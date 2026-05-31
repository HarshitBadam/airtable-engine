import { z } from "zod";
import { protectedProcedure } from "../../trpc";

export const backfill = protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      columnId: z.string(),
      sourceColumnId: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // Default-value columns no longer need a backfill — the value
    // lives on the Column record and is resolved at read time.
    if (!input.sourceColumnId) return { ok: true };

    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true },
    });
    if (!table) throw new Error("Table not found");

    // Resolve sourceColumnId chain: if the source is itself an
    // unbackfilled duplicate, follow the chain to the column that
    // has actual cell data.
    let resolvedSrcId = input.sourceColumnId;
    for (let depth = 0; depth < 10; depth++) {
      const src = await ctx.db.column.findFirst({
        where: { id: resolvedSrcId },
        select: { sourceColumnId: true },
      });
      if (!src?.sourceColumnId) break;
      resolvedSrcId = src.sourceColumnId;
    }

    const tId = input.tableId.replace(/'/g, "''");
    const srcId = resolvedSrcId.replace(/'/g, "''");
    const newId = input.columnId.replace(/'/g, "''");

    const BATCH = 50_000;
    const MAX_RETRIES = 3;

    let total = 0;
    let batchStart = 0;

    while (true) {
      let affected = 0;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          affected = await ctx.db.$executeRawUnsafe(`
            UPDATE "Row"
            SET "cells" = jsonb_build_object('${newId}', "cells" -> '${srcId}') || "cells"
            WHERE "tableId" = '${tId}'
              AND "cells" ? '${srcId}'
              AND "rowIndex" >= ${batchStart}
              AND "rowIndex" < ${batchStart + BATCH}
          `);
          break;
        } catch (e: unknown) {
          const isDeadlock =
            typeof e === "object" && e !== null && "message" in e &&
            (e as { message: string }).message.includes("40P01");
          if (isDeadlock && attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
            continue;
          }
          throw e;
        }
      }

      total += affected;
      if (affected === 0) break;
      batchStart += BATCH;
    }

    console.log(
      `[column.backfill] Duplication: ${total} rows (source resolved to ${resolvedSrcId}) for ${input.columnId}`,
    );

    // Sort index is built lazily on the user's first sort via
    // ensureSortIndex in row.ts (3-8s one-time cost). Deferring it
    // here cuts backfill time roughly in half for large tables and
    // avoids Vercel serverless function timeouts. During the backfill
    // window, sorts redirect to the source column's existing index.

    // Clear sourceColumnId — getCellValue and sort-redirect no longer
    // need the fallback.
    await ctx.db.column.update({
      where: { id: input.columnId },
      data: { sourceColumnId: null },
    });

    return { ok: true };
  });
