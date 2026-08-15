import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import { escapeLiteral } from "~/server/sql/escape";
import {
  MAX_ADD_MANY_PER_CALL,
  DEFAULT_ADD_MANY,
  MAX_ROWS_PER_TABLE,
  MAX_ROWS_PER_USER,
} from "../../limits";
import { buildPopulatedRowSql } from "./addManyFixtures";

export const addMany = protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      count: z
        .number()
        .min(1)
        .max(MAX_ADD_MANY_PER_CALL)
        .default(DEFAULT_ADD_MANY),
      populate: z.boolean().default(true),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true, rowCount: true },
    });
    if (!table)
      throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

    if (table.rowCount + input.count > MAX_ROWS_PER_TABLE) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Row limit for this table reached (max ${MAX_ROWS_PER_TABLE}). Delete rows or use a new table.`,
      });
    }

    const userAggregate = await ctx.db.table.aggregate({
      where: { base: { ownerId: ctx.session.user.id } },
      _sum: { rowCount: true },
    });
    const userTotal = userAggregate._sum.rowCount ?? 0;
    if (userTotal + input.count > MAX_ROWS_PER_USER) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Account row limit reached (max ${MAX_ROWS_PER_USER}).`,
      });
    }

    const columns = input.populate
      ? await ctx.db.column.findMany({
          where: { tableId: input.tableId },
          orderBy: { order: "asc" },
          select: { id: true, type: true, name: true },
        })
      : [];

    const count = input.count;

    // IMPORTANT: Only increment nextRowIndex here, NOT rowCount.
    // rowCount is incremented after batches succeed (Step 3) so that a
    // failed batch on Vercel (timeout / connection drop) can never leave
    // rowCount higher than the actual number of rows — which would cause
    // permanent ghost/skeleton rows at the end of the table.
    const updated = await ctx.db.$transaction(async (tx) => {
      const t = await tx.table.update({
        where: { id: input.tableId },
        data: {
          nextRowIndex: { increment: count },
        },
        select: { nextRowIndex: true },
      });

      // NOTE: We intentionally do NOT mark ranks stale here.
      // New rows have no ViewRowRank entry.  For scrolling (infinite query)
      // they appear in the "unranked tail" (Phase 2).  For jumps (windowFetch)
      // they fall through to Tier 3 with cursor anchors.  The auto-rank
      // effect on the client re-computes ranks on view load to cover new rows.

      return t;
    });

    const startRowIndex = updated.nextRowIndex - count;
    const tableIdEscaped = escapeLiteral(input.tableId);

    // We keep per-column indexes alive during insert instead of
    // dropping and rebuilding.  B-tree maintenance is O(log N) per
    // row per index, so overhead stays nearly constant as the table
    // grows.  The win: sorts are always instant afterwards — no
    // cold-start index build that scales linearly with table size.
    //
    // If any batch fails, we compensate by rolling back the counters
    // to match the number of rows actually inserted, preventing drift.

    const INSERT_BATCH = 10_000;
    let insertedCount = 0;
    try {
      for (let offset = 0; offset < count; offset += INSERT_BATCH) {
        const batchCount = Math.min(INSERT_BATCH, count - offset);
        const batchStart = startRowIndex + offset;

        const { cellsExpr, searchExpr } = buildPopulatedRowSql(
          columns,
          batchStart,
        );

        await ctx.db.$executeRawUnsafe(`
          INSERT INTO "Row" ("tableId", "rowIndex", "cells", "searchText", "createdAt", "updatedAt")
          SELECT
            '${tableIdEscaped}',
            ${batchStart} + gs,
            ${cellsExpr},
            ${searchExpr},
            now(),
            now()
          FROM generate_series(0, ${batchCount - 1}) AS gs
        `);
        insertedCount += batchCount;
      }
    } catch (err) {
      // Compensate: roll back nextRowIndex for the rows that weren't inserted.
      // rowCount was NOT pre-incremented, so no rowCount drift is possible.
      const missed = count - insertedCount;
      if (missed > 0) {
        try {
          await ctx.db.table.update({
            where: { id: input.tableId },
            data: {
              nextRowIndex: { decrement: missed },
            },
          });
        } catch {
          // If even the compensation fails (connection dead), nextRowIndex
          // is slightly too high — harmless (just a gap in row indices).
          // rowCount is still correct because we haven't touched it yet.
        }
      }

      // Even on failure, reconcile rowCount with the actual row count so
      // any partially inserted rows are reflected correctly.
      try {
        const [actual] = await ctx.db.$queryRawUnsafe<{ cnt: number }[]>(
          `SELECT COUNT(*)::int AS cnt FROM "Row" WHERE "tableId" = $1`,
          input.tableId,
        );
        if (actual) {
          await ctx.db.table.update({
            where: { id: input.tableId },
            data: { rowCount: actual.cnt },
          });
        }
      } catch {
        // Best-effort reconciliation — if this fails too, the counter
        // may be slightly off but at least it won't be wildly inflated.
      }

      throw err;
    }

    // Reconcile rowCount with the actual number of rows.
    // Using COUNT(*) is the source of truth — eliminates any possible
    // drift from partial failures, race conditions, or prior bugs.
    // Cost: ~10-30ms for 300K rows with the tableId index.
    const [actual] = await ctx.db.$queryRawUnsafe<{ cnt: number }[]>(
      `SELECT COUNT(*)::int AS cnt FROM "Row" WHERE "tableId" = $1`,
      input.tableId,
    );
    if (actual) {
      await ctx.db.table.update({
        where: { id: input.tableId },
        data: { rowCount: actual.cnt },
      });
    }

    return { startRowIndex, count };
  });
