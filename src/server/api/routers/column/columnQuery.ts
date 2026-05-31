import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import { ensureSortIndex } from "~/server/db/ensureColumnIndexes";

export const list = protectedProcedure
  .input(z.object({ tableId: z.string() }))
  .query(async ({ ctx, input }) => {
    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true },
    });
    if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

    return ctx.db.column.findMany({
      where: { tableId: input.tableId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, type: true, order: true, defaultValue: true, config: true, sourceColumnId: true },
    });
  });

export const ensureIndexes = protectedProcedure
  .input(z.object({ tableId: z.string(), columnId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true },
    });
    if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

    const col = await ctx.db.column.findFirst({
      where: { id: input.columnId, tableId: input.tableId },
      select: { id: true, type: true },
    });
    if (!col) throw new TRPCError({ code: "NOT_FOUND", message: "Column not found" });

    // Single ASC NULLS FIRST index serves both ASC (forward scan) and DESC
    // (backward scan) queries. Fast path (<1ms) when the index already exists.
    await ensureSortIndex(
      ctx.db,
      input.tableId,
      input.columnId,
      col.type as "TEXT" | "NUMBER",
    );

    return { ok: true };
  });
