import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../../trpc";

export const update = protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      columnId: z.string(),
      name: z.string().min(1).max(80).optional(),
      numberConfig: z
        .object({
          decimalPlaces: z.number().int().min(0).max(8),
          thousandsSep: z.string(),
          showThousands: z.boolean(),
          largeNumAbbrev: z.string().nullable(),
          allowNegative: z.boolean(),
        })
        .optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true },
    });
    if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

    const col = await ctx.db.column.findFirst({
      where: { id: input.columnId, tableId: input.tableId },
      select: { id: true },
    });
    if (!col) throw new TRPCError({ code: "NOT_FOUND", message: "Column not found" });

    if (input.name) {
      const duplicate = await ctx.db.column.findFirst({
        where: { tableId: input.tableId, name: input.name, NOT: { id: input.columnId } },
        select: { id: true },
      });
      if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "A field with this name already exists in this table" });
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.numberConfig !== undefined) data.config = input.numberConfig as unknown as object;

    return ctx.db.column.update({
      where: { id: input.columnId },
      data,
      select: { id: true, name: true, type: true, order: true, defaultValue: true, config: true, sourceColumnId: true },
    });
  });
