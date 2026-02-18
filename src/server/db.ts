import { env } from "~/env";
import { PrismaClient } from "../../generated/prisma";

const createPrismaClient = () => {
  // Prisma defaults to a small connection pool (num_cpus * 2 + 1).
  // With concurrent heavy operations (rank materialization, column backfill,
  // page refetches, user edits) the pool gets exhausted, causing cascading
  // timeouts.  Bump the pool size and wait-timeout for breathing room.
  const url = env.DATABASE_URL;
  const sep = url.includes("?") ? "&" : "?";
  const pooledUrl = `${url}${sep}connection_limit=25&pool_timeout=30`;

  return new PrismaClient({
    datasources: { db: { url: pooledUrl } },
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
