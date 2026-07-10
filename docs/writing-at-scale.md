# Writing at scale

The write path maintains the values used by the read path: `rowIndex`, `rowCount`, `nextRowIndex`, `searchText`, and saved view ranks.

| Operation | Immediate work | Follow-up state |
| --- | --- | --- |
| Insert or reorder | Write one midpoint `rowIndex` | Update table counters |
| Edit a cell | Update one JSONB object | Rebuild that row's `searchText` |
| Bulk add | Insert generated rows in chunks | Advance counters per completed chunk |
| Duplicate a field | Create the field | Backfill its JSON key in batches |
| Save a sort | Keep the view config | Build `ViewRowRank` under a lock |

## Inserts and reorders

An append atomically claims `Table.nextRowIndex`. An insert above or below an existing row uses the midpoint between its neighbors. Dragging a row uses the same midpoint calculation.

```text
before: 2.0, 3.0
insert: 2.5
```

The neighbor read and write happen in one transaction. `rowCount` is updated with the row, and `nextRowIndex` never moves backwards when a row is inserted in the middle.

Floats have finite precision. The current mutation does not rebalance a gap that can no longer produce a distinct midpoint; the unique `(tableId, rowIndex)` constraint rejects the collision. Local re-spacing is a known missing edge-case path.

## Cell edits

[`updateCell`](../src/server/api/routers/row/cellMutations.ts) validates the field type, updates the JSONB value, and rebuilds the row's `searchText`. Keeping those changes together prevents search from lagging behind the visible cell.

Client updates are optimistic, but the database remains authoritative. A failed mutation restores the previous client value.

## Bulk insert

`row.addMany` accepts at most 100,000 rows per call. It reserves a range of `rowIndex` values, then inserts generated sample rows with PostgreSQL `generate_series`.

```sql
INSERT INTO "Row" (...)
SELECT ...
FROM generate_series(0, $batchSize - 1)
```

The work is split into batches rather than one large statement. `nextRowIndex` is reserved before insertion so concurrent writers receive different ranges; `rowCount` advances only for batches that finish. The batch-size benchmark in [`batch-benchmark.ts`](../batch-benchmark.ts) was used to choose the current chunk size.

## Saved sort ranks

`row.computeViewRanks` rebuilds the `ViewRowRank` entries for a saved sort.

1. The view is marked stale.
2. A transaction takes a PostgreSQL advisory lock for that view.
3. Old ranks are deleted and new ranks are inserted with `ROW_NUMBER()`.
4. After that transaction commits, the view is marked fresh.

The lock prevents two rebuilds from interleaving. If the transaction fails, readers continue through the general query path instead of seeing a partial rank set.

New rows can exist outside the last rank build. Infinite scrolling returns those rows after the ranked section, while a positional jump can fall back to the general path. The next rank computation folds them into the saved order.

## Permanent sort

`row.applyPermanentSort` is a separate operation that rewrites `rowIndex` itself. It first assigns negative values in sorted order, then flips them positive. The temporary negative range avoids unique-key collisions with rows that have not moved yet.

This is a full-table write with a 120-second transaction timeout. The normal UI uses saved ranks instead; permanent sort remains available at the API layer.

## Column duplication

Duplicating a field creates its `Column` immediately with a temporary `sourceColumnId`. Reads can resolve the source value while [`column.backfill`](../src/server/api/routers/column/columnBackfill.ts) copies values into the new JSON key in batches. The source marker is cleared when the backfill completes.

## Concurrency checks

- Row deletion is idempotent and decrements `rowCount` only when a row was removed.
- Rank rebuilds are serialized per view.
- Sort-index creation tolerates two requests racing to create the same index.
- Bulk paths reconcile cached counters after partial work.

[`stress-test.ts`](../stress-test.ts) exercises concurrent writes and checks row totals, duplicate ids, and rank consistency. Run it with the development server already running:

```bash
npx tsx stress-test.ts
```
