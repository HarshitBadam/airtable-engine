/**
 * Latency Benchmark: server-side query latency for the README performance table.
 *
 * Measures the exact SQL the read procedures run (mirrored from
 * windowFetchProcedure.ts / infiniteProcedure.ts / rowMutations.ts /
 * addManyProcedure.ts / columnBackfill.ts) using EXPLAIN (ANALYZE, BUFFERS),
 * so the numbers are pure Postgres execution time — no network, no tRPC,
 * no serialization. This isolates the query strategy from the hosting stack.
 *
 * Per table size (default 1K / 100K / 1M):
 *   Reads (2 warmups discarded, then N measured runs → median + p95):
 *     - Scroll one page          infinite keyset (rowIndex > cursor)
 *     - Tier 1 jump              MIN/MAX interpolation + B-tree seek
 *     - Tier 2 jump              ViewRowRank probe + rank BETWEEN join
 *     - Tier 3 sorted jump       deferred join, with and without cursor anchor
 *     - Tier 3 filtered jump     equals filter + deferred join
 *     - Search first page        searchText ILIKE, rowIndex order
 *     - Naive OFFSET baseline    what the tiers replace
 *   Writes (wall clock):
 *     - Duplicate one row        midpoint insert (median of N runs)
 *     - Duplicate a field        batched JSONB backfill over all rows
 *     - Bulk insert 200K rows    generate_series batches (same as addMany)
 *   One-time costs (wall clock):
 *     - Seed throughput, sort-index build, view-rank computation
 *
 * At the largest size it also runs an offset sweep (Tier 1/2/3 + naive
 * OFFSET at depths 0 → ~1M) and writes a CSV for charting.
 *
 * Output: console + benchmark-results/latency-results.md + offset-sweep.csv
 *
 * Usage (run from the repository root so benchmark-results/ resolves correctly):
 *   npx tsx scripts/benchmarks/latency-benchmark.ts                  # full run (1K, 100K, 1M)
 *   npx tsx scripts/benchmarks/latency-benchmark.ts --sizes 1000     # smoke test
 *   npx tsx scripts/benchmarks/latency-benchmark.ts --runs 30        # more samples per op
 *   npx tsx scripts/benchmarks/latency-benchmark.ts --keep           # skip cleanup
 */

import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import { PrismaClient } from "../../generated/prisma/index.js";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    sizes: (get("--sizes") ?? "1000,100000,1000000").split(",").map(Number),
    runs: Number(get("--runs") ?? 15),
    keep: args.includes("--keep"),
  };
}

const { sizes: SIZES, runs: RUNS, keep: KEEP } = parseArgs();
const WARMUPS = 2;
const PAGE_LIMIT = 1000; // production default for infinite/windowFetch
const INSERT_BATCH = 10_000; // matches addManyProcedure.ts
const BULK_INSERT_COUNT = 200_000;
const BACKFILL_BATCH = 50_000; // matches columnBackfill.ts

const ROW_SELECT = `"id", "rowIndex", "cells", "createdAt", "updatedAt"`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SqlParam = string | number;
type Query = { sql: string; params: SqlParam[] };
type Stat = { median: number; p95: number; runs: number };

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

function stats(samples: number[]): Stat {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    median: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    runs: samples.length,
  };
}

function fmtMs(ms: number): string {
  if (ms >= 10_000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms >= 100) return `${Math.round(ms)} ms`;
  return `${ms.toFixed(1)} ms`;
}

function escapeLiteral(s: string): string {
  return s.replace(/'/g, "''");
}

/** Run EXPLAIN (ANALYZE, BUFFERS) and return Postgres "Execution Time" in ms. */
async function explainMs(q: Query): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(
    `EXPLAIN (ANALYZE, BUFFERS) ${q.sql}`,
    ...q.params,
  );
  for (const r of rows) {
    const m = /Execution Time: ([\d.]+) ms/.exec(r["QUERY PLAN"]);
    if (m) return parseFloat(m[1]!);
  }
  throw new Error("Could not parse Execution Time from EXPLAIN output");
}

/**
 * Benchmark one logical operation made of one or more queries (e.g. Tier 1 =
 * MIN/MAX lookup + range scan). Per run, the reported sample is the SUM of
 * the constituent queries' execution times.
 */
async function bench(label: string, queries: Query[]): Promise<Stat> {
  for (let w = 0; w < WARMUPS; w++) {
    for (const q of queries) await prisma.$queryRawUnsafe(q.sql, ...q.params);
  }
  const samples: number[] = [];
  for (let r = 0; r < RUNS; r++) {
    let total = 0;
    for (const q of queries) total += await explainMs(q);
    samples.push(total);
  }
  const s = stats(samples);
  console.log(
    `    ${label.padEnd(46)} median ${fmtMs(s.median).padStart(9)}   p95 ${fmtMs(s.p95).padStart(9)}`,
  );
  return s;
}

async function wallClock<T>(
  fn: () => Promise<T>,
): Promise<{ ms: number; result: T }> {
  const t0 = performance.now();
  const result = await fn();
  return { ms: performance.now() - t0, result };
}

// ---------------------------------------------------------------------------
// Seeding (mirrors addManyProcedure.ts generate_series batches)
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "Garnet",
  "Valentine",
  "Moses",
  "Lavinia",
  "Carley",
  "Anderson",
  "Sammie",
  "Lea",
  "Melissa",
  "Akeem",
  "Waino",
  "Riley",
  "Coy",
  "Cheyenne",
  "Christelle",
  "Elliott",
  "Judson",
  "Hollie",
  "Einar",
  "Leopoldo",
  "Brody",
  "Eladio",
  "Frederic",
  "Jacky",
  "Ozella",
  "Cody",
  "Jordane",
  "Larry",
  "Alyce",
]; // 29 (prime)

const LAST_NAMES = [
  "Lang",
  "Franey",
  "Roob",
  "Blick",
  "Crooks",
  "Schowalter",
  "Swaniawski",
  "Dibbert",
  "Lindgren",
  "Tremblay",
  "Brown",
  "Keebler",
  "Stoltenberg",
  "Langosh",
  "Fadel",
  "Hauck",
  "Hand",
  "Prosacco",
  "Witting",
  "Graham",
  "Monahan",
  "Bechtelar",
  "Upton",
]; // 23 (prime)

const PHRASES = [
  "Decentralized demand-driven knowledge base",
  "Reactive national database",
  "User-friendly real-time knowledge user",
  "Polarised heuristic core",
  "Grass-roots regional access",
  "Cross-platform analyzing algorithm",
  "Sustainable optimal infrastructure",
  "Compatible immersive infrastructure",
  "Digitized high-level functionalities",
  "Polarised modular alliance",
  "Immersive mobile instruction set",
  "Sustainable national capability",
  "Business-focused motivating adapter",
  "Persistent value-added network",
  "Implemented motivating hub",
  "Organic value-added framework",
  "Seamless executive task-force",
]; // 17 (prime)

const STATUSES = ["Todo", "In progress", "In review", "Done", "Blocked"]; // 5

function sqlArrayPick(arr: string[], idxExpr: string): string {
  const escaped = arr.map((s) => `'${escapeLiteral(s)}'`).join(",");
  return `(ARRAY[${escaped}])[1 + ((${idxExpr}) % ${arr.length})]`;
}

interface BenchTable {
  baseId: string;
  tableId: string;
  viewId: string;
  cols: { name: Col; notes: Col; status: Col; amount: Col };
}
interface Col {
  id: string;
  type: "TEXT" | "NUMBER";
}

async function createBenchTable(
  userId: string,
  label: string,
): Promise<BenchTable> {
  const base = await prisma.base.create({
    data: {
      name: `Latency Bench ${label}`,
      ownerId: userId,
      tables: {
        create: {
          name: "Bench",
          rowCount: 0,
          nextRowIndex: 1,
          nextColumnOrder: 5,
          columns: {
            create: [
              { name: "Name", type: "TEXT", order: 1 },
              { name: "Notes", type: "TEXT", order: 2 },
              { name: "Status", type: "TEXT", order: 3 },
              { name: "Amount", type: "NUMBER", order: 4 },
            ],
          },
        },
      },
    },
    include: { tables: { include: { columns: true } } },
  });
  const table = base.tables[0]!;
  const byName = (n: string) => {
    const c = table.columns.find((c) => c.name === n)!;
    return { id: c.id, type: c.type } as Col;
  };
  const cols = {
    name: byName("Name"),
    notes: byName("Notes"),
    status: byName("Status"),
    amount: byName("Amount"),
  };

  const view = await prisma.view.create({
    data: {
      tableId: table.id,
      name: "Grid view",
      config: {
        search: "",
        filters: [],
        filterConjunction: "and",
        sorts: [],
        permanentSorts: [],
        autoSort: true,
        hiddenColumnIds: [],
        columnOrderIds: table.columns.map((c) => c.id),
        rowOrderIds: [],
        rowHeightPreset: "short",
        wrapHeaders: false,
      },
    },
  });

  return { baseId: base.id, tableId: table.id, viewId: view.id, cols };
}

/** Same INSERT shape as addMany: generate_series, jsonb_build_object, searchText. */
async function insertRows(
  t: BenchTable,
  startIndex: number,
  count: number,
): Promise<void> {
  for (let offset = 0; offset < count; offset += INSERT_BATCH) {
    const batchCount = Math.min(INSERT_BATCH, count - offset);
    const batchStart = startIndex + offset;
    const idx = `(${batchStart} + gs)`;

    const nameExpr = `${sqlArrayPick(FIRST_NAMES, idx)} || ' ' || ${sqlArrayPick(LAST_NAMES, `${idx} * 7 + 3`)}`;
    const notesExpr = sqlArrayPick(PHRASES, `${idx} * 3 + 1`);
    const statusExpr = sqlArrayPick(STATUSES, idx);
    const amountExpr = idx;

    const cellsExpr =
      `jsonb_build_object(` +
      `'${escapeLiteral(t.cols.name.id)}', ${nameExpr}, ` +
      `'${escapeLiteral(t.cols.notes.id)}', ${notesExpr}, ` +
      `'${escapeLiteral(t.cols.status.id)}', ${statusExpr}, ` +
      `'${escapeLiteral(t.cols.amount.id)}', ${amountExpr})`;
    const searchExpr = [
      nameExpr,
      notesExpr,
      statusExpr,
      `${amountExpr}::text`,
    ].join(` || chr(31) || `);

    await prisma.$executeRawUnsafe(`
      INSERT INTO "Row" ("tableId", "rowIndex", "cells", "searchText", "createdAt", "updatedAt")
      SELECT '${escapeLiteral(t.tableId)}', ${batchStart} + gs, ${cellsExpr}, ${searchExpr}, now(), now()
      FROM generate_series(0, ${batchCount - 1}) AS gs
    `);
  }
}

async function syncCounters(tableId: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
    `SELECT COUNT(*)::int AS cnt FROM "Row" WHERE "tableId" = $1`,
    tableId,
  );
  const cnt = rows[0]?.cnt ?? 0;
  const maxRows = await prisma.$queryRawUnsafe<{ mx: number | null }[]>(
    `SELECT MAX("rowIndex")::float8 AS mx FROM "Row" WHERE "tableId" = $1`,
    tableId,
  );
  const mx = maxRows[0]?.mx ?? null;
  await prisma.table.update({
    where: { id: tableId },
    data: { rowCount: cnt, nextRowIndex: Math.ceil(mx ?? 0) + 1 },
  });
  return cnt;
}

// ---------------------------------------------------------------------------
// Production SQL mirrors
// ---------------------------------------------------------------------------

const sortExpr = (colId: string, alias = `"Row"`) =>
  `(NULLIF(${alias}."cells" ->> '${escapeLiteral(colId)}', ''))`;

/** Same as ensureSortIndex (ensureColumnIndexes.ts). */
async function createSortIndex(tableId: string, colId: string): Promise<void> {
  const indexName = `ri_${tableId.slice(0, 8)}_${colId}_s`;
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "${indexName}"
    ON "Row" ((NULLIF(cells->>'${escapeLiteral(colId)}','')) ASC NULLS FIRST, "rowIndex" ASC)
    INCLUDE ("id")
    WHERE "tableId" = '${escapeLiteral(tableId)}'
  `);
}

/** Same as computeViewRanks (sortProcedures.ts), sorted by Name ASC. */
async function computeRanks(t: BenchTable): Promise<void> {
  const v = escapeLiteral(t.viewId);
  await prisma.$executeRawUnsafe(
    `DELETE FROM "ViewRowRank" WHERE "viewId" = '${v}'`,
  );
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ViewRowRank" ("viewId", "rank", "rowId")
    SELECT '${v}', ROW_NUMBER() OVER (ORDER BY ${sortExpr(t.cols.name.id, "r")} ASC NULLS FIRST, r."rowIndex" ASC)::int, r."id"
    FROM "Row" r WHERE r."tableId" = '${escapeLiteral(t.tableId)}'
  `);
  await prisma.view.update({
    where: { id: t.viewId },
    data: { ranksStale: false },
  });
}

// --- Read-path query builders (each returns the constituent queries) -------

/** infinite, no sort/filter (infiniteProcedure.ts Tier-less fast path). */
function qScrollPage(t: BenchTable, cursorRowIndex: number): Query[] {
  return [
    {
      sql: `SELECT "Row"."id", "Row"."rowIndex", "Row"."cells", "Row"."createdAt", "Row"."updatedAt"
          FROM "Row"
          WHERE "Row"."tableId" = $1 AND "Row"."rowIndex" > $2
          ORDER BY "Row"."rowIndex" ASC
          LIMIT $3`,
      params: [t.tableId, cursorRowIndex, PAGE_LIMIT + 1],
    },
  ];
}

/** windowFetch Tier 1: MIN/MAX edge lookups + interpolated seek. */
function qTier1(t: BenchTable, offset: number, rowCount: number): Query[] {
  // estimated = min + offset * (max - min) / (rowCount - 1). The estimate is
  // JS arithmetic; the DB cost is the two queries. Seeded rowIndex is 1..N,
  // so min=1, max=N and the interpolation collapses to exactly 1 + offset.
  const estimated = rowCount <= 1 ? 1 : 1 + offset;
  return [
    {
      sql: `SELECT MIN("rowIndex") AS min_idx, MAX("rowIndex") AS max_idx FROM "Row" WHERE "tableId" = $1`,
      params: [t.tableId],
    },
    {
      sql: `SELECT ${ROW_SELECT} FROM "Row"
            WHERE "tableId" = $1 AND "rowIndex" >= $2
            ORDER BY "rowIndex" ASC LIMIT $3`,
      params: [t.tableId, estimated, PAGE_LIMIT],
    },
  ];
}

/** windowFetch Tier 2: rank probe + rank BETWEEN join. */
function qTier2(t: BenchTable, offset: number): Query[] {
  const targetRank = offset + 1;
  return [
    {
      sql: `SELECT "rank" FROM "ViewRowRank" WHERE "viewId" = $1 AND "rank" = $2 LIMIT 1`,
      params: [t.viewId, targetRank],
    },
    {
      sql: `SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
            FROM "ViewRowRank" vrr
            JOIN "Row" r ON r."id" = vrr."rowId"
            WHERE vrr."viewId" = $1 AND vrr."rank" BETWEEN $2 AND $3
            ORDER BY vrr."rank" ASC`,
      params: [t.viewId, targetRank, targetRank + PAGE_LIMIT - 1],
    },
  ];
}

/** windowFetch Tier 3, ad-hoc sort on Name ASC, deferred join, no anchor. */
function qTier3Sorted(t: BenchTable, offset: number): Query[] {
  const e = sortExpr(t.cols.name.id);
  const er = sortExpr(t.cols.name.id, "r");
  return [
    {
      sql: `SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
          FROM (
            SELECT "Row"."id" FROM "Row"
            WHERE "Row"."tableId" = $1
            ORDER BY ${e} ASC NULLS FIRST, "Row"."rowIndex" ASC
            LIMIT $2 OFFSET $3
          ) sub
          JOIN "Row" r ON r."id" = sub."id"
          ORDER BY ${er} ASC NULLS FIRST, r."rowIndex" ASC`,
      params: [t.tableId, PAGE_LIMIT, offset],
    },
  ];
}

/** Tier 3 sorted with a cursor anchor (buildMultiSortCursorSql, single ASC sort). */
function qTier3SortedAnchored(
  t: BenchTable,
  offset: number,
  anchor: { offset: number; sortValue: string; rowIndex: number },
): Query[] {
  const e = sortExpr(t.cols.name.id);
  const er = sortExpr(t.cols.name.id, "r");
  const effectiveOffset = offset - anchor.offset;
  return [
    {
      sql: `SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
          FROM (
            SELECT "Row"."id" FROM "Row"
            WHERE "Row"."tableId" = $1
              AND ${e} >= $2
              AND ( (${e} > $3) OR ((${e} = $4) AND ("Row"."rowIndex" > $5)) )
            ORDER BY ${e} ASC NULLS FIRST, "Row"."rowIndex" ASC
            LIMIT $6 OFFSET $7
          ) sub
          JOIN "Row" r ON r."id" = sub."id"
          ORDER BY ${er} ASC NULLS FIRST, r."rowIndex" ASC`,
      params: [
        t.tableId,
        anchor.sortValue,
        anchor.sortValue,
        anchor.sortValue,
        anchor.rowIndex,
        PAGE_LIMIT,
        effectiveOffset,
      ],
    },
  ];
}

/** windowFetch Tier 3, equals filter on Status, rowIndex order, deferred join. */
function qTier3Filtered(t: BenchTable, offset: number): Query[] {
  const e = sortExpr(t.cols.status.id);
  return [
    {
      sql: `SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
          FROM (
            SELECT "Row"."id" FROM "Row"
            WHERE "Row"."tableId" = $1 AND (${e} = $2)
            ORDER BY "Row"."rowIndex" ASC
            LIMIT $3 OFFSET $4
          ) sub
          JOIN "Row" r ON r."id" = sub."id"
          ORDER BY r."rowIndex" ASC`,
      params: [t.tableId, "Done", PAGE_LIMIT, offset],
    },
  ];
}

function qTier3FilteredAnchored(
  t: BenchTable,
  offset: number,
  anchor: { offset: number; rowIndex: number },
): Query[] {
  const expression = sortExpr(t.cols.status.id);
  return [
    {
      sql: `SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
            FROM (
              SELECT "Row"."id" FROM "Row"
              WHERE "Row"."tableId" = $1
                AND (${expression} = $2)
                AND "Row"."rowIndex" > $3
              ORDER BY "Row"."rowIndex" ASC
              LIMIT $4 OFFSET $5
            ) sub
            JOIN "Row" r ON r."id" = sub."id"
            ORDER BY r."rowIndex" ASC`,
      params: [
        t.tableId,
        "Done",
        anchor.rowIndex,
        PAGE_LIMIT,
        offset - anchor.offset,
      ],
    },
  ];
}

/** Search first page (searchText ILIKE, rowIndex order — buildBaseWhere). */
function qSearch(t: BenchTable, term: string): Query[] {
  return [
    {
      sql: `SELECT "Row"."id", "Row"."rowIndex", "Row"."cells", "Row"."createdAt", "Row"."updatedAt"
          FROM "Row"
          WHERE "Row"."tableId" = $1 AND "Row"."searchText" ILIKE $2 ESCAPE '\\' AND "Row"."rowIndex" > $3
          ORDER BY "Row"."rowIndex" ASC
          LIMIT $4`,
      params: [t.tableId, `%${term}%`, 0, PAGE_LIMIT + 1],
    },
  ];
}

/** The naive baseline every tier replaces. */
function qNaiveOffset(t: BenchTable, offset: number): Query[] {
  return [
    {
      sql: `SELECT ${ROW_SELECT} FROM "Row"
          WHERE "tableId" = $1 ORDER BY "rowIndex" ASC
          LIMIT $2 OFFSET $3`,
      params: [t.tableId, PAGE_LIMIT, offset],
    },
  ];
}

// --- Write-path mirrors -----------------------------------------------------

/** duplicateAt (rowMutations.ts): neighbour lookup + midpoint insert + counter. */
async function duplicateOneRow(
  t: BenchTable,
  midRowIndex: number,
): Promise<number> {
  const { ms } = await wallClock(async () => {
    const src = await prisma.$queryRawUnsafe<
      { id: string; rowIndex: number; cells: unknown; searchText: string }[]
    >(
      `SELECT "id", "rowIndex", "cells", "searchText" FROM "Row"
       WHERE "tableId" = $1 AND "rowIndex" >= $2 ORDER BY "rowIndex" ASC LIMIT 1`,
      t.tableId,
      midRowIndex,
    );
    const source = src[0]!;
    await prisma.$transaction(async (tx) => {
      const nextRes = await tx.$queryRawUnsafe<{ nxt: number | null }[]>(
        `SELECT MIN("rowIndex")::float8 AS nxt FROM "Row" WHERE "tableId" = $1 AND "rowIndex" > $2`,
        t.tableId,
        source.rowIndex,
      );
      const nxt = nextRes[0]?.nxt;
      const insertIndex =
        nxt != null ? (source.rowIndex + nxt) / 2 : source.rowIndex + 1;
      await tx.row.create({
        data: {
          tableId: t.tableId,
          rowIndex: insertIndex,
          cells: (source.cells ?? {}) as object,
          searchText: source.searchText ?? "",
        },
      });
      await tx.$executeRawUnsafe(
        `UPDATE "Table" SET "rowCount" = "rowCount" + 1, "nextRowIndex" = GREATEST("nextRowIndex", $1) WHERE "id" = $2`,
        Math.ceil(insertIndex) + 1,
        t.tableId,
      );
    });
  });
  return ms;
}

/** column.backfill (columnBackfill.ts): batched JSONB copy of Name → new column. */
async function duplicateField(t: BenchTable): Promise<number> {
  const newCol = await prisma.column.create({
    data: {
      tableId: t.tableId,
      name: "Name copy",
      type: "TEXT",
      order: 90 + Math.floor(Math.random() * 1000),
      sourceColumnId: t.cols.name.id,
    },
  });
  const tId = escapeLiteral(t.tableId);
  const srcId = escapeLiteral(t.cols.name.id);
  const newId = escapeLiteral(newCol.id);

  const { ms } = await wallClock(async () => {
    let batchStart = 0;
    while (true) {
      const affected = await prisma.$executeRawUnsafe(`
        UPDATE "Row"
        SET "cells" = jsonb_build_object('${newId}', "cells" -> '${srcId}') || "cells"
        WHERE "tableId" = '${tId}'
          AND "cells" ? '${srcId}'
          AND "rowIndex" >= ${batchStart}
          AND "rowIndex" < ${batchStart + BACKFILL_BATCH}
      `);
      if (affected === 0) break;
      batchStart += BACKFILL_BATCH;
    }
    await prisma.column.update({
      where: { id: newCol.id },
      data: { sourceColumnId: null },
    });
  });
  return ms;
}

// ---------------------------------------------------------------------------
// Result collection
// ---------------------------------------------------------------------------

interface SizeResults {
  size: number;
  reads: Record<string, Stat>;
  writes: Record<string, number>; // wall-clock ms
  oneTime: Record<string, number>; // wall-clock ms
}

const READ_LABELS: Record<string, string> = {
  scrollPage: "Scroll one page (keyset)",
  tier1: "Jump to middle, unsorted (Tier 1)",
  tier2: "Jump into a saved sorted view (Tier 2)",
  tier3Sorted: "Jump, ad-hoc sort, no anchor (Tier 3)",
  tier3Anchored: "Jump, ad-hoc sort, cursor anchor (Tier 3)",
  tier3Filtered: "Jump into a filtered view (Tier 3, cursor anchor)",
  search: "Search, first page of matches",
  naiveOffset: "Naive OFFSET to middle (baseline)",
};

const WRITE_LABELS: Record<string, string> = {
  duplicateRow: "Duplicate one row (midpoint insert)",
  duplicateField: "Duplicate a field (backfill all rows)",
  bulkInsert200k: `Bulk insert ${BULK_INSERT_COUNT / 1000}K rows`,
};

const ONETIME_LABELS: Record<string, string> = {
  seed: "Seed table (bulk insert, total)",
  sortIndex: "One-time: build sort index (Name)",
  ranks: "One-time: compute view ranks",
};

// ---------------------------------------------------------------------------
// Per-size run
// ---------------------------------------------------------------------------

async function runSize(
  userId: string,
  size: number,
  isLargest: boolean,
): Promise<{ results: SizeResults; sweepCsv: string | null }> {
  const label = size >= 1_000_000 ? `${size / 1_000_000}M` : `${size / 1000}K`;
  console.log(
    `\n${"=".repeat(72)}\n  TABLE SIZE: ${size.toLocaleString()} rows\n${"=".repeat(72)}`,
  );

  const t = await createBenchTable(userId, label);
  const results: SizeResults = { size, reads: {}, writes: {}, oneTime: {} };
  let sweepCsv: string | null = null;

  try {
    // -- Seed -----------------------------------------------------------------
    process.stdout.write(`  Seeding ${size.toLocaleString()} rows ... `);
    const seed = await wallClock(() => insertRows(t, 1, size));
    results.oneTime.seed = seed.ms;
    console.log(
      `${fmtMs(seed.ms)} (${Math.round(size / (seed.ms / 1000)).toLocaleString()} rows/s)`,
    );
    const rowCount = await syncCounters(t.tableId);
    await prisma.$executeRawUnsafe(`ANALYZE "Row"`);
    await prisma.$executeRawUnsafe(`ANALYZE "ViewRowRank"`);

    // -- One-time costs ---------------------------------------------------------
    const idx = await wallClock(async () => {
      await createSortIndex(t.tableId, t.cols.name.id);
      await createSortIndex(t.tableId, t.cols.status.id);
    });
    results.oneTime.sortIndex = idx.ms;
    console.log(`  Sort/filter index build: ${fmtMs(idx.ms)}`);

    const ranks = await wallClock(() => computeRanks(t));
    results.oneTime.ranks = ranks.ms;
    console.log(`  View rank computation:   ${fmtMs(ranks.ms)}`);
    await prisma.$executeRawUnsafe(`ANALYZE "ViewRowRank"`);

    // -- Reads ------------------------------------------------------------------
    console.log(
      `\n  Read latency (server-side execution time, ${RUNS} runs after ${WARMUPS} warmups):`,
    );
    const mid = Math.floor(rowCount / 2);

    results.reads.scrollPage = await bench(
      READ_LABELS.scrollPage!,
      qScrollPage(t, mid),
    );
    results.reads.tier1 = await bench(
      READ_LABELS.tier1!,
      qTier1(t, mid, rowCount),
    );
    results.reads.tier2 = await bench(READ_LABELS.tier2!, qTier2(t, mid));
    results.reads.tier3Sorted = await bench(
      READ_LABELS.tier3Sorted!,
      qTier3Sorted(t, mid),
    );

    // Anchor 20K rows before the target (or halfway for small tables) — fetch
    // the anchor row's sort value once, exactly like the client's cursor cache.
    const anchorOffset = Math.max(
      0,
      mid - Math.min(20_000, Math.floor(mid / 2)),
    );
    const anchorRow = await prisma.$queryRawUnsafe<
      { id: string; rowIndex: number; cells: Record<string, unknown> }[]
    >(
      `SELECT r."id", r."rowIndex", r."cells" FROM (
         SELECT "Row"."id" FROM "Row" WHERE "Row"."tableId" = $1
         ORDER BY ${sortExpr(t.cols.name.id)} ASC NULLS FIRST, "Row"."rowIndex" ASC
         LIMIT 1 OFFSET $2
       ) sub JOIN "Row" r ON r."id" = sub."id"`,
      t.tableId,
      Math.max(0, anchorOffset - 1),
    );
    const a = anchorRow[0]!;
    const anchor = {
      offset: anchorOffset,
      sortValue: String(a.cells[t.cols.name.id] ?? ""),
      rowIndex: a.rowIndex,
    };
    results.reads.tier3Anchored = await bench(
      `${READ_LABELS.tier3Anchored!} (Δ=${(mid - anchorOffset).toLocaleString()})`,
      qTier3SortedAnchored(t, mid, anchor),
    );

    const filteredMid = Math.floor(rowCount / 5 / 2);
    const filteredAnchorOffset = Math.max(
      0,
      filteredMid - Math.min(20_000, Math.floor(filteredMid / 2)),
    );
    const [filteredAnchorRow] = await prisma.$queryRawUnsafe<
      { rowIndex: number }[]
    >(
      `SELECT "Row"."rowIndex"
       FROM "Row"
       WHERE "Row"."tableId" = $1
         AND ${sortExpr(t.cols.status.id)} = $2
       ORDER BY "Row"."rowIndex" ASC
       LIMIT 1 OFFSET $3`,
      t.tableId,
      "Done",
      Math.max(0, filteredAnchorOffset - 1),
    );
    const filteredAnchor = {
      offset: filteredAnchorOffset,
      rowIndex: filteredAnchorRow!.rowIndex,
    };
    results.reads.tier3Filtered = await bench(
      `${READ_LABELS.tier3Filtered!} (Δ=${(filteredMid - filteredAnchorOffset).toLocaleString()})`,
      qTier3FilteredAnchored(t, filteredMid, filteredAnchor),
    );
    results.reads.search = await bench(
      READ_LABELS.search!,
      qSearch(t, "Garnet"),
    );
    results.reads.naiveOffset = await bench(
      READ_LABELS.naiveOffset!,
      qNaiveOffset(t, mid),
    );

    // -- Offset sweep (largest size only) ----------------------------------------
    if (isLargest && rowCount >= 100_000) {
      console.log(`\n  Offset sweep (median of 5 runs per point):`);
      const offsets = [
        0,
        1_000,
        10_000,
        50_000,
        100_000,
        250_000,
        500_000,
        750_000,
        rowCount - PAGE_LIMIT,
      ]
        .filter((o) => o >= 0 && o <= rowCount - 1)
        .filter((o, i, arr) => arr.indexOf(o) === i);
      const paths: [string, (o: number) => Query[]][] = [
        ["naive_offset", (o) => qNaiveOffset(t, o)],
        ["tier1_rowindex_seek", (o) => qTier1(t, o, rowCount)],
        ["tier2_viewrowrank", (o) => qTier2(t, o)],
        ["tier3_sorted_deferred_join", (o) => qTier3Sorted(t, o)],
      ];
      const lines = ["offset,path,median_ms"];
      const measureSweepQueries = async (queries: Query[]) => {
        for (const query of queries) {
          await prisma.$queryRawUnsafe(query.sql, ...query.params);
        }
        const samples: number[] = [];
        for (let run = 0; run < 5; run++) {
          let total = 0;
          for (const query of queries) total += await explainMs(query);
          samples.push(total);
        }
        return stats(samples).median;
      };
      for (const [name, build] of paths) {
        const medians: string[] = [];
        for (const o of offsets) {
          const med = await measureSweepQueries(build(o));
          lines.push(`${o},${name},${med.toFixed(2)}`);
          medians.push(`${o / 1000}K=${fmtMs(med)}`);
        }
        console.log(`    ${name.padEnd(28)} ${medians.join("  ")}`);
      }

      const filteredCount = Math.floor(rowCount / 5);
      const filteredOffsets = [
        0,
        1_000,
        10_000,
        50_000,
        100_000,
        filteredCount - PAGE_LIMIT,
      ]
        .filter((offset) => offset >= 0 && offset < filteredCount)
        .filter((offset, index, all) => all.indexOf(offset) === index);
      const filteredMedians: string[] = [];
      for (const offset of filteredOffsets) {
        let queries = qTier3Filtered(t, offset);
        if (offset > 0) {
          const anchorOffset = Math.max(
            0,
            offset - Math.min(20_000, Math.floor(offset / 2)),
          );
          const [anchorRow] = await prisma.$queryRawUnsafe<
            { rowIndex: number }[]
          >(
            `SELECT "Row"."rowIndex"
             FROM "Row"
             WHERE "Row"."tableId" = $1
               AND ${sortExpr(t.cols.status.id)} = $2
             ORDER BY "Row"."rowIndex" ASC
             LIMIT 1 OFFSET $3`,
            t.tableId,
            "Done",
            Math.max(0, anchorOffset - 1),
          );
          queries = qTier3FilteredAnchored(t, offset, {
            offset: anchorOffset,
            rowIndex: anchorRow!.rowIndex,
          });
        }
        const median = await measureSweepQueries(queries);
        lines.push(`${offset},tier3_filtered_anchor,${median.toFixed(2)}`);
        filteredMedians.push(`${offset / 1000}K=${fmtMs(median)}`);
      }
      console.log(
        `    ${"tier3_filtered_anchor".padEnd(28)} ${filteredMedians.join("  ")}`,
      );
      sweepCsv = lines.join("\n") + "\n";
    }

    // -- Writes -------------------------------------------------------------------
    console.log(`\n  Write latency (wall clock):`);

    const dupSamples: number[] = [];
    for (let i = 0; i < Math.min(RUNS, 10); i++) {
      dupSamples.push(await duplicateOneRow(t, mid));
    }
    const dupStat = stats(dupSamples);
    results.writes.duplicateRow = dupStat.median;
    console.log(
      `    ${WRITE_LABELS.duplicateRow!.padEnd(46)} median ${fmtMs(dupStat.median).padStart(9)}   p95 ${fmtMs(dupStat.p95).padStart(9)}`,
    );

    const backfill = await wallClock(() => duplicateField(t));
    results.writes.duplicateField = backfill.ms;
    console.log(
      `    ${WRITE_LABELS.duplicateField!.padEnd(46)} ${fmtMs(backfill.ms).padStart(9)}`,
    );

    const nriRows = await prisma.$queryRawUnsafe<{ nri: number }[]>(
      `SELECT "nextRowIndex"::float8 AS nri FROM "Table" WHERE "id" = $1`,
      t.tableId,
    );
    const nri = nriRows[0]?.nri ?? 0;
    const bulk = await wallClock(() =>
      insertRows(t, Math.ceil(nri), BULK_INSERT_COUNT),
    );
    results.writes.bulkInsert200k = bulk.ms;
    console.log(
      `    ${WRITE_LABELS.bulkInsert200k!.padEnd(46)} ${fmtMs(bulk.ms).padStart(9)}   (${Math.round(BULK_INSERT_COUNT / (bulk.ms / 1000)).toLocaleString()} rows/s)`,
    );
  } finally {
    if (!KEEP) {
      const indexes = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'Row' AND indexname LIKE $1`,
        `ri_${t.tableId.slice(0, 8)}_%`,
      );
      for (const i of indexes) {
        await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${i.indexname}"`);
      }
      await prisma.base.delete({ where: { id: t.baseId } });
      console.log(`\n  Cleaned up (base + ${indexes.length} indexes dropped)`);
    } else {
      console.log(`\n  Kept bench data (--keep): base ${t.baseId}`);
    }
  }

  return { results, sweepCsv };
}

// ---------------------------------------------------------------------------
// Markdown output
// ---------------------------------------------------------------------------

function sizeLabel(n: number): string {
  return n >= 1_000_000 ? `${n / 1_000_000}M rows` : `${n / 1000}K rows`;
}

function buildMarkdown(all: SizeResults[], pgVersion: string): string {
  const header = `| Operation | ${all.map((r) => sizeLabel(r.size)).join(" | ")} |`;
  const sep = `| --- | ${all.map(() => "---").join(" | ")} |`;

  const readRows = Object.keys(READ_LABELS).map((key) => {
    const cells = all.map((r) => {
      const s = r.reads[key];
      return s ? `${fmtMs(s.median)} (p95 ${fmtMs(s.p95)})` : "—";
    });
    return `| ${READ_LABELS[key]} | ${cells.join(" | ")} |`;
  });

  const writeRows = Object.keys(WRITE_LABELS).map((key) => {
    const cells = all.map((r) => {
      const ms = r.writes[key];
      return ms !== undefined ? fmtMs(ms) : "—";
    });
    return `| ${WRITE_LABELS[key]} | ${cells.join(" | ")} |`;
  });

  const oneTimeRows = Object.keys(ONETIME_LABELS).map((key) => {
    const cells = all.map((r) => {
      const ms = r.oneTime[key];
      return ms !== undefined ? fmtMs(ms) : "—";
    });
    return `| ${ONETIME_LABELS[key]} | ${cells.join(" | ")} |`;
  });

  const cpu = os.cpus()[0]?.model ?? "unknown CPU";
  const ram = Math.round(os.totalmem() / 1024 ** 3);

  return [
    `## Latency benchmark results`,
    ``,
    `Server-side query latency measured with \`EXPLAIN (ANALYZE, BUFFERS)\` — pure`,
    `Postgres execution time for the exact SQL each read procedure runs, so the`,
    `numbers reflect the query strategy rather than network or render time.`,
    `Reads: median (p95) of ${RUNS} runs after ${WARMUPS} discarded warmups, warm cache,`,
    `\`ANALYZE\` run after seeding. Writes: wall clock. Jumps target the middle of the table.`,
    ``,
    `### Reads`,
    ``,
    header,
    sep,
    ...readRows,
    ``,
    `### Writes`,
    ``,
    header,
    sep,
    ...writeRows,
    ``,
    `### One-time costs`,
    ``,
    header,
    sep,
    ...oneTimeRows,
    ``,
    `_Measured on ${cpu}, ${ram} GB RAM · ${pgVersion} · generated ${new Date().toISOString().slice(0, 10)} via \`npx tsx scripts/benchmarks/latency-benchmark.ts\`._`,
    ``,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(
    "\n╔══════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║        LYRA AIRTABLE — SERVER-SIDE QUERY LATENCY BENCHMARK        ║",
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════════╝",
  );

  const verRows =
    await prisma.$queryRawUnsafe<{ version: string }[]>(`SELECT version()`);
  const version = verRows[0]?.version ?? "unknown";
  const pgVersion = /PostgreSQL [\d.]+/.exec(version)?.[0] ?? version;
  console.log(`  ${pgVersion}`);
  console.log(
    `  Sizes: ${SIZES.map((s) => s.toLocaleString()).join(", ")} · Runs/op: ${RUNS} · Warmups: ${WARMUPS}`,
  );

  let user = await prisma.user.findFirst({
    where: { email: "stress-test@lyra.local" },
  });
  user ??= await prisma.user.create({
    data: { email: "stress-test@lyra.local", name: "Bench User" },
  });

  const all: SizeResults[] = [];
  let sweepCsv: string | null = null;
  const largest = Math.max(...SIZES);

  for (const size of SIZES) {
    const { results, sweepCsv: csv } = await runSize(
      user.id,
      size,
      size === largest,
    );
    all.push(results);
    if (csv) sweepCsv = csv;
  }

  const md = buildMarkdown(all, pgVersion);
  mkdirSync("benchmark-results", { recursive: true });
  writeFileSync("benchmark-results/latency-results.md", md);
  if (sweepCsv) writeFileSync("benchmark-results/offset-sweep.csv", sweepCsv);

  console.log(
    `\n${"=".repeat(72)}\n  RESULTS (paste-ready markdown)\n${"=".repeat(72)}\n`,
  );
  console.log(md);
  console.log(
    `  Written to benchmark-results/latency-results.md${sweepCsv ? " and offset-sweep.csv" : ""}\n`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
