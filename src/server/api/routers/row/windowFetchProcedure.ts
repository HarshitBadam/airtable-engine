import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import { filterSchema, sortSchema, filterTreeSchema } from "~/shared/grid";
import { filterTreeHasConditions } from "~/server/sql/filterSql";
import { sortedCursorSchema } from "~/server/sql/sortSql";
import { queryNoBitmap, queryRawUnsafe } from "~/server/sql/queryHelpers";
import {
  buildCountSql,
  buildNextCursor,
  validateSortsAndFilters,
  type CountRow,
  type RowSelect,
} from "./rowQueryHelpers";
import { fetchNaturalWindow } from "./naturalWindowFetch";
import { buildWindowFetchSql } from "./windowFetchSql";

// windowFetch — positional window fetch for virtualized grid jumps.
// Three-tier strategy:
//   Tier 1 (no sort/filter/search): rowIndex estimation + B-tree seek → O(log N)
//   Tier 2 (saved view with fresh ranks): JOIN ViewRowRank, rank BETWEEN → O(log N)
//   Tier 3 (temporary sort / stale ranks): OFFSET + LIMIT → O(offset)
export const windowFetch = protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      offset: z.number().min(0),
      limit: z.number().min(1).max(2000).default(1000),
      search: z.string().max(200).optional(),
      filters: z.array(filterSchema).optional(),
      conjunction: z.enum(["and", "or"]).default("and"),
      filterTree: filterTreeSchema.optional(),
      sorts: z.array(sortSchema).optional(),
      viewId: z.string().optional(),
      // Count-skip optimisation: when true, the server skips the expensive COUNT(*) query and
      // returns knownTotal as-is.  The client should only set this when
      // it already has a valid totalCount from a prior fetch with the
      // same filter/sort parameters.
      skipCount: z.boolean().optional(),
      knownTotal: z.number().int().optional(),
      // Cursor anchor optimisation: if the client has a cached keyset
      // cursor near the target offset,
      // it sends it here so the server can seek past `anchorOffset` rows
      // via keyset predicate and only OFFSET the remainder.
      anchor: z
        .object({
          /** Absolute row position this cursor represents. */
          anchorOffset: z.number().int().min(0),
          cursor: sortedCursorSchema,
        })
        .optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const search = input.search?.trim();
    const filters = input.filters ?? [];
    const conjunction = input.conjunction;
    const filterTree = input.filterTree;
    const useTree = filterTree && filterTreeHasConditions(filterTree);
    let sorts = input.sorts ?? [];
    const hasQuery =
      sorts.length > 0 ||
      filters.length > 0 ||
      Boolean(search && search.length > 0) ||
      Boolean(useTree);

    // TIER 1 FAST PATH: exact B-tree seek for dense rowIndex sequences.
    // Sparse or uneven sequences validate the estimate's actual rank and
    // correct it before returning a window.
    if (!hasQuery) {
      // Auth + table metadata (rowCount is already materialized on the model)
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true, rowCount: true },
      });
      if (!table)
        throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

      if (table.rowCount === 0 || input.offset >= table.rowCount) {
        return { items: [], totalCount: table.rowCount, nextCursor: null };
      }

      const items = await fetchNaturalWindow(
        ctx.db,
        input.tableId,
        table.rowCount,
        input.offset,
        input.limit,
      );

      let nextCursor:
        | number
        | { rowIndex: number; sortValues: (string | number | null)[] }
        | null = null;
      if (items.length > 0) {
        nextCursor = items[items.length - 1]!.rowIndex;
      }

      return { items, totalCount: table.rowCount, nextCursor };
    }

    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true, rowCount: true },
    });
    if (!table)
      throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

    sorts = await validateSortsAndFilters(
      ctx.db,
      sorts,
      filters,
      filterTree,
      !!useTree,
      input.tableId,
    );

    // TIER 2: Saved view with fresh ViewRowRank → O(limit) fetch.
    // Only for sort-only (no filters/search).  Sort+filter stays on Tier 3
    // because evaluating filters requires joining every ranked entry to Row
    // — worse than Tier 3's approach
    // of filtering first then sorting the smaller filtered set.
    const hasFiltersOrSearch =
      filters.length > 0 ||
      Boolean(useTree) ||
      Boolean(search && search.length > 0);
    if (input.viewId && sorts.length > 0 && !hasFiltersOrSearch) {
      const view = await ctx.db.view.findFirst({
        where: {
          id: input.viewId,
          tableId: input.tableId,
          table: { base: { ownerId: ctx.session.user.id } },
        },
        select: { ranksStale: true },
      });

      if (view && !view.ranksStale) {
        // O(log N) probe: check if the target offset exists in the ranked zone.
        const targetRank = input.offset + 1;
        const [rankProbe] = await queryRawUnsafe<{ rank: number }[]>(
          ctx.db,
          `SELECT "rank" FROM "ViewRowRank" WHERE "viewId" = $1 AND "rank" = $2 LIMIT 1`,
          [input.viewId, targetRank],
        );

        if (rankProbe) {
          // Offset is within the ranked zone — fast BETWEEN query.
          const startRank = targetRank;
          const endRank = startRank + input.limit - 1;

          const rp = [input.viewId, startRank, endRank];
          const rankedSql = `
            SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
            FROM "ViewRowRank" vrr
            JOIN "Row" r ON r."id" = vrr."rowId"
            WHERE vrr."viewId" = $1 AND vrr."rank" BETWEEN $2 AND $3
            ORDER BY vrr."rank" ASC
          `;
          const items = await queryRawUnsafe<RowSelect[]>(
            ctx.db,
            rankedSql,
            rp,
          );

          const nextCursor:
            | number
            | { rowIndex: number; sortValues: (string | number | null)[] }
            | null =
            items.length > 0
              ? buildNextCursor(sorts, items[items.length - 1]!)
              : null;

          // totalCount = table.rowCount always (rankCount + unrankedCount = rowCount)
          return { items, totalCount: table.rowCount, nextCursor };
        }

        // Offset is beyond the ranked zone → fall through to Tier 3 (with anchors)
      }
    }

    const dataQuery = buildWindowFetchSql({
      tableId: input.tableId,
      offset: input.offset,
      limit: input.limit,
      search,
      useTree,
      filterTree,
      filters,
      conjunction,
      sorts,
      anchor: input.anchor,
    });

    let totalCount: number;
    const runDataQuery = dataQuery.disableBitmapScan
      ? () =>
          queryNoBitmap<RowSelect[]>(ctx.db, dataQuery.sql, dataQuery.params)
      : () =>
          queryRawUnsafe<RowSelect[]>(ctx.db, dataQuery.sql, dataQuery.params);

    if (input.skipCount && typeof input.knownTotal === "number") {
      totalCount = input.knownTotal;

      const items = await runDataQuery();

      const nextCursor:
        | number
        | { rowIndex: number; sortValues: (string | number | null)[] }
        | null =
        items.length > 0
          ? buildNextCursor(sorts, items[items.length - 1]!)
          : null;

      return { items, totalCount, nextCursor };
    }

    const { countSql, countParams } = buildCountSql(
      input.tableId,
      search,
      useTree,
      filterTree,
      filters,
      conjunction,
    );

    const [items, countRes] = await Promise.all([
      runDataQuery(),
      queryRawUnsafe<CountRow[]>(ctx.db, countSql, countParams),
    ]);

    totalCount = countRes[0]?.count ?? 0;

    const nextCursor:
      | number
      | { rowIndex: number; sortValues: (string | number | null)[] }
      | null =
      items.length > 0
        ? buildNextCursor(sorts, items[items.length - 1]!)
        : null;

    return { items, totalCount, nextCursor };
  });
