import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { ensureSortIndex } from "~/server/db/ensureColumnIndexes";

/* ── Helper: remove a deleted column from a filterTree ────────────── */
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

      // ── Step 1: Create column + update views (fast, in a transaction) ──
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

        // Column creation is table-level: the new column must appear in ALL views.
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

      // Backfill is NOT done here — the client fires column.backfill
      // as a separate mutation after receiving the column.  This makes
      // column creation sub-200ms instead of 10-30s.

      // Index creation is NOT done here either.  Building a B-tree on
      // 1M rows of NULL values would take ~5-10s for zero benefit.
      // The on-demand ensureSortIndex in infinite/windowFetch builds the
      // index if/when the user actually sorts on this column.

      return col;
    }),

  /**
   * Backfill cell values for a newly created column.
   * Called by the client AFTER column.create returns, so the column
   * header appears instantly and the heavy row-level writes happen
   * in the background.  The client shows default/source values at
   * render time, so the user never sees blank cells.
   */
  backfill: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        columnId: z.string(),
        /** Default value to stamp into every row */
        defaultValue: z.string().optional(),
        /** Column type (needed to write numbers as JSONB numbers) */
        type: z.enum(["TEXT", "NUMBER"]).optional(),
        /** Source column to copy values from (field duplication) */
        sourceColumnId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      const BATCH = 100_000;
      const tId = input.tableId.replace(/'/g, "''");

      // ── Default value backfill ──
      if (input.defaultValue && input.defaultValue.trim() !== "") {
        const cId = input.columnId.replace(/'/g, "''");
        const dv = input.defaultValue.replace(/'/g, "''");

        const jsonbExpr =
          input.type === "NUMBER" && !isNaN(Number(input.defaultValue))
            ? `to_jsonb(${Number(input.defaultValue)}::double precision)`
            : `to_jsonb('${dv}'::text)`;

        // COALESCE guards: if searchText is NULL (not just ''), concatenation
        // with NULL yields NULL → violates NOT NULL constraint.
        const searchAppend = `CASE WHEN COALESCE("searchText", '') = '' THEN '${dv}' ELSE COALESCE("searchText", '') || chr(31) || '${dv}' END`;

        let total = 0;
        let batchStart = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const affected: number = await ctx.db.$executeRawUnsafe(`
            UPDATE "Row"
            SET "cells" = jsonb_set(COALESCE("cells", '{}'), '{${cId}}', ${jsonbExpr}),
                "searchText" = ${searchAppend},
                "updatedAt" = now()
            WHERE "tableId" = '${tId}'
              AND "rowIndex" >= ${batchStart}
              AND "rowIndex" < ${batchStart + BATCH}
          `);
          total += affected;
          if (affected === 0) break;
          batchStart += BATCH;
        }
        console.log(`[column.backfill] Default value: ${total} rows for ${input.columnId}`);
      }

      // ── Duplication backfill ──
      if (input.sourceColumnId) {
        const srcId = input.sourceColumnId.replace(/'/g, "''");
        const newId = input.columnId.replace(/'/g, "''");

        let total = 0;
        let batchStart = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          // COALESCE guards prevent NOT NULL violations:
          //  - cells: if source column doesn't exist, cells->'src' is SQL NULL,
          //    and jsonb_set(jsonb, path, NULL) returns NULL. We skip the set
          //    entirely when the source key is absent.
          //  - searchText: if searchText is NULL or source value is NULL,
          //    unguarded concatenation yields NULL.
          const affected: number = await ctx.db.$executeRawUnsafe(`
            UPDATE "Row"
            SET "cells" = CASE
                  WHEN (COALESCE("cells", '{}') -> '${srcId}') IS NOT NULL
                  THEN jsonb_set(COALESCE("cells", '{}'), '{${newId}}', COALESCE("cells", '{}') -> '${srcId}')
                  ELSE COALESCE("cells", '{}')
                END,
                "searchText" = CASE
                  WHEN COALESCE("searchText", '') = '' THEN COALESCE(COALESCE("cells", '{}')->>'${srcId}', '')
                  ELSE COALESCE("searchText", '') || chr(31) || COALESCE(COALESCE("cells", '{}')->>'${srcId}', '')
                END,
                "updatedAt" = now()
            WHERE "tableId" = '${tId}'
              AND "rowIndex" >= ${batchStart}
              AND "rowIndex" < ${batchStart + BATCH}
          `);
          total += affected;
          if (affected === 0) break;
          batchStart += BATCH;
        }
        console.log(`[column.backfill] Duplication: ${total} rows for ${input.columnId}`);
      }

      // Clear sourceColumnId now that data is persisted — getCellValue
      // no longer needs the fallback.
      if (input.sourceColumnId) {
        await ctx.db.column.update({
          where: { id: input.columnId },
          data: { sourceColumnId: null },
        });
      }

      return { ok: true };
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

      // ── Step 1: Fast transaction — delete column + clean up views ──
      // Includes the last-column check inside the transaction to prevent
      // a race where two concurrent deletes both pass the count check.
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

      // ── Step 2: Batched cell cleanup (OUTSIDE transaction) ──────────
      // Strip the column key from cells JSONB in 100K-row batches.
      // Each batch commits independently so concurrent readers see
      // progress immediately.  searchText is simplified: just remove
      // the column value via a string replace on the separator-delimited
      // text — recomputing from jsonb_each_text is far too slow at 1M rows.
      const BATCH = 100_000;
      const colId = input.columnId.replace(/'/g, "''");
      const tId = input.tableId.replace(/'/g, "''");

      try {
        let totalCleaned = 0;
        let batchStart = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const affected: number = await ctx.db.$executeRawUnsafe(`
            UPDATE "Row"
            SET "cells" = "cells" - '${colId}',
                "updatedAt" = now()
            WHERE "tableId" = '${tId}'
              AND "rowIndex" >= ${batchStart}
              AND "rowIndex" < ${batchStart + BATCH}
          `);
          totalCleaned += affected;
          if (affected === 0) break;
          batchStart += BATCH;
        }
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

      // Clean filterTree referencing this column (condition groups)
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

      // Delegates to the shared ensureSortIndex which builds a single
      // ASC NULLS FIRST index (serving both ASC and DESC via backward scan).
      // Fast path (<1ms) when the index already exists.
      await ensureSortIndex(
        ctx.db,
        input.tableId,
        input.columnId,
        col.type as "TEXT" | "NUMBER",
      );

      return { ok: true };
    }),
});
