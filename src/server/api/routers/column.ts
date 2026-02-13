import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

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
          },
          select: { id: true, name: true, type: true, order: true, defaultValue: true, config: true },
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

      // ── Step 2: Bulk backfill (slow, OUTSIDE the transaction) ─────────
      // A single UPDATE on 1M+ rows runs as one implicit PostgreSQL
      // transaction.  Due to MVCC, concurrent readers (windowFetch) see
      // the OLD data until the entire UPDATE commits (30-60s later).
      // If the user scrolls or refreshes during that window, they see
      // missing default values.
      //
      // FIX: batch the UPDATE into 100K-row chunks.  Each batch commits
      // independently in 2-5s, so concurrent readers immediately see the
      // completed batches.  Even a mid-backfill refresh shows most rows
      // correctly.
      const BACKFILL_BATCH = 100_000;

      if (input.defaultValue && input.defaultValue.trim() !== "") {
        const tId = input.tableId.replace(/'/g, "''");
        const cId = col.id.replace(/'/g, "''");
        const dv = input.defaultValue.replace(/'/g, "''");

        const jsonbExpr =
          input.type === "NUMBER" && !isNaN(Number(input.defaultValue))
            ? `to_jsonb(${Number(input.defaultValue)}::double precision)`
            : `to_jsonb('${dv}'::text)`;

        const searchAppend = `CASE WHEN "searchText" = '' THEN '${dv}' ELSE "searchText" || chr(31) || '${dv}' END`;

        try {
          let totalBackfilled = 0;
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const affected: number = await ctx.db.$executeRawUnsafe(`
              UPDATE "Row"
              SET "cells" = jsonb_set(COALESCE("cells", '{}'), '{${cId}}', ${jsonbExpr}),
                  "searchText" = ${searchAppend},
                  "updatedAt" = now()
              WHERE "id" IN (
                SELECT "id" FROM "Row"
                WHERE "tableId" = '${tId}'
                  AND NOT (COALESCE("cells", '{}') ? '${cId}')
                ORDER BY "rowIndex"
                LIMIT ${BACKFILL_BATCH}
              )
            `);
            totalBackfilled += affected;
            if (affected === 0) break;
          }
          console.log(`[column.create] Default value backfill: ${totalBackfilled} rows updated for column ${col.id}`);
        } catch (err) {
          console.error("[column.create] Default value backfill failed:", err);
        }
      }

      if (input.sourceColumnId) {
        const tId = input.tableId.replace(/'/g, "''");
        const srcId = input.sourceColumnId.replace(/'/g, "''");
        const newId = col.id.replace(/'/g, "''");

        try {
          let totalBackfilled = 0;
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const affected: number = await ctx.db.$executeRawUnsafe(`
              UPDATE "Row"
              SET "cells" = CASE
                    WHEN COALESCE("cells", '{}') ? '${srcId}'
                    THEN jsonb_set(COALESCE("cells", '{}'), '{${newId}}', COALESCE("cells", '{}')->'${srcId}')
                    ELSE "cells"
                  END,
                  "searchText" = CASE
                    WHEN COALESCE("cells", '{}') ? '${srcId}'
                    THEN CASE
                      WHEN "searchText" = '' THEN (COALESCE("cells", '{}')->>'${srcId}')
                      ELSE "searchText" || chr(31) || COALESCE(COALESCE("cells", '{}')->>'${srcId}', '')
                    END
                    ELSE "searchText"
                  END,
                  "updatedAt" = now()
              WHERE "id" IN (
                SELECT "id" FROM "Row"
                WHERE "tableId" = '${tId}'
                  AND NOT (COALESCE("cells", '{}') ? '${newId}')
                ORDER BY "rowIndex"
                LIMIT ${BACKFILL_BATCH}
              )
            `);
            totalBackfilled += affected;
            if (affected === 0) break;
          }
          console.log(`[column.create] Field duplication backfill: ${totalBackfilled} rows updated for column ${col.id}`);
        } catch (err) {
          console.error("[column.create] Field duplication backfill failed:", err);
        }
      }

      return col;
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

      // ── Step 1: Fast transaction — delete column + clean up views ──
      // NO heavy row updates here; this completes in <1s.
      await ctx.db.$transaction(async (tx) => {
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
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const affected: number = await ctx.db.$executeRawUnsafe(`
            UPDATE "Row"
            SET "cells" = "cells" - '${colId}',
                "updatedAt" = now()
            WHERE "id" IN (
              SELECT "id" FROM "Row"
              WHERE "tableId" = '${tId}'
                AND (COALESCE("cells", '{}') ? '${colId}')
              ORDER BY "rowIndex"
              LIMIT ${BATCH}
            )
          `);
          totalCleaned += affected;
          if (affected === 0) break;
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
