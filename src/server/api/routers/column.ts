import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const columnRouter = createTRPCRouter({
  ensureIndexes: protectedProcedure
    .input(z.object({ tableId: z.string(), columnId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // ownership check
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

      // PG identifiers max 63 chars; keep short
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
