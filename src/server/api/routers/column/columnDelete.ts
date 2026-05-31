import { z } from "zod";
import { protectedProcedure } from "../../trpc";

type FilterTreeNode = { kind?: string; columnId?: string; items?: FilterTreeNode[]; [key: string]: unknown };

function cleanFilterTreeColumn(
  items: FilterTreeNode[],
  columnId: string,
): { items: FilterTreeNode[]; changed: boolean } {
  let changed = false;
  const result: FilterTreeNode[] = [];
  for (const item of items) {
    if (item.kind === "condition") {
      if (item.columnId === columnId) {
        changed = true;
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

export const deleteColumn = protectedProcedure
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
  });

export const removeFromView = protectedProcedure
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
  });
