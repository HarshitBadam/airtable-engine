/**
 * Playwright Global Setup
 *
 * Seeds the database with a test user, session, base, and table,
 * then saves the auth cookie so all tests run as an authenticated user.
 *
 * This avoids needing to go through Google OAuth in E2E tests.
 */
import { chromium, type FullConfig } from "@playwright/test";
import { fileURLToPath } from "url";
import * as nodePath from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = nodePath.dirname(__filename);

const TEST_USER_EMAIL = "e2e-test@lyra.local";
const TEST_SESSION_TOKEN = "e2e-test-session-token-playwright";
const TEST_BASE_NAME = "E2E Test Base";
const TEST_TABLE_NAME = "E2E Test Table";

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";

  console.log("[global-setup] Seeding test data...");

  // Dynamic import of the generated Prisma client (ESM-compatible)
  const prismaModule = await import("../generated/prisma/index.js");
  const PrismaClient = prismaModule.PrismaClient;
  const prisma = new PrismaClient();

  try {
    // 1. Upsert test user
    let user = await prisma.user.findUnique({
      where: { email: TEST_USER_EMAIL },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: TEST_USER_EMAIL,
          name: "E2E Test User",
        },
      });
      console.log("[global-setup] Created test user:", user.id);
    } else {
      console.log("[global-setup] Found existing test user:", user.id);
    }

    // 2. Upsert session (expires 30 days from now)
    const existingSession = await prisma.session.findUnique({
      where: { sessionToken: TEST_SESSION_TOKEN },
    });

    if (existingSession) {
      await prisma.session.update({
        where: { sessionToken: TEST_SESSION_TOKEN },
        data: { expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });
      console.log("[global-setup] Refreshed session expiry");
    } else {
      await prisma.session.create({
        data: {
          sessionToken: TEST_SESSION_TOKEN,
          userId: user.id,
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      console.log("[global-setup] Created test session");
    }

    // 3. Find or create a test base with a table
    let base = await prisma.base.findFirst({
      where: { ownerId: user.id, name: TEST_BASE_NAME },
      include: { tables: { include: { columns: true } } },
    });

    if (!base) {
      base = await prisma.base.create({
        data: {
          name: TEST_BASE_NAME,
          ownerId: user.id,
          tables: {
            create: {
              name: TEST_TABLE_NAME,
              rowCount: 0,
              nextRowIndex: 1,
              columns: {
                create: [
                  { name: "Name", type: "TEXT", order: 0 },
                  { name: "Amount", type: "NUMBER", order: 1 },
                ],
              },
            },
          },
        },
        include: { tables: { include: { columns: true } } },
      });
      console.log("[global-setup] Created test base:", base.id);

      // Create a default view for the table
      const table = base.tables[0]!;
      await prisma.view.create({
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
      console.log("[global-setup] Created default view for table:", table.id);
    } else {
      console.log("[global-setup] Found existing test base:", base.id);
    }

    const table = base.tables[0]!;

    // Write test metadata for specs to read
    const fs = await import("fs");
    const metaPath = nodePath.join(__dirname, ".auth", "test-meta.json");
    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          userId: user.id,
          baseId: base.id,
          tableId: table.id,
          columnIds: table.columns.map((c) => ({ id: c.id, name: c.name, type: c.type })),
        },
        null,
        2,
      ),
    );
    console.log("[global-setup] Wrote test metadata to", metaPath);

    // 4. Save auth state (session cookie) for Playwright
    const browser = await chromium.launch();
    const context = await browser.newContext();

    // NextAuth v5 dev cookie name: authjs.session-token
    await context.addCookies([
      {
        name: "authjs.session-token",
        value: TEST_SESSION_TOKEN,
        domain: new URL(baseURL).hostname,
        path: "/",
        httpOnly: true,
        secure: false, // false for localhost
        sameSite: "Lax",
      },
    ]);

    const statePath = nodePath.join(__dirname, ".auth", "state.json");
    await context.storageState({ path: statePath });
    console.log("[global-setup] Saved auth state to", statePath);

    await browser.close();
    console.log("[global-setup] Done! Test URL:", `${baseURL}/bases/${base.id}/tables/${table.id}`);
  } finally {
    await prisma.$disconnect();
  }
}
