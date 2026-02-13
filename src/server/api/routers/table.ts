import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { ViewConfig } from "../types/view";

export const tableRouter = createTRPCRouter({
  listByBase: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, ownerId: ctx.session.user.id },
        select: { id: true },
      });
      if (!base) throw new Error("Base not found");

      return ctx.db.table.findMany({
        where: { baseId: input.baseId },
        orderBy: { createdAt: "asc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({ baseId: z.string(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // ownership check
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, ownerId: userId },
        select: { id: true },
      });
      if (!base) throw new Error("Base not found");

      const seedCount = 20;

      const defaultViewConfig: ViewConfig = {
        search: "",
        filters: [],
        filterConjunction: "and",
        sorts: [],
        hiddenColumnIds: [],
        columnOrderIds: [],
      };

      const result = await ctx.db.$transaction(async (tx) => {
        const table = await tx.table.create({
          data: {
            baseId: input.baseId,
            name: input.name,
          },
        });

        // Create 2 default columns: # (auto-number) and Name
        const colDefs: { name: string; type: "TEXT" | "NUMBER"; order: number }[] = [
          { name: "#",    type: "NUMBER", order: 1 },
          { name: "Name", type: "TEXT",   order: 2 },
        ];

        const cols = await Promise.all(
          colDefs.map((c) =>
            tx.column.create({ data: { tableId: table.id, name: c.name, type: c.type, order: c.order } }),
          ),
        );

        await tx.table.update({
          where: { id: table.id },
          data: { nextColumnOrder: colDefs.length + 1 },
        });

        const view = await tx.view.create({
          data: {
            tableId: table.id,
            name: "Grid view",
            config: defaultViewConfig as unknown as object,
          },
        });

        // Seed rows with auto-number only — Name column left blank so the user
        // starts with a clean slate (matching Airtable's behavior).
        const rowsData = Array.from({ length: seedCount }, (_, i) => {
          const cells: Record<string, string | number> = {
            [cols[0]!.id]: i + 1,
          };

          return {
            tableId: table.id,
            rowIndex: i + 1,
            cells: cells as unknown as object,
            searchText: String(i + 1),
          };
        });

        await tx.row.createMany({ data: rowsData });

        await tx.table.update({
          where: { id: table.id },
          data: {
            rowCount: seedCount,
            nextRowIndex: seedCount + 1,
          },
        });

        return { table, view, columns: cols };
      });

      return result;
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.id },
        include: { base: { select: { ownerId: true } } },
      });
      if (!table || table.base.ownerId !== ctx.session.user.id) {
        throw new Error("Table not found");
      }
      return ctx.db.table.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), baseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, ownerId: ctx.session.user.id },
        select: { id: true },
      });
      if (!base) throw new Error("Base not found");

      // Ensure at least one table remains
      const count = await ctx.db.table.count({
        where: { baseId: input.baseId },
      });
      if (count <= 1) throw new Error("Cannot delete the last table");

      return ctx.db.table.delete({ where: { id: input.id } });
    }),
});
