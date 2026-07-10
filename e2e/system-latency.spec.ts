import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../generated/prisma/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_POSITIONS = [0.1, 0.25, 0.5, 0.75, 0.9];
const PASSES = 3;
const TARGET_ROW_COUNT = 1_000_000;
const SEED_BATCH_SIZE = 100_000;

interface TestMeta {
  baseId: string;
  tableId: string;
}

interface JumpSample {
  position: number;
  targetRow: number;
  responseMs: number;
  viewportReadyMs: number;
  status: number;
}

interface BenchmarkBaseline {
  rowCount: number;
  nextRowIndex: number;
}

function readMeta(): TestMeta {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, ".auth", "test-meta.json"), "utf8"),
  ) as TestMeta;
}

function percentile(values: number[], value: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil(value * sorted.length) - 1,
  );
  return Math.round(sorted[index]! * 10) / 10;
}

function summarize(values: number[]) {
  return {
    samples: values.length,
    min: Math.round(Math.min(...values) * 10) / 10,
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    max: Math.round(Math.max(...values) * 10) / 10,
  };
}

function assertSafeId(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`Unexpected database id: ${value}`);
  }
}

async function ensureBenchmarkRows(meta: TestMeta): Promise<BenchmarkBaseline> {
  const db = new PrismaClient();
  try {
    const table = await db.table.findUnique({
      where: { id: meta.tableId },
      include: { columns: { orderBy: { order: "asc" } } },
    });
    if (!table) throw new Error("Benchmark table not found");

    const textColumn = table.columns.find((column) => column.type === "TEXT");
    const numberColumn = table.columns.find(
      (column) => column.type === "NUMBER",
    );
    if (!textColumn || !numberColumn) {
      throw new Error("Benchmark table needs one text and one number column");
    }

    assertSafeId(table.id);
    assertSafeId(textColumn.id);
    assertSafeId(numberColumn.id);

    const baseline = {
      rowCount: table.rowCount,
      nextRowIndex: table.nextRowIndex,
    };
    let rowCount = baseline.rowCount;
    let nextRowIndex = baseline.nextRowIndex;
    while (rowCount < TARGET_ROW_COUNT) {
      const count = Math.min(SEED_BATCH_SIZE, TARGET_ROW_COUNT - rowCount);
      const firstIndex = nextRowIndex;

      await db.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(`
            INSERT INTO "Row"
              ("id", "tableId", "rowIndex", "cells", "searchText", "createdAt", "updatedAt")
            SELECT
              gen_random_uuid(),
              '${table.id}',
              (${firstIndex} + gs)::double precision,
              jsonb_build_object(
                '${textColumn.id}', 'Person ' || (${firstIndex} + gs)::text,
                '${numberColumn.id}', ${firstIndex} + gs
              ),
              lower('Person ' || (${firstIndex} + gs)::text),
              now(),
              now()
            FROM generate_series(0, ${count - 1}) AS gs
          `);
          await tx.table.update({
            where: { id: table.id },
            data: {
              rowCount: { increment: count },
              nextRowIndex: { increment: count },
            },
          });
        },
        { timeout: 120_000 },
      );

      rowCount += count;
      nextRowIndex += count;
      console.log(
        `Seeded benchmark table to ${rowCount.toLocaleString()} rows`,
      );
    }

    return baseline;
  } finally {
    await db.$disconnect();
  }
}

async function restoreBenchmarkRows(
  meta: TestMeta,
  baseline: BenchmarkBaseline,
) {
  const db = new PrismaClient();
  try {
    await db.$transaction(
      async (tx) => {
        await tx.row.deleteMany({
          where: {
            tableId: meta.tableId,
            rowIndex: { gte: baseline.nextRowIndex },
          },
        });
        await tx.table.update({
          where: { id: meta.tableId },
          data: baseline,
        });
      },
      { timeout: 120_000 },
    );
  } finally {
    await db.$disconnect();
  }
}

async function waitForInitialData(page: Page) {
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll<HTMLElement>("[data-index]");
    return [...rows].some((row) => {
      if (row.querySelector('[class*="skeleton"]')) return false;
      return [...row.querySelectorAll('[class*="gridDataCell"]')].some(
        (cell) => (cell.textContent?.trim().length ?? 0) > 0,
      );
    });
  });
}

async function readRowCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const footer = document.querySelector('[class*="gridFooterRecordCount"]');
    return Number.parseInt(
      (footer?.textContent ?? "0").replace(/[^\d]/g, ""),
      10,
    );
  });
}

async function waitForRealRowsNear(
  page: Page,
  targetRow: number,
  tolerance: number,
) {
  await page.waitForFunction(
    ([target = 0, allowed = 0]) => {
      const labels = document.querySelectorAll<HTMLElement>(
        '[class*="gridRowNumInner"]',
      );
      return [...labels].some((label) => {
        const rowNumber = Number.parseInt(
          (label.textContent ?? "").replace(/[^\d]/g, ""),
          10,
        );
        if (
          !Number.isFinite(rowNumber) ||
          Math.abs(rowNumber - target) > allowed
        ) {
          return false;
        }

        const row = label.closest<HTMLElement>("[data-index]");
        if (!row || row.querySelector('[class*="skeleton"]')) return false;
        return [...row.querySelectorAll('[class*="gridDataCell"]')].some(
          (cell) => (cell.textContent?.trim().length ?? 0) > 0,
        );
      });
    },
    [targetRow, tolerance],
  );
}

async function dragScrollbarTo(page: Page, fraction: number) {
  const track = page.locator('[class*="customVScrollTrack"]').first();
  const thumb = page.locator('[class*="customVScrollThumb"]').first();
  await track.waitFor({ state: "attached", timeout: 5_000 });
  await thumb.waitFor({ state: "visible", timeout: 5_000 });
  const [trackBox, thumbBox] = await Promise.all([
    track.boundingBox(),
    thumb.boundingBox(),
  ]);

  if (!trackBox || !thumbBox) {
    throw new Error("Custom vertical scrollbar is not available");
  }

  const startX = thumbBox.x + thumbBox.width / 2;
  const startY = thumbBox.y + thumbBox.height / 2;
  const usableTrack = trackBox.height - 6 - thumbBox.height;
  const targetY = trackBox.y + 3 + usableTrack * fraction + thumbBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, targetY, { steps: 3 });
  await page.mouse.up();
}

test("records production-style system latency", async ({
  page,
  browserName,
}) => {
  test.setTimeout(180_000);

  const meta = readMeta();
  const url = `/bases/${meta.baseId}/tables/${meta.tableId}`;
  const pageLoadSamples: number[] = [];
  const jumpSamples: JumpSample[] = [];

  const baseline = await ensureBenchmarkRows(meta);
  try {
    await page.goto(url, { waitUntil: "commit" });
    await waitForInitialData(page);

    for (let pass = 0; pass < PASSES; pass++) {
      for (const position of SAMPLE_POSITIONS) {
        const loadStart = performance.now();
        await page.goto(url, { waitUntil: "commit" });
        await waitForInitialData(page);
        pageLoadSamples.push(performance.now() - loadStart);

        const rowCount = await readRowCount(page);
        expect(rowCount).toBeGreaterThan(0);

        const targetRow = Math.round((rowCount - 1) * position) + 1;
        const responsePromise = page.waitForResponse(
          (response) =>
            response.url().includes("/api/trpc/") &&
            response.url().includes("row.windowFetch"),
          { timeout: 15_000 },
        );

        const jumpStart = performance.now();
        await dragScrollbarTo(page, position);
        const response = await responsePromise;
        const responseMs = performance.now() - jumpStart;

        await waitForRealRowsNear(
          page,
          targetRow,
          Math.max(50, Math.round(rowCount * 0.005)),
        );
        const viewportReadyMs = performance.now() - jumpStart;

        expect(response.status()).toBe(200);
        jumpSamples.push({
          position,
          targetRow,
          responseMs: Math.round(responseMs * 10) / 10,
          viewportReadyMs: Math.round(viewportReadyMs * 10) / 10,
          status: response.status(),
        });
      }
    }

    const result = {
      generatedAt: new Date().toISOString(),
      environment: {
        appMode: process.env.NODE_ENV ?? "unknown",
        baseURL: test.info().project.use.baseURL,
        browser: browserName,
        rowCount: await readRowCount(page),
        passes: PASSES,
        positions: SAMPLE_POSITIONS,
      },
      definitions: {
        pageLoad:
          "Navigation start to the first non-skeleton data cell becoming visible",
        jumpResponse:
          "Scrollbar drag start to the row.windowFetch HTTP response, including client throttle, network, auth, query, and serialization",
        viewportReady:
          "Scrollbar drag start to a non-skeleton row near the target becoming visible",
      },
      summary: {
        pageLoadMs: summarize(pageLoadSamples),
        jumpResponseMs: summarize(
          jumpSamples.map((sample) => sample.responseMs),
        ),
        viewportReadyMs: summarize(
          jumpSamples.map((sample) => sample.viewportReadyMs),
        ),
      },
      pageLoadSamplesMs: pageLoadSamples.map(
        (value) => Math.round(value * 10) / 10,
      ),
      jumpSamples,
    };

    const outputPath = path.resolve(
      __dirname,
      "../benchmark-results/system-latency.json",
    );
    fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result.summary, null, 2));
  } finally {
    await restoreBenchmarkRows(meta, baseline);
  }
});
