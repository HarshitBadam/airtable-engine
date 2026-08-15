/**
 * Batch Size Benchmark: Find the optimal INSERT_BATCH for 100K rows.
 *
 * Tests inserting 100K rows total using different internal batch sizes
 * by directly calling the SQL generate_series INSERT (same as addMany).
 *
 * Usage: npx tsx scripts/benchmarks/batch-benchmark.ts
 */

import { PrismaClient } from "../../generated/prisma/index.js";

const prisma = new PrismaClient();

const TOTAL_ROWS = 100_000;
const BATCH_SIZES = [5_000, 10_000, 20_000, 25_000, 50_000, 100_000];

async function createTestTable(userId: string, label: string) {
  const base = await prisma.base.create({
    data: {
      name: `Batch Test ${label}`,
      ownerId: userId,
      tables: {
        create: {
          name: "Test",
          rowCount: 0,
          nextRowIndex: 1,
          nextColumnOrder: 6,
          columns: {
            create: [
              { name: "Name", type: "TEXT", order: 1 },
              { name: "Notes", type: "TEXT", order: 2 },
              { name: "Status", type: "TEXT", order: 3 },
            ],
          },
        },
      },
    },
    include: { tables: { include: { columns: true } } },
  });
  return { baseId: base.id, tableId: base.tables[0]!.id, columns: base.tables[0]!.columns };
}

function escapeLiteral(s: string) {
  return s.replace(/'/g, "''");
}

async function insertBatch(
  tableId: string,
  columns: { id: string; name: string }[],
  batchStart: number,
  batchCount: number,
) {
  const tableIdEscaped = escapeLiteral(tableId);
  const idx = `(${batchStart} + gs)`;

  const FIRST_NAMES = `(ARRAY['James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda','David','Elizabeth'])`;
  const LAST_NAMES = `(ARRAY['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Lee'])`;
  const STATUSES = `(ARRAY['Todo','In progress','In review','Done','Blocked'])`;

  const jsonbParts: string[] = [];
  for (const col of columns) {
    const colId = escapeLiteral(col.id);
    const name = col.name.toLowerCase();
    if (name === "name") {
      jsonbParts.push(`'${colId}', ${FIRST_NAMES}[1 + (${idx} % 10)] || ' ' || ${LAST_NAMES}[1 + (${idx} % 11)]`);
    } else if (name === "notes") {
      jsonbParts.push(`'${colId}', 'Note for row ' || ${idx}`);
    } else if (name === "status") {
      jsonbParts.push(`'${colId}', ${STATUSES}[1 + (${idx} % 5)]`);
    }
  }

  const cellsExpr = `jsonb_build_object(${jsonbParts.join(", ")})`;

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Row" ("tableId", "rowIndex", "cells", "searchText", "createdAt", "updatedAt")
    SELECT
      '${tableIdEscaped}',
      ${batchStart} + gs,
      ${cellsExpr},
      '',
      now(),
      now()
    FROM generate_series(0, ${batchCount - 1}) AS gs
  `);
}

async function benchmarkBatchSize(
  userId: string,
  batchSize: number,
): Promise<{ batchSize: number; durationMs: number; batches: number; perBatchMs: number[] }> {
  const label = `${batchSize / 1000}K`;
  const { baseId, tableId, columns } = await createTestTable(userId, label);

  const batches = Math.ceil(TOTAL_ROWS / batchSize);
  const perBatchMs: number[] = [];

  const t0 = performance.now();

  for (let offset = 0; offset < TOTAL_ROWS; offset += batchSize) {
    const count = Math.min(batchSize, TOTAL_ROWS - offset);
    const batchStart = offset + 1;

    const bt0 = performance.now();
    await insertBatch(tableId, columns, batchStart, count);
    perBatchMs.push(Math.round(performance.now() - bt0));
  }

  const durationMs = Math.round(performance.now() - t0);

  // Verify
  const actualCount = await prisma.row.count({ where: { tableId } });
  if (actualCount !== TOTAL_ROWS) {
    console.error(`  ERROR: Expected ${TOTAL_ROWS}, got ${actualCount}`);
  }

  // Cleanup
  await prisma.base.delete({ where: { id: baseId } });

  return { batchSize, durationMs, batches, perBatchMs };
}

async function main() {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║     BATCH SIZE BENCHMARK: 100K rows, varying batch size     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");

  let user = await prisma.user.findFirst({ where: { email: "stress-test@lyra.local" } });
  if (!user) {
    user = await prisma.user.create({ data: { email: "stress-test@lyra.local", name: "Bench User" } });
  }

  const results: { batchSize: number; durationMs: number; batches: number; throughput: number; perBatchMs: number[] }[] = [];

  for (const batchSize of BATCH_SIZES) {
    const label = batchSize >= 1000 ? `${batchSize / 1000}K` : `${batchSize}`;
    process.stdout.write(`  Testing batch size ${label.padStart(5)}  (${Math.ceil(TOTAL_ROWS / batchSize)} batches) ... `);

    const result = await benchmarkBatchSize(user.id, batchSize);
    const throughput = Math.round(TOTAL_ROWS / (result.durationMs / 1000));

    results.push({ ...result, throughput });
    console.log(`${result.durationMs}ms  (${throughput.toLocaleString()} rows/sec)`);
  }

  // Print summary table
  console.log("");
  console.log("  ┌─────────────┬─────────┬─────────┬────────────────┬───────────────────┐");
  console.log("  │ Batch Size  │ Batches │ Time    │ Throughput     │ Per-Batch (avg)   │");
  console.log("  ├─────────────┼─────────┼─────────┼────────────────┼───────────────────┤");

  let bestResult = results[0]!;
  for (const r of results) {
    if (r.durationMs < bestResult.durationMs) bestResult = r;

    const batchLabel = r.batchSize >= 1000 ? `${r.batchSize / 1000}K` : `${r.batchSize}`;
    const avgBatch = Math.round(r.perBatchMs.reduce((s, t) => s + t, 0) / r.perBatchMs.length);
    const marker = r === bestResult ? " ★" : "  ";

    console.log(
      `  │ ${batchLabel.padStart(9)}   │ ${String(r.batches).padStart(5)}   │ ${String(r.durationMs + "ms").padStart(7)} │ ${(r.throughput.toLocaleString() + " r/s").padStart(14)} │ ${String(avgBatch + "ms").padStart(15)}   │${marker}`,
    );
  }
  console.log("  └─────────────┴─────────┴─────────┴────────────────┴───────────────────┘");

  const bestLabel = bestResult.batchSize >= 1000 ? `${bestResult.batchSize / 1000}K` : `${bestResult.batchSize}`;
  console.log("");
  console.log(`  ★ OPTIMAL BATCH SIZE: ${bestLabel} (${bestResult.durationMs}ms, ${bestResult.throughput.toLocaleString()} rows/sec)`);
  console.log("");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
