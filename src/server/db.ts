import { env } from "~/env";
import { PrismaClient } from "../../generated/prisma";

const createPrismaClient = () => {
  // Bump pool size for concurrent operations
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
