import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkMigrationSafety } from "./check-migration-safety.mjs";

async function fixture(t, migrations) {
  const root = await mkdtemp(join(tmpdir(), "migration-safety-"));
  const migrationsDir = join(root, "migrations");
  const baselinePath = join(root, "baseline.json");
  await mkdir(migrationsDir);
  t.after(() => rm(root, { recursive: true, force: true }));

  for (const [name, sql] of Object.entries(migrations)) {
    const migrationDir = join(migrationsDir, name);
    await mkdir(migrationDir);
    await writeFile(join(migrationDir, "migration.sql"), sql);
  }

  return {
    migrationsDir,
    baselinePath,
    writeBaseline: (historicalDestructiveMigrations = {}) =>
      writeFile(
        baselinePath,
        JSON.stringify({ historicalDestructiveMigrations }),
      ),
  };
}

test("accepts non-destructive migrations", async (t) => {
  const setup = await fixture(t, {
    "20260101000000_create_widget":
      'CREATE TABLE "Widget" ("id" TEXT PRIMARY KEY);',
  });
  await setup.writeBaseline();

  const result = await checkMigrationSafety(setup);

  assert.deepEqual(result.violations, []);
  assert.equal(result.destructiveCount, 0);
});

test("rejects a new destructive migration", async (t) => {
  const setup = await fixture(t, {
    "20260101000000_reset_widgets": 'DELETE FROM "Widget";',
  });
  await setup.writeBaseline();

  const result = await checkMigrationSafety(setup);

  assert.match(result.violations[0], /without a historical baseline exception/);
});

test("only accepts the exact historical migration", async (t) => {
  const name = "20260101000000_historical_reset";
  const sql = 'DELETE FROM "Widget";';
  const setup = await fixture(t, { [name]: sql });
  await setup.writeBaseline({
    [name]: {
      sha256: createHash("sha256").update(sql).digest("hex"),
      reason: "Previously shipped migration.",
    },
  });

  assert.deepEqual((await checkMigrationSafety(setup)).violations, []);

  await writeFile(
    join(setup.migrationsDir, name, "migration.sql"),
    `${sql}\n-- changed`,
  );
  assert.match(
    (await checkMigrationSafety(setup)).violations[0],
    /checksum differs/,
  );
});
