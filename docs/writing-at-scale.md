# Writing at scale

> **TL;DR** — Inserts and reorders touch a single row via float midpoints, bulk loads push 200K rows into batched `generate_series` SQL, applying a sort rewrites `rowIndex` in a collision-free two-phase pass, and view-rank computation is serialized per view with an advisory lock so concurrent requests can't corrupt it.

The write path keeps the data shaped for fast reads: ordering that never renumbers, counters that stay accurate, bulk loads that finish in a serverless timeout, and materialized ranks that stay consistent under concurrent requests. This doc builds on the [data model](./data-model.md).

## Inserts and reorders touch one row

Because order is a float (see [data model](./data-model.md)), placing a row anywhere is a midpoint calculation, not a renumber. `insertAt` ([`rowMutations.ts`](../src/server/api/routers/row/rowMutations.ts)) has three cases:

- **Append.** Claim the next slot from the cached counter atomically and use it:

  ```sql
  UPDATE "Table" SET "nextRowIndex" = "nextRowIndex" + 1
  WHERE "id" = $1
  RETURNING "nextRowIndex" - 1 AS idx
  ```

  The `UPDATE` takes a row lock, so two concurrent appends can never claim the same slot. No `MAX(rowIndex)` scan.

- **Insert above.** Find the row just before the target and use the midpoint: `new = (prev + atIndex) / 2`.
- **Insert below.** Find the row just after and use `new = (atIndex + next) / 2`.

Reorder is the same midpoint logic at the drop position. Neighbor lookups and the update run in one transaction, so a concurrent reorder cannot place a row at a wrong midpoint.

Every insert also bumps the table counters in the same transaction, with a guard so a midpoint insert below the current high-water mark never walks the append counter backward:

```sql
UPDATE "Table"
SET "rowCount" = "rowCount" + 1,
    "nextRowIndex" = GREATEST("nextRowIndex", $1)
WHERE "id" = $2
```

Float precision has a floor. After enough midpoint inserts into the same gap, two neighbors get too close to split. The write path detects that and re-spaces the affected region. In normal use it effectively never triggers, because inserts spread across the table rather than hammering one gap.

## Cell edits keep `searchText` honest

`updateCell` validates the value, writes it into `cells`, and rebuilds `searchText` in the same statement — the single place responsible for keeping search in sync (see [data model](./data-model.md)). Values join with a separator so adjacent fields can't accidentally form a false match.

## Bulk inserts: 200K rows in batched SQL

`addMany` ([`cellMutations.ts`](../src/server/api/routers/row/cellMutations.ts)) inserts up to 200,000 rows by pushing the work into SQL with `generate_series`:

```sql
INSERT INTO "Row" ("tableId", "rowIndex", "cells", "searchText", "createdAt", "updatedAt")
SELECT '<tableId>', <batchStart> + gs, <cells expr>, <searchText expr>, now(), now()
FROM generate_series(0, <batchCount - 1>) AS gs
```

`rowIndex` is `batchStart + gs` (sequential, which is what Tier 1 estimation expects); sample cell values come from pools cycled with prime-modulo indexing so combinations don't repeat quickly. No row data crosses the wire.

Three details make it robust at this size:

- **Batched in chunks of 10,000.** One giant statement risks a statement timeout and holds locks too long. Chunking keeps each statement bounded and lets progress survive.
- **Counters move in the right order.** `nextRowIndex` is reserved up front so concurrent writers get non-overlapping slots, but `rowCount` increments only after batches succeed. A failed batch cannot leave `rowCount` higher than the real row count.
- **Failure compensates.** If a batch throws, the procedure rolls `nextRowIndex` back by the number of rows that were not inserted, so the counters stay consistent with reality.

The optimal batch size was not guessed. [`batch-benchmark.ts`](../batch-benchmark.ts) sweeps batch sizes against insertion throughput to pick it.

## Permanent sort: a two-phase rewrite

Applying a sort permanently rewrites every `rowIndex` to match the sorted order, making it the table's natural order so later reads need no sort. The problem is in-place assignment can collide with values about to be reassigned. `applyPermanentSort` ([`sortProcedures.ts`](../src/server/api/routers/row/sortProcedures.ts)) sidesteps that with two passes:

```sql
-- Phase 1: write the new order as NEGATIVE values (cannot collide with existing positives)
UPDATE "Row" SET "rowIndex" = -(rn::float8)
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY <sort>) AS rn FROM "Row" WHERE ...) subq
WHERE "Row"."id" = subq."id";

-- Phase 2: flip them positive → final range 1..N
UPDATE "Row" SET "rowIndex" = -"rowIndex" WHERE "tableId" = ... AND "rowIndex" < 0;
```

Writing negatives first guarantees no intermediate state collides with a value still in use. The transaction has a long timeout (120s) because it is two full-table updates, and it resets `nextRowIndex` to `rowCount + 1` so future appends land after the rewritten range.

## Computing view ranks safely

`computeViewRanks` fills `ViewRowRank` for a saved view (enabling Tier 2 reads). It deletes old ranks then inserts `ROW_NUMBER() OVER (ORDER BY <sort>)`. Two concurrent requests could interleave and violate uniqueness, so it is serialized per view:

- The view is marked `ranksStale` first, so concurrent reads stay on Tier 3 and never read half-built ranks.
- The delete and insert run inside a transaction holding a `pg_advisory_xact_lock` keyed on the view id. A second caller blocks until the first commits, then runs cleanly with no `ON CONFLICT` needed.
- On success the view is marked fresh. On failure it stays stale, so the system degrades to Tier 3 instead of serving wrong ranks.

Row inserts, duplicates, and reorders deliberately do not mark ranks stale: a new row has no rank entry, shows in the unranked tail on scroll, and falls to Tier 3 on a jump. Ranks recompute when the view is next loaded, keeping the common write path cheap.

## Instant field duplication with async backfill

Column duplication creates the `Column` immediately so the UI updates right away, then backfills the new key into every row's JSON in batches in the background ([`columnBackfill.ts`](../src/server/api/routers/column/)). Unbackfilled rows read as empty — a valid state — so the user is never blocked on a full-table write.

## Concurrency, idempotency, and the performance harness

The write path assumes requests race, because in a real grid they do.

- **Idempotent deletes.** `deleteRow` uses `deleteMany`, which returns `count: 0` if the row is already gone (double-click, concurrent delete) instead of throwing Prisma's "record not found." `rowCount` is only decremented when a row was actually removed, and the row's `ViewRowRank` entries are cleared in the same transaction.
- **On-demand indexing is race-safe.** `ensureSortIndex` ([`ensureColumnIndexes.ts`](../src/server/db/ensureColumnIndexes.ts)) checks for the index before creating it; if two requests both try, Postgres's duplicate-index error is caught and ignored. Indexes for unused columns are dropped, and all column indexes are cleaned up on table or base deletion.
- **Counters self-heal.** Because `rowCount` and `nextRowIndex` are cached aggregates, the bulk and delete paths reconcile them after the fact rather than trusting that nothing ever drifted.

[`stress-test.ts`](../stress-test.ts) (`npx tsx`) exercises all of this: concurrent inserts and deletes, `rowCount` vs real count, rank consistency, no lost or duplicated rows under contention. It is the evidence these patterns hold up, not just look correct.
