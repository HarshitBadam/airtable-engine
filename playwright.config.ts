import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for Lyra Airtable.
 *
 * Prerequisites:
 *   1. Dev server running: `pnpm dev`
 *   2. Database seeded with test data: `pnpm test:setup`
 *
 * Usage:
 *   pnpm test:e2e          — run all E2E tests
 *   pnpm test:e2e:ui       — open Playwright UI mode
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // sequential — tests share state (100K rows)
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,

  // Generous timeout for bulk operations (add 100K can take 10-30s)
  timeout: 120_000,
  expect: { timeout: 30_000 },

  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    storageState: "./e2e/.auth/state.json",
  },

  globalSetup: "./e2e/global-setup.ts",

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Optionally start dev server (comment out if already running)
  // webServer: {
  //   command: "pnpm dev",
  //   url: "http://localhost:3000",
  //   reuseExistingServer: true,
  //   timeout: 30_000,
  // },
});
