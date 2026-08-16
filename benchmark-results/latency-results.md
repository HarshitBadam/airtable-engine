## Latency benchmark results

Server-side query latency measured with `EXPLAIN (ANALYZE, BUFFERS)` — pure
Postgres execution time for the exact SQL each read procedure runs, so the
numbers reflect the query strategy rather than network or render time.
Reads: median (p95) of 15 runs after 2 discarded warmups, warm cache,
`ANALYZE` run after seeding. Writes: wall clock. Jumps target the middle of the table.

### Reads

| Operation | 1K rows | 100K rows | 1M rows |
| --- | --- | --- | --- |
| Scroll one page (keyset) | 0.2 ms (p95 0.2 ms) | 0.2 ms (p95 0.2 ms) | 0.6 ms (p95 0.9 ms) |
| Jump to middle, unsorted (Tier 1) | 0.2 ms (p95 0.2 ms) | 0.2 ms (p95 0.2 ms) | 0.7 ms (p95 1.2 ms) |
| Jump into a saved sorted view (Tier 2) | 1.1 ms (p95 1.2 ms) | 1.2 ms (p95 2.0 ms) | 2.0 ms (p95 3.5 ms) |
| Jump, ad-hoc sort, no anchor (Tier 3) | 4.7 ms (p95 4.9 ms) | 112 ms (p95 119 ms) | 1333 ms (p95 2217 ms) |
| Jump, ad-hoc sort, cursor anchor (Tier 3) | 3.1 ms (p95 3.4 ms) | 178 ms (p95 180 ms) | 51.0 ms (p95 137 ms) |
| Jump into a filtered view (Tier 3) | 0.2 ms (p95 0.2 ms) | 5.1 ms (p95 6.2 ms) | 145 ms (p95 172 ms) |
| Search, first page of matches | 0.7 ms (p95 0.7 ms) | 14.7 ms (p95 14.9 ms) | 14.5 ms (p95 16.4 ms) |
| Naive OFFSET to middle (baseline) | 0.2 ms (p95 0.2 ms) | 6.4 ms (p95 7.2 ms) | 99.8 ms (p95 101 ms) |

### Writes

| Operation | 1K rows | 100K rows | 1M rows |
| --- | --- | --- | --- |
| Duplicate one row (midpoint insert) | 1.9 ms | 2.2 ms | 1.9 ms |
| Duplicate a field (backfill all rows) | 22.8 ms | 2387 ms | 99.8 s |
| Bulk insert 200K rows | 6789 ms | 6543 ms | 15.1 s |

### One-time costs

| Operation | 1K rows | 100K rows | 1M rows |
| --- | --- | --- | --- |
| Seed table (bulk insert, total) | 358 ms | 1199 ms | 18.6 s |
| One-time: build sort index (Name) | 1494 ms | 600 ms | 6424 ms |
| One-time: compute view ranks | 31.1 ms | 1342 ms | 19.1 s |

_Measured on Apple M2, 8 GB RAM · PostgreSQL 17.7 · generated 2026-08-16 via `npx tsx scripts/benchmarks/latency-benchmark.ts`._
