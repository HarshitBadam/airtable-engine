/**
 * Guarantee that a sort B-tree index exists for a column.
 * Uses a single direction-agnostic index (ASC NULLS FIRST) that serves both
 * forward and backward scans. Race-safe with fast path when index exists.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

function isIndexRaceError(e: unknown): boolean {
  if (typeof e === "object" && e !== null && "message" in e) {
    const msg = (e as { message: string }).message;
    return msg.includes("23505") && msg.includes("already exists");
  }
  return false;
}

async function safeCreateIndex(db: PrismaClient, sql: string): Promise<void> {
  try {
    await db.$executeRawUnsafe(sql);
  } catch (e) {
    if (isIndexRaceError(e)) return; // another connection created it first
    throw e;
  }
}

// Drop all per-column indexes for a table
export async function dropColumnIndexesForTable(
  db: PrismaClient,
  tableId: string,
): Promise<void> {
  const prefix = `ri_${tableId.slice(0, 8)}_`;
  const indexes = (await db.$queryRawUnsafe(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'Row' AND indexname LIKE $1`,
    `${prefix}%`,
  )) as { indexname: string }[];

  for (const idx of indexes) {
    await db.$executeRawUnsafe(`DROP INDEX IF EXISTS "${idx.indexname}"`);
  }
}

/**
 * Build the single B-tree sort index for a column.
 * Direction-agnostic: one ASC NULLS FIRST index serves both ASC and DESC queries.
 */
export async function ensureSortIndex(
  db: PrismaClient,
  tableId: string,
  columnId: string,
  columnType: "TEXT" | "NUMBER",
): Promise<void> {
  const baseName = `ri_${tableId.slice(0, 8)}_${columnId}`;
  const tId = tableId.replace(/'/g, "''");
  const cId = columnId.replace(/'/g, "''");

  const suffix = columnType === "TEXT" ? "_s" : "_ns";
  const indexName = `${baseName}${suffix}`;

  // Fast path
  const existing = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS cnt FROM pg_indexes WHERE indexname = $1`,
    indexName,
  )) as { cnt: number }[];
  if ((existing[0]?.cnt ?? 0) > 0) return;

  // Slow path
  if (columnType === "TEXT") {
    await safeCreateIndex(
      db,
      `CREATE INDEX IF NOT EXISTS "${indexName}"
       ON "Row" ((NULLIF(cells->>'${cId}','')) ASC NULLS FIRST, "rowIndex" ASC)
       INCLUDE ("id")
       WHERE "tableId" = '${tId}'`,
    );
  } else {
    await safeCreateIndex(
      db,
      `CREATE INDEX IF NOT EXISTS "${indexName}"
       ON "Row" ((NULLIF(cells->>'${cId}','')::double precision) ASC NULLS FIRST, "rowIndex" ASC)
       INCLUDE ("id")
       WHERE "tableId" = '${tId}'`,
    );
  }
}

// Alias for ensureSortIndex
export async function ensureColumnIndexes(
  db: PrismaClient,
  tableId: string,
  columnId: string,
  columnType: "TEXT" | "NUMBER",
): Promise<void> {
  await ensureSortIndex(db, tableId, columnId, columnType);
}
