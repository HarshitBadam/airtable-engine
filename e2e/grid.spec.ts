/**
 * Grid E2E tests — run as an authenticated user.
 *
 * Reads `e2e/.auth/test-meta.json` (written by global-setup.ts) to get the
 * exact baseId / tableId / columnIds for the seeded "E2E Test Table".
 *
 * Prerequisites:
 *   1. `pnpm test:setup` (or running global-setup) to seed the database and
 *      write test-meta.json
 *   2. Dev server running at BASE_URL (default http://localhost:3000)
 */
import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ColumnMeta {
  id: string;
  name: string;
  type: string;
}

interface TestMeta {
  userId: string;
  baseId: string;
  tableId: string;
  columnIds: ColumnMeta[];
}

function readTestMeta(): TestMeta {
  const metaPath = path.join(__dirname, ".auth", "test-meta.json");
  return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as TestMeta;
}

/** Navigate to the E2E test table and wait for column headers to appear. */
async function gotoTable(page: Page, meta: TestMeta) {
  await page.goto(`/bases/${meta.baseId}/tables/${meta.tableId}`);

  // Column headers carry data-col-header-id; wait for at least one.
  await expect(page.locator("[data-col-header-id]").first()).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("Grid – column headers", () => {
  test("renders the 'Name' column header", async ({ page }) => {
    const meta = readTestMeta();
    await gotoTable(page, meta);

    const nameCol = meta.columnIds.find((c) => c.name === "Name");
    expect(nameCol).toBeDefined();

    await expect(
      page.locator(`[data-col-header-id="${nameCol!.id}"]`),
    ).toBeVisible();

    await expect(
      page.locator(`[data-col-header-id="${nameCol!.id}"]`),
    ).toContainText("Name");
  });

  test("renders the 'Amount' column header", async ({ page }) => {
    const meta = readTestMeta();
    await gotoTable(page, meta);

    const amountCol = meta.columnIds.find((c) => c.name === "Amount");
    expect(amountCol).toBeDefined();

    await expect(
      page.locator(`[data-col-header-id="${amountCol!.id}"]`),
    ).toBeVisible();

    await expect(
      page.locator(`[data-col-header-id="${amountCol!.id}"]`),
    ).toContainText("Amount");
  });

  test("column count matches the seeded schema", async ({ page }) => {
    const meta = readTestMeta();
    await gotoTable(page, meta);

    // global-setup creates exactly 2 columns (Name + Amount).
    const colHeaders = page.locator("[data-col-header-id]");
    await expect(colHeaders).toHaveCount(meta.columnIds.length);
  });
});

test.describe("Grid – toolbar", () => {
  test("Hide fields button is visible", async ({ page }) => {
    const meta = readTestMeta();
    await gotoTable(page, meta);

    await expect(page.getByText("Hide fields")).toBeVisible();
  });

  test("Filter button is visible", async ({ page }) => {
    const meta = readTestMeta();
    await gotoTable(page, meta);

    await expect(page.getByText("Filter")).toBeVisible();
  });

  test("Sort button is visible", async ({ page }) => {
    const meta = readTestMeta();
    await gotoTable(page, meta);

    await expect(page.getByText("Sort")).toBeVisible();
  });
});

test.describe("Grid – add field panel", () => {
  test("clicking the add-column button opens the CreateFieldPanel", async ({
    page,
  }) => {
    const meta = readTestMeta();
    await gotoTable(page, meta);

    // The add-column button is the first div sibling after the last
    // [data-col-header-id] element in the scrollable header area.
    // We use evaluate() to find and click it without depending on CSS-module
    // class names (which are hashed at build time).
    await page.evaluate(() => {
      const headers = document.querySelectorAll("[data-col-header-id]");
      const last = headers[headers.length - 1];
      const addBtn = last?.nextElementSibling as HTMLElement | null;
      addBtn?.click();
    });

    // The CreateFieldPanel renders a search input via a portal.
    await expect(
      page.getByPlaceholder("Find a field type"),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("CreateFieldPanel lists standard field types after opening", async ({
    page,
  }) => {
    const meta = readTestMeta();
    await gotoTable(page, meta);

    await page.evaluate(() => {
      const headers = document.querySelectorAll("[data-col-header-id]");
      const last = headers[headers.length - 1];
      (last?.nextElementSibling as HTMLElement | null)?.click();
    });

    await expect(
      page.getByPlaceholder("Find a field type"),
    ).toBeVisible({ timeout: 5_000 });

    await expect(page.getByText("Text", { exact: true })).toBeVisible();
    await expect(page.getByText("Number", { exact: true })).toBeVisible();
  });

  test("pressing Escape closes the CreateFieldPanel", async ({ page }) => {
    const meta = readTestMeta();
    await gotoTable(page, meta);

    await page.evaluate(() => {
      const headers = document.querySelectorAll("[data-col-header-id]");
      const last = headers[headers.length - 1];
      (last?.nextElementSibling as HTMLElement | null)?.click();
    });

    const searchInput = page.getByPlaceholder("Find a field type");
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Escape");

    await expect(searchInput).not.toBeVisible();
  });
});
