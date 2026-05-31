import { z } from "zod";
import { protectedProcedure } from "../../trpc";

export const create = protectedProcedure
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
    // as a separate mutation after receiving the column. This makes
    // column creation sub-200ms instead of 10-30s.

    // Index creation is NOT done here either. Building a B-tree on
    // all-NULL rows is wasted work. The on-demand ensureSortIndex in
    // infinite/windowFetch builds the index if/when the user actually
    // sorts on this column.

    return col;
  });
