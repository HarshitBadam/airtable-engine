/**
 * Guarantee that a sort B-tree index exists for a column.
 *
 * INDEX STRATEGY — 1 index per column (down from 3):
 *
 *   Index:  (expr ASC NULLS FIRST, "rowIndex" ASC) WHERE "tableId" = '...'
 *
 *   Forward scan  → ORDER BY expr ASC  NULLS FIRST, "rowIndex" ASC  (ASC sort)
 *   Backward scan → ORDER BY expr DESC NULLS LAST,  "rowIndex" DESC (DESC sort)
 *
 *   This works because ASC NULLS FIRST and DESC NULLS LAST are exact
 *   reverses — null = -infinity: smallest in ASC (first), largest gap
 *   from the top in DESC (last).
 *
 * Called from:
 *   - row.infinite        → ensureSortIndex (on-demand before sorted query)
 *   - row.windowFetch     → ensureSortIndex (on-demand before sorted jump)
 *   - column.ensureIndexes → ensureSortIndex (explicit index build)
 *
 * Fast path when index already exists (pg_indexes sentinel check).
 * Slow path creates the index on first call (time depends on table size).
 *
 * Race-safe: concurrent callers that both enter the slow path will not
 * crash — Postgres 23505 (duplicate key on pg_catalog) is caught and
 * ignored since it means another connection already created the index.
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.$executeRawUnsafe(sql);
  } catch (e) {
    if (isIndexRaceError(e)) return; // another connection created it first
    throw e;
  }
}

/**
 * Used during table/base deletion to prevent orphan indexes in pg_catalog.
 */
export async function dropColumnIndexesForTable(
  db: PrismaClient,
  tableId: string,
): Promise<void> {
  const prefix = `ri_${tableId.slice(0, 8)}_`;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const indexes = (await db.$queryRawUnsafe(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'Row' AND indexname LIKE $1`,
    `${prefix}%`,
  )) as { indexname: string }[];

  for (const idx of indexes) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.$executeRawUnsafe(`DROP INDEX IF EXISTS "${idx.indexname}"`);
  }
}

/**
 * Direction-agnostic: one ASC NULLS FIRST index serves both ASC
 * (forward scan) and DESC (backward scan) queries.
 *
 * Called from the sort safety net in infinite/windowFetch queries.
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

  // Fast path: check if this specific index already exists (~0.5ms)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const existing = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS cnt FROM pg_indexes WHERE indexname = $1`,
    indexName,
  )) as { cnt: number }[];
  if ((existing[0]?.cnt ?? 0) > 0) return;

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
