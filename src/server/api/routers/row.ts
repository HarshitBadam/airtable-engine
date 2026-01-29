import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const rowRouter = createTRPCRouter({
  infinite: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        limit: z.number().min(1).max(500).default(200),
        cursor: z.number().nullable().optional(), // last rowIndex
      }),
    )
    .query(async ({ ctx, input }) => {
      // Ownership check: table -> base -> owner
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
      const nextCursor = hasNextPage ? items[items.length - 1]!.rowIndex : null;

      return {
        items,
        nextCursor,
        totalCount: table.rowCount,
      };
    }),
});
