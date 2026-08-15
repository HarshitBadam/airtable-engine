import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../../trpc";

export const updateCell = protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      rowId: z.string(),
      columnId: z.string(),
      value: z.union([z.string(), z.number(), z.null()]),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true },
    });
    if (!table)
      throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

    // Storing a string in a NUMBER column (or vice versa) would break sorting
    // and filtering, so coerce the value to match the column type.
    const column = await ctx.db.column.findFirst({
      where: { id: input.columnId, tableId: input.tableId },
      select: { id: true, type: true, sourceColumnId: true },
    });
    if (!column)
      throw new TRPCError({ code: "NOT_FOUND", message: "Column not found" });

    const row = await ctx.db.row.findFirst({
      where: { id: input.rowId, tableId: input.tableId },
      select: { id: true, cells: true },
    });
    if (!row)
      throw new TRPCError({ code: "NOT_FOUND", message: "Row not found" });

    const currentCells = (row.cells ?? {}) as Record<string, unknown>;

    // Freeze pre-edit value into dependent (duplicate) columns.
    // If c1c was duplicated from c1 (sourceColumnId = c1.id) and the
    // backfill hasn't written c1c's key yet, copy c1's current value
    // into c1c so the backfill (which uses existing-wins ordering)
    // won't overwrite it with the post-edit value.
    const dependents = await ctx.db.column.findMany({
      where: { sourceColumnId: input.columnId, tableId: input.tableId },
      select: { id: true },
    });
    for (const dep of dependents) {
      if (!Object.prototype.hasOwnProperty.call(currentCells, dep.id)) {
        const oldVal = currentCells[input.columnId];
        currentCells[dep.id] = oldVal ?? null;
      }
    }

    if (input.value === null || input.value === "") {
      // If this column is still being backfilled (has sourceColumnId),
      // set to null instead of deleting so the key persists in JSONB.
      // The backfill uses existing-wins ordering and will skip this key.
      if (column.sourceColumnId) {
        currentCells[input.columnId] = null;
      } else {
        delete currentCells[input.columnId];
      }
    } else if (column.type === "NUMBER") {
      const num =
        typeof input.value === "number" ? input.value : Number(input.value);
      if (Number.isNaN(num)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid number value",
        });
      }
      currentCells[input.columnId] = num;
    } else {
      currentCells[input.columnId] =
        typeof input.value === "number" ? String(input.value) : input.value;
    }

    // Lint-safe stringification (avoids "[object Object]")
    // Uses \u001F (Unit Separator) as delimiter to prevent cross-cell false matches
    const searchText = Object.values(currentCells)
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
      .join("\u001F");

    const result = await ctx.db.row.update({
      where: { id: input.rowId },
      data: {
        cells: currentCells as unknown as object,
        searchText,
      },
      select: { id: true, rowIndex: true, cells: true, updatedAt: true },
    });

    // NOTE: We intentionally do NOT mark ranks stale here.
    // With permanent sort (autoSort=false), the rank is frozen — cell
    // edits don't move the row. With autoSort=true, the query uses live
    // ORDER BY (no ViewRowRank), so ranks aren't relevant.

    return result;
  });
