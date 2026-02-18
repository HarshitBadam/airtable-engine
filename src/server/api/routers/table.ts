import { z } from "zod";
import { faker } from "@faker-js/faker";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { ViewConfig } from "../types/view";
import { dropColumnIndexesForTable, ensureSortIndex } from "~/server/db/ensureColumnIndexes";

const STATUSES = ["Todo", "In progress", "In review", "Done", "Blocked"] as const;

export const tableRouter = createTRPCRouter({
  listByBase: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, ownerId: ctx.session.user.id },
        select: { id: true },
      });
      // Return empty array instead of throwing (supports optimistic navigation during base creation)
      if (!base) return [];

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

      // Uniqueness check: no two tables in the same base can share a name
      const duplicate = await ctx.db.table.findFirst({
        where: { baseId: input.baseId, name: input.name },
        select: { id: true },
      });
      if (duplicate) throw new Error("A table with this name already exists in this base");

      const seedCount = 25;

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

        // Default columns matching Airtable's layout
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

        const view = await tx.view.create({
          data: {
            tableId: table.id,
            name: "Grid view",
            config: defaultViewConfig as unknown as object,
          },
        });

        // Seed rows with faker.js data
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
          data: {
            rowCount: seedCount,
            nextRowIndex: seedCount + 1,
          },
        });

        return { table, view, columns: cols };
      });

      // Build sort indexes for seed columns (outside transaction)
      await Promise.all(
        result.columns.map((c) =>
          ensureSortIndex(ctx.db, result.table.id, c.id, c.type as "TEXT" | "NUMBER"),
        ),
      );

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

      const duplicate = await ctx.db.table.findFirst({
        where: { baseId: table.baseId, name: input.name, NOT: { id: input.id } },
        select: { id: true },
      });
      if (duplicate) throw new Error("A table with this name already exists in this base");

      return ctx.db.table.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), baseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, ownerId: ctx.session.user.id },
        select: { id: true },
      });
      if (!base) throw new Error("Base not found");

      // Drop custom column indexes before deleting rows (prevents orphan indexes in pg_catalog)
      await dropColumnIndexesForTable(ctx.db, input.id).catch(() => {});

      // Ensure at least one table remains (check + delete in transaction to avoid race condition)
      return ctx.db.$transaction(async (tx) => {
        const count = await tx.table.count({
          where: { baseId: input.baseId },
        });
        if (count <= 1) throw new Error("Cannot delete the last table");

        return tx.table.delete({ where: { id: input.id } });
      });
    }),
});
