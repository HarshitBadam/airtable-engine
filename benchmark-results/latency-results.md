## Latency benchmark results

These results use `EXPLAIN (ANALYZE, BUFFERS)` on the exact SQL run by each
read procedure. They measure PostgreSQL execution time and exclude network and
rendering work. Reads report the median and p95 of 15 warm-cache runs after two
discarded warmups. `ANALYZE` ran after seeding. Writes use wall-clock time.
Jumps target the middle of the table.

### Reads

| Operation                                 | 1K rows             | 100K rows             | 1M rows               |
| ----------------------------------------- | ------------------- | --------------------- | --------------------- |
| Scroll one page (keyset)                  | 0.2 ms (p95 0.2 ms) | 0.2 ms (p95 0.4 ms)   | 0.2 ms (p95 0.2 ms)   |
| Jump to middle, unsorted (Tier 1)         | 0.2 ms (p95 0.2 ms) | 0.2 ms (p95 0.5 ms)   | 0.2 ms (p95 0.2 ms)   |
| Jump into a saved sorted view (Tier 2)    | 0.9 ms (p95 1.1 ms) | 1.0 ms (p95 1.3 ms)   | 1.1 ms (p95 1.5 ms)   |
| Jump, ad-hoc sort, no anchor (Tier 3)     | 4.6 ms (p95 5.6 ms) | 113 ms (p95 177 ms)   | 1224 ms (p95 1325 ms) |
| Jump, ad-hoc sort, cursor anchor (Tier 3) | 3.3 ms (p95 3.5 ms) | 177 ms (p95 181 ms)   | 60.6 ms (p95 123 ms)  |
| Jump into a filtered view (Tier 3)        | 0.2 ms (p95 0.2 ms) | 6.1 ms (p95 6.8 ms)   | 145 ms (p95 1321 ms)  |
| Search, first page of matches             | 0.8 ms (p95 0.9 ms) | 14.5 ms (p95 15.2 ms) | 15.7 ms (p95 16.2 ms) |
| Naive OFFSET to middle (baseline)         | 0.2 ms (p95 0.4 ms) | 7.1 ms (p95 8.2 ms)   | 102 ms (p95 109 ms)   |

### Writes

| Operation                             | 1K rows | 100K rows | 1M rows |
| ------------------------------------- | ------- | --------- | ------- |
| Duplicate one row (midpoint insert)   | 1.7 ms  | 2.4 ms    | 3.7 ms  |
| Duplicate a field (backfill all rows) | 21.8 ms | 4406 ms   | 82.0 s  |
| Bulk insert 200K rows                 | 4282 ms | 5685 ms   | 9781 ms |

### One-time costs

| Operation                         | 1K rows | 100K rows | 1M rows |
| --------------------------------- | ------- | --------- | ------- |
| Seed table (bulk insert, total)   | 38.8 ms | 1158 ms   | 13.9 s  |
| One-time: build sort index (Name) | 1217 ms | 1057 ms   | 4906 ms |
| One-time: compute view ranks      | 24.3 ms | 1168 ms   | 14.8 s  |

_Measured on an Apple M2, 8 GB RAM, PostgreSQL 17.7 (local), generated 2026-06-11 via `npx tsx latency-benchmark.ts`._
