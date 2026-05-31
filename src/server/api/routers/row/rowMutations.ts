import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import { escapeLiteral } from "~/server/sql/escape";

/**
 * Strategy (Float rowIndex, zero shifting):
 *   position="end"   → atomically claim nextRowIndex (O(1), race-safe)
 *   position="above"  → midpoint between prev row and atIndex
 *   position="below"  → midpoint between atIndex and next row
 *
 * No existing rows are ever touched — just one INSERT.
 */
export const insertAt = protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      atIndex: z.number(), // the reference rowIndex
      // 'above' = insert before atIndex, 'below' = insert after atIndex, 'end' = slot is free, use directly
      position: z.enum(["above", "below", "end"]).default("above"),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true },
    });
    if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

    // Wrapped in a transaction so the row INSERT and the Table counter
    // UPDATE are atomic — if either fails, both roll back and rowCount
    // stays consistent.

    return ctx.db.$transaction(async (tx) => {
      let insertIndex: number;

      if (input.position === "end") {
        // + button: atomically claim the next integer index from the Table's
        // nextRowIndex counter.  The UPDATE takes a row-level lock, so two
        // concurrent inserts can never claim the same slot — zero race risk.
        const claimed = await tx.$queryRawUnsafe<{ idx: number }[]>(
          `UPDATE "Table"
           SET "nextRowIndex" = "nextRowIndex" + 1
           WHERE "id" = $1
           RETURNING "nextRowIndex" - 1 AS idx`,
          input.tableId,
        );
        insertIndex = claimed[0]?.idx ?? 1;
      } else if (input.position === "above") {
        const prevRes = await tx.$queryRawUnsafe<{ prev: number | null }[]>(
          `SELECT MAX("rowIndex")::float8 AS prev FROM "Row"
           WHERE "tableId" = $1 AND "rowIndex" < $2`,
          input.tableId, input.atIndex,
        );
        const prevIndex = prevRes[0]?.prev;
        insertIndex = prevIndex != null
          ? (prevIndex + input.atIndex) / 2
          : input.atIndex / 2; // before the very first row
      } else {
        const nextRes = await tx.$queryRawUnsafe<{ nxt: number | null }[]>(
          `SELECT MIN("rowIndex")::float8 AS nxt FROM "Row"
           WHERE "tableId" = $1 AND "rowIndex" > $2`,
          input.tableId, input.atIndex,
        );
        const nextIndex = nextRes[0]?.nxt;
        insertIndex = nextIndex != null
          ? (input.atIndex + nextIndex) / 2
          : input.atIndex + 1; // after the very last row
      }

      const newRow = await tx.row.create({
        data: {
          tableId: input.tableId,
          rowIndex: insertIndex,
          cells: {},
          searchText: "",
        },
        select: { id: true, rowIndex: true, cells: true, createdAt: true, updatedAt: true },
      });

      // GREATEST ensures nextRowIndex never goes backward if a midpoint
      // insert happens to land below the current nextRowIndex.
      await tx.$executeRawUnsafe(
        `UPDATE "Table"
         SET "rowCount" = "rowCount" + 1,
             "nextRowIndex" = GREATEST("nextRowIndex", $1)
         WHERE "id" = $2`,
        Math.ceil(insertIndex) + 1,
        input.tableId,
      );

      // NOTE: We intentionally do NOT mark ranks stale here.
      // The new row has no ViewRowRank entry.  For scrolling it appears
      // in the unranked tail; for jumps it falls to Tier 3 with anchors.
      // Auto-rank re-computes on view load to cover new rows.

      return newRow;
    });
  });

export const duplicateAt = protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      rowId: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true },
    });
    if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

    const sourceRow = await ctx.db.row.findFirst({
      where: { id: input.rowId, tableId: input.tableId },
      select: { rowIndex: true, cells: true, searchText: true },
    });
    if (!sourceRow) throw new TRPCError({ code: "NOT_FOUND", message: "Row not found" });

    // Wrapped in a transaction so the row INSERT and the Table counter
    // UPDATE are atomic — if either fails, both roll back and rowCount
    // stays consistent.

    return ctx.db.$transaction(async (tx) => {
      const nextRes = await tx.$queryRawUnsafe<{ nxt: number | null }[]>(
        `SELECT MIN("rowIndex")::float8 AS nxt FROM "Row"
         WHERE "tableId" = $1 AND "rowIndex" > $2`,
        input.tableId, sourceRow.rowIndex,
      );
      const nextIndex = nextRes[0]?.nxt;

      const insertIndex = nextIndex != null
        ? (sourceRow.rowIndex + nextIndex) / 2   // midpoint between source and next
        : sourceRow.rowIndex + 1;                 // no next row — just +1

      const newRow = await tx.row.create({
        data: {
          tableId: input.tableId,
          rowIndex: insertIndex,
          cells: sourceRow.cells ?? {},
          searchText: sourceRow.searchText ?? "",
        },
        select: { id: true, rowIndex: true, cells: true, createdAt: true, updatedAt: true },
      });

      await tx.$executeRawUnsafe(
        `UPDATE "Table"
         SET "rowCount" = "rowCount" + 1,
             "nextRowIndex" = GREATEST("nextRowIndex", $1)
         WHERE "id" = $2`,
        Math.ceil(insertIndex) + 1,
        input.tableId,
      );

      // NOTE: We intentionally do NOT mark ranks stale here.
      // The duplicated row has no ViewRowRank entry.  Falls to
      // unranked tail (scroll) or Tier 3 (jump).  Auto-rank re-computes.

      return newRow;
    });
  });

/**
 * Idempotent: if the row is already gone (concurrent delete, double-click),
 * the mutation succeeds with count: 0 instead of throwing.
 */
export const deleteRow = protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      rowId: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true },
    });
    if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

    return ctx.db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM "ViewRowRank" WHERE "rowId" = $1::uuid`,
        input.rowId,
      );

      // deleteMany is idempotent — returns count: 0 if the row was already
      // deleted (concurrent request, double-click). This avoids the P2025
      // "Record to delete does not exist" error that Prisma's .delete() throws.
      const result = await tx.row.deleteMany({
        where: { id: input.rowId, tableId: input.tableId },
      });

      if (result.count > 0) {
        await tx.table.update({
          where: { id: input.tableId },
          data: { rowCount: { decrement: 1 } },
        });
      }

      return { id: input.rowId };
    });
  });

export const clearData = protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true, rowCount: true },
    });
    if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

    if (table.rowCount === 0) return { deletedCount: 0 };

    const tableIdEscaped = escapeLiteral(input.tableId);

    await ctx.db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`
        DELETE FROM "ViewRowRank"
        WHERE "rowId" IN (
          SELECT "id" FROM "Row" WHERE "tableId" = '${tableIdEscaped}'
        )
      `);

      await tx.$executeRawUnsafe(`
        DELETE FROM "Row" WHERE "tableId" = '${tableIdEscaped}'
      `);

      await tx.table.update({
        where: { id: input.tableId },
        data: {
          rowCount: 0,
          nextRowIndex: 1,
        },
      });
    }, { timeout: 120_000 }); // 120s for large tables

    return { deletedCount: table.rowCount };
  });

export const reorder = protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      rowId: z.string(),
      fromIndex: z.number(),
      toIndex: z.number(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    if (input.fromIndex === input.toIndex) return { ok: true };

    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true },
    });
    if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

    // Wrap the entire reorder in a transaction so the neighbour lookups
    // and the UPDATE are atomic — prevents a concurrent reorder from
    // reading stale neighbours and placing a row at a wrong midpoint.
    await ctx.db.$transaction(async (tx) => {
      const row = await tx.row.findFirst({
        where: { id: input.rowId, tableId: input.tableId },
        select: { id: true, rowIndex: true },
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Row not found" });

      if (row.rowIndex === input.toIndex) return;

      // Float midpoint reorder: O(log N), zero row shifting —
      // find the two neighbours at the drop position and place the
      // dragged row at the midpoint.
      const targetIdx = input.toIndex;

      const prevRes = await tx.$queryRawUnsafe<{ prev: number | null }[]>(
        `SELECT MAX("rowIndex")::float8 AS prev FROM "Row"
         WHERE "tableId" = $1 AND "rowIndex" < $2 AND "id" != $3::uuid`,
        input.tableId, targetIdx, input.rowId,
      );
      const nextRes = await tx.$queryRawUnsafe<{ nxt: number | null }[]>(
        `SELECT MIN("rowIndex")::float8 AS nxt FROM "Row"
         WHERE "tableId" = $1 AND "rowIndex" >= $2 AND "id" != $3::uuid`,
        input.tableId, targetIdx, input.rowId,
      );

      const prev = prevRes[0]?.prev;
      const next = nextRes[0]?.nxt;

      let newIdx: number;
      if (prev != null && next != null) {
        newIdx = (prev + next) / 2;
      } else if (prev != null) {
        newIdx = prev + 1;
      } else if (next != null) {
        newIdx = next / 2;
      } else {
        newIdx = targetIdx; // only row in table
      }

      await tx.row.update({
        where: { id: input.rowId },
        data: { rowIndex: newIdx },
      });
    });

    // NOTE: We intentionally do NOT mark ranks stale here.
    // Reorder only affects rowIndex (natural order), not the frozen
    // ViewRowRank sort order. Reorder is only allowed when no sorts
    // are active (canDragRows check on the frontend).

    return { ok: true };
  });
