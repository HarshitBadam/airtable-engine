import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { viewConfigSchema } from "~/shared/grid";

export const viewRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

      return ctx.db.view.findMany({
        where: { tableId: input.tableId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, config: true, ranksStale: true, createdAt: true, updatedAt: true },
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
      if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

      const duplicate = await ctx.db.view.findFirst({
        where: { tableId: input.tableId, name: input.name },
        select: { id: true },
      });
      if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "A view with this name already exists in this table" });

      return ctx.db.view.create({
        data: {
          tableId: input.tableId,
          name: input.name,
          config: input.config as unknown as object,
        },
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
      const view = await ctx.db.view.findFirst({
        where: { id: input.viewId, table: { base: { ownerId: ctx.session.user.id } } },
        select: { id: true, tableId: true },
      });
      if (!view) throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });

      if (input.name) {
        const duplicate = await ctx.db.view.findFirst({
          where: { tableId: view.tableId, name: input.name, NOT: { id: input.viewId } },
          select: { id: true },
        });
        if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "A view with this name already exists in this table" });
      }

      return ctx.db.view.update({
        where: { id: input.viewId },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.config ? { config: input.config as unknown as object } : {}),
        },
        select: { id: true, name: true, config: true },
      });
    }),

  duplicate: protectedProcedure
    .input(z.object({ viewId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.view.findFirst({
        where: { id: input.viewId, table: { base: { ownerId: ctx.session.user.id } } },
        select: { id: true, tableId: true, name: true, config: true },
      });
      if (!view) throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });

      const siblings = await ctx.db.view.findMany({
        where: { tableId: view.tableId },
        select: { name: true },
      });
      const existingNames = new Set(siblings.map(s => s.name));
      let newName = `${view.name} 2`;
      let num = 2;
      while (existingNames.has(newName)) {
        num++;
        newName = `${view.name} ${num}`;
      }

      return ctx.db.view.create({
        data: {
          tableId: view.tableId,
          name: newName,
          config: view.config as object,
        },
        select: { id: true, name: true, config: true },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ viewId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.view.findFirst({
        where: { id: input.viewId, table: { base: { ownerId: ctx.session.user.id } } },
        select: { id: true, tableId: true },
      });
      if (!view) throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });

      // Last-view guard inside a transaction so two concurrent deletes can't
      // both pass the count check and leave the table view-less.
      await ctx.db.$transaction(async (tx) => {
        const siblingCount = await tx.view.count({
          where: { tableId: view.tableId },
        });
        if (siblingCount <= 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete the only view" });
        }

        await tx.view.delete({ where: { id: input.viewId } });
      });
      return { deleted: true };
    }),
});
