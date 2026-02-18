import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { ensureSortIndex } from "~/server/db/ensureColumnIndexes";

/* Remove a deleted column from a filter tree */
type FilterTreeNode = { kind?: string; columnId?: string; items?: FilterTreeNode[]; [key: string]: unknown };

/**
 * Recursively remove conditions that reference `columnId` from a filter tree.
 * Returns the cleaned items array and whether any changes were made.
 */
function cleanFilterTreeColumn(
  items: FilterTreeNode[],
  columnId: string,
): { items: FilterTreeNode[]; changed: boolean } {
  let changed = false;
  const result: FilterTreeNode[] = [];
  for (const item of items) {
    if (item.kind === "condition") {
      if (item.columnId === columnId) {
        changed = true; // drop this condition
        continue;
      }
      result.push(item);
    } else if (item.kind === "group" && Array.isArray(item.items)) {
      const cleaned = cleanFilterTreeColumn(item.items, columnId);
      if (cleaned.changed) changed = true;
      // Keep group even if empty (UI will show "Drag conditions here...")
      result.push({ ...item, items: cleaned.items });
    } else {
      result.push(item);
    }
  }
  return { items: result, changed };
}

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
        select: { id: true, name: true, type: true, order: true, defaultValue: true, config: true, sourceColumnId: true },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string().min(1).max(80),
        type: z.enum(["TEXT", "NUMBER"]),
        defaultValue: z.string().optional(),
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
        anchorColumnId: z.string().optional(),
        insertSide: z.enum(["left", "right"]).optional(),
        sourceColumnId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      const col = await ctx.db.$transaction(async (tx) => {
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
            sourceColumnId: input.sourceColumnId ?? null,
          },
          select: { id: true, name: true, type: true, order: true, defaultValue: true, config: true, sourceColumnId: true },
        });

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
            const allCols = await tx.column.findMany({
              where: { tableId: input.tableId },
              orderBy: { order: "asc" },
              select: { id: true },
            });
            newOrder = allCols.map((c) => c.id);
          } else if (existingOrder.includes(col.id)) {
            newOrder = existingOrder;
          } else if (input.anchorColumnId && input.insertSide) {
            const anchorIdx = existingOrder.indexOf(input.anchorColumnId);
            if (anchorIdx !== -1) {
              newOrder = [...existingOrder];
              const insertIdx = input.insertSide === "right" ? anchorIdx + 1 : anchorIdx;
              newOrder.splice(insertIdx, 0, col.id);
            } else {
              newOrder = [...existingOrder, col.id];
            }
          } else {
            newOrder = [...existingOrder, col.id];
          }

          await tx.view.update({
            where: { id: view.id },
            data: { config: { ...config, columnOrderIds: newOrder } as unknown as object },
          });
        }

        return col;
      });

      // Backfill runs as a separate mutation after column creation

      return col;
    }),

  /**
   * Backfill cell values for a newly created column.
   * Copies cell data from sourceColumnId when duplicating a field.
   * Batched in 50K-row chunks with deadlock retries.
   */
  backfill: protectedProcedure
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

      // ── Duplication backfill (batched, cells-only) ──

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

      // eslint-disable-next-line no-constant-condition
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
            break; // success
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

      // Build the sort index proactively so the user's first sort on
      // the new column is instant (<1ms) instead of a 3-8s cold build.
      // While sourceColumnId was set, sorts redirected to the source
      // column's index.  Now that cells are copied, build the real one.
      const col = await ctx.db.column.findFirst({
        where: { id: input.columnId },
        select: { type: true },
      });
      if (col) {
        try {
          await ensureSortIndex(
            ctx.db,
            input.tableId,
            input.columnId,
            col.type as "TEXT" | "NUMBER",
          );
        } catch (e) {
          // Non-critical: if index build fails, it'll be built lazily
          // on the user's first sort via ensureSortIndex in row.ts.
          console.error("[column.backfill] Proactive index build failed:", e);
        }
      }

      // Clear sourceColumnId — getCellValue and sort-redirect no longer
      // need the fallback.
      await ctx.db.column.update({
        where: { id: input.columnId },
        data: { sourceColumnId: null },
      });

      return { ok: true };
    }),

  /**
   * Delete a column by ID. Cannot delete the last column in a table.
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

      // Delete column + clean up views in a transaction
      await ctx.db.$transaction(async (tx) => {
        const colCount = await tx.column.count({
          where: { tableId: input.tableId },
        });
        if (colCount <= 1) throw new Error("Cannot delete the last column");

        const col = await tx.column.findFirst({
          where: { id: input.columnId, tableId: input.tableId },
          select: { id: true },
        });
        if (!col) throw new Error("Column not found");

        await tx.column.delete({ where: { id: input.columnId } });

        const views = await tx.view.findMany({
          where: { tableId: input.tableId },
          select: { id: true, config: true },
        });

        for (const view of views) {
          const config = view.config as Record<string, unknown> | null;
          if (!config) continue;

          const updatedConfig = { ...config };
          let changed = false;

          const order = updatedConfig.columnOrderIds;
          if (Array.isArray(order) && order.includes(input.columnId)) {
            updatedConfig.columnOrderIds = order.filter((id: string) => id !== input.columnId);
            changed = true;
          }

          const hidden = updatedConfig.hiddenColumnIds;
          if (Array.isArray(hidden) && hidden.includes(input.columnId)) {
            updatedConfig.hiddenColumnIds = hidden.filter((id: string) => id !== input.columnId);
            changed = true;
          }

          const sorts = Array.isArray(updatedConfig.sorts)
            ? (updatedConfig.sorts as Record<string, unknown>[])
            : [];
          const newSorts = sorts.filter((s) => s.columnId !== input.columnId);
          if (newSorts.length !== sorts.length) {
            updatedConfig.sorts = newSorts;
            changed = true;
          }

          const filters = Array.isArray(updatedConfig.filters)
            ? (updatedConfig.filters as Record<string, unknown>[])
            : [];
          const newFilters = filters.filter((f) => f.columnId !== input.columnId);
          if (newFilters.length !== filters.length) {
            updatedConfig.filters = newFilters;
            changed = true;
          }

          if (updatedConfig.filterTree && typeof updatedConfig.filterTree === "object") {
            const tree = updatedConfig.filterTree as Record<string, unknown>;
            if (Array.isArray(tree.items)) {
              const cleaned = cleanFilterTreeColumn(tree.items as FilterTreeNode[], input.columnId);
              if (cleaned.changed) {
                tree.items = cleaned.items;
                changed = true;
              }
            }
          }

          if (changed) {
            await tx.view.update({
              where: { id: view.id },
              data: { config: updatedConfig as unknown as object },
            });
          }
        }
      });

      // ── Step 2: Cell cleanup (OUTSIDE transaction) ──────────
      // Strip the column key from cells JSONB in a single UPDATE.
      const colId = input.columnId.replace(/'/g, "''");
      const tId = input.tableId.replace(/'/g, "''");

      try {
        const totalCleaned: number = await ctx.db.$executeRawUnsafe(`
          UPDATE "Row"
          SET "cells" = "cells" - '${colId}'
          WHERE "tableId" = '${tId}'
            AND "cells" ? '${colId}'
        `);
        console.log(`[column.delete] Cell cleanup: ${totalCleaned} rows cleaned for column ${input.columnId}`);
      } catch (err) {
        console.error("[column.delete] Cell cleanup failed:", err);
      }

      return { id: input.columnId };
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

      const columnOrderIds = Array.isArray(config.columnOrderIds)
        ? (config.columnOrderIds as string[]).filter((id) => id !== input.columnId)
        : [];

      if (columnOrderIds.length === 0) {
        throw new Error("Cannot remove the last column from the view");
      }

      const hiddenColumnIds = Array.isArray(config.hiddenColumnIds)
        ? (config.hiddenColumnIds as string[]).filter((id) => id !== input.columnId)
        : [];

      const sorts = Array.isArray(config.sorts)
        ? (config.sorts as Record<string, unknown>[]).filter(
            (s) => s.columnId !== input.columnId,
          )
        : [];

      const filters = Array.isArray(config.filters)
        ? (config.filters as Record<string, unknown>[]).filter(
            (f) => f.columnId !== input.columnId,
          )
        : [];

      let filterTree = config.filterTree;
      if (filterTree && typeof filterTree === "object") {
        const tree = filterTree as Record<string, unknown>;
        if (Array.isArray(tree.items)) {
          const cleaned = cleanFilterTreeColumn(tree.items as FilterTreeNode[], input.columnId);
          if (cleaned.changed) {
            filterTree = { ...tree, items: cleaned.items };
          }
        }
      }

      await ctx.db.view.update({
        where: { id: input.viewId },
        data: {
          config: {
            ...config,
            columnOrderIds,
            hiddenColumnIds,
            sorts,
            filters,
            filterTree,
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

      if (input.name) {
        const duplicate = await ctx.db.column.findFirst({
          where: { tableId: input.tableId, name: input.name, NOT: { id: input.columnId } },
          select: { id: true },
        });
        if (duplicate) throw new Error("A field with this name already exists in this table");
      }

      const data: Record<string, unknown> = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.numberConfig !== undefined) data.config = input.numberConfig as unknown as object;

      return ctx.db.column.update({
        where: { id: input.columnId },
        data,
        select: { id: true, name: true, type: true, order: true, defaultValue: true, config: true, sourceColumnId: true },
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

      // Ensures sort index exists for this column
      await ensureSortIndex(
        ctx.db,
        input.tableId,
        input.columnId,
        col.type as "TEXT" | "NUMBER",
      );

      return { ok: true };
    }),
});
