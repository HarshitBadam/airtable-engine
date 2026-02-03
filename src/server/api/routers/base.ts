import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const baseRouter = createTRPCRouter({
  listMine: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.base.findMany({
      where: { ownerId: ctx.session.user.id },
      // Use createdAt for stable ordering - doesn't change on star/rename
      orderBy: { createdAt: "desc" },
    });
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.base.create({
        data: { name: input.name, ownerId: ctx.session.user.id },
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
      // Use createdAt for stable ordering - doesn't change on star/rename
      orderBy: { createdAt: "desc" },
    });
  }),
});
