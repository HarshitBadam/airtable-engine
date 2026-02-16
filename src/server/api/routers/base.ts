import { z } from "zod";
import { faker } from "@faker-js/faker";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { ViewConfig } from "../types/view";

const STATUSES = ["Todo", "In progress", "In review", "Done", "Blocked"] as const;

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
      const seedCount = 25;
      const defaultViewConfig: ViewConfig = {
        search: "",
        filters: [],
        filterConjunction: "and",
        sorts: [],
        hiddenColumnIds: [],
        columnOrderIds: [],
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

        // 3. Default columns matching Airtable's layout
        const colDefs: { name: string; type: "TEXT" | "NUMBER"; order: number }[] = [
          { name: "Name",        type: "TEXT",   order: 1 },
          { name: "Notes",       type: "TEXT",   order: 2 },
          { name: "Assignee",    type: "TEXT",   order: 3 },
          { name: "Status",      type: "TEXT",   order: 4 },
          { name: "Attachments", type: "TEXT",   order: 5 },
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

        // 4. Create default "Grid view"
        await tx.view.create({
          data: {
            tableId: table.id,
            name: "Grid view",
            config: defaultViewConfig as unknown as object,
          },
        });

        // 5. Seed rows with faker.js data
        const rowsData = Array.from({ length: seedCount }, (_, i) => {
          const name = faker.person.fullName();
          const notes = faker.company.catchPhrase();
          const assignee = faker.internet.email();
          const status = faker.helpers.arrayElement(STATUSES);
          const attachment = `https://storage.example.com/${faker.string.uuid()}/${faker.system.commonFileName()}`;

          const cells: Record<string, string> = {
            [cols[0]!.id]: name,
            [cols[1]!.id]: notes,
            [cols[2]!.id]: assignee,
            [cols[3]!.id]: status,
            [cols[4]!.id]: attachment,
          };

          const searchText = [name, notes, assignee, status, attachment].join("\u001F");

          return {
            tableId: table.id,
            rowIndex: i + 1,
            cells: cells as unknown as object,
            searchText,
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
      // Verify ownership — if not found, the base was already deleted
      // (or never existed). Treat as a no-op for idempotency.
      const base = await ctx.db.base.findFirst({
        where: { id: input.id, ownerId: ctx.session.user.id },
      });
      if (!base) return null;

      // Delete (cascade removes tables, rows, views, etc.)
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
