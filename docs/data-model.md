# Data model

> **TL;DR** — A float `rowIndex` makes inserts and reorders renumber-free, JSONB cells let new columns skip migrations, cached `rowCount` / `nextRowIndex` counters avoid full-table scans, and a materialized `ViewRowRank` table turns a jump into a saved sorted view into an index lookup.

Everything else is downstream of a few schema decisions. The next docs ([query engine](./query-engine.md), [reading](./reading-at-scale.md), [writing](./writing-at-scale.md)) build directly on each choice made here.

The schema lives in [`prisma/schema.prisma`](../prisma/schema.prisma). The core entities are `Base` > `Table` > (`Column`, `View`, `Row`), plus `ViewRowRank` for materialized sorts and the standard NextAuth tables for accounts and sessions.

## Row ordering is a float

Each row stores a floating-point `rowIndex`, not an integer position:

```prisma
model Row {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tableId    String   @db.Uuid
  rowIndex   Float
  cells      Json     @default("{}")
  searchText String   @default("")
  // ...
  @@index([tableId, rowIndex])
}
```

Order is defined by `ORDER BY rowIndex`, and the first rows get values like `1, 2, 3`. The point of using a float is inserts and reorders. To put a row between positions 2 and 3, you give it `2.5`. Between 2 and 2.5 you give it `2.25`. No other row changes.

With integer positions, inserting above row 500,000 means incrementing the position of every row below it. With a float, an insert or drag-reorder writes exactly one row. The midpoint math and its edge cases are covered in [writing at scale](./writing-at-scale.md).

Doubles give about 52 bits of mantissa, which is enough for a very large number of midpoint inserts in the same gap before precision runs out. The write path detects that case and re-spaces the affected rows.

## Cells are JSONB, keyed by column id

A row's data is a single JSONB object, not one database column per spreadsheet column:

```jsonc
// Row.cells
{
  "0f9c…": "Acme Corp",     // a TEXT column, keyed by Column.id
  "7b21…": 42               // a NUMBER column
}
```

`Column` is its own table (id, name, type, `position`) — it describes columns without changing `Row`'s shape. The trade-offs:

- Adding a column is an `INSERT` into `Column`. No `ALTER TABLE`, no migration, no lock on a million-row table. New cells simply read as empty until written.
- Deleting a column drops its key from the JSON. A backfill clears the key from existing rows in batches.
- Querying a cell goes through a JSON path (`cells->>'colId'`), so filtering and sorting need expression indexes on those paths. That is the cost of the flexibility, and the [query engine](./query-engine.md) and the index section below handle it.

`Column.type` (`TEXT` or `NUMBER`) drives how values are validated on write and how they are cast in SQL on read, so a NUMBER column sorts numerically rather than as a string.

## A denormalized search column

Each row keeps a `searchText` string — the lowercased concatenation of all text cell values, maintained on every write — so search runs against one column instead of walking the JSON. The write path is responsible for keeping it in sync. The indexing history (and why a trigram index was removed) is in the [query engine](./query-engine.md).

## Counters cached on the table

`Table` stores two values that could be derived but are expensive to derive at scale:

```prisma
model Table {
  rowCount     Int   @default(0)  // number of rows
  nextRowIndex Float @default(1)  // next rowIndex to hand out for an append
  // ...
}
```

- `rowCount` avoids a `COUNT(*)` over the whole table on every read. The client needs the total to size the scrollbar, and the read path needs it to decide which jump strategy to use.
- `nextRowIndex` makes an append O(1): hand out the value, then increment it. No `MAX(rowIndex)` scan.

Both are updated inside the same transaction as the writes that change them. They are cached aggregates, so the write path reconciles them after bulk operations and deletes to keep them honest. Details are in [writing at scale](./writing-at-scale.md).

## Materialized sort ranks: `ViewRowRank`

A `View` is a saved configuration: its filters, its sort, its search term. The hard part of a saved sorted view is jumping into the middle of it. "Show me row 800,000 in this sort" has no natural cursor to start a keyset scan from.

`ViewRowRank` precomputes the answer. For a given view it stores, for each row, that row's position in the sorted order:

```prisma
model ViewRowRank {
  viewId String @db.Uuid
  rowId  String @db.Uuid
  rank   Int                 // 0-based position in this view's sort order
  @@id([viewId, rowId])
  @@index([viewId, rank])
}
```

With this table, a jump to rank 800,000 is an index lookup on `(viewId, rank)`, not a sort of the whole table. The rank is materialized state, so it is recomputed when the view's sort changes or its row set changes, under an advisory lock so two requests cannot compute it twice. That machinery is in [writing at scale](./writing-at-scale.md), and how reads choose to use it is in [reading at scale](./reading-at-scale.md).

## Computed cell values

Some cell values are derived rather than stored. `getCellValue` resolves them at read time on the client, evaluating from the row's other values. This prevents derived data from going stale in the JSON and is why the client always reads cells through a single resolver.

## Index layout

Because cells are JSON, the indexes that make reads fast are expression indexes on JSON paths, not plain column indexes. The set:

| Index | Shape | Used by |
| --- | --- | --- |
| Row base order | `(tableId, rowIndex)` | The default unsorted read and every keyset scan |
| Search | `(tableId, searchText)` | Database-level search after the trigram index was removed |
| Per-column sort (on demand) | `(tableId, NULLIF(cells->>'colId',''))`, often `INCLUDE (id)` | Sorting and filtering on a specific column |

The per-column indexes are the interesting ones:

- They are partial expression indexes. `NULLIF(cells->>'colId','')` indexes the JSON path and treats empty strings as `NULL`, so blank cells stay out of the index and it stays small.
- They are covering where it helps. `INCLUDE (id)` lets a sorted keyset page be served from the index alone (an index-only scan), so the row heap is only touched for the rows actually returned.
- They are created on demand. The system does not pre-build an index for every column. When a sort or filter first needs one, `ensureSortIndex` builds it; unused ones are dropped. See [writing at scale](./writing-at-scale.md) and [`src/server/db/ensureColumnIndexes.ts`](../src/server/db/ensureColumnIndexes.ts).

Two Postgres extensions are enabled in the migrations: `pgcrypto` for `gen_random_uuid()` (UUID primary keys generated in the database) and `pg_trgm` (added for search, later removed from the active index path for write performance, kept available).

