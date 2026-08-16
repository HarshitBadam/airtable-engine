## Latency benchmark results

Server-side query latency measured with `EXPLAIN (ANALYZE, BUFFERS)` — pure
Postgres execution time for the exact SQL each read procedure runs, so the
numbers reflect the query strategy rather than network or render time.
Reads: median (p95) of 15 runs after 2 discarded warmups, warm cache,
`ANALYZE` run after seeding. Writes: wall clock. Jumps target the middle of the table.

### Reads

| Operation | 1K rows | 100K rows | 1M rows |
| --- | --- | --- | --- |
| Scroll one page (keyset) | 0.2 ms (p95 0.3 ms) | 0.3 ms (p95 0.3 ms) | 0.2 ms (p95 0.3 ms) |
| Jump to middle, unsorted (Tier 1) | 0.2 ms (p95 0.2 ms) | 0.3 ms (p95 0.3 ms) | 0.2 ms (p95 0.3 ms) |
| Jump into a saved sorted view (Tier 2) | 1.2 ms (p95 1.6 ms) | 1.0 ms (p95 1.4 ms) | 1.2 ms (p95 1.6 ms) |
| Jump, ad-hoc sort, no anchor (Tier 3) | 5.3 ms (p95 6.2 ms) | 20.7 ms (p95 22.9 ms) | 3569 ms (p95 6723 ms) |
| Jump, ad-hoc sort, cursor anchor (Tier 3) | 3.4 ms (p95 4.0 ms) | 179 ms (p95 182 ms) | 48.9 ms (p95 104 ms) |
| Jump into a filtered view (Tier 3, cursor anchor) | 0.2 ms (p95 0.3 ms) | 4.8 ms (p95 5.8 ms) | 76.9 ms (p95 101 ms) |
| Search, first page of matches | 0.7 ms (p95 0.8 ms) | 14.8 ms (p95 16.4 ms) | 15.3 ms (p95 21.7 ms) |
| Naive OFFSET to middle (baseline) | 0.2 ms (p95 0.2 ms) | 7.5 ms (p95 8.7 ms) | 103 ms (p95 111 ms) |

### Writes

| Operation | 1K rows | 100K rows | 1M rows |
| --- | --- | --- | --- |
| Duplicate one row (midpoint insert) | 2.0 ms | 1.4 ms | 1.4 ms |
| Duplicate a field (backfill all rows) | 24.8 ms | 6567 ms | 106.7 s |
| Bulk insert 200K rows | 13.5 s | 9679 ms | 13.3 s |

### One-time costs

| Operation | 1K rows | 100K rows | 1M rows |
| --- | --- | --- | --- |
| Seed table (bulk insert, total) | 233 ms | 2229 ms | 25.1 s |
| One-time: build sort index (Name) | 5791 ms | 5351 ms | 9953 ms |
| One-time: compute view ranks | 37.3 ms | 1302 ms | 16.8 s |

_Measured on Apple M2, 8 GB RAM · PostgreSQL 17.7 · generated 2026-08-16 via `npx tsx scripts/benchmarks/latency-benchmark.ts`._
