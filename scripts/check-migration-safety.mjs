import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const destructivePatterns = [
  ["DELETE FROM", /\bDELETE\s+FROM\b/i],
  ["TRUNCATE", /\bTRUNCATE(?:\s+TABLE)?\b/i],
  [
    "DROP data object",
    /\bDROP\s+(?:TABLE|SCHEMA|DATABASE|TYPE|VIEW|MATERIALIZED\s+VIEW|EXTENSION)\b/i,
  ],
  [
    "ALTER TABLE ... DROP",
    /\bALTER\s+TABLE\b[\s\S]*?\bDROP\s+(?:COLUMN|CONSTRAINT)\b/i,
  ],
];

function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--.*$/gm, " ");
}

function destructiveOperations(sql) {
  const executableSql = stripComments(sql);
  return destructivePatterns
    .filter(([, pattern]) => pattern.test(executableSql))
    .map(([label]) => label);
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

export async function checkMigrationSafety({
  migrationsDir = resolve(projectRoot, "prisma/migrations"),
  baselinePath = resolve(projectRoot, "prisma/migration-safety-baseline.json"),
} = {}) {
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const historical = baseline.historicalDestructiveMigrations ?? {};
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const migrationNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const violations = [];
  let destructiveCount = 0;

  for (const migrationName of migrationNames.sort()) {
    const migrationPath = resolve(
      migrationsDir,
      migrationName,
      "migration.sql",
    );
    const sql = await readFile(migrationPath);
    const operations = destructiveOperations(sql.toString("utf8"));

    if (operations.length === 0) continue;
    destructiveCount += 1;

    const exception = historical[migrationName];
    if (!exception) {
      violations.push(
        `${migrationName}: contains ${operations.join(", ")} without a historical baseline exception`,
      );
      continue;
    }

    if (!exception.reason?.trim()) {
      violations.push(
        `${migrationName}: historical exception must include a reason`,
      );
    }
    if (exception.sha256 !== sha256(sql)) {
      violations.push(
        `${migrationName}: checksum differs from its immutable historical baseline`,
      );
    }
  }

  for (const migrationName of Object.keys(historical)) {
    if (!migrationNames.includes(migrationName)) {
      violations.push(
        `${migrationName}: historical baseline entry has no migration directory`,
      );
    }
  }

  return {
    migrationCount: migrationNames.length,
    destructiveCount,
    violations,
  };
}

async function main() {
  const result = await checkMigrationSafety();
  if (result.violations.length > 0) {
    console.error("Migration safety check failed:");
    for (const violation of result.violations) console.error(`- ${violation}`);
    console.error(
      "Keep data resets outside prisma/migrations; do not extend the historical baseline.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Migration safety check passed (${result.migrationCount} migrations, ` +
      `${result.destructiveCount} immutable historical exceptions).`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
