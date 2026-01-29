import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const rowRouter = createTRPCRouter({
  infinite: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        limit: z.number().min(1).max(500).default(200),
        cursor: z.number().nullable().optional(),
        search: z.string().optional(), // Push 7
      }),
    )
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: {
          id: input.tableId,
          base: { ownerId: ctx.session.user.id },
        },
        select: { id: true, rowCount: true },
      });
      if (!table) throw new Error("Table not found");

      const cursorRowIndex = input.cursor ?? 0;
      const take = input.limit + 1;
      const search = input.search?.trim();

      const where = {
        tableId: input.tableId,
        rowIndex: { gt: cursorRowIndex },
        ...(search && search.length > 0
          ? { searchText: { contains: search, mode: "insensitive" as const } }
          : {}),
      } as const;

      const rows = await ctx.db.row.findMany({
        where,
        orderBy: { rowIndex: "asc" },
        take,
        select: {
          id: true,
          rowIndex: true,
          cells: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const hasNextPage = rows.length > input.limit;
      const items = hasNextPage ? rows.slice(0, input.limit) : rows;
      const nextCursor = hasNextPage
        ? items[items.length - 1]!.rowIndex
        : null;

      const totalCount =
        search && search.length > 0
          ? await ctx.db.row.count({
              where: {
                tableId: input.tableId,
                searchText: { contains: search, mode: "insensitive" },
              },
            })
          : table.rowCount;

      return {
        items,
        nextCursor,
        totalCount,
      };
    }),

  addMany: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        count: z.number().min(1).max(200000).default(100000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: userId } },
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      const count = input.count;

      const result = await ctx.db.$transaction(async (tx) => {
        const updated = await tx.table.update({
          where: { id: input.tableId },
          data: {
            nextRowIndex: { increment: count },
            rowCount: { increment: count },
          },
          select: { nextRowIndex: true },
        });

        const startRowIndex = updated.nextRowIndex - count;

        await tx.$executeRaw`
          INSERT INTO "Row" ("tableId", "rowIndex", "cells", "searchText", "createdAt", "updatedAt")
          SELECT
            ${input.tableId},
            ${startRowIndex} + gs,
            '{}'::jsonb,
            ''::text,
            now(),
            now()
          FROM generate_series(0, ${count} - 1) AS gs;
        `;

        return { startRowIndex, count };
      });

      return result;
    }),

  updateCell: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        rowId: z.string(),
        columnId: z.string(),
        value: z.union([z.string(), z.number(), z.null()]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: userId } },
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      const row = await ctx.db.row.findFirst({
        where: { id: input.rowId, tableId: input.tableId },
        select: { id: true, cells: true },
      });
      if (!row) throw new Error("Row not found");

      const cells = (row.cells ?? {}) as Record<string, unknown>;

      if (input.value === null || input.value === "") {
        delete cells[input.columnId];
      } else {
        cells[input.columnId] = input.value;
      }

      // Lint-safe stringification (avoids "[object Object]")
      const searchText = Object.values(cells)
        .map((v) => {
          if (v == null) return "";
          if (typeof v === "string") return v;
          if (typeof v === "number" || typeof v === "boolean") return String(v);
          try {
            return JSON.stringify(v);
          } catch {
            return "";
          }
        })
        .join(" ");

      return ctx.db.row.update({
        where: { id: input.rowId },
        data: {
          cells: cells as unknown as object,
          searchText,
        },
        select: { id: true, rowIndex: true, cells: true, updatedAt: true },
      });
    }),
});
