import { z } from "zod";
import { faker } from "@faker-js/faker";
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
        orderBy: { updatedAt: "desc" },
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

      const seedCount = 120; // pick 50–200; 120 is a nice middle

      const defaultViewConfig: ViewConfig = {
        search: "",
        filters: [],
        sort: null,
        hiddenColumnIds: [],
      };

      const result = await ctx.db.$transaction(async (tx) => {
        const table = await tx.table.create({
          data: {
            baseId: input.baseId,
            name: input.name,
            // counters default automatically
          },
        });

        // Create default columns with deterministic ordering
        const [nameCol, notesCol, amountCol] = await Promise.all([
          tx.column.create({
            data: { tableId: table.id, name: "Name", type: "TEXT", order: 1 },
          }),
          tx.column.create({
            data: { tableId: table.id, name: "Notes", type: "TEXT", order: 2 },
          }),
          tx.column.create({
            data: { tableId: table.id, name: "Amount", type: "NUMBER", order: 3 },
          }),
        ]);

        // bump nextColumnOrder to 4 (since we used 1..3)
        await tx.table.update({
          where: { id: table.id },
          data: { nextColumnOrder: 4 },
        });

        const view = await tx.view.create({
          data: {
            tableId: table.id,
            name: "Grid view",
            config: defaultViewConfig as unknown as object,
          },
        });

        // Seed rows
        const rowsData = Array.from({ length: seedCount }, (_, i) => {
          const rowIndex = i + 1;

          const cells: Record<string, string | number> = {
            [nameCol.id]: faker.person.fullName(),
            [notesCol.id]: faker.lorem.sentence(),
            [amountCol.id]: faker.number.int({ min: 0, max: 10000 }),
          };

          const searchText = Object.values(cells).join(" ");

          return {
            tableId: table.id,
            rowIndex,
            cells: cells as unknown as object,
            searchText,
          };
        });

        await tx.row.createMany({ data: rowsData });

        // Update counters for pagination and totals
        await tx.table.update({
          where: { id: table.id },
          data: {
            rowCount: seedCount,
            nextRowIndex: seedCount + 1,
          },
        });

        return { table, view, columns: [nameCol, notesCol, amountCol] };
      });

      return result;
    }),
});
