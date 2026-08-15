import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import {
  filterSchema,
  sortSchema,
  filterTreeSchema,
} from "~/shared/grid";
import { escapeLiteral, type SqlParam } from "~/server/sql/escape";
import {
  detectOrEqualsPattern,
  filterTreeHasConditions,
} from "~/server/sql/filterSql";
import {
  buildMultiSortCursorSql,
  buildMultiSortOrderBy,
  sortedCursorSchema,
} from "~/server/sql/sortSql";
import { queryNoBitmap, queryRawUnsafe } from "~/server/sql/queryHelpers";
import {
  buildBaseWhere,
  buildCountSql,
  buildNextCursor,
  validateSortsAndFilters,
  type CountRow,
  type RowSelect,
} from "./rowQueryHelpers";

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
      anchor: z.object({
        /** Absolute row position this cursor represents. */
        anchorOffset: z.number().int().min(0),
        cursor: sortedCursorSchema,
      }).optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const search = input.search?.trim();
    const filters = input.filters ?? [];
    const conjunction = input.conjunction;
    const filterTree = input.filterTree;
    const useTree = filterTree && filterTreeHasConditions(filterTree);
    let sorts = input.sorts ?? [];
    const hasQuery = sorts.length > 0 || filters.length > 0 || Boolean(search && search.length > 0) || Boolean(useTree);

    // TIER 1 FAST PATH: no sort/filter/search → rowIndex estimation + B-tree seek.
    // Instead of OFFSET (which scans+discards O(offset) index entries), we
    // estimate the rowIndex at the target position via linear interpolation
    // on MIN/MAX rowIndex and seek directly — O(log N) regardless of position.
    //
    // The estimation is near-perfect for bulk-inserted or append-heavy tables
    // (sequential rowIndex values). Midpoint insertions keep the distribution
    // dense within [min, max], so the estimate stays accurate.
    if (!hasQuery) {
      // Auth + table metadata (rowCount is already materialized on the model)
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true, rowCount: true },
      });
      if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

      if (table.rowCount === 0 || input.offset >= table.rowCount) {
        return { items: [], totalCount: table.rowCount, nextCursor: null };
      }

      // Fetch min/max rowIndex — O(log N) each (B-tree edge lookups)
      const [minMaxRes] = await queryRawUnsafe<{ min_idx: number; max_idx: number }[]>(
        ctx.db,
        `SELECT MIN("rowIndex") AS min_idx, MAX("rowIndex") AS max_idx
         FROM "Row" WHERE "tableId" = $1`,
        [input.tableId],
      );
      const minIdx = minMaxRes?.min_idx ?? 0;
      const maxIdx = minMaxRes?.max_idx ?? 0;

      const estimatedRowIndex =
        table.rowCount <= 1
          ? minIdx
          : minIdx + input.offset * ((maxIdx - minIdx) / (table.rowCount - 1));

      // B-tree range scan — O(log N) seek, no OFFSET scanning
      const params: SqlParam[] = [input.tableId, estimatedRowIndex, input.limit];
      const dataSql = `
        SELECT "id", "rowIndex", "cells", "createdAt", "updatedAt"
        FROM "Row"
        WHERE "tableId" = $1 AND "rowIndex" >= $2
        ORDER BY "rowIndex" ASC
        LIMIT $3
      `;
      const items = await queryRawUnsafe<RowSelect[]>(ctx.db, dataSql, params);

      let nextCursor: number | { rowIndex: number; sortValues: (string | number | null)[] } | null = null;
      if (items.length > 0) {
        nextCursor = items[items.length - 1]!.rowIndex;
      }

      return { items, totalCount: table.rowCount, nextCursor };
    }

    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true, rowCount: true },
    });
    if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

    sorts = await validateSortsAndFilters(ctx.db, sorts, filters, filterTree, !!useTree, input.tableId);

    // TIER 2: Saved view with fresh ViewRowRank → O(limit) fetch.
    // Only for sort-only (no filters/search).  Sort+filter stays on Tier 3
    // because evaluating filters requires joining every ranked entry to Row
    // — worse than Tier 3's approach
    // of filtering first then sorting the smaller filtered set.
    const hasFiltersOrSearch = filters.length > 0 || Boolean(useTree) || Boolean(search && search.length > 0);
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

          const rp: SqlParam[] = [input.viewId, startRank, endRank];
          const rankedSql = `
            SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
            FROM "ViewRowRank" vrr
            JOIN "Row" r ON r."id" = vrr."rowId"
            WHERE vrr."viewId" = $1 AND vrr."rank" BETWEEN $2 AND $3
            ORDER BY vrr."rank" ASC
          `;
          const items = await queryRawUnsafe<RowSelect[]>(ctx.db, rankedSql, rp);

          const nextCursor: number | { rowIndex: number; sortValues: (string | number | null)[] } | null =
            items.length > 0 ? buildNextCursor(sorts, items[items.length - 1]!) : null;

          // totalCount = table.rowCount always (rankCount + unrankedCount = rowCount)
          return { items, totalCount: table.rowCount, nextCursor };
        }

        // Offset is beyond the ranked zone → fall through to Tier 3 (with anchors)
      }
    }

    // TIER 3: Temporary sort / stale ranks → OFFSET + LIMIT.
    // Two optimisations layered together:
    //
    // A) DEFERRED JOIN — the inner subquery selects only "id" so Postgres
    //    keeps (sort_key, id) in the sort buffer instead of the full cells
    //    JSONB blob.  This dramatically shrinks memory usage for large
    //    OFFSETs, avoiding disk-spill and reducing TOAST decompression
    //    to the final window.
    //
    // B) CURSOR ANCHOR — when the client provides a keyset cursor from a
    //    previous fetch, we add a keyset predicate that lets Postgres skip
    //    all rows before the anchor.  The OFFSET is then only the distance
    //    from the anchor to the target position.
    //    Example: jump to row 500 K with anchor at 480 K → OFFSET = 20 K.
    const params: SqlParam[] = [];
    let whereSql = buildBaseWhere(input.tableId, search, useTree, filterTree, filters, conjunction, params);

    // The anchor must be BEFORE the target offset.
    // Two modes:
    //   A) Sorted: use multi-sort keyset predicate (skip in sort order)
    //   B) Unsorted: use rowIndex predicate (skip by natural position)
    // In both cases, effectiveOffset becomes (offset - anchorOffset), which
    // is dramatically smaller than the absolute offset.
    let effectiveOffset = input.offset;
    let anchorRowIndexParam: number | null = null; // tracks $N for UNION ALL path
    if (input.anchor && input.anchor.anchorOffset <= input.offset) {
      if (
        sorts.length > 0 &&
        input.anchor.cursor.sortValues.length === sorts.length
      ) {
        // A) Sorted: multi-sort keyset predicate
        whereSql += buildMultiSortCursorSql(sorts, input.anchor.cursor, params);
        effectiveOffset = input.offset - input.anchor.anchorOffset;
      } else if (sorts.length === 0) {
        // B) Unsorted (filters/search only): rowIndex keyset predicate.
        //    ORDER BY is rowIndex ASC, so "rowIndex > anchor" skips past it.
        params.push(input.anchor.cursor.rowIndex);
        anchorRowIndexParam = params.length;
        whereSql += ` AND "Row"."rowIndex" > $${params.length}`;
        effectiveOffset = input.offset - input.anchor.anchorOffset;
      }
    }

    const orderBySql = buildMultiSortOrderBy(sorts);

    // LIMIT + OFFSET (offset is now relative to the anchor, not absolute)
    params.push(input.limit);
    const limitP = params.length;
    params.push(effectiveOffset);
    const offsetP = params.length;

    // UNION ALL optimisation for OR-of-equals filters:
    // when the filter is `col = 'A' OR col = 'B'` (same column, no sorts,
    // no search), Postgres uses BitmapOr which loses rowIndex ordering and
    // requires a full re-sort of all matching rows.
    //
    // UNION ALL lets Postgres do a Merge Append of per-value index scans
    // on the composite index (cells->>'col', rowIndex).  Each branch is
    // already sorted by rowIndex, so the merge is O(offset) pointer
    // comparisons on compact index entries — much cheaper than the
    // BitmapOr + heap scan + sort path.
    const orEqPattern =
      !search && sorts.length === 0
        ? detectOrEqualsPattern(filterTree, filters, conjunction, Boolean(useTree))
        : null;

    let dataSql: string;

    if (orEqPattern) {
      // Build UNION ALL branches — one per filter value.
      // All branches share $1 (tableId) and optionally the anchor param.
      //
      // CRITICAL: each branch gets ORDER BY rowIndex ASC LIMIT (offset+limit).
      // This forces Postgres to use Merge Append instead of Append+Sort.
      // Merge Append consumes pre-sorted streams lazily, stopping once
      // (offset+limit) rows are emitted — avoiding a full table sort.
      const colId = escapeLiteral(orEqPattern.colId);
      const colExpr = `(NULLIF("Row"."cells" ->> '${colId}', ''))`;
      const anchorClause = anchorRowIndexParam
        ? ` AND "Row"."rowIndex" > $${anchorRowIndexParam}`
        : "";

      // Per-branch LIMIT: worst case all rows come from one branch
      params.push(effectiveOffset + input.limit);
      const branchLimitP = params.length;

      const branches: string[] = [];
      for (const val of orEqPattern.values) {
        params.push(val);
        branches.push(
          `(SELECT "Row"."id", "Row"."rowIndex" FROM "Row" WHERE "Row"."tableId" = $1 AND ${colExpr} = $${params.length}${anchorClause} ORDER BY "Row"."rowIndex" ASC LIMIT $${branchLimitP})`,
        );
      }

      dataSql = `
        SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
        FROM (
          SELECT "id" FROM (
            ${branches.join("\n              UNION ALL\n              ")}
          ) u
          ORDER BY u."rowIndex" ASC
          LIMIT $${limitP} OFFSET $${offsetP}
        ) sub
        JOIN "Row" r ON r."id" = sub."id"
        ORDER BY r."rowIndex" ASC
      `;
    } else {
      // Standard deferred-join: the inner subquery selects only "id" to keep the sort
      // buffer compact (no TOAST heap decompression until the final window).
      dataSql = `
        SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
        FROM (
          SELECT "Row"."id"
          FROM "Row"
          ${whereSql}
          ORDER BY ${orderBySql}
          LIMIT $${limitP} OFFSET $${offsetP}
        ) sub
        JOIN "Row" r ON r."id" = sub."id"
        ORDER BY ${orderBySql.replace(/"Row"\./g, 'r.')}
      `;
    }

    let totalCount: number;

    // Use queryNoBitmap for UNION ALL paths to force Index Scan
    // (4-5× faster than Bitmap Heap Scan for large offsets).
    const runDataQuery = orEqPattern
      ? () => queryNoBitmap<RowSelect[]>(ctx.db, dataSql, params)
      : () => queryRawUnsafe<RowSelect[]>(ctx.db, dataSql, params);

    if (input.skipCount && typeof input.knownTotal === "number") {
      totalCount = input.knownTotal;

      const items = await runDataQuery();

      const nextCursor: number | { rowIndex: number; sortValues: (string | number | null)[] } | null =
        items.length > 0 ? buildNextCursor(sorts, items[items.length - 1]!) : null;

      return { items, totalCount, nextCursor };
    }

    const { countSql, countParams } = buildCountSql(input.tableId, search, useTree, filterTree, filters, conjunction);

    const [items, countRes] = await Promise.all([
      runDataQuery(),
      queryRawUnsafe<CountRow[]>(ctx.db, countSql, countParams),
    ]);

    totalCount = countRes[0]?.count ?? 0;

    const nextCursor: number | { rowIndex: number; sortValues: (string | number | null)[] } | null =
      items.length > 0 ? buildNextCursor(sorts, items[items.length - 1]!) : null;

    return { items, totalCount, nextCursor };
  });
