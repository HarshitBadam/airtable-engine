/**
 * Auth E2E tests — run WITHOUT authentication state.
 *
 * Overrides the global storageState (which carries the E2E session cookie)
 * with an empty state so every test in this file is unauthenticated.
 *
 * Prerequisites: dev server running at BASE_URL (default http://localhost:3000).
 */
import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Unauthenticated visitor", () => {
  test("root page shows sign-in form, not a dashboard redirect", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Sign in to Airtable" }),
    ).toBeVisible();
  });

  test("/sign-in page renders the sign-in form correctly", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(
      page.getByRole("heading", { name: "Sign in to Airtable" }),
    ).toBeVisible();

    await expect(page.locator("input[type=email]")).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeVisible();
  });

  test("typing a valid email enables the Continue button", async ({ page }) => {
    await page.goto("/sign-in");

    const continueBtn = page.getByRole("button", { name: "Continue", exact: true });
    await expect(continueBtn).toBeDisabled();

    await page.locator("input[type=email]").fill("user@example.com");

    await expect(continueBtn).toBeEnabled();
  });

  test("sign-in page has a link to create an account", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(
      page.getByRole("link", { name: "Create an account" }),
    ).toBeVisible();
  });
});

test.describe("Authenticated visitor", () => {
  // Override: restore the default auth state for this block only.
  // We read the state file path that is also used by playwright.config.ts.
  test.use({ storageState: "./e2e/.auth/state.json" });

  test("authenticated user visiting / is redirected to /dashboard", async ({
    page,
  }) => {
    await page.goto("/");

    // The root page server-side checks the session and redirects.
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("authenticated user visiting /sign-in is redirected to /dashboard", async ({
    page,
  }) => {
    await page.goto("/sign-in");

    await expect(page).toHaveURL(/\/dashboard/);
  });
});
