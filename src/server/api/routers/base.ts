import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { dropColumnIndexesForTable } from "~/server/db/ensureColumnIndexes";
import { ensureSeedColumnIndexes, seedDefaultTable } from "~/server/seed/defaultTableSeed";

export const baseRouter = createTRPCRouter({
  listMine: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.base.findMany({
      where: { ownerId: ctx.session.user.id },
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
        throw new TRPCError({ code: "NOT_FOUND", message: "Base not found or access denied" });
      }
      return base;
    }),

  create: protectedProcedure
    .input(z.object({
      id: z.string().min(1).max(30),
      name: z.string().min(1).max(80),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async (tx) => {
        const base = await tx.base.create({
          data: {
            id: input.id,
            name: input.name,
            ownerId: ctx.session.user.id,
          },
        });

        const seeded = await seedDefaultTable(tx, { baseId: base.id });

        return { base, ...seeded };
      }, { timeout: 30_000 });

      await ensureSeedColumnIndexes(ctx.db, result.table.id, result.columns);

      return result.base;
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.id, ownerId: ctx.session.user.id },
      });
      if (!base) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Base not found or access denied" });
      }
      return ctx.db.base.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const MAX_RETRIES = 3;
      const BASE_DELAY_MS = 250;

      // Verify ownership up-front. Missing base = already deleted (idempotent).
      const base = await ctx.db.base.findFirst({
        where: { id: input.id, ownerId: ctx.session.user.id },
      });
      if (!base) return null;

      const tables = await ctx.db.table.findMany({
        where: { baseId: input.id },
        select: { id: true },
      });

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          return await ctx.db.$transaction(
            async (tx) => {
              // Drop per-column sort indexes first so the cascade doesn't
              // have to update them for every row delete.
              await Promise.all(
                tables.map((t) => dropColumnIndexesForTable(tx, t.id)),
              );

              return await tx.base.delete({
                where: { id: input.id },
              });
            },
            { timeout: 30_000 },
          );
        } catch (error) {
          const msg =
            typeof error === "object" &&
            error !== null &&
            "message" in error
              ? (error as { message: string }).message
              : "";
          if (
            msg.includes("Record to delete does not exist") ||
            msg.includes("does not exist")
          ) {
            return null;
          }

          // Last-resort bare delete on final attempt — skips index cleanup
          // but at least removes the base.
          if (attempt === MAX_RETRIES) {
            try {
              return await ctx.db.base.delete({
                where: { id: input.id },
              });
            } catch {
              return null;
            }
          }

          await new Promise((r) =>
            setTimeout(r, BASE_DELAY_MS * 2 ** attempt),
          );
        }
      }

      return null;
    }),

  toggleStar: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.id, ownerId: ctx.session.user.id },
      });
      if (!base) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Base not found or access denied" });
      }
      return ctx.db.base.update({
        where: { id: input.id },
        data: { isStarred: !base.isStarred },
      });
    }),

  listStarred: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.base.findMany({
      where: { ownerId: ctx.session.user.id, isStarred: true },
      orderBy: { lastOpenedAt: "desc" },
    });
  }),

  recordOpen: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.id, ownerId: ctx.session.user.id },
      });
      if (!base) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Base not found or access denied" });
      }
      return ctx.db.base.update({
        where: { id: input.id },
        data: { lastOpenedAt: new Date() },
      });
    }),
});
