import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { checkRateLimit, type RateBucket } from "~/server/api/rateLimit";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();

  return {
    db,
    session,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

// Adds an artificial 100–500ms delay in development to surface request
// waterfalls that would otherwise hide behind a fast localhost.
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

const HEAVY_MUTATION_PATHS = new Set([
  "row.addMany",
  "row.clearData",
  "row.applyPermanentSort",
  "row.computeViewRanks",
  "column.backfill",
]);

const rateLimitMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  const userId = ctx.session?.user?.id;
  const identifier =
    userId ??
    ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anon";

  let bucket: RateBucket = "queryDefault";
  if (type === "mutation") {
    bucket = HEAVY_MUTATION_PATHS.has(path) ? "mutationHeavy" : "mutationDefault";
  }

  const { success } = await checkRateLimit(identifier, bucket);
  if (!success) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded. Please slow down.",
    });
  }

  return next();
});

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  })
  .use(rateLimitMiddleware);
