# Reading at scale

> **TL;DR** — Reads never use raw `OFFSET`. `windowFetch` picks one of three tiers — `rowIndex` interpolation for plain tables, `ViewRowRank` lookups for saved sorts, and a deferred-join plus cursor-anchor path for filters and search — so cost scales with window size, not scroll depth.

The requirement is that any read stays sub-second at any scale: scrolling page by page or jumping to row 800,000, on a plain, filtered, sorted, or searched view. This doc assumes the [data model](./data-model.md) and the [query engine](./query-engine.md).

There are two read procedures. `infinite` ([`infiniteProcedure.ts`](../src/server/api/routers/row/infiniteProcedure.ts)) serves contiguous forward scrolling with keyset cursors. `windowFetch` ([`windowFetchProcedure.ts`](../src/server/api/routers/row/windowFetchProcedure.ts)) serves a window at an arbitrary offset, which is what a scrollbar jump produces. `windowFetch` is the hard one, and it picks one of three strategies based on the view.

## Why not OFFSET

`OFFSET 800000 LIMIT 100` makes Postgres walk and discard 800,000 rows: cost grows linearly with depth. Every strategy below replaces that with something bounded by window size, not offset.

## Tier 1: unsorted, unfiltered tables

For a plain table, position maps almost directly to `rowIndex`. Bulk inserts produce near-sequential values and midpoint inserts keep them densely packed in `[min, max]`, so the target `rowIndex` for offset N can be estimated by linear interpolation:

```
estimated = min + offset * (max - min) / (rowCount - 1)
```

`min` and `max` are two B-tree edge lookups, `rowCount` is already cached on `Table`, and the seek itself is an index range scan:

```sql
SELECT ... FROM "Row"
WHERE "tableId" = $1 AND "rowIndex" >= $estimated
ORDER BY "rowIndex" ASC
LIMIT $limit
```

The whole jump is O(log N). The estimate only needs to land close; the range scan returns a full window from there.

## Tier 2: saved sorted views, via materialized ranks

For a saved view with a sort and no filters or search, the answer is precomputed in `ViewRowRank` (see [data model](./data-model.md)). Each row already has a `rank` for that view, so "give me offset N" is a range on rank:

```sql
SELECT r.* FROM "ViewRowRank" vrr
JOIN "Row" r ON r."id" = vrr."rowId"
WHERE vrr."viewId" = $1 AND vrr."rank" BETWEEN $start AND $end
ORDER BY vrr."rank" ASC
```

This is an index lookup on `(viewId, rank)`, so a jump to rank 800,000 costs the same as a jump to rank 5. Before using it, the path checks two things: the view's ranks are not marked stale, and the target rank actually exists in the ranked zone (a single-row probe). If either fails, it falls through to Tier 3.

Tier 2 deliberately handles sort-only views. Adding a filter would mean joining every ranked row back to check the predicate, which is more expensive than Tier 3's "filter to a smaller set, then sort that." So filtered or searched views skip straight to Tier 3.

## Tier 3: temporary sorts, filters, and search

This is the general path: an ad-hoc sort the user just applied, a filtered or searched view, or a sorted view whose ranks are stale. It uses `OFFSET`, but with three things layered on top to keep it fast.

**Deferred join.** The inner subquery selects only `id`, sorts that, applies `LIMIT`/`OFFSET`, and only then joins back to `Row` for the final window:

```sql
SELECT r.* FROM (
  SELECT "Row"."id" FROM "Row"
  <where>
  ORDER BY <sort>
  LIMIT $limit OFFSET $offset
) sub
JOIN "Row" r ON r."id" = sub."id"
ORDER BY <sort>
```

The sort buffer holds `(sort_key, id)` instead of full `cells` JSONB, staying small and avoiding spills; TOAST decompression of the JSON only happens for rows actually returned. When the sort is on an indexed column, the inner query runs as an index-only scan (`INCLUDE (id)`), barely touching the heap until the final join.

**Cursor anchors.** The client caches keyset cursors at known offsets as it scrolls. When it jumps, it sends the nearest anchor before the target. The server adds a keyset predicate to skip everything up to the anchor, so the `OFFSET` only covers the remaining distance:

```
jump to 500,000 with an anchor at 480,000  →  effective OFFSET = 20,000
```

A 500,000-row jump turns into a 20,000-row one. With sorts, the anchor is a multi-sort keyset predicate; without, it is a simple `rowIndex > anchor` bound. The anchor only ever helps, since it is validated to sit before the target and the deferred join stays correct without it.

**The `UNION ALL` rewrite.** When the filter is an OR of equalities on one column with no sort or search (`detectOrEqualsPattern`), the naive plan is a `BitmapOr` that loses `rowIndex` order and re-sorts every match. The query is rewritten as one index scan per value:

```sql
SELECT r.* FROM (
  SELECT "id" FROM (
    (SELECT id, rowIndex FROM "Row" WHERE tableId=$1 AND col=$A ORDER BY rowIndex ASC LIMIT $n)
    UNION ALL
    (SELECT id, rowIndex FROM "Row" WHERE tableId=$1 AND col=$B ORDER BY rowIndex ASC LIMIT $n)
  ) u
  ORDER BY u."rowIndex" ASC
  LIMIT $limit OFFSET $offset
) sub
JOIN "Row" r ON r."id" = sub."id"
ORDER BY r."rowIndex" ASC
```

Each branch is already ordered by `rowIndex` from the composite index, so Postgres does a `Merge Append`: it pulls from the pre-sorted streams lazily and stops once it has `offset + limit` rows, with no full sort. This path runs through `queryNoBitmap`, which disables bitmap scans for the statement so the planner commits to the per-value index scans (measured 4 to 5 times faster than the bitmap plan on large offsets).

## Skipping the count

Every window fetch needs a total to size the scrollbar. `COUNT(*)` over a filtered set is expensive, and it doesn't change between jumps in the same view. The client passes `skipCount` with the `knownTotal` it already has; the server returns it untouched. When the count does need to run, it and the data query go concurrently with `Promise.all`.

## Finding and jumping to search matches

Search needs more than filtering: the user expects "next match"/"previous match" to jump the viewport to a row that may be far outside the loaded window. [`searchProcedures.ts`](../src/server/api/routers/row/searchProcedures.ts) handles this without loading matches into the client. Given the current position, it finds the next or previous matching row using a keyset predicate (and `buildMultiSortOrderByReversed` for backward), returning a single row id and offset that the client feeds into `windowFetch`. The cost is bounded by the index, not by match count or distance.

## Why these procedures are long

`windowFetchProcedure.ts` is ~420 lines and intentionally not split. All three tiers share the same validation, filter/sort builders, count-skip logic, and cursor construction; splitting would scatter that context and obscure the tier-selection logic. Validation and on-demand index creation live in `rowQueryHelpers.ts` (see [writing at scale](./writing-at-scale.md)).
