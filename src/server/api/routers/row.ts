import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const rowRouter = createTRPCRouter({
  infinite: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        limit: z.number().min(1).max(500).default(200),
        cursor: z.number().nullable().optional(),
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

      const rows = await ctx.db.row.findMany({
        where: {
          tableId: input.tableId,
          rowIndex: { gt: cursorRowIndex },
        },
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

      return {
        items,
        nextCursor,
        totalCount: table.rowCount,
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
});
