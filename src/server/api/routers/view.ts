import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const viewConfigSchema = z.object({
  search: z.string(),
  filters: z.array(z.any()), // we’ll tighten in Push 9/10
  sort: z.any().nullable(),
  hiddenColumnIds: z.array(z.string()),
});

export const viewRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      return ctx.db.view.findMany({
        where: { tableId: input.tableId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, config: true, createdAt: true, updatedAt: true },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string().min(1).max(80),
        config: viewConfigSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      return ctx.db.view.create({
        data: { tableId: input.tableId, name: input.name, config: input.config },
        select: { id: true, name: true, config: true },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        viewId: z.string(),
        name: z.string().min(1).max(80).optional(),
        config: viewConfigSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ownership check via view->table->base
      const view = await ctx.db.view.findFirst({
        where: { id: input.viewId, table: { base: { ownerId: ctx.session.user.id } } },
        select: { id: true },
      });
      if (!view) throw new Error("View not found");

      return ctx.db.view.update({
        where: { id: input.viewId },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.config ? { config: input.config } : {}),
        },
        select: { id: true, name: true, config: true },
      });
    }),
});
