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

  /**
   * Delete a column by ID. Cannot delete the last column in a table.
   * Also strips the column's key from every row's cells JSONB.
   */
  delete: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        columnId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      // Prevent deleting the last column
      const colCount = await ctx.db.column.count({
        where: { tableId: input.tableId },
      });
      if (colCount <= 1) throw new Error("Cannot delete the last column");

      const col = await ctx.db.column.findFirst({
        where: { id: input.columnId, tableId: input.tableId },
        select: { id: true },
      });
      if (!col) throw new Error("Column not found");

      return ctx.db.$transaction(async (tx) => {
        // Remove column key from all rows' cells JSONB
        const colId = input.columnId.replace(/'/g, "''");
        await tx.$executeRawUnsafe(`
          UPDATE "Row"
          SET "cells" = "cells" - '${colId}',
              "searchText" = (
                SELECT COALESCE(string_agg(value::text, ' '), '')
                FROM jsonb_each_text("cells" - '${colId}')
              ),
              "updatedAt" = now()
          WHERE "tableId" = '${input.tableId.replace(/'/g, "''")}'
        `);

        // Delete the column
        await tx.column.delete({ where: { id: input.columnId } });

        // Clean up views: remove columnId from hiddenColumnIds in view configs
        const views = await tx.view.findMany({
          where: { tableId: input.tableId },
          select: { id: true, config: true },
        });

        for (const view of views) {
          const config = view.config as Record<string, unknown> | null;
          if (!config) continue;

          const hidden = config.hiddenColumnIds;
          if (Array.isArray(hidden) && hidden.includes(input.columnId)) {
            const newHidden = hidden.filter((id: string) => id !== input.columnId);
            await tx.view.update({
              where: { id: view.id },
              data: { config: { ...config, hiddenColumnIds: newHidden } as unknown as object },
            });
          }

          // Also clean sorts that reference this column
          const sorts = Array.isArray(config.sorts) ? config.sorts as Record<string, unknown>[] : [];
          const newSorts = sorts.filter((s) => s.columnId !== input.columnId);
          if (newSorts.length !== sorts.length) {
            await tx.view.update({
              where: { id: view.id },
              data: { config: { ...config, sorts: newSorts } as unknown as object },
            });
          }

          // Also clean filters if they reference this column
          const filters = config.filters;
          if (Array.isArray(filters)) {
            const newFilters = filters.filter(
              (f: Record<string, unknown>) => f.columnId !== input.columnId,
            );
            if (newFilters.length !== filters.length) {
              await tx.view.update({
                where: { id: view.id },
                data: { config: { ...config, filters: newFilters } as unknown as object },
              });
            }
          }
        }

        return { id: input.columnId };
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
        // Composite btree index matching ORDER BY shape:
        //   (NULLIF(cells->>'colId',''), rowIndex)
        // Allows Postgres to satisfy ORDER BY + LIMIT from the index.
        await ctx.db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "${baseName}_t_b"
          ON "Row" ((NULLIF(cells->>'${colId}','')), "rowIndex")
          WHERE "tableId" = '${tableId}';
        `);

        // Trigram index for ILIKE contains/search queries
        await ctx.db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "${baseName}_t_g"
          ON "Row"
          USING GIN ((cells->>'${colId}') gin_trgm_ops)
          WHERE "tableId" = '${tableId}';
        `);
      } else {
        // Composite btree index matching ORDER BY shape:
        //   (NULLIF(cells->>'colId','')::double precision, rowIndex)
        await ctx.db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "${baseName}_n_b"
          ON "Row" ((NULLIF(cells->>'${colId}','')::double precision), "rowIndex")
          WHERE "tableId" = '${tableId}';
        `);
      }

      return { ok: true };
    }),
});
