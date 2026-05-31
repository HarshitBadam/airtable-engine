/**
 * Dashboard E2E tests — run as an authenticated user.
 *
 * Uses the global storageState set by global-setup.ts (the E2E session cookie),
 * so every test here sees the "E2E Test User" with the seeded "E2E Test Base".
 *
 * Prerequisites:
 *   1. `pnpm test:setup` — seeds the database (global-setup handles this too)
 *   2. Dev server running at BASE_URL (default http://localhost:3000)
 */
import { test, expect } from "@playwright/test";

test.describe("Dashboard page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("region", { name: "Home" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("shows the 'Home' heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  });

  test("displays the seeded E2E test base", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "E2E Test Base" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("opens and closes the Create Base modal", async ({ page }) => {
    const createBtn = page
      .getByRole("button", { name: /create/i })
      .first();
    await createBtn.click();

    const modalHeading = page.getByRole("heading", {
      name: /how do you want to start/i,
    });
    await expect(modalHeading).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Escape");
    await expect(modalHeading).not.toBeVisible();
  });

  test("view-mode toggle buttons are visible", async ({ page }) => {
    await expect(
      page.getByRole("radio", { name: "List view" }),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Grid view" }),
    ).toBeVisible();
  });

  test("filter dropdown button is visible and opens a listbox", async ({
    page,
  }) => {
    const filterBtn = page.getByRole("button", { name: "Filter items" });
    await expect(filterBtn).toBeVisible();

    await filterBtn.click();

    await expect(page.getByRole("listbox")).toBeVisible();
  });
});
