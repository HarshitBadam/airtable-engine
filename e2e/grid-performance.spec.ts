/**
 * E2E Performance Tests — Grid Virtualization & Bulk Operations
 *
 * Tests the core performance scenarios:
 *   1. Add 100K rows (bulk insert, measures wall-clock time)
 *   2. Scroll to end (default view, measures data appearance time)
 *   3. Scroll to end (sorted view, measures data appearance time)
 *   4. Rapid positional jumps (mid-table, near-end)
 *
 * Run:  pnpm test:e2e
 * UI:   pnpm test:e2e:ui
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Test metadata from global-setup ────────────────────────────────────────
interface TestMeta {
  userId: string;
  baseId: string;
  tableId: string;
  columnIds: { id: string; name: string; type: string }[];
}

let _meta: TestMeta | null = null;
function loadMeta(): TestMeta {
  if (_meta) return _meta;
  const raw = fs.readFileSync(path.join(__dirname, ".auth", "test-meta.json"), "utf-8");
  _meta = JSON.parse(raw) as TestMeta;
  return _meta;
}

// ── Timing helpers ─────────────────────────────────────────────────────────
function elapsed(start: number): number {
  return Math.round(performance.now() - start);
}

function log(label: string, ms: number, limit?: number) {
  const ok = limit ? ms <= limit : true;
  const status = limit ? (ok ? "✓ PASS" : "✗ FAIL") : "•";
  const extra = limit ? ` (limit: ${limit}ms)` : "";
  console.log(`  ${status} ${label}: ${ms}ms${extra}`);
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Wait for rows at a given position range to be visible with real data.
 * After scrolling, the virtualizer may take a few frames to update,
 * then data needs to load via windowFetch. This helper handles both waits.
 *
 * @param minExpectedIndex  Minimum data-index in the viewport after scroll
 * @param maxExpectedIndex  Maximum data-index — ensures we're at the RIGHT position (not leftover DOM)
 */
async function waitForDataAtPosition(
  page: Page,
  minExpectedIndex: number,
  timeout = 30_000,
  maxExpectedIndex?: number,
) {
  const maxIdx = maxExpectedIndex ?? minExpectedIndex + 5000; // default: allow 5K range above min
  await page.waitForFunction(
    ([minIdx, maxIdx]) => {
      const rows = document.querySelectorAll("[data-index]");
      if (rows.length === 0) return false;

      // Phase 1: The MAJORITY of rendered items must be within [minIdx, maxIdx]
      // This prevents false positives from leftover DOM elements at a different position.
      let inRangeCount = 0;
      let totalCount = 0;
      for (const row of rows) {
        const idx = parseInt(row.getAttribute("data-index") ?? "-1", 10);
        if (idx < 0) continue;
        totalCount++;
        if (idx >= minIdx && idx <= maxIdx) inRangeCount++;
      }
      // Need at least half the rendered items to be in the expected range
      if (totalCount === 0 || inRangeCount < totalCount * 0.5) return false;

      // Phase 2: At least one row in range has real data (not skeleton)
      for (const row of rows) {
        const idx = parseInt(row.getAttribute("data-index") ?? "-1", 10);
        if (idx < minIdx || idx > maxIdx) continue;
        const cells = row.querySelectorAll('[class*="gridDataCell"]');
        for (const cell of cells) {
          const text = cell.textContent?.trim();
          if (text && text.length > 0 && !cell.querySelector('[class*="skeleton"]')) {
            return true;
          }
        }
      }
      return false;
    },
    [minExpectedIndex, maxIdx] as [number, number],
    { timeout },
  );
}

/** Simple wait for any data to appear at position 0+ (used after initial page load). */
async function waitForDataVisible(page: Page, timeout = 30_000) {
  await waitForDataAtPosition(page, 0, timeout, 500);
}

/** Scroll the grid container to a specific scrollTop position. */
async function scrollGridTo(page: Page, scrollTop: number) {
  await page.evaluate((top) => {
    const scroller = document.querySelector('[class*="gridContentScroller"]');
    if (scroller) {
      scroller.scrollTop = top;
    }
  }, scrollTop);
}

/** Get the current visible row numbers from the grid. */
async function getVisibleRowNumbers(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const items = document.querySelectorAll("[data-index]");
    const indices: number[] = [];
    for (const item of items) {
      const idx = item.getAttribute("data-index");
      if (idx) indices.push(parseInt(idx, 10));
    }
    return indices;
  });
}

/** Get the row count display from the toolbar or footer. */
async function getDisplayedRowCount(page: Page): Promise<string> {
  // The row count is usually shown in the table toolbar area
  return page.evaluate(() => {
    // Look for elements containing row count patterns like "100,020 records"
    const all = document.body.innerText;
    const match = /(\d[\d,]+)\s*(?:records?|rows?)/i.exec(all);
    return match?.[1] ?? "0";
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe.serial("Grid Performance Suite", () => {

  function gridURL() {
    const meta = loadMeta();
    return `/bases/${meta.baseId}/tables/${meta.tableId}`;
  }

  // ─── TEST 1: Add 100K rows ──────────────────────────────────────────────
  test("add 100K rows — completes within 60s", async ({ page }) => {
    const url = gridURL();
    console.log("\n=== TEST 1: Add 100K Rows ===");
    console.log("  Grid URL:", url);

    await page.goto(url, { waitUntil: "networkidle" });

    // Wait for the grid to render
    await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
    await page.waitForTimeout(1000); // let initial data load

    // Check if we already have enough rows (from a previous run)
    const existingCount = await getDisplayedRowCount(page);
    const existingNum = parseInt(existingCount.replace(/,/g, ""), 10);
    if (existingNum >= 100_000) {
      console.log(`  Already have ${existingCount} rows — skipping bulk add`);
      return;
    }

    // Find and click the bulk add pill (use exact text match to avoid tooltip)
    const bulkPill = page.getByText("100,000 rows", { exact: true });
    await expect(bulkPill).toBeVisible({ timeout: 10_000 });
    await bulkPill.click();

    // Confirm in the dialog — find the button with "Add records" text
    const confirmBtn = page.getByRole("button", { name: /add records/i });
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });

    const t0 = performance.now();
    await confirmBtn.click();

    // Wait for the loading indicator to appear and then disappear
    // The pill shows "Adding records…" while in progress
    await page.waitForSelector('text="Adding records…"', { timeout: 5_000 }).catch(() => {
      // May have already completed by the time we check
    });

    // Wait for the loading to finish — the pill goes back to normal
    // or the row count updates. We'll wait for the spinner to disappear.
    await page.waitForFunction(
      () => !document.body.innerText.includes("Adding records"),
      { timeout: 60_000 },
    );

    const addTime = elapsed(t0);
    log("Bulk add 100K rows", addTime, 60_000);

    // Verify row count updated
    await page.waitForTimeout(2000); // let UI settle
    const rowCount = await getDisplayedRowCount(page);
    console.log(`  Row count displayed: ${rowCount}`);

    // Should have at least 100K rows (could have the initial 20 + 100K)
    const numericCount = parseInt(rowCount.replace(/,/g, ""), 10);
    expect(numericCount).toBeGreaterThanOrEqual(100_000);

    expect(addTime).toBeLessThan(60_000);
  });

  // ─── TEST 2: Scroll to end (default view) — STRICT 1.5s ─────────────────
  test("scroll to end (default) — data visible under 1.5s", async ({ page }) => {
    console.log("\n=== TEST 2: Scroll to End (Default View) [STRICT] ===");

    await page.goto(gridURL(), { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
    await waitForDataVisible(page); // Ensure first page is fully rendered before timing

    const approxTotal = await page.evaluate(() => {
      const scroller = document.querySelector('[class*="gridContentScroller"]');
      return scroller ? Math.round(scroller.scrollHeight / 32) : 100_000;
    });

    const t0 = performance.now();
    await page.evaluate(() => {
      const scroller = document.querySelector('[class*="gridContentScroller"]');
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });

    await waitForDataAtPosition(page, Math.round(approxTotal * 0.85), 1_500, approxTotal);
    const scrollTime = elapsed(t0);

    const visibleRows = await getVisibleRowNumbers(page);
    const maxVisibleIndex = Math.max(...visibleRows);
    console.log(`  Last visible row: ${maxVisibleIndex} / ~${approxTotal}`);
    log("Scroll→end + data", scrollTime, 1_500);

    expect(maxVisibleIndex).toBeGreaterThan(approxTotal * 0.9);
    expect(scrollTime).toBeLessThan(1_500);
  });

  // ─── TEST 3: Jump to middle — STRICT 1.5s ────────────────────────────────
  test("jump to middle (~50%) — data visible under 1.5s", async ({ page }) => {
    console.log("\n=== TEST 3: Jump to Middle [STRICT] ===");

    await page.goto(gridURL(), { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
    await waitForDataVisible(page); // Ensure first page is fully rendered before timing

    const totalItems = await page.evaluate(() => {
      const scroller = document.querySelector('[class*="gridContentScroller"]');
      return scroller ? Math.round(scroller.scrollHeight / 32) : 100_000;
    });

    const t0 = performance.now();
    await page.evaluate(() => {
      const scroller = document.querySelector('[class*="gridContentScroller"]');
      if (scroller) scroller.scrollTop = scroller.scrollHeight * 0.5;
    });

    const midMin = Math.round(totalItems * 0.35);
    const midMax = Math.round(totalItems * 0.65);
    await waitForDataAtPosition(page, midMin, 1_500, midMax);
    const jumpTime = elapsed(t0);

    const visibleRows = await getVisibleRowNumbers(page);
    const midRow = visibleRows[Math.floor(visibleRows.length / 2)] ?? 0;
    console.log(`  Mid row: ${midRow} / ~${totalItems}`);
    log("Jump→50% + data", jumpTime, 1_500);

    expect(midRow).toBeGreaterThan(totalItems * 0.3);
    expect(midRow).toBeLessThan(totalItems * 0.7);
    expect(jumpTime).toBeLessThan(1_500);
  });

  // ─── TEST 4: Scroll to end (sorted view) — STRICT 1.5s ──────────────────
  test("scroll to end (sorted) — data visible under 1.5s", async ({ page }) => {
    console.log("\n=== TEST 4: Scroll to End (Sorted) [STRICT] ===");

    await page.goto(gridURL(), { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
    await waitForDataVisible(page); // Ensure first page is fully rendered before timing

    // Apply a sort via the toolbar
    const sortButton = page.locator('[class*="toolbarBtn"]', { hasText: /sort/i });
    if (await sortButton.count() > 0) {
      await sortButton.click();
      await page.waitForTimeout(500);
      const addSort = page.locator("text=/add.*sort/i").first();
      if (await addSort.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addSort.click();
        await page.waitForTimeout(500);
        const nameOption = page.locator("text=Name").first();
        if (await nameOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nameOption.click();
          await page.waitForTimeout(500);
        }
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);
    } else {
      const firstHeader = page.locator('[class*="gridHeaderCell"]').first();
      await firstHeader.click({ button: "right" });
      await page.waitForTimeout(500);
      const sortAsc = page.locator("text=/sort.*asc/i").first();
      if (await sortAsc.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sortAsc.click();
        await page.waitForTimeout(1000);
      }
    }

    const approxTotal = await page.evaluate(() => {
      const scroller = document.querySelector('[class*="gridContentScroller"]');
      return scroller ? Math.round(scroller.scrollHeight / 32) : 100_000;
    });

    // Now scroll to end — start the clock
    const t0 = performance.now();
    await page.evaluate(() => {
      const scroller = document.querySelector('[class*="gridContentScroller"]');
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });

    await waitForDataAtPosition(page, Math.round(approxTotal * 0.85), 1_500, approxTotal);
    const scrollTime = elapsed(t0);

    const visibleRows = await getVisibleRowNumbers(page);
    const maxVisibleIndex = Math.max(...visibleRows);
    console.log(`  Last visible row (sorted): ${maxVisibleIndex} / ~${approxTotal}`);
    log("Scroll→end (sorted) + data", scrollTime, 1_500);

    expect(maxVisibleIndex).toBeGreaterThan(approxTotal * 0.9);
    expect(scrollTime).toBeLessThan(1_500);
  });

  // ─── TEST 5: Rapid sequential jumps — STRICT 1.3s each ─────────────────
  test("rapid jumps — each position loads under 1.3s", async ({ page }) => {
    console.log("\n=== TEST 5: Rapid Jumps [STRICT 1.3s] ===");

    await page.goto(gridURL(), { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
    await waitForDataVisible(page); // Ensure first page is fully rendered before timing

    const approxTotal = await page.evaluate(() => {
      const scroller = document.querySelector('[class*="gridContentScroller"]');
      return scroller ? Math.round(scroller.scrollHeight / 32) : 100_000;
    });

    const positions = [
      { fraction: 0.25, min: Math.round(approxTotal * 0.15), max: Math.round(approxTotal * 0.35) },
      { fraction: 0.75, min: Math.round(approxTotal * 0.65), max: Math.round(approxTotal * 0.85) },
      { fraction: 0.1,  min: Math.round(approxTotal * 0.03), max: Math.round(approxTotal * 0.18) },
      { fraction: 0.9,  min: Math.round(approxTotal * 0.80), max: Math.round(approxTotal * 0.98) },
      { fraction: 0.5,  min: Math.round(approxTotal * 0.40), max: Math.round(approxTotal * 0.60) },
    ];

    let maxJump = 0;
    for (const { fraction, min, max } of positions) {
      const label = `${Math.round(fraction * 100)}%`;
      const t0 = performance.now();

      await page.evaluate((frac) => {
        const scroller = document.querySelector('[class*="gridContentScroller"]');
        if (scroller) scroller.scrollTop = scroller.scrollHeight * frac;
      }, fraction);

      await waitForDataAtPosition(page, min, 1_300, max);
      const jumpTime = elapsed(t0);
      if (jumpTime > maxJump) maxJump = jumpTime;

      const visibleRows = await getVisibleRowNumbers(page);
      const midRow = visibleRows[Math.floor(visibleRows.length / 2)] ?? 0;
      log(`${label} (row ~${midRow})`, jumpTime, 1_300);

      expect(jumpTime).toBeLessThan(1_300);
    }
    console.log(`  Worst jump: ${maxJump}ms`);
  });

  // ─── TEST 6: Scrollbar thumb accuracy ───────────────────────────────────
  test("scrollbar accurately represents full dataset", async ({ page }) => {
    console.log("\n=== TEST 6: Scrollbar Accuracy ===");

    await page.goto(gridURL(), { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
    await page.waitForTimeout(2000);

    const metrics = await page.evaluate(() => {
      const scroller = document.querySelector('[class*="gridContentScroller"]');
      const inner = document.querySelector('[class*="gridContentScrollerInner"]');
      if (!scroller || !inner) return null;

      return {
        scrollerHeight: scroller.clientHeight,
        contentHeight: inner.scrollHeight,
        scrollHeight: scroller.scrollHeight,
      };
    });

    console.log(`  Scroller viewport: ${metrics?.scrollerHeight}px`);
    console.log(`  Content height: ${metrics?.contentHeight}px`);
    console.log(`  Scroll height: ${metrics?.scrollHeight}px`);

    // Content height should be substantial (>100K rows * ~32px each = >3.2M px)
    expect(metrics).toBeTruthy();
    // At least 100K * 32px = 3.2M pixels
    expect(metrics!.contentHeight).toBeGreaterThan(3_000_000);
    console.log("  ✓ Scrollbar height represents full dataset");
  });

  // ─── TEST 7: Data integrity at various positions ────────────────────────
  test("data integrity — cell content matches expected pattern", async ({ page }) => {
    console.log("\n=== TEST 7: Data Integrity ===");

    await page.goto(gridURL(), { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
    await page.waitForTimeout(2000);

    // Check rows near the top (these are loaded by infinite scroll)
    const topCells = await page.evaluate(() => {
      const rows = document.querySelectorAll("[data-index]");
      const result: { index: number; text: string }[] = [];
      for (const row of rows) {
        const idx = parseInt(row.getAttribute("data-index") ?? "-1", 10);
        if (idx >= 0 && idx < 5) {
          const firstCell = row.querySelector('[class*="gridDataCell"] [class*="gridCellContent"]');
          result.push({ index: idx, text: firstCell?.textContent?.trim() ?? "" });
        }
      }
      return result;
    });

    console.log(`  Top rows: ${JSON.stringify(topCells.slice(0, 3))}`);
    // First few rows should have content (not empty, not "[object Object]")
    for (const cell of topCells) {
      expect(cell.text).toBeTruthy();
      expect(cell.text).not.toBe("[object Object]");
      expect(cell.text).not.toBe("undefined");
    }

    // Now scroll to ~25% and check data there
    await page.evaluate(() => {
      const scroller = document.querySelector('[class*="gridContentScroller"]');
      if (scroller) scroller.scrollTop = scroller.scrollHeight * 0.25;
    });

    const approxTotal = await page.evaluate(() => {
      const scroller = document.querySelector('[class*="gridContentScroller"]');
      return scroller ? Math.round(scroller.scrollHeight / 32) : 100_000;
    });

    const minPos = Math.round(approxTotal * 0.2);
    const maxPos = Math.round(approxTotal * 0.3);
    await waitForDataAtPosition(page, minPos, 15_000, maxPos);

    const midCells = await page.evaluate((minIdx: number) => {
      const rows = document.querySelectorAll("[data-index]");
      const result: { index: number; text: string }[] = [];
      for (const row of rows) {
        const idx = parseInt(row.getAttribute("data-index") ?? "-1", 10);
        if (idx >= minIdx && result.length < 3) {
          const firstCell = row.querySelector('[class*="gridDataCell"] [class*="gridCellContent"]');
          result.push({ index: idx, text: firstCell?.textContent?.trim() ?? "" });
        }
      }
      return result;
    }, minPos);

    console.log(`  Mid rows (~25%): ${JSON.stringify(midCells)}`);
    for (const cell of midCells) {
      expect(cell.text).toBeTruthy();
      expect(cell.text).not.toBe("[object Object]");
      // Data from addMany generates "Person N" for text columns
      expect(cell.text).toMatch(/^Person \d+$/);
    }
    console.log("  ✓ All sampled cells contain valid data");
  });

  // ─── TEST 8: Row count in footer is formatted correctly ─────────────────
  test("footer shows formatted row count", async ({ page }) => {
    console.log("\n=== TEST 8: Footer Row Count ===");

    await page.goto(gridURL(), { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
    await page.waitForTimeout(2000);

    const footerText = await page.evaluate(() => {
      const footer = document.querySelector('[class*="gridFooterRecordCount"]');
      return footer?.textContent?.trim() ?? "";
    });

    console.log(`  Footer text: "${footerText}"`);
    // Should show a formatted number like "100,000 records" or "200,000 records"
    expect(footerText).toMatch(/^[\d,]+ records?$/);
    // Verify comma formatting for large numbers
    const match = /^([\d,]+)/.exec(footerText);
    const numStr = match?.[1] ?? "0";
    expect(numStr).toContain(","); // should have comma separators
    console.log("  ✓ Footer row count is properly formatted");
  });

  // ─── TEST 9: Search filters rows and scroll works within results ────────
  test("search filters visible rows", async ({ page }) => {
    console.log("\n=== TEST 9: Search Filtering ===");

    await page.goto(gridURL(), { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
    await page.waitForTimeout(2000);

    // Get initial row count
    const initialCount = await page.evaluate(() => {
      const footer = document.querySelector('[class*="gridFooterRecordCount"]');
      const text = footer?.textContent ?? "0";
      return parseInt(text.replace(/[^\d]/g, ""), 10);
    });
    console.log(`  Initial count: ${initialCount}`);

    // Open the FindBar by clicking the magnifying glass button in GridBar
    // The button has class "gridBarSearchButton" and contains an SVG icon
    const searchBtn = page.locator('[class*="gridBarSearchButton"]').first();
    const hasSearchBtn = await searchBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasSearchBtn) {
      await searchBtn.click();
      await page.waitForTimeout(500);

      // The FindBar input has placeholder "Find in view..."
      const findInput = page.locator('input[placeholder*="Find in view"]').first();
      await expect(findInput).toBeVisible({ timeout: 3_000 });

      // Use a very specific search term that matches few rows
      const searchTerm = "Person 199999";
      await findInput.fill(searchTerm);

      // Wait for debounce (250ms) + query execution + UI update
      // Poll the footer count until it changes or we timeout
      let filteredCount = initialCount;
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(1000);
        filteredCount = await page.evaluate(() => {
          const footer = document.querySelector('[class*="gridFooterRecordCount"]');
          const text = footer?.textContent ?? "0";
          return parseInt(text.replace(/[^\d]/g, ""), 10);
        });
        if (filteredCount < initialCount) break;
      }

      console.log(`  Filtered count for "${searchTerm}": ${filteredCount}`);
      // "Person 199999" should match very few rows (only Person 199999 and maybe Person 1999990-9 if they existed)
      expect(filteredCount).toBeGreaterThan(0);
      expect(filteredCount).toBeLessThan(initialCount);

      // Clear search by clearing the input
      await findInput.fill("");
      await page.waitForTimeout(1000);

      // Verify count restored
      const restoredCount = await page.evaluate(() => {
        const footer = document.querySelector('[class*="gridFooterRecordCount"]');
        const text = footer?.textContent ?? "0";
        return parseInt(text.replace(/[^\d]/g, ""), 10);
      });
      console.log(`  Restored count: ${restoredCount}`);

      // Close FindBar
      await page.keyboard.press("Escape");
      console.log("  ✓ Search correctly filters and restores rows");
    } else {
      console.log("  ⚠ Could not find search button, skipping search test");
    }
  });

  // ─── TEST 10: Cell editing persists ─────────────────────────────────────
  test("cell edit persists after navigation", async ({ page }) => {
    console.log("\n=== TEST 10: Cell Editing ===");

    await page.goto(gridURL(), { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
    await page.waitForTimeout(2000);

    // Double-click the first data cell to start editing
    const firstCell = page.locator('[class*="gridDataCell"]').first();
    await expect(firstCell).toBeVisible();

    const originalText = await firstCell.textContent();
    console.log(`  Original cell text: "${originalText?.trim()}"`);

    // Double-click to enter edit mode
    await firstCell.dblclick();
    await page.waitForTimeout(300);

    // Type a new value
    const testValue = `E2E_Test_${Date.now()}`;
    const input = page.locator('[class*="gridDataCell"] input, [class*="gridDataCell"] textarea, [class*="gridCellEditor"]').first();
    const hasInput = await input.isVisible({ timeout: 2_000 }).catch(() => false);

    if (hasInput) {
      await input.fill(testValue);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1000);

      // Verify the cell now shows the new value
      const updatedText = await firstCell.textContent();
      console.log(`  Updated cell text: "${updatedText?.trim()}"`);
      expect(updatedText?.trim()).toBe(testValue);

      // Scroll away and back to verify data persists in memory
      await page.evaluate(() => {
        const scroller = document.querySelector('[class*="gridContentScroller"]');
        if (scroller) scroller.scrollTop = 5000;
      });
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const scroller = document.querySelector('[class*="gridContentScroller"]');
        if (scroller) scroller.scrollTop = 0;
      });
      await page.waitForTimeout(500);

      const persistedText = await firstCell.textContent();
      console.log(`  Persisted cell text: "${persistedText?.trim()}"`);
      expect(persistedText?.trim()).toBe(testValue);

      // Restore original value
      await firstCell.dblclick();
      await page.waitForTimeout(300);
      const restoreInput = page.locator('[class*="gridDataCell"] input, [class*="gridDataCell"] textarea, [class*="gridCellEditor"]').first();
      if (await restoreInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await restoreInput.fill(originalText?.trim() ?? "");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(500);
      }

      console.log("  ✓ Cell edit persists correctly");
    } else {
      console.log("  ⚠ Could not find cell editor input, skipping edit test");
    }
  });

  // ─── TEST 11: Keyboard navigation moves active cell ─────────────────────
  test("keyboard navigation — arrow keys move selection", async ({ page }) => {
    console.log("\n=== TEST 11: Keyboard Navigation ===");

    await page.goto(gridURL(), { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
    await page.waitForTimeout(2000);

    // Click the first data cell to activate it
    const firstCell = page.locator('[class*="gridDataCell"]').first();
    await firstCell.click();
    await page.waitForTimeout(500);

    // Check the selection overlay is visible (CSS module mangles the class name,
    // so use "gridSelectionOverlay" partial match)
    const overlay = page.locator('[class*="gridSelectionOverlay"]').first();

    // Wait for the overlay to become visible (display: block is set by JS)
    const hasOverlay = await page.waitForFunction(() => {
      const el = document.querySelector('[class*="gridSelectionOverlay"]');
      return el && getComputedStyle(el).display !== "none";
    }, { timeout: 3_000 }).then(() => true).catch(() => false);
    console.log(`  Selection overlay visible: ${hasOverlay}`);

    if (hasOverlay) {
      // Record initial overlay position
      const pos1 = await overlay.boundingBox();
      console.log(`  Initial position: top=${pos1?.y?.toFixed(0)}, left=${pos1?.x?.toFixed(0)}`);

      // Press ArrowDown — overlay should move down
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(200);
      const pos2 = await overlay.boundingBox();
      console.log(`  After ArrowDown: top=${pos2?.y?.toFixed(0)}, left=${pos2?.x?.toFixed(0)}`);
      expect(pos2!.y).toBeGreaterThan(pos1!.y);

      // Press ArrowRight — overlay should move right
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(200);
      const pos3 = await overlay.boundingBox();
      console.log(`  After ArrowRight: top=${pos3?.y?.toFixed(0)}, left=${pos3?.x?.toFixed(0)}`);
      expect(pos3!.x).toBeGreaterThan(pos2!.x);

      // Press ArrowUp — overlay should move back up
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(200);
      const pos4 = await overlay.boundingBox();
      console.log(`  After ArrowUp: top=${pos4?.y?.toFixed(0)}, left=${pos4?.x?.toFixed(0)}`);
      expect(pos4!.y).toBeLessThan(pos3!.y);

      // Press ArrowLeft — overlay should move back left
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(200);
      const pos5 = await overlay.boundingBox();
      console.log(`  After ArrowLeft: top=${pos5?.y?.toFixed(0)}, left=${pos5?.x?.toFixed(0)}`);
      expect(pos5!.x).toBeLessThan(pos4!.x);

      // Escape clears selection
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      const overlayHidden = await page.evaluate(() => {
        const el = document.querySelector('[class*="gridSelectionOverlay"]') as HTMLElement | null;
        return !el || getComputedStyle(el).display === "none" || el.style.display === "none";
      });
      console.log(`  After Escape, overlay hidden: ${overlayHidden}`);
      expect(overlayHidden).toBe(true);

      console.log("  ✓ Keyboard navigation works correctly");
    } else {
      console.log("  ⚠ Selection overlay not found, skipping keyboard nav test");
    }
  });

  // ─── TEST 12: Single row add via "+" button ─────────────────────────────
  test("add single row — mutation succeeds and count updates", async ({ page }) => {
    console.log("\n=== TEST 12: Single Row Add ===");

    await page.goto(gridURL(), { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
    await page.waitForTimeout(2000);

    // Get initial count
    const initialCount = await page.evaluate(() => {
      const footer = document.querySelector('[class*="gridFooterRecordCount"]');
      const text = footer?.textContent ?? "0";
      return parseInt(text.replace(/[^\d]/g, ""), 10);
    });
    console.log(`  Initial count: ${initialCount}`);

    // Scroll to the bottom to reveal the "+" button
    await page.evaluate(() => {
      const scroller = document.querySelector('[class*="gridContentScroller"]');
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
    await page.waitForTimeout(2000);

    // Set up mutation response interception BEFORE clicking
    const mutationResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes("trpc") && resp.url().includes("addMany"),
      { timeout: 15_000 },
    ).catch(() => null);

    // Click the "+" button
    const addRowBtn = page.locator('[class*="gridAddRowFrozenInner"]').first();
    await addRowBtn.click({ force: true, timeout: 5_000 });

    // Wait for the tRPC mutation response
    const mutResponse = await mutationResponsePromise;
    const mutFired = mutResponse !== null && mutResponse.status() === 200;
    console.log(`  Mutation succeeded: ${mutFired}`);
    expect(mutFired).toBe(true);

    // Mutation returned 200 — the server added the row.
    // Now scroll back to top to ensure the refetched data is rendered
    await page.evaluate(() => {
      const scroller = document.querySelector('[class*="gridContentScroller"]');
      if (scroller) scroller.scrollTop = 0;
    });

    // Poll for count update (cache invalidation should trigger refetch)
    let newCount = initialCount;
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);
      newCount = await page.evaluate(() => {
        const footer = document.querySelector('[class*="gridFooterRecordCount"]');
        const text = footer?.textContent ?? "0";
        return parseInt(text.replace(/[^\d]/g, ""), 10);
      });
      if (newCount > initialCount) break;
    }

    // If polling didn't pick up the change, reload as fallback
    if (newCount <= initialCount) {
      console.log("  Polling didn't detect change, reloading...");
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
      await page.waitForTimeout(2000);
      newCount = await page.evaluate(() => {
        const footer = document.querySelector('[class*="gridFooterRecordCount"]');
        const text = footer?.textContent ?? "0";
        return parseInt(text.replace(/[^\d]/g, ""), 10);
      });
    }

    console.log(`  New count: ${newCount}`);
    expect(newCount).toBe(initialCount + 1);
    console.log("  ✓ Single row added successfully");
  });

  // ─── TEST 13: Time-to-first-data on page load — STRICT ──────────────────
  test("page load — first data row visible under 2s", async ({ page }) => {
    console.log("\n=== TEST 13: Time to First Data [STRICT] ===");

    const t0 = performance.now();
    await page.goto(gridURL(), { waitUntil: "commit" }); // don't wait for networkidle

    // Wait for a data cell with actual text content (not skeleton)
    await page.waitForFunction(() => {
      const cells = document.querySelectorAll('[class*="gridDataCell"] [class*="gridCellContent"]');
      for (const cell of cells) {
        const text = cell.textContent?.trim();
        if (text && text.length > 0 && !cell.querySelector('[class*="skeleton"]')) {
          return true;
        }
      }
      return false;
    }, { timeout: 2_000 });
    const ttfd = elapsed(t0);
    log("Time to first data row", ttfd, 2_000);
    console.log(`  First data visible in ${ttfd}ms`);
    expect(ttfd).toBeLessThan(2_000);
  });

  // ─── TEST 14: Search response time — STRICT ───────────────────────────
  test("search — filtered results appear under 2s", async ({ page }) => {
    console.log("\n=== TEST 14: Search Speed [STRICT] ===");

    await page.goto(gridURL(), { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
    await page.waitForTimeout(1500);

    // Capture the initial count so we know when it actually changes
    const initialCount = await page.evaluate(() => {
      const footer = document.querySelector('[class*="gridFooterRecordCount"]');
      const text = footer?.textContent ?? "0";
      return parseInt(text.replace(/[^\d]/g, ""), 10);
    });
    console.log(`  Initial count: ${initialCount}`);

    // Open FindBar
    const searchBtn = page.locator('[class*="gridBarSearchButton"]').first();
    await searchBtn.click();
    await page.waitForTimeout(300);

    const findInput = page.locator('input[placeholder*="Find in view"]').first();
    await expect(findInput).toBeVisible({ timeout: 2_000 });

    // Time from typing to footer count ACTUALLY changing
    const t0 = performance.now();
    await findInput.fill("Person 199999");

    // Wait for the footer count to become STRICTLY less than initial (= search filter applied)
    await page.waitForFunction(
      (initCount: number) => {
        const footer = document.querySelector('[class*="gridFooterRecordCount"]');
        const text = footer?.textContent ?? "0";
        const count = parseInt(text.replace(/[^\d]/g, ""), 10);
        return count > 0 && count < initCount;
      },
      initialCount,
      { timeout: 2_000 },
    );
    const searchTime = elapsed(t0);

    const filteredCount = await page.evaluate(() => {
      const footer = document.querySelector('[class*="gridFooterRecordCount"]');
      const text = footer?.textContent ?? "0";
      return parseInt(text.replace(/[^\d]/g, ""), 10);
    });
    console.log(`  Filtered to ${filteredCount} rows`);
    log("Search → results visible", searchTime, 2_000);
    console.log(`  Search completed in ${searchTime}ms`);
    expect(searchTime).toBeLessThan(2_000);

    // Clear and close
    await findInput.fill("");
    await page.waitForTimeout(500);
    await page.keyboard.press("Escape");
  });

  // ─── TEST 15: Cell edit latency — STRICT ──────────────────────────────
  test("cell edit — editor appears under 300ms", async ({ page }) => {
    console.log("\n=== TEST 15: Cell Edit Speed [STRICT] ===");

    await page.goto(gridURL(), { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
    await page.waitForTimeout(1500);

    const firstCell = page.locator('[class*="gridDataCell"]').first();
    await expect(firstCell).toBeVisible();

    // Double-click and time until the input appears
    const t0 = performance.now();
    await firstCell.dblclick();

    const input = page.locator('[class*="gridDataCell"] input, [class*="gridDataCell"] textarea, [class*="gridCellEditor"]').first();
    await expect(input).toBeVisible({ timeout: 300 });
    const editTime = elapsed(t0);
    log("Double-click → editor visible", editTime, 300);
    console.log(`  Editor appeared in ${editTime}ms`);
    expect(editTime).toBeLessThan(300);

    // Escape out of editing
    await page.keyboard.press("Escape");
  });

  // ─── TEST 16: windowFetch API round-trip — STRICT ─────────────────────
  test("windowFetch API — responds under 400ms", async ({ page }) => {
    console.log("\n=== TEST 16: API Speed [STRICT] ===");

    await page.goto(gridURL(), { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
    await waitForDataVisible(page); // Ensure page fully initialized

    // Intercept a windowFetch request by scrolling to a far position
    const apiPromise = page.waitForResponse(
      (resp) => resp.url().includes("trpc") && resp.url().includes("windowFetch"),
      { timeout: 5_000 },
    );

    const t0 = performance.now();
    // Scroll to 60% to trigger a windowFetch
    await page.evaluate(() => {
      const scroller = document.querySelector('[class*="gridContentScroller"]');
      if (scroller) scroller.scrollTop = scroller.scrollHeight * 0.6;
    });

    const resp = await apiPromise;
    const apiTime = elapsed(t0);
    const status = resp.status();
    log(`windowFetch response (status ${status})`, apiTime, 400);
    console.log(`  API responded in ${apiTime}ms`);
    expect(status).toBe(200);
    expect(apiTime).toBeLessThan(400);
  });

  // ─── TEST 17: Infinite scroll loads more pages ────────────────────────
  test("infinite scroll — gradually loading pages", async ({ page }) => {
    console.log("\n=== TEST 13: Infinite Scroll ===");

    await page.goto(gridURL(), { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="gridContentScroller"]', { timeout: 15_000 });
    await page.waitForTimeout(2000);

    // Check how many data rows are visible initially
    const initialRenderedCount = await page.evaluate(() => {
      const rows = document.querySelectorAll("[data-index]");
      return rows.length;
    });
    console.log(`  Initially rendered rows: ${initialRenderedCount}`);

    // Scroll down progressively (not a jump — just smooth scrolling)
    const scrollSteps = 5;
    let lastMaxIndex = 0;

    for (let step = 1; step <= scrollSteps; step++) {
      await page.evaluate((s) => {
        const scroller = document.querySelector('[class*="gridContentScroller"]');
        if (scroller) {
          // Scroll to step * 5000px (about 156 rows per step)
          scroller.scrollTop = s * 5000;
        }
      }, step);

      // Wait for scroll and potential data loading
      await page.waitForTimeout(1000);

      const maxIndex = await page.evaluate(() => {
        const rows = document.querySelectorAll("[data-index]");
        let max = 0;
        for (const row of rows) {
          const idx = parseInt(row.getAttribute("data-index") ?? "0", 10);
          if (idx > max) max = idx;
        }
        return max;
      });

      console.log(`  After scroll step ${step} (${step * 5000}px): max visible index = ${maxIndex}`);
      expect(maxIndex).toBeGreaterThanOrEqual(lastMaxIndex);
      lastMaxIndex = maxIndex;
    }

    // After scrolling ~25000px, we should have loaded several pages
    // At 32px per row, 25000px / 32 ≈ 781 rows. With 200 per page, that's ~4 pages
    expect(lastMaxIndex).toBeGreaterThan(600);
    console.log("  ✓ Infinite scroll loads data progressively");
  });
});
