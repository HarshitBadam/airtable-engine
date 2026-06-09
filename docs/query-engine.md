# Query engine

> **TL;DR** — Filter/sort/search SQL is hand-built because Prisma can't express keyset cursors or expression-index predicates. It stays injection-safe with parameterized values and validated identifiers, and is shaped to match the on-demand expression indexes so every read hits an index instead of a sequential scan.

Prisma can't express the keyset cursors, expression-index predicates, and planner rewrites the read path needs, so filter/sort/search SQL is built by hand in [`src/server/sql/`](../src/server/sql/) and run through `$queryRawUnsafe`. This doc covers how that SQL is generated and kept safe. How the read procedures assemble it is in [reading at scale](./reading-at-scale.md).

These builders are the most unit-tested part of the codebase ([`src/server/sql/__tests__/`](../src/server/sql/__tests__/)), because a bug here produces a wrong result set rather than a crash.

## Injection model

Raw SQL means injection is the first thing to get right. Two rules, both in [`escape.ts`](../src/server/sql/escape.ts):

- **Values are always parameters.** Every user value is pushed onto a `params` array and referenced as `$1`, `$2`, and so on. They are never interpolated into the SQL string.
- **Identifiers are validated, then escaped.** Column ids appear inside the JSON path text (`cells->>'<colId>'`), which cannot be a bind parameter. Callers must validate that every `columnId` belongs to the target table before building SQL, and `escapeLiteral` doubles any single quotes as a backstop.

`LIKE` patterns get a third step: `escapeLikePattern` escapes `%`, `_`, and `\` so a search for `50%` does not turn into a wildcard, paired with `ESCAPE '\'` in the query.

## Sorting against one index in two directions

A sort compiles to an `ORDER BY` over a JSON-path expression, with empty cells treated as NULL so they match the partial index:

```sql
-- TEXT
ORDER BY (NULLIF("Row"."cells" ->> 'colId', '')) ASC NULLS FIRST, "Row"."rowIndex" ASC
-- NUMBER (cast so 10 sorts after 9)
ORDER BY (NULLIF("Row"."cells" ->> 'colId', '')::double precision) ASC NULLS FIRST, ...
```

Two details do real work:

- **`rowIndex` is the tie-breaker.** Rows with equal sort values fall back to `rowIndex`, so the order is fully deterministic. Without it, keyset pagination on a non-unique column would skip or repeat rows at page boundaries.
- **One index serves both directions.** The tie-breaker direction follows the first sort key's direction, which matches the shape of the index built for that column (`expr ASC NULLS FIRST, rowIndex ASC`). An `ASC` view is a forward scan of that index; a `DESC` view is a backward scan of the same index. One index covers both, so the on-demand indexing in [writing at scale](./writing-at-scale.md) builds half as many.

NULL ordering follows Airtable's convention: empty is the smallest value, so `ASC` puts blanks first (`NULLS FIRST`) and `DESC` sinks them to the end (`NULLS LAST`). `buildMultiSortOrderByReversed` produces the exact mirror of an order-by, which the search path uses to find the last match by scanning backward.

## Keyset cursors for multi-sort

Pagination never uses `OFFSET`. It uses a keyset cursor: the sort values plus the `rowIndex` of the last row on the previous page. The next page is "everything ordered after this point," which is a range scan rather than a scan-and-discard.

For a multi-column sort, "after this point" is lexicographic, so `buildMultiSortCursorSql` emits the standard expanding-OR predicate. For a sort on `(A, B)`:

```sql
(A > cursorA)
OR (A = cursorA AND B > cursorB)
OR (A = cursorA AND B = cursorB AND rowIndex > cursorRowIndex)
```

NULLs make this fiddly, since "after a NULL" depends on direction. The builder handles each case explicitly: in `ASC NULLS FIRST`, "after NULL" is `expr IS NOT NULL`; in `DESC NULLS LAST`, nothing comes after a NULL, so that branch is skipped.

One planner problem remains. Postgres will not use a B-tree index condition for a large OR predicate, so the cursor predicate alone can fall back to a sequential scan on deep jumps. The fix is to prepend a plain range bound on the first sort key:

```sql
AND (NULLIF(cells->>'colId','')) >= $cursorA   -- index-friendly hint
AND ( ...the full OR predicate above... )       -- exact correctness
```

The range bound is an index-usable lower bound that lets Postgres seek into the index, and the full OR predicate keeps the result exactly correct. This is what keeps a deep sorted jump fast instead of degrading into a scan. `buildMultiSortBeforeCursorSql` is the mirror image for scanning backward.

## Filtering

Filters compile through the same JSON-path expression, so they hit the same per-column expression indexes:

```sql
NULLIF("Row"."cells" ->> 'colId', '')
```

Operators map to SQL with care around empties and types:

| Operator | SQL | Notes |
| --- | --- | --- |
| `equals` / `not_equals` | `= $n` / `IS NULL OR <> $n` | `not_equals` includes empty cells, matching spreadsheet intuition |
| `contains` / `not_contains` | `ILIKE $n ESCAPE '\'` | case-insensitive; pattern is escaped |
| `is_empty` / `is_not_empty` | `IS NULL` / `IS NOT NULL` | empty string and missing key are the same thing |
| `gt` / `lt` / `gte` / `lte` | `::double precision <op> $n` | numeric compare, so 10 is greater than 9 |

`buildFilterSql` handles a flat list joined by `AND`/`OR`. `buildFilterTreeSql` walks a nested `FilterTree` (groups within groups, mixed conjunctions), recursing and dropping no-op conditions (an empty `contains`, for example) so the planner never sees dead predicates.

`detectOrEqualsPattern` spots an OR of equalities on one column — a pattern that makes Postgres choose a `BitmapOr`, losing `rowIndex` order and forcing a re-sort. The read path rewrites those as a `UNION ALL` of per-value index scans for a `Merge Append` with no re-sort. The rewrite is in [reading at scale](./reading-at-scale.md).

## Search

Search filters rows whose denormalized `searchText` (see [data model](./data-model.md)) contains the term. It runs as a predicate on every read, and there is a dedicated procedure to count matches and jump between them ([reading at scale](./reading-at-scale.md)).

An earlier version used a `pg_trgm` GIN index on `searchText` to accelerate substring matching. It made reads faster, but a trigram GIN index is expensive to maintain: every insert and cell edit had to update it, dragging down the bulk-insert and edit paths this project optimizes hard for. The trigram index was removed in favor of a plain B-tree on `(tableId, searchText)`. The `pg_trgm` extension is still enabled should read patterns shift. The migration history in [`prisma/migrations/`](../prisma/migrations/) shows the addition and removal.

## On-demand indexing

Indexes aren't pre-created for every column — that would waste space and slow writes on columns nobody sorts or filters. When a query first needs one, `ensureSortIndex` creates it; unused ones are dropped. The mechanism and lifecycle are in [`src/server/db/ensureColumnIndexes.ts`](../src/server/db/ensureColumnIndexes.ts) and [writing at scale](./writing-at-scale.md). The builders are written to match the exact index shape (`NULLIF(...)`, optional `::double precision`, `INCLUDE (id)`), which is why the expressions look the way they do.
