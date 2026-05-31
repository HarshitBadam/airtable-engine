import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { dropColumnIndexesForTable } from "~/server/db/ensureColumnIndexes";
import { ensureSeedColumnIndexes, seedDefaultTable } from "~/server/seed/defaultTableSeed";

export const tableRouter = createTRPCRouter({
  listByBase: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, ownerId: ctx.session.user.id },
        select: { id: true },
      });
      // Optimistic-nav friendly: empty array instead of throwing while a
      // base is still being created.
      if (!base) return [];

      return ctx.db.table.findMany({
        where: { baseId: input.baseId },
        orderBy: { createdAt: "asc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({ baseId: z.string(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, ownerId: userId },
        select: { id: true },
      });
      if (!base) throw new TRPCError({ code: "NOT_FOUND", message: "Base not found" });

      const duplicate = await ctx.db.table.findFirst({
        where: { baseId: input.baseId, name: input.name },
        select: { id: true },
      });
      if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "A table with this name already exists in this base" });

      const result = await ctx.db.$transaction(async (tx) => {
        return seedDefaultTable(tx, { baseId: input.baseId, tableName: input.name });
      });

      await ensureSeedColumnIndexes(ctx.db, result.table.id, result.columns);

      return { table: result.table };
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.id },
        include: { base: { select: { ownerId: true } } },
      });
      if (!table || table.base.ownerId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });
      }

      const duplicate = await ctx.db.table.findFirst({
        where: { baseId: table.baseId, name: input.name, NOT: { id: input.id } },
        select: { id: true },
      });
      if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "A table with this name already exists in this base" });

      return ctx.db.table.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), baseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, ownerId: ctx.session.user.id },
        select: { id: true },
      });
      if (!base) throw new TRPCError({ code: "NOT_FOUND", message: "Base not found" });

      const table = await ctx.db.table.findFirst({
        where: { id: input.id, baseId: input.baseId },
        select: { id: true },
      });
      if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

      // Drop custom column indexes before deleting the table's rows; otherwise
      // orphan partial B-tree indexes accumulate in pg_catalog.
      await dropColumnIndexesForTable(ctx.db, input.id).catch(() => { /* best-effort cleanup */ });

      // Last-table guard inside a transaction so two concurrent deletes can't
      // both pass the count check.
      return ctx.db.$transaction(async (tx) => {
        const count = await tx.table.count({
          where: { baseId: input.baseId },
        });
        if (count <= 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete the last table" });

        return tx.table.delete({ where: { id: input.id } });
      });
    }),
});
