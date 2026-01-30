import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const columnRouter = createTRPCRouter({

  list: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      return ctx.db.column.findMany({
        where: { tableId: input.tableId },
        orderBy: { order: "asc" },
        select: { id: true, name: true, type: true, order: true },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string().min(1).max(80),
        type: z.enum(["TEXT", "NUMBER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      return ctx.db.$transaction(async (tx) => {
        const updated = await tx.table.update({
          where: { id: input.tableId },
          data: { nextColumnOrder: { increment: 1 } },
          select: { nextColumnOrder: true },
        });

        const order = updated.nextColumnOrder - 1;

        return tx.column.create({
          data: { tableId: input.tableId, name: input.name, type: input.type, order },
          select: { id: true, name: true, type: true, order: true },
        });
      });
    }),

  ensureIndexes: protectedProcedure
    .input(z.object({ tableId: z.string(), columnId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      const col = await ctx.db.column.findFirst({
        where: { id: input.columnId, tableId: input.tableId },
        select: { id: true, type: true },
      });
      if (!col) throw new Error("Column not found");

      const tableId = input.tableId.replace(/'/g, "''");
      const colId = input.columnId.replace(/'/g, "''");

      const baseName = `r_${input.tableId.slice(0, 8)}_${input.columnId.slice(0, 8)}`;

      if (col.type === "TEXT") {
        await ctx.db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "${baseName}_t_b"
          ON "Row" ((cells->>'${colId}'))
          WHERE "tableId" = '${tableId}';
        `);

        await ctx.db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "${baseName}_t_g"
          ON "Row"
          USING GIN ((cells->>'${colId}') gin_trgm_ops)
          WHERE "tableId" = '${tableId}';
        `);
      } else {
        await ctx.db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "${baseName}_n_b"
          ON "Row" ((NULLIF(cells->>'${colId}','')::double precision))
          WHERE "tableId" = '${tableId}';
        `);
      }

      return { ok: true };
    }),
});
