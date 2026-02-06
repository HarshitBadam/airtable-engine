import { z } from "zod";
import { faker } from "@faker-js/faker";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { ViewConfig } from "../types/view";

export const baseRouter = createTRPCRouter({
  listMine: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.base.findMany({
      where: { ownerId: ctx.session.user.id },
      // Sort by lastOpenedAt so recently opened bases appear first
      orderBy: { lastOpenedAt: "desc" },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.id, ownerId: ctx.session.user.id },
      });
      if (!base) {
        throw new Error("Base not found or access denied");
      }
      return base;
    }),

  create: protectedProcedure
    .input(z.object({ 
      id: z.string().min(1).max(30),
      name: z.string().min(1).max(80) 
    }))
    .mutation(async ({ ctx, input }) => {
      const seedCount = 120;
      const defaultViewConfig: ViewConfig = {
        search: "",
        filters: [],
        sort: null,
        hiddenColumnIds: [],
      };

      return ctx.db.$transaction(async (tx) => {
        // 1. Create the base
        const base = await tx.base.create({
          data: {
            id: input.id,
            name: input.name,
            ownerId: ctx.session.user.id,
          },
        });

        // 2. Create default "Table 1"
        const table = await tx.table.create({
          data: { baseId: base.id, name: "Table 1" },
        });

        // 3. Create default columns
        const [nameCol, notesCol, amountCol] = await Promise.all([
          tx.column.create({ data: { tableId: table.id, name: "Name", type: "TEXT", order: 1 } }),
          tx.column.create({ data: { tableId: table.id, name: "Notes", type: "TEXT", order: 2 } }),
          tx.column.create({ data: { tableId: table.id, name: "Amount", type: "NUMBER", order: 3 } }),
        ]);

        await tx.table.update({
          where: { id: table.id },
          data: { nextColumnOrder: 4 },
        });

        // 4. Create default "Grid view"
        await tx.view.create({
          data: {
            tableId: table.id,
            name: "Grid view",
            config: defaultViewConfig as unknown as object,
          },
        });

        // 5. Seed rows
        const rowsData = Array.from({ length: seedCount }, (_, i) => {
          const cells: Record<string, string | number> = {
            [nameCol.id]: faker.person.fullName(),
            [notesCol.id]: faker.lorem.sentence(),
            [amountCol.id]: faker.number.int({ min: 0, max: 10000 }),
          };
          return {
            tableId: table.id,
            rowIndex: i + 1,
            cells: cells as unknown as object,
            searchText: Object.values(cells).join(" "),
          };
        });

        await tx.row.createMany({ data: rowsData });

        await tx.table.update({
          where: { id: table.id },
          data: { rowCount: seedCount, nextRowIndex: seedCount + 1 },
        });

        return base;
      });
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      // First verify ownership
      const base = await ctx.db.base.findFirst({
        where: { id: input.id, ownerId: ctx.session.user.id },
      });
      if (!base) {
        throw new Error("Base not found or access denied");
      }
      // Then update
      return ctx.db.base.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // First verify ownership
      const base = await ctx.db.base.findFirst({
        where: { id: input.id, ownerId: ctx.session.user.id },
      });
      if (!base) {
        throw new Error("Base not found or access denied");
      }
      // Then delete
      return ctx.db.base.delete({
        where: { id: input.id },
      });
    }),

  toggleStar: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // First verify ownership and get current state
      const base = await ctx.db.base.findFirst({
        where: { id: input.id, ownerId: ctx.session.user.id },
      });
      if (!base) {
        throw new Error("Base not found or access denied");
      }
      // Toggle the starred state
      return ctx.db.base.update({
        where: { id: input.id },
        data: { isStarred: !base.isStarred },
      });
    }),

  listStarred: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.base.findMany({
      where: { ownerId: ctx.session.user.id, isStarred: true },
      // Sort by lastOpenedAt so recently opened bases appear first
      orderBy: { lastOpenedAt: "desc" },
    });
  }),

  recordOpen: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership first
      const base = await ctx.db.base.findFirst({
        where: { id: input.id, ownerId: ctx.session.user.id },
      });
      if (!base) {
        throw new Error("Base not found or access denied");
      }
      // Update lastOpenedAt timestamp
      return ctx.db.base.update({
        where: { id: input.id },
        data: { lastOpenedAt: new Date() },
      });
    }),
});
