import type { SqlParam } from "./escape";

// Prisma's `$queryRawUnsafe` is awaitable; this wrapper just centralises the
// types so call sites stay clean.
export async function queryRawUnsafe<T>(
  db: {
    $queryRawUnsafe: <R = unknown>(query: string, ...values: unknown[]) => PromiseLike<R>;
  },
  sql: string,
  params: SqlParam[],
): Promise<T> {
  return (await db.$queryRawUnsafe<T>(sql, ...params)) as T;
}

/**
 * Run a query inside a short-lived transaction with
 * `SET LOCAL enable_bitmapscan = off`.
 *
 * This forces Postgres to use Index Scan / Index-Only Scan instead of Bitmap
 * Heap Scan for UNION ALL branches.  Bitmap Heap Scan materialises every
 * matching row from the heap (losing index ordering) whereas Index Scan
 * streams rows in index order — critical for Merge Append to work cheaply.
 *
 * `SET LOCAL` only applies within the transaction scope so no other queries
 * are affected.
 */
export async function queryNoBitmap<T>(
  db: {
    $transaction: <R>(fn: (tx: {
      $executeRawUnsafe: (query: string) => PromiseLike<unknown>;
      $queryRawUnsafe: <Q = unknown>(query: string, ...values: unknown[]) => PromiseLike<Q>;
    }) => Promise<R>) => Promise<R>;
  },
  sql: string,
  params: SqlParam[],
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL enable_bitmapscan = off");
    return (await tx.$queryRawUnsafe<T>(sql, ...params)) as T;
  });
}
