import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { sortSchema } from "~/shared/grid";
import { escapeLiteral } from "~/server/sql/escape";
import { buildSortOrderByForAlias } from "~/server/sql/sortSql";
import { validateAndResolveSorts } from "./columnResolution";

export const applyPermanentSort = protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      sorts: z.array(sortSchema).min(1),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true, rowCount: true },
    });
    if (!table) throw new Error("Table not found");

    // Validate + redirect unbackfilled duplicates (no index build needed
    // for a full-table rewrite).
    const resolvedSorts = await validateAndResolveSorts(ctx.db, input.sorts, input.tableId, false);

    if (table.rowCount === 0) return { ok: true };

    const tableIdEscaped = escapeLiteral(input.tableId);
    const orderByClause = buildSortOrderByForAlias(resolvedSorts, "r");

    await ctx.db.$transaction(async (tx) => {
      // Phase 1: Compute new order and set to negative values (avoids unique constraint collisions)
      await tx.$executeRawUnsafe(`
        UPDATE "Row"
        SET "rowIndex" = -(subq.rn::float8), "updatedAt" = now()
        FROM (
          SELECT r."id", ROW_NUMBER() OVER (ORDER BY ${orderByClause}) AS rn
          FROM "Row" r
          WHERE r."tableId" = '${tableIdEscaped}'
        ) subq
        WHERE "Row"."id" = subq."id"
      `);

      // Phase 2: Flip negative to positive (final range 1..N)
      await tx.$executeRawUnsafe(`
        UPDATE "Row"
        SET "rowIndex" = -"rowIndex"
        WHERE "tableId" = '${tableIdEscaped}' AND "rowIndex" < 0
      `);

      await tx.table.update({
        where: { id: input.tableId },
        data: {
          nextRowIndex: table.rowCount + 1,
          updatedAt: new Date(),
        },
      });
    }, { timeout: 120_000 });  // 120s for large tables (two full-table UPDATEs)

    return { ok: true };
  });

export const computeViewRanks = protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      viewId: z.string(),
      sorts: z.array(sortSchema).min(1),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true, rowCount: true },
    });
    if (!table) throw new Error("Table not found");

    const view = await ctx.db.view.findFirst({
      where: { id: input.viewId, tableId: input.tableId },
      select: { id: true },
    });
    if (!view) throw new Error("View not found");

    const resolvedSorts = await validateAndResolveSorts(ctx.db, input.sorts, input.tableId, false);

    if (table.rowCount === 0) {
      await ctx.db.$transaction([
        ctx.db.viewRowRank.deleteMany({ where: { viewId: input.viewId } }),
        ctx.db.view.update({
          where: { id: input.viewId },
          data: { ranksStale: false },
        }),
      ]);
      return { ok: true, rankCount: 0 };
    }

    const viewIdEscaped = escapeLiteral(input.viewId);
    const tableIdEscaped = escapeLiteral(input.tableId);
    const orderByClause = buildSortOrderByForAlias(resolvedSorts, "r");

    // Wrapped in a transaction with pg_advisory_xact_lock to prevent
    // concurrent computeViewRanks calls from racing (DELETE/INSERT
    // interleaving can violate the secondary UNIQUE on (viewId, rowId)).
    //
    // The advisory lock serialises calls per-view: if two calls race,
    // the second blocks until the first commits, then runs cleanly.
    //
    // The transaction holds one connection for the duration of the
    // rank computation.  This is acceptable given the pool size.

    // 1. Mark ranks stale — prevents concurrent queries from entering
    //    the ViewRowRank path during the heavy INSERT.
    await ctx.db.view.update({
      where: { id: input.viewId },
      data: { ranksStale: true },
    });

    try {
      await ctx.db.$transaction(
        async (tx) => {
          // Advisory lock scoped to this transaction — serialises concurrent
          // computeViewRanks calls for the same view.
          // Uses DO/PERFORM because pg_advisory_xact_lock returns void,
          // which Prisma's $queryRawUnsafe cannot deserialize.
          await tx.$executeRawUnsafe(
            `DO $$ BEGIN PERFORM pg_advisory_xact_lock(hashtext('vrr:${viewIdEscaped}')); END $$`,
          );

          await tx.$executeRawUnsafe(
            `DELETE FROM "ViewRowRank" WHERE "viewId" = '${viewIdEscaped}'`,
          );

          // INSERT new ranks — no ON CONFLICT needed because the advisory
          // lock guarantees exclusive access.
          await tx.$executeRawUnsafe(`
            INSERT INTO "ViewRowRank" ("viewId", "rank", "rowId")
            SELECT '${viewIdEscaped}', ROW_NUMBER() OVER (ORDER BY ${orderByClause})::int, r."id"
            FROM "Row" r
            WHERE r."tableId" = '${tableIdEscaped}'
          `);
        },
        {
          maxWait: 60000,  // wait up to 60s for a connection
          timeout: 120000, // allow up to 120s for the full transaction
        },
      );

      // 3. Mark view as fresh (auto-commit, outside the heavy transaction)
      await ctx.db.view.update({
        where: { id: input.viewId },
        data: { ranksStale: false },
      });
    } catch (err) {
      console.error(`computeViewRanks failed for view ${input.viewId}:`, err);
      // ranksStale remains true → system stays on Tier 3 (graceful degradation)
      throw err;
    }

    return { ok: true, rankCount: table.rowCount };
  });
