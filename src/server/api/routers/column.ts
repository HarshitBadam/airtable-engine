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
        select: { id: true, name: true, type: true, order: true, defaultValue: true, config: true },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string().min(1).max(80),
        type: z.enum(["TEXT", "NUMBER"]),
        defaultValue: z.string().optional(),
        /** Number format config (decimal places, separators, abbreviation, allow negative) */
        numberConfig: z
          .object({
            decimalPlaces: z.number().int().min(0).max(8),
            thousandsSep: z.string(),
            showThousands: z.boolean(),
            largeNumAbbrev: z.string().nullable(),
            allowNegative: z.boolean(),
          })
          .optional(),
        viewId: z.string().optional(),
        /** When inserting left/right, the anchor column and side */
        anchorColumnId: z.string().optional(),
        insertSide: z.enum(["left", "right"]).optional(),
        /** When duplicating a field, the source column whose cell data should be copied */
        sourceColumnId: z.string().optional(),
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

        const col = await tx.column.create({
          data: {
            tableId: input.tableId,
            name: input.name,
            type: input.type,
            order,
            defaultValue: input.defaultValue ?? null,
            config: input.numberConfig ? (input.numberConfig as unknown as object) : undefined,
          },
          select: { id: true, name: true, type: true, order: true, defaultValue: true, config: true },
        });

        // If a default value is set, stamp it into every existing row's cells JSONB
        if (input.defaultValue && input.defaultValue.trim() !== "") {
          const tId = input.tableId.replace(/'/g, "''");
          const cId = col.id.replace(/'/g, "''");
          const dv = input.defaultValue.replace(/'/g, "''");

          // For NUMBER columns, store as a JSON number; otherwise store as JSON text
          const jsonbExpr =
            input.type === "NUMBER" && !isNaN(Number(input.defaultValue))
              ? `to_jsonb(${Number(input.defaultValue)}::double precision)`
              : `to_jsonb('${dv}'::text)`;

          await tx.$executeRawUnsafe(`
            UPDATE "Row"
            SET "cells" = jsonb_set(COALESCE("cells", '{}'), '{${cId}}', ${jsonbExpr}),
                "searchText" = (
                  SELECT COALESCE(string_agg(value::text, ' '), '')
                  FROM jsonb_each_text(jsonb_set(COALESCE("cells", '{}'), '{${cId}}', ${jsonbExpr}))
                ),
                "updatedAt" = now()
            WHERE "tableId" = '${tId}'
          `);
        }

        // If duplicating a field, copy cell data from the source column to the new one
        if (input.sourceColumnId) {
          const tId = input.tableId.replace(/'/g, "''");
          const srcId = input.sourceColumnId.replace(/'/g, "''");
          const newId = col.id.replace(/'/g, "''");

          await tx.$executeRawUnsafe(`
            UPDATE "Row"
            SET "cells" = CASE
                  WHEN COALESCE("cells", '{}') ? '${srcId}'
                  THEN jsonb_set(COALESCE("cells", '{}'), '{${newId}}', COALESCE("cells", '{}')->'${srcId}')
                  ELSE "cells"
                END,
                "searchText" = (
                  SELECT COALESCE(string_agg(value::text, ' '), '')
                  FROM jsonb_each_text(
                    CASE
                      WHEN COALESCE("cells", '{}') ? '${srcId}'
                      THEN jsonb_set(COALESCE("cells", '{}'), '{${newId}}', COALESCE("cells", '{}')->'${srcId}')
                      ELSE COALESCE("cells", '{}')
                    END
                  )
                ),
                "updatedAt" = now()
            WHERE "tableId" = '${tId}'
          `);
        }

        // Column creation is table-level: the new column must appear in ALL views.
        // If an insert position is specified (anchor + side), place the new column
        // relative to the anchor in EVERY view (since the anchor exists in all views).
        // Otherwise, append at the end.
        const allViews = await tx.view.findMany({
          where: { tableId: input.tableId },
          select: { id: true, config: true },
        });

        for (const view of allViews) {
          const config = (view.config as Record<string, unknown>) ?? {};
          const existingOrder = Array.isArray(config.columnOrderIds)
            ? (config.columnOrderIds as string[])
            : [];

          let newOrder: string[];
          if (existingOrder.length === 0) {
            // Lazy-init: populate with ALL current table columns (includes the
            // just-created one since we're inside the same transaction).
            const allCols = await tx.column.findMany({
              where: { tableId: input.tableId },
              orderBy: { order: "asc" },
              select: { id: true },
            });
            newOrder = allCols.map((c) => c.id);
          } else if (existingOrder.includes(col.id)) {
            // Already present (safety check)
            newOrder = existingOrder;
          } else if (input.anchorColumnId && input.insertSide) {
            // Insert relative to the anchor column in this view's order.
            // The anchor column exists in all views since columns are table-level.
            const anchorIdx = existingOrder.indexOf(input.anchorColumnId);
            if (anchorIdx !== -1) {
              newOrder = [...existingOrder];
              const insertIdx = input.insertSide === "right" ? anchorIdx + 1 : anchorIdx;
              newOrder.splice(insertIdx, 0, col.id);
            } else {
              // Anchor not found in this view (shouldn't happen), append
              newOrder = [...existingOrder, col.id];
            }
          } else {
            // No insert position — append at end
            newOrder = [...existingOrder, col.id];
          }

          await tx.view.update({
            where: { id: view.id },
            data: { config: { ...config, columnOrderIds: newOrder } as unknown as object },
          });
        }

        return col;
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

          // Accumulate all changes into a single config object to avoid
          // multiple view.update calls overwriting each other with stale data.
          let updatedConfig = { ...config };
          let changed = false;

          // Clean columnOrderIds
          const order = updatedConfig.columnOrderIds;
          if (Array.isArray(order) && order.includes(input.columnId)) {
            updatedConfig.columnOrderIds = order.filter((id: string) => id !== input.columnId);
            changed = true;
          }

          // Clean hiddenColumnIds
          const hidden = updatedConfig.hiddenColumnIds;
          if (Array.isArray(hidden) && hidden.includes(input.columnId)) {
            updatedConfig.hiddenColumnIds = hidden.filter((id: string) => id !== input.columnId);
            changed = true;
          }

          // Clean sorts referencing this column
          const sorts = Array.isArray(updatedConfig.sorts)
            ? (updatedConfig.sorts as Record<string, unknown>[])
            : [];
          const newSorts = sorts.filter((s) => s.columnId !== input.columnId);
          if (newSorts.length !== sorts.length) {
            updatedConfig.sorts = newSorts;
            changed = true;
          }

          // Clean filters referencing this column
          const filters = Array.isArray(updatedConfig.filters)
            ? (updatedConfig.filters as Record<string, unknown>[])
            : [];
          const newFilters = filters.filter((f) => f.columnId !== input.columnId);
          if (newFilters.length !== filters.length) {
            updatedConfig.filters = newFilters;
            changed = true;
          }

          if (changed) {
            await tx.view.update({
              where: { id: view.id },
              data: { config: updatedConfig as unknown as object },
            });
          }
        }

        return { id: input.columnId };
      });
    }),

  /**
   * View-scoped "delete": remove a column from a single view's config.
   * The column stays in the database and remains visible in other views.
   * Cleans up columnOrderIds, hiddenColumnIds, sorts, and filters
   * within the target view only.
   */
  removeFromView: protectedProcedure
    .input(
      z.object({
        viewId: z.string(),
        columnId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.view.findFirst({
        where: { id: input.viewId, table: { base: { ownerId: ctx.session.user.id } } },
        select: { id: true, config: true },
      });
      if (!view) throw new Error("View not found");

      const config = (view.config as Record<string, unknown>) ?? {};

      // Remove from columnOrderIds
      const columnOrderIds = Array.isArray(config.columnOrderIds)
        ? (config.columnOrderIds as string[]).filter((id) => id !== input.columnId)
        : [];

      if (columnOrderIds.length === 0) {
        throw new Error("Cannot remove the last column from the view");
      }

      // Remove from hiddenColumnIds
      const hiddenColumnIds = Array.isArray(config.hiddenColumnIds)
        ? (config.hiddenColumnIds as string[]).filter((id) => id !== input.columnId)
        : [];

      // Remove sorts referencing this column
      const sorts = Array.isArray(config.sorts)
        ? (config.sorts as Record<string, unknown>[]).filter(
            (s) => s.columnId !== input.columnId,
          )
        : [];

      // Remove filters referencing this column
      const filters = Array.isArray(config.filters)
        ? (config.filters as Record<string, unknown>[]).filter(
            (f) => f.columnId !== input.columnId,
          )
        : [];

      await ctx.db.view.update({
        where: { id: input.viewId },
        data: {
          config: {
            ...config,
            columnOrderIds,
            hiddenColumnIds,
            sorts,
            filters,
          } as unknown as object,
        },
      });

      return { removed: true, columnId: input.columnId };
    }),

  /**
   * Update a column's name and/or number config.
   */
  update: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        columnId: z.string(),
        name: z.string().min(1).max(80).optional(),
        numberConfig: z
          .object({
            decimalPlaces: z.number().int().min(0).max(8),
            thousandsSep: z.string(),
            showThousands: z.boolean(),
            largeNumAbbrev: z.string().nullable(),
            allowNegative: z.boolean(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      const col = await ctx.db.column.findFirst({
        where: { id: input.columnId, tableId: input.tableId },
        select: { id: true },
      });
      if (!col) throw new Error("Column not found");

      const data: Record<string, unknown> = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.numberConfig !== undefined) data.config = input.numberConfig as unknown as object;

      return ctx.db.column.update({
        where: { id: input.columnId },
        data,
        select: { id: true, name: true, type: true, order: true, defaultValue: true, config: true },
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
