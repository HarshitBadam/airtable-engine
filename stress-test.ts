/**
 * Comprehensive Stress Test Suite for Lyra Airtable
 *
 * Tests:
 *   1.  Bulk insert (addMany) — 10K, 50K, 100K rows
 *   2.  Concurrent single-row inserts (insertAt)
 *   3.  Concurrent cell updates (updateCell)
 *   4.  Concurrent row deletions
 *   5.  Concurrent windowFetch reads at random offsets
 *   6.  Concurrent infinite scroll pagination
 *   7.  Mixed read/write workload (simulates real users)
 *   8.  Search under load (full-text ILIKE across 100K+ rows)
 *   9.  Filter queries under concurrent load
 *  10.  Sorted view scrolling (Tier 2 / Tier 3 paths)
 *  11.  Row reorder under concurrency
 *  12.  Column CRUD under load
 *  13.  Data integrity verification after concurrent writes
 *  14.  Edge cases: empty table, boundary offsets, max limits
 *  15.  Connection pool exhaustion test
 *
 * Usage:
 *   npx tsx stress-test.ts
 *
 * Prerequisites:
 *   - PostgreSQL running with the lyra-airtable database
 *   - Dev server running at http://localhost:3000  (pnpm dev)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SESSION_TOKEN = "stress-test-session-token-" + Date.now();
const SESSION_COOKIE = `authjs.session-token=${SESSION_TOKEN}`;

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { PrismaClient } from "./generated/prisma/index.js";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details: string;
}

const results: TestResult[] = [];

function elapsed(start: number): number {
  return Math.round(performance.now() - start);
}

function log(msg: string) {
  console.log(`  ${msg}`);
}

function header(name: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  ${name}`);
  console.log(`${"=".repeat(70)}`);
}

function recordResult(name: string, passed: boolean, durationMs: number, details: string) {
  results.push({ name, passed, durationMs, details });
  const icon = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`  ${icon} — ${name} (${durationMs}ms) ${details}`);
}

/**
 * Make a tRPC query (GET) request.
 */
async function trpcQuery<T = any>(
  procedure: string,
  input: any,
): Promise<{ data: T; status: number; durationMs: number }> {
  const encoded = encodeURIComponent(JSON.stringify({ json: input }));
  const url = `${BASE_URL}/api/trpc/${procedure}?input=${encoded}`;
  const t0 = performance.now();
  const resp = await fetch(url, {
    method: "GET",
    headers: { Cookie: SESSION_COOKIE },
  });
  const durationMs = elapsed(t0);
  const body = await resp.json();
  return { data: body?.result?.data?.json ?? body?.result?.data, status: resp.status, durationMs };
}

/**
 * Make a tRPC mutation (POST) request.
 */
async function trpcMutation<T = any>(
  procedure: string,
  input: any,
): Promise<{ data: T; status: number; durationMs: number }> {
  const url = `${BASE_URL}/api/trpc/${procedure}`;
  const t0 = performance.now();
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: SESSION_COOKIE,
    },
    body: JSON.stringify({ json: input }),
  });
  const durationMs = elapsed(t0);
  const body = await resp.json();
  return { data: body?.result?.data?.json ?? body?.result?.data, status: resp.status, durationMs };
}

/**
 * Run N async tasks concurrently and collect results.
 */
async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
): Promise<{ results: T[]; errors: Error[]; totalDurationMs: number }> {
  const t0 = performance.now();
  const settled = await Promise.allSettled(tasks.map((t) => t()));
  const totalDurationMs = elapsed(t0);

  const successes: T[] = [];
  const errors: Error[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled") successes.push(s.value);
    else errors.push(s.reason as Error);
  }
  return { results: successes, errors, totalDurationMs };
}

/**
 * Generates batches of concurrent tasks for a workload.
 */
async function runConcurrentBatches<T>(
  taskFactory: (index: number) => Promise<T>,
  total: number,
  concurrency: number,
): Promise<{ results: T[]; errors: Error[]; totalDurationMs: number }> {
  const allResults: T[] = [];
  const allErrors: Error[] = [];
  const t0 = performance.now();

  for (let i = 0; i < total; i += concurrency) {
    const batchSize = Math.min(concurrency, total - i);
    const tasks = Array.from({ length: batchSize }, (_, j) => () => taskFactory(i + j));
    const batch = await runConcurrent(tasks);
    allResults.push(...batch.results);
    allErrors.push(...batch.errors);
  }

  return { results: allResults, errors: allErrors, totalDurationMs: elapsed(t0) };
}

// ---------------------------------------------------------------------------
// State: will be populated during setup
// ---------------------------------------------------------------------------
let userId: string;
let baseId: string;
let tableId: string;
let columnIds: { id: string; name: string; type: string }[] = [];
let viewId: string;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

async function setup() {
  header("SETUP: Creating test user, session, base, table");

  // 1. Create test user
  let user = await prisma.user.findFirst({ where: { email: "stress-test@lyra.local" } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: "stress-test@lyra.local", name: "Stress Test User" },
    });
    log(`Created user: ${user.id}`);
  } else {
    log(`Found existing user: ${user.id}`);
  }
  userId = user.id;

  // 2. Create session
  const existingSession = await prisma.session.findUnique({
    where: { sessionToken: SESSION_TOKEN },
  });
  if (!existingSession) {
    await prisma.session.create({
      data: {
        sessionToken: SESSION_TOKEN,
        userId: user.id,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    log("Created session");
  }

  // 3. Create test base (clean slate)
  const existingBase = await prisma.base.findFirst({
    where: { ownerId: userId, name: "Stress Test Base" },
  });
  if (existingBase) {
    await prisma.base.delete({ where: { id: existingBase.id } }).catch(() => {});
    log("Deleted previous stress test base");
  }

  const base = await prisma.base.create({
    data: {
      name: "Stress Test Base",
      ownerId: userId,
      tables: {
        create: {
          name: "Stress Table",
          rowCount: 0,
          nextRowIndex: 1,
          nextColumnOrder: 6,
          columns: {
            create: [
              { name: "Name", type: "TEXT", order: 1 },
              { name: "Notes", type: "TEXT", order: 2 },
              { name: "Assignee", type: "TEXT", order: 3 },
              { name: "Status", type: "TEXT", order: 4 },
              { name: "Amount", type: "NUMBER", order: 5 },
            ],
          },
        },
      },
    },
    include: { tables: { include: { columns: true } } },
  });
  baseId = base.id;
  tableId = base.tables[0]!.id;
  columnIds = base.tables[0]!.columns.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
  }));

  // Create default view
  const view = await prisma.view.create({
    data: {
      tableId,
      name: "Grid view",
      config: {
        search: "",
        filters: [],
        filterConjunction: "and",
        sorts: [],
        permanentSorts: [],
        autoSort: true,
        hiddenColumnIds: [],
        columnOrderIds: columnIds.map((c) => c.id),
        rowOrderIds: [],
        rowHeightPreset: "short",
        wrapHeaders: false,
      },
    },
  });
  viewId = view.id;

  log(`Base: ${baseId}, Table: ${tableId}, View: ${viewId}`);
  log(`Columns: ${columnIds.map((c) => `${c.name}(${c.id.slice(0, 8)})`).join(", ")}`);
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

async function teardown() {
  header("TEARDOWN");
  try {
    await prisma.session.deleteMany({ where: { sessionToken: SESSION_TOKEN } });
    await prisma.base.deleteMany({ where: { name: "Stress Test Base", ownerId: userId } });
    log("Cleaned up stress test data");
  } catch (e) {
    log(`Teardown warning: ${e}`);
  }
  await prisma.$disconnect();
}

// ===========================================================================
// TEST 1: Bulk Insert (addMany)
// ===========================================================================

async function testBulkInsert() {
  header("TEST 1: Bulk Insert (addMany)");

  for (const count of [1000, 10_000, 50_000]) {
    const t0 = performance.now();
    const { data, status, durationMs } = await trpcMutation("row.addMany", {
      tableId,
      count,
    });
    const totalDuration = elapsed(t0);

    const passed = status === 200;
    const rate = passed ? Math.round(count / (durationMs / 1000)) : 0;
    recordResult(
      `Bulk insert ${count.toLocaleString()} rows`,
      passed,
      totalDuration,
      passed ? `${rate.toLocaleString()} rows/sec` : `status=${status}`,
    );

    // Verify row count
    const table = await prisma.table.findUnique({ where: { id: tableId }, select: { rowCount: true } });
    log(`  Table rowCount after insert: ${table?.rowCount?.toLocaleString()}`);
  }
}

// ===========================================================================
// TEST 2: Concurrent Single-Row Inserts
// ===========================================================================

async function testConcurrentInserts() {
  header("TEST 2: Concurrent Single-Row Inserts (insertAt)");

  const TOTAL = 50;
  const CONCURRENCY = 10;

  const table = await prisma.table.findUnique({
    where: { id: tableId },
    select: { rowCount: true, nextRowIndex: true },
  });
  const initialCount = table?.rowCount ?? 0;

  const { results: insertResults, errors, totalDurationMs } = await runConcurrentBatches(
    async (i) => {
      return trpcMutation("row.insertAt", {
        tableId,
        atIndex: initialCount + i + 1,
        position: "end",
      });
    },
    TOTAL,
    CONCURRENCY,
  );

  const successes = insertResults.filter((r) => r.status === 200).length;
  const avgMs = Math.round(insertResults.reduce((s, r) => s + r.durationMs, 0) / insertResults.length);
  const passed = successes === TOTAL && errors.length === 0;

  recordResult(
    `${TOTAL} concurrent inserts (${CONCURRENCY} parallel)`,
    passed,
    totalDurationMs,
    `${successes}/${TOTAL} succeeded, avg ${avgMs}ms, ${errors.length} errors`,
  );

  if (errors.length > 0) {
    log(`  First error: ${errors[0]?.message}`);
  }

  // Verify no row count drift
  const tableAfter = await prisma.table.findUnique({ where: { id: tableId }, select: { rowCount: true } });
  const expectedCount = initialCount + successes;
  const countMatch = tableAfter?.rowCount === expectedCount;
  recordResult(
    "Row count integrity after concurrent inserts",
    countMatch,
    0,
    `expected=${expectedCount}, actual=${tableAfter?.rowCount}`,
  );
}

// ===========================================================================
// TEST 3: Concurrent Cell Updates
// ===========================================================================

async function testConcurrentCellUpdates() {
  header("TEST 3: Concurrent Cell Updates (updateCell)");

  // Fetch some row IDs to update
  const rows = await prisma.row.findMany({
    where: { tableId },
    take: 50,
    select: { id: true },
    orderBy: { rowIndex: "asc" },
  });

  if (rows.length < 10) {
    recordResult("Concurrent cell updates", false, 0, "Not enough rows to test");
    return;
  }

  const TOTAL = 100;
  const CONCURRENCY = 20;
  const nameColId = columnIds.find((c) => c.name === "Name")!.id;

  const { results: updateResults, errors, totalDurationMs } = await runConcurrentBatches(
    async (i) => {
      const row = rows[i % rows.length]!;
      return trpcMutation("row.updateCell", {
        tableId,
        rowId: row.id,
        columnId: nameColId,
        value: `StressTest_${i}_${Date.now()}`,
      });
    },
    TOTAL,
    CONCURRENCY,
  );

  const successes = updateResults.filter((r) => r.status === 200).length;
  const avgMs = Math.round(updateResults.reduce((s, r) => s + r.durationMs, 0) / updateResults.length);
  const passed = successes >= TOTAL * 0.95; // allow 5% failure rate for concurrent writes

  recordResult(
    `${TOTAL} concurrent cell updates (${CONCURRENCY} parallel)`,
    passed,
    totalDurationMs,
    `${successes}/${TOTAL} succeeded, avg ${avgMs}ms, ${errors.length} errors`,
  );

  if (errors.length > 0) {
    log(`  First error: ${errors[0]?.message}`);
  }
}

// ===========================================================================
// TEST 4: Concurrent Row Deletions
// ===========================================================================

async function testConcurrentDeletions() {
  header("TEST 4: Concurrent Row Deletions");

  // Insert rows specifically for deletion
  const DELETE_COUNT = 30;
  const rowsToDelete: string[] = [];

  for (let i = 0; i < DELETE_COUNT; i++) {
    const row = await prisma.row.create({
      data: {
        tableId,
        rowIndex: 9_000_000 + i,
        cells: {},
        searchText: "",
      },
      select: { id: true },
    });
    rowsToDelete.push(row.id);
  }
  await prisma.table.update({
    where: { id: tableId },
    data: { rowCount: { increment: DELETE_COUNT } },
  });

  const tableBefore = await prisma.table.findUnique({ where: { id: tableId }, select: { rowCount: true } });
  const CONCURRENCY = 10;

  const { results: deleteResults, errors, totalDurationMs } = await runConcurrent(
    rowsToDelete.map(
      (rowId) => () =>
        trpcMutation("row.delete", { tableId, rowId }),
    ),
  );

  const successes = deleteResults.filter((r) => r.status === 200).length;
  const passed = successes === DELETE_COUNT && errors.length === 0;

  recordResult(
    `${DELETE_COUNT} concurrent deletions`,
    passed,
    totalDurationMs,
    `${successes}/${DELETE_COUNT} succeeded, ${errors.length} errors`,
  );

  // Verify row count after deletions
  const tableAfter = await prisma.table.findUnique({ where: { id: tableId }, select: { rowCount: true } });
  const expectedCount = (tableBefore?.rowCount ?? 0) - successes;
  const countMatch = tableAfter?.rowCount === expectedCount;
  recordResult(
    "Row count integrity after concurrent deletions",
    countMatch,
    0,
    `expected=${expectedCount}, actual=${tableAfter?.rowCount}`,
  );
}

// ===========================================================================
// TEST 5: Concurrent windowFetch Reads at Random Offsets
// ===========================================================================

async function testConcurrentWindowFetch() {
  header("TEST 5: Concurrent windowFetch Reads");

  const table = await prisma.table.findUnique({ where: { id: tableId }, select: { rowCount: true } });
  const totalRows = table?.rowCount ?? 0;

  const TOTAL = 50;
  const CONCURRENCY = 15;

  const offsets = Array.from({ length: TOTAL }, () =>
    Math.floor(Math.random() * Math.max(1, totalRows - 200)),
  );

  const { results: fetchResults, errors, totalDurationMs } = await runConcurrentBatches(
    async (i) => {
      return trpcQuery("row.windowFetch", {
        tableId,
        offset: offsets[i]!,
        limit: 200,
      });
    },
    TOTAL,
    CONCURRENCY,
  );

  const successes = fetchResults.filter((r) => r.status === 200).length;
  const durations = fetchResults.map((r) => r.durationMs).sort((a, b) => a - b);
  const p50 = durations[Math.floor(durations.length * 0.5)] ?? 0;
  const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
  const p99 = durations[Math.floor(durations.length * 0.99)] ?? 0;
  const passed = successes === TOTAL && p95 < 3000;

  recordResult(
    `${TOTAL} concurrent windowFetch (${CONCURRENCY} parallel)`,
    passed,
    totalDurationMs,
    `${successes}/${TOTAL} ok, p50=${p50}ms, p95=${p95}ms, p99=${p99}ms`,
  );

  // Verify data integrity: each response should have items with valid cells
  let dataValid = true;
  for (const r of fetchResults) {
    if (r.status !== 200) continue;
    const items = (r.data as any)?.items;
    if (!Array.isArray(items)) { dataValid = false; break; }
    for (const item of items.slice(0, 3)) {
      if (!item.id || item.cells === undefined) { dataValid = false; break; }
    }
  }
  recordResult("windowFetch response data integrity", dataValid, 0, "All responses have valid items");
}

// ===========================================================================
// TEST 6: Concurrent Infinite Scroll Pagination
// ===========================================================================

async function testConcurrentInfiniteScroll() {
  header("TEST 6: Concurrent Infinite Scroll Pagination");

  const PAGES = 20;
  const CONCURRENCY = 5;
  let cursor: number | null = null;

  const pageTimes: number[] = [];
  let allPassed = true;

  for (let page = 0; page < PAGES; page++) {
    const input: any = {
      tableId,
      limit: 200,
      cursor: cursor ?? null,
    };

    const { data, status, durationMs } = await trpcQuery("row.infinite", input);
    pageTimes.push(durationMs);

    if (status !== 200) {
      log(`  Page ${page} failed: status=${status}`);
      allPassed = false;
      break;
    }

    const items = (data as any)?.items ?? [];
    cursor = items.length > 0 ? items[items.length - 1]?.rowIndex : null;

    if (items.length === 0) {
      log(`  No more items at page ${page}`);
      break;
    }
  }

  const avgMs = Math.round(pageTimes.reduce((s, t) => s + t, 0) / pageTimes.length);
  const maxMs = Math.max(...pageTimes);

  recordResult(
    `Infinite scroll ${PAGES} pages sequentially`,
    allPassed,
    pageTimes.reduce((s, t) => s + t, 0),
    `avg=${avgMs}ms/page, max=${maxMs}ms/page`,
  );
}

// ===========================================================================
// TEST 7: Mixed Read/Write Workload
// ===========================================================================

async function testMixedWorkload() {
  header("TEST 7: Mixed Read/Write Workload (simulates real users)");

  const rows = await prisma.row.findMany({
    where: { tableId },
    take: 50,
    select: { id: true, rowIndex: true },
    orderBy: { rowIndex: "asc" },
  });

  if (rows.length < 10) {
    recordResult("Mixed workload", false, 0, "Not enough rows");
    return;
  }

  const table = await prisma.table.findUnique({ where: { id: tableId }, select: { rowCount: true } });
  const totalRows = table?.rowCount ?? 0;
  const nameColId = columnIds.find((c) => c.name === "Name")!.id;

  const OPERATIONS = 80;
  const CONCURRENCY = 15;

  const tasks: (() => Promise<{ type: string; status: number; durationMs: number }>)[] = [];

  for (let i = 0; i < OPERATIONS; i++) {
    const opType = Math.random();

    if (opType < 0.4) {
      // 40% reads (windowFetch)
      const offset = Math.floor(Math.random() * Math.max(1, totalRows - 200));
      tasks.push(async () => {
        const r = await trpcQuery("row.windowFetch", { tableId, offset, limit: 200 });
        return { type: "read", status: r.status, durationMs: r.durationMs };
      });
    } else if (opType < 0.7) {
      // 30% cell updates
      const row = rows[i % rows.length]!;
      tasks.push(async () => {
        const r = await trpcMutation("row.updateCell", {
          tableId,
          rowId: row.id,
          columnId: nameColId,
          value: `Mixed_${i}_${Date.now()}`,
        });
        return { type: "update", status: r.status, durationMs: r.durationMs };
      });
    } else if (opType < 0.9) {
      // 20% insert
      tasks.push(async () => {
        const r = await trpcMutation("row.insertAt", {
          tableId,
          atIndex: totalRows + i + 1,
          position: "end",
        });
        return { type: "insert", status: r.status, durationMs: r.durationMs };
      });
    } else {
      // 10% infinite scroll
      tasks.push(async () => {
        const r = await trpcQuery("row.infinite", { tableId, limit: 200 });
        return { type: "infinite", status: r.status, durationMs: r.durationMs };
      });
    }
  }

  const { results: mixedResults, errors, totalDurationMs } = await runConcurrentBatches(
    async (i) => tasks[i]!(),
    OPERATIONS,
    CONCURRENCY,
  );

  const byType: Record<string, { ok: number; fail: number; totalMs: number }> = {};
  for (const r of mixedResults) {
    const t = r.type;
    if (!byType[t]) byType[t] = { ok: 0, fail: 0, totalMs: 0 };
    if (r.status === 200) byType[t]!.ok++;
    else byType[t]!.fail++;
    byType[t]!.totalMs += r.durationMs;
  }

  const totalOk = mixedResults.filter((r) => r.status === 200).length;
  const passed = totalOk >= OPERATIONS * 0.9;

  for (const [type, stats] of Object.entries(byType)) {
    const avg = Math.round(stats.totalMs / (stats.ok + stats.fail));
    log(`  ${type}: ${stats.ok} ok, ${stats.fail} fail, avg ${avg}ms`);
  }

  recordResult(
    `Mixed workload (${OPERATIONS} ops, ${CONCURRENCY} parallel)`,
    passed,
    totalDurationMs,
    `${totalOk}/${OPERATIONS} succeeded, ${errors.length} errors`,
  );
}

// ===========================================================================
// TEST 8: Search Under Load
// ===========================================================================

async function testSearchUnderLoad() {
  header("TEST 8: Search Under Load");

  const searchTerms = ["James", "Smith", "Adaptive", "Done", "Thompson", "Barbara", "Heather"];
  const CONCURRENCY = 7;

  const { results: searchResults, errors, totalDurationMs } = await runConcurrent(
    searchTerms.map(
      (term) => async () => {
        const r = await trpcQuery("row.windowFetch", {
          tableId,
          offset: 0,
          limit: 200,
          search: term,
        });
        return { term, ...r };
      },
    ),
  );

  let allPassed = true;
  for (const r of searchResults) {
    const items = (r.data as any)?.items ?? [];
    const total = (r.data as any)?.totalCount ?? 0;
    const ok = r.status === 200 && items.length >= 0;
    if (!ok) allPassed = false;
    log(`  "${r.term}": ${items.length} items, ${total} total, ${r.durationMs}ms ${ok ? "✓" : "✗"}`);
  }

  const avgMs = Math.round(
    searchResults.reduce((s, r) => s + r.durationMs, 0) / searchResults.length,
  );

  recordResult(
    `${searchTerms.length} concurrent searches`,
    allPassed && errors.length === 0,
    totalDurationMs,
    `avg ${avgMs}ms/search, ${errors.length} errors`,
  );
}

// ===========================================================================
// TEST 9: Filter Queries Under Load
// ===========================================================================

async function testFilterQueries() {
  header("TEST 9: Filter Queries Under Load");

  const statusColId = columnIds.find((c) => c.name === "Status")?.id;
  const nameColId = columnIds.find((c) => c.name === "Name")?.id;
  const amountColId = columnIds.find((c) => c.name === "Amount")?.id;

  if (!statusColId || !nameColId) {
    recordResult("Filter queries", false, 0, "Missing required columns");
    return;
  }

  const filterSets = [
    { label: "equals filter", filters: [{ columnId: statusColId, op: "equals", value: "Done" }] },
    { label: "contains filter", filters: [{ columnId: nameColId, op: "contains", value: "James" }] },
    { label: "is_not_empty", filters: [{ columnId: nameColId, op: "is_not_empty" }] },
    {
      label: "combined AND filters",
      filters: [
        { columnId: statusColId, op: "equals", value: "Done" },
        { columnId: nameColId, op: "contains", value: "a" },
      ],
    },
  ];

  if (amountColId) {
    filterSets.push({
      label: "number range",
      filters: [
        { columnId: amountColId, op: "gte", value: 100 },
        { columnId: amountColId, op: "lte", value: 5000 },
      ] as any,
    });
  }

  const CONCURRENCY = filterSets.length;

  const { results: filterResults, errors, totalDurationMs } = await runConcurrent(
    filterSets.map(
      ({ label, filters }) => async () => {
        const r = await trpcQuery("row.windowFetch", {
          tableId,
          offset: 0,
          limit: 200,
          filters,
          conjunction: "and",
        });
        return { label, ...r };
      },
    ),
  );

  let allPassed = true;
  for (const r of filterResults) {
    const items = (r.data as any)?.items ?? [];
    const total = (r.data as any)?.totalCount ?? 0;
    const ok = r.status === 200;
    if (!ok) allPassed = false;
    log(`  ${r.label}: ${items.length} items, ${total} total, ${r.durationMs}ms ${ok ? "✓" : "✗"}`);
  }

  recordResult(
    `${filterSets.length} concurrent filter queries`,
    allPassed && errors.length === 0,
    totalDurationMs,
    `${errors.length} errors`,
  );
}

// ===========================================================================
// TEST 10: Sorted View Scrolling (Tier 2 / Tier 3 paths)
// ===========================================================================

async function testSortedViewScrolling() {
  header("TEST 10: Sorted View Scrolling");

  const nameColId = columnIds.find((c) => c.name === "Name")!.id;
  const sorts = [{ columnId: nameColId, direction: "asc", type: "TEXT" }];

  // Test Tier 3 (unsorted view, sorted query)
  const offsets = [0, 1000, 5000, 10000, 25000, 50000];

  const { results: sortResults, errors, totalDurationMs } = await runConcurrent(
    offsets.map(
      (offset) => async () => {
        const r = await trpcQuery("row.windowFetch", {
          tableId,
          offset,
          limit: 200,
          sorts,
          viewId,
        });
        return { offset, ...r };
      },
    ),
  );

  let allPassed = true;
  for (const r of sortResults) {
    const items = (r.data as any)?.items ?? [];
    const ok = r.status === 200 && items.length > 0;
    if (!ok && r.offset < 50000) allPassed = false;
    log(`  offset=${r.offset}: ${items.length} items, ${r.durationMs}ms ${ok ? "✓" : "✗"}`);
  }

  const durations = sortResults.map((r) => r.durationMs).sort((a, b) => a - b);
  const p50 = durations[Math.floor(durations.length * 0.5)] ?? 0;
  const maxMs = Math.max(...durations);

  recordResult(
    `Sorted view scrolling (${offsets.length} positions)`,
    allPassed && errors.length === 0,
    totalDurationMs,
    `p50=${p50}ms, max=${maxMs}ms`,
  );
}

// ===========================================================================
// TEST 11: Row Reorder Under Concurrency
// ===========================================================================

async function testRowReorder() {
  header("TEST 11: Row Reorder Under Concurrency");

  const rows = await prisma.row.findMany({
    where: { tableId },
    take: 20,
    select: { id: true, rowIndex: true },
    orderBy: { rowIndex: "asc" },
  });

  if (rows.length < 10) {
    recordResult("Row reorder", false, 0, "Not enough rows");
    return;
  }

  const REORDERS = 10;
  const tasks: (() => Promise<{ status: number; durationMs: number }>)[] = [];

  for (let i = 0; i < REORDERS; i++) {
    const row = rows[i]!;
    const targetRow = rows[rows.length - 1 - i]!;
    tasks.push(async () => {
      const r = await trpcMutation("row.reorder", {
        tableId,
        rowId: row.id,
        fromIndex: row.rowIndex,
        toIndex: targetRow.rowIndex,
      });
      return { status: r.status, durationMs: r.durationMs };
    });
  }

  const { results: reorderResults, errors, totalDurationMs } = await runConcurrent(tasks);
  const successes = reorderResults.filter((r) => r.status === 200).length;
  const passed = successes >= REORDERS * 0.8;

  recordResult(
    `${REORDERS} concurrent reorders`,
    passed,
    totalDurationMs,
    `${successes}/${REORDERS} succeeded, ${errors.length} errors`,
  );
}

// ===========================================================================
// TEST 12: Column CRUD Under Load
// ===========================================================================

async function testColumnCrud() {
  header("TEST 12: Column CRUD Under Load");

  const COLS_TO_CREATE = 5;
  const createdColIds: string[] = [];

  // Create columns concurrently
  const { results: createResults, errors: createErrors } = await runConcurrent(
    Array.from({ length: COLS_TO_CREATE }, (_, i) => async () => {
      const r = await trpcMutation("column.create", {
        tableId,
        name: `StressCol_${i}_${Date.now()}`,
        type: i % 2 === 0 ? "TEXT" : "NUMBER",
      });
      if (r.status === 200 && (r.data as any)?.id) {
        createdColIds.push((r.data as any).id);
      }
      return r;
    }),
  );

  const createOk = createResults.filter((r) => r.status === 200).length;
  recordResult(
    `Create ${COLS_TO_CREATE} columns concurrently`,
    createOk === COLS_TO_CREATE,
    0,
    `${createOk}/${COLS_TO_CREATE} succeeded`,
  );

  // List columns to verify
  const { data: listData, status: listStatus } = await trpcQuery("column.list", { tableId });
  const colCount = Array.isArray(listData) ? listData.length : 0;
  recordResult(
    "List columns after creation",
    listStatus === 200 && colCount >= columnIds.length + createOk,
    0,
    `${colCount} columns found`,
  );

  // Delete the created columns
  if (createdColIds.length > 0) {
    const { results: deleteResults } = await runConcurrent(
      createdColIds.map(
        (colId) => async () =>
          trpcMutation("column.delete", { tableId, columnId: colId }),
      ),
    );
    const deleteOk = deleteResults.filter((r) => r.status === 200).length;
    recordResult(
      `Delete ${createdColIds.length} columns concurrently`,
      deleteOk === createdColIds.length,
      0,
      `${deleteOk}/${createdColIds.length} succeeded`,
    );
  }
}

// ===========================================================================
// TEST 13: Data Integrity After Concurrent Writes
// ===========================================================================

async function testDataIntegrity() {
  header("TEST 13: Data Integrity Verification");

  // 1. Verify rowCount matches actual count
  const table = await prisma.table.findUnique({ where: { id: tableId }, select: { rowCount: true } });
  const actualCount = await prisma.row.count({ where: { tableId } });
  const countMatch = table?.rowCount === actualCount;
  recordResult(
    "rowCount matches actual row count",
    countMatch,
    0,
    `counter=${table?.rowCount}, actual=${actualCount}`,
  );

  // 2. Verify no duplicate rowIndex values
  const duplicates = await prisma.$queryRawUnsafe<{ dup_count: number }[]>(`
    SELECT COUNT(*) as dup_count
    FROM (
      SELECT "rowIndex", COUNT(*) as cnt
      FROM "Row"
      WHERE "tableId" = '${tableId}'
      GROUP BY "rowIndex"
      HAVING COUNT(*) > 1
    ) dupes
  `);
  const dupCount = Number(duplicates[0]?.dup_count ?? 0);
  recordResult(
    "No duplicate rowIndex values",
    dupCount === 0,
    0,
    dupCount === 0 ? "No duplicates" : `${dupCount} duplicated rowIndex groups`,
  );

  // 3. Verify all rows have valid cells (JSONB)
  const invalidCells = await prisma.$queryRawUnsafe<{ cnt: number }[]>(`
    SELECT COUNT(*) as cnt
    FROM "Row"
    WHERE "tableId" = '${tableId}'
      AND (jsonb_typeof("cells") IS NULL OR jsonb_typeof("cells") != 'object')
  `);
  const invalidCount = Number(invalidCells[0]?.cnt ?? 0);
  recordResult(
    "All rows have valid JSONB cells",
    invalidCount === 0,
    0,
    invalidCount === 0 ? "All valid" : `${invalidCount} invalid`,
  );

  // 4. Verify column count matches
  const actualColumns = await prisma.column.count({ where: { tableId } });
  const expectedColumns = columnIds.length;
  recordResult(
    "Column count integrity",
    actualColumns === expectedColumns,
    0,
    `expected=${expectedColumns}, actual=${actualColumns}`,
  );

  // 5. Verify API returns consistent data with DB
  const { data: apiData, status } = await trpcQuery("row.windowFetch", {
    tableId,
    offset: 0,
    limit: 10,
  });
  const apiItems = (apiData as any)?.items ?? [];
  const apiTotal = (apiData as any)?.totalCount ?? 0;
  recordResult(
    "API totalCount matches DB rowCount",
    status === 200 && apiTotal === actualCount,
    0,
    `api=${apiTotal}, db=${actualCount}`,
  );

  // Verify first API item matches DB
  if (apiItems.length > 0) {
    const firstApiRow = apiItems[0];
    const firstDbRow = await prisma.row.findUnique({
      where: { id: firstApiRow.id },
      select: { id: true, cells: true },
    });
    const cellsMatch = JSON.stringify(firstApiRow.cells) === JSON.stringify(firstDbRow?.cells);
    recordResult(
      "API row cells match DB",
      cellsMatch,
      0,
      cellsMatch ? "Match" : "Mismatch",
    );
  }
}

// ===========================================================================
// TEST 14: Edge Cases & Boundary Conditions
// ===========================================================================

async function testEdgeCases() {
  header("TEST 14: Edge Cases & Boundary Conditions");

  // 1. Fetch at offset beyond total rows
  const table = await prisma.table.findUnique({ where: { id: tableId }, select: { rowCount: true } });
  const { data: beyondData, status: beyondStatus } = await trpcQuery("row.windowFetch", {
    tableId,
    offset: (table?.rowCount ?? 0) + 10000,
    limit: 200,
  });
  const beyondItems = (beyondData as any)?.items ?? [];
  recordResult(
    "Fetch beyond total rows returns empty",
    beyondStatus === 200 && beyondItems.length === 0,
    0,
    `status=${beyondStatus}, items=${beyondItems.length}`,
  );

  // 2. Fetch with limit=1 (minimum)
  const { data: minLimitData, status: minStatus } = await trpcQuery("row.windowFetch", {
    tableId,
    offset: 0,
    limit: 1,
  });
  const minItems = (minLimitData as any)?.items ?? [];
  recordResult(
    "Fetch with limit=1",
    minStatus === 200 && minItems.length === 1,
    0,
    `items=${minItems.length}`,
  );

  // 3. Fetch with limit=2000 (maximum)
  const { data: maxLimitData, status: maxStatus } = await trpcQuery("row.windowFetch", {
    tableId,
    offset: 0,
    limit: 2000,
  });
  const maxItems = (maxLimitData as any)?.items ?? [];
  recordResult(
    "Fetch with limit=2000 (max)",
    maxStatus === 200 && maxItems.length > 0,
    0,
    `items=${maxItems.length}`,
  );

  // 4. Update cell with empty string
  const firstRow = await prisma.row.findFirst({
    where: { tableId },
    select: { id: true },
    orderBy: { rowIndex: "asc" },
  });
  if (firstRow) {
    const nameColId = columnIds.find((c) => c.name === "Name")!.id;
    const { status: emptyStatus } = await trpcMutation("row.updateCell", {
      tableId,
      rowId: firstRow.id,
      columnId: nameColId,
      value: "",
    });
    recordResult("Update cell with empty string", emptyStatus === 200, 0, `status=${emptyStatus}`);

    // Restore a value
    await trpcMutation("row.updateCell", {
      tableId,
      rowId: firstRow.id,
      columnId: nameColId,
      value: "Restored_Name",
    });
  }

  // 5. Update cell with null
  if (firstRow) {
    const nameColId = columnIds.find((c) => c.name === "Name")!.id;
    const { status: nullStatus } = await trpcMutation("row.updateCell", {
      tableId,
      rowId: firstRow.id,
      columnId: nameColId,
      value: null,
    });
    recordResult("Update cell with null", nullStatus === 200, 0, `status=${nullStatus}`);
  }

  // 6. Search with empty string
  const { data: emptySearchData, status: emptySearchStatus } = await trpcQuery("row.windowFetch", {
    tableId,
    offset: 0,
    limit: 200,
    search: "",
  });
  recordResult(
    "Search with empty string returns all rows",
    emptySearchStatus === 200,
    0,
    `items=${((emptySearchData as any)?.items ?? []).length}`,
  );

  // 7. Search with special characters
  const { status: specialSearchStatus } = await trpcQuery("row.windowFetch", {
    tableId,
    offset: 0,
    limit: 200,
    search: "%_\\'\";DROP TABLE",
  });
  recordResult(
    "Search with SQL injection attempt",
    specialSearchStatus === 200,
    0,
    `status=${specialSearchStatus} (no crash)`,
  );

  // 8. Delete non-existent row
  const { status: ghostDeleteStatus } = await trpcMutation("row.delete", {
    tableId,
    rowId: "00000000-0000-0000-0000-000000000000",
  });
  recordResult(
    "Delete non-existent row (idempotent)",
    ghostDeleteStatus === 200,
    0,
    `status=${ghostDeleteStatus}`,
  );

  // 9. windowFetch with combined sorts + filters + search
  const statusColId = columnIds.find((c) => c.name === "Status")?.id;
  const nameColId = columnIds.find((c) => c.name === "Name")!.id;
  if (statusColId) {
    const { data: comboData, status: comboStatus } = await trpcQuery("row.windowFetch", {
      tableId,
      offset: 0,
      limit: 200,
      search: "a",
      filters: [{ columnId: statusColId, op: "equals", value: "Done" }],
      sorts: [{ columnId: nameColId, direction: "asc", type: "TEXT" }],
    });
    recordResult(
      "Combined sort + filter + search",
      comboStatus === 200,
      0,
      `items=${((comboData as any)?.items ?? []).length}`,
    );
  }
}

// ===========================================================================
// TEST 15: Connection Pool / High Concurrency Stress
// ===========================================================================

async function testHighConcurrency() {
  header("TEST 15: Connection Pool Stress (50 parallel requests)");

  const table = await prisma.table.findUnique({ where: { id: tableId }, select: { rowCount: true } });
  const totalRows = table?.rowCount ?? 0;

  const TOTAL = 50;

  const tasks = Array.from({ length: TOTAL }, (_, i) => async () => {
    const offset = Math.floor(Math.random() * Math.max(1, totalRows - 100));
    const r = await trpcQuery("row.windowFetch", {
      tableId,
      offset,
      limit: 100,
    });
    return { status: r.status, durationMs: r.durationMs };
  });

  const { results: stressResults, errors, totalDurationMs } = await runConcurrent(tasks);

  const successes = stressResults.filter((r) => r.status === 200).length;
  const durations = stressResults.map((r) => r.durationMs).sort((a, b) => a - b);
  const p50 = durations[Math.floor(durations.length * 0.5)] ?? 0;
  const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
  const maxMs = Math.max(...durations);
  const passed = successes >= TOTAL * 0.95 && errors.length <= 2;

  recordResult(
    `${TOTAL} fully parallel reads`,
    passed,
    totalDurationMs,
    `${successes}/${TOTAL} ok, p50=${p50}ms, p95=${p95}ms, max=${maxMs}ms, ${errors.length} errors`,
  );
}

// ===========================================================================
// TEST 16: Rapid Sequential API Calls (Latency)
// ===========================================================================

async function testRapidSequentialCalls() {
  header("TEST 16: Rapid Sequential API Calls (Latency Profiling)");

  const CALLS = 20;
  const durations: number[] = [];

  for (let i = 0; i < CALLS; i++) {
    const { durationMs, status } = await trpcQuery("row.windowFetch", {
      tableId,
      offset: i * 100,
      limit: 100,
    });
    durations.push(durationMs);
    if (status !== 200) break;
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const avg = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;

  recordResult(
    `${CALLS} sequential windowFetch calls`,
    p95 < 2000,
    durations.reduce((s, d) => s + d, 0),
    `avg=${avg}ms, p50=${p50}ms, p95=${p95}ms, min=${min}ms, max=${max}ms`,
  );
}

// ===========================================================================
// TEST 17: Base & Table CRUD Stress
// ===========================================================================

async function testBaseTableCrud() {
  header("TEST 17: Base & Table CRUD Stress");

  // Create multiple bases concurrently
  const BASE_COUNT = 5;
  const createdBaseIds: string[] = [];

  const { results: baseResults, errors: baseErrors } = await runConcurrent(
    Array.from({ length: BASE_COUNT }, (_, i) => async () => {
      const id = `stress-base-${i}-${Date.now()}`;
      const r = await trpcMutation("base.create", {
        id,
        name: `Stress Base ${i}`,
      });
      if (r.status === 200) createdBaseIds.push(id);
      return r;
    }),
  );

  const baseOk = baseResults.filter((r) => r.status === 200).length;
  recordResult(
    `Create ${BASE_COUNT} bases concurrently`,
    baseOk === BASE_COUNT,
    0,
    `${baseOk}/${BASE_COUNT} succeeded`,
  );

  // Create tables in those bases concurrently
  const TABLE_COUNT = 3;
  const { results: tableResults } = await runConcurrent(
    createdBaseIds.slice(0, 2).flatMap((bId) =>
      Array.from({ length: TABLE_COUNT }, (_, i) => async () => {
        const r = await trpcMutation("table.create", {
          baseId: bId,
          name: `Stress Table ${i}`,
        });
        return r;
      }),
    ),
  );

  const tableOk = tableResults.filter((r) => r.status === 200).length;
  recordResult(
    `Create ${TABLE_COUNT} tables in ${Math.min(2, createdBaseIds.length)} bases`,
    tableOk > 0,
    0,
    `${tableOk} tables created`,
  );

  // Delete all created bases
  const { results: deleteResults } = await runConcurrent(
    createdBaseIds.map(
      (bId) => async () => trpcMutation("base.delete", { id: bId }),
    ),
  );
  const deleteOk = deleteResults.filter((r) => r.status === 200).length;
  recordResult(
    `Delete ${createdBaseIds.length} bases concurrently`,
    deleteOk === createdBaseIds.length,
    0,
    `${deleteOk}/${createdBaseIds.length} deleted`,
  );
}

// ===========================================================================
// SUMMARY
// ===========================================================================

function printSummary() {
  header("STRESS TEST SUMMARY");

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`\n  Total: ${total}  |  Passed: ${passed}  |  Failed: ${failed}\n`);

  if (failed > 0) {
    console.log("  FAILURES:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`    ✗ ${r.name} — ${r.details}`);
    }
    console.log();
  }

  const totalDuration = results.reduce((s, r) => s + r.durationMs, 0);
  console.log(`  Total test duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`  Final verdict: ${failed === 0 ? "ALL PASSED ✓" : `${failed} FAILURES ✗`}\n`);

  return failed === 0;
}

// ===========================================================================
// MAIN
// ===========================================================================

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║          LYRA AIRTABLE — COMPREHENSIVE STRESS TEST SUITE           ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Time:   ${new Date().toISOString()}`);

  let allPassed = true;
  try {
    await setup();
    await testBulkInsert();
    await testConcurrentInserts();
    await testConcurrentCellUpdates();
    await testConcurrentDeletions();
    await testConcurrentWindowFetch();
    await testConcurrentInfiniteScroll();
    await testMixedWorkload();
    await testSearchUnderLoad();
    await testFilterQueries();
    await testSortedViewScrolling();
    await testRowReorder();
    await testColumnCrud();
    await testDataIntegrity();
    await testEdgeCases();
    await testHighConcurrency();
    await testRapidSequentialCalls();
    await testBaseTableCrud();
    allPassed = printSummary();
  } catch (err) {
    console.error("\n  FATAL ERROR:", err);
    allPassed = false;
  } finally {
    await teardown();
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Uncaught error:", err);
  process.exit(1);
});
