import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import {
  filterSchema,
  sortSchema,
  filterTreeSchema,
} from "~/shared/grid";
import { escapeLikePattern, type SqlParam } from "~/server/sql/escape";
import {
  buildFilterSql,
  buildFilterTreeSql,
  filterTreeHasConditions,
} from "~/server/sql/filterSql";
import {
  buildMultiSortBeforeCursorSql,
  buildMultiSortCursorSql,
  buildMultiSortOrderBy,
  buildMultiSortOrderByReversed,
  normalizeSortValuesFromCells,
  type SortedCursorInput,
} from "~/server/sql/sortSql";
import {
  validateAndResolveFilters,
  validateAndResolveSorts,
} from "./columnResolution";

// searchMatchCount — count total substring occurrences across rows (respects filters).
export const searchMatchCount = protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      search: z.string().min(1),
      filters: z.array(filterSchema).optional(),
      conjunction: z.enum(["and", "or"]).default("and"),
      filterTree: filterTreeSchema.optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true },
    });
    if (!table) return { count: 0 };

    const escaped = escapeLikePattern(input.search);
    const searchLower = input.search.toLowerCase();
    const filters = input.filters ?? [];
    const conjunction = input.conjunction;
    const filterTree = input.filterTree;
    const useTree = filterTree && filterTreeHasConditions(filterTree);

    // Redirect unbackfilled duplicate filter columns to their source.
    await validateAndResolveFilters(ctx.db, filters, filterTree, !!useTree, input.tableId);

    // $1 = searchLower, $2 = tableId, $3 = ILIKE pattern, $4+ = filter params.
    // searchLower MUST be in the params array so that buildFilterSql/buildFilterTreeSql
    // generate correct $N references (they use params.length after each push).
    const params: SqlParam[] = [searchLower, input.tableId, `%${escaped}%`];
    let whereSql = `WHERE "Row"."tableId" = $2 AND "Row"."searchText" ILIKE $3 ESCAPE '\\'`;
    if (useTree) {
      whereSql += buildFilterTreeSql(filterTree, params);
    } else if (filters.length > 0) {
      whereSql += buildFilterSql(filters, params, conjunction);
    }

    const result = await ctx.db.$queryRawUnsafe<[{ count: number }]>(
      `SELECT COALESCE(SUM(
         (LENGTH("searchText") - LENGTH(REPLACE(LOWER("searchText"), $1, '')))
         / NULLIF(LENGTH($1), 0)
       ), 0)::int AS count
       FROM "Row"
       ${whereSql}`,
      ...params,
    );

    return { count: result[0]?.count ?? 0 };
  });

// findEdgeMatch — fast O(log N) first/last match for wrap-around navigation.
//
// Replaces the slow searchMatchAt for wrap-around (prev-from-first,
// next-from-last).  Instead of materializing ALL matches with window
// functions, this uses a simple LIMIT 1 query with the appropriate
// ORDER BY to find the edge match directly.
//
// Position computation strategy (avoids O(N) ROW_NUMBER):
//   - Unsorted: COUNT(rowIndex < target) — bounded B-tree scan
//   - Sorted + ViewRowRank fresh: rank lookup — O(1)
//   - Sorted + "first" edge: COUNT(before target) — O(position), small
//   - Sorted + "last" edge:  totalCount - 1 - COUNT(after target) — O(small)
export const findEdgeMatch = protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      search: z.string().min(1),
      edge: z.enum(["first", "last"]),
      filters: z.array(filterSchema).optional(),
      conjunction: z.enum(["and", "or"]).default("and"),
      filterTree: filterTreeSchema.optional(),
      sorts: z.array(sortSchema).optional(),
      viewId: z.string().optional(),
      /** Client-side hint for totalCount (avoids a re-count for "last" edge). */
      totalCount: z.number().int().optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true, rowCount: true },
    });
    if (!table) return { rowId: null, absolutePosition: null };

    const sorts = await validateAndResolveSorts(
      ctx.db, input.sorts ?? [], input.tableId, true,
    );

    const escaped = escapeLikePattern(input.search);
    const filters = input.filters ?? [];
    const conjunction = input.conjunction;
    const filterTree = input.filterTree;
    const useTree = filterTree && filterTreeHasConditions(filterTree);

    // Redirect unbackfilled duplicate filter columns to their source.
    await validateAndResolveFilters(ctx.db, filters, filterTree, !!useTree, input.tableId);

    const q1Params: SqlParam[] = [input.tableId, `%${escaped}%`];
    let q1Where = `WHERE "Row"."tableId" = $1 AND "Row"."searchText" ILIKE $2 ESCAPE '\\'`;
    if (useTree) {
      q1Where += buildFilterTreeSql(filterTree, q1Params);
    } else if (filters.length > 0) {
      q1Where += buildFilterSql(filters, q1Params, conjunction);
    }

    const orderBy = sorts.length > 0
      ? (input.edge === "first" ? buildMultiSortOrderBy(sorts) : buildMultiSortOrderByReversed(sorts))
      : (input.edge === "first" ? `"Row"."rowIndex" ASC` : `"Row"."rowIndex" DESC`);

    // Include cells when sorted (needed to extract sort values for cursor)
    const q1SelectCells = sorts.length > 0 ? ', "Row"."cells"' : '';

    const hitResult = await ctx.db.$queryRawUnsafe<
      [{ id: string; rowIndex: number; cells?: unknown } | undefined]
    >(
      `SELECT "Row"."id", "Row"."rowIndex"${q1SelectCells}
       FROM "Row"
       ${q1Where}
       ORDER BY ${orderBy}
       LIMIT 1`,
      ...q1Params,
    );

    const hit = hitResult[0];
    if (!hit) return { rowId: null, absolutePosition: null };

    let absolutePosition = 0;

    if (sorts.length === 0) {
      // Unsorted: position = COUNT(rowIndex < target) — fast B-tree scan.
      // For "last" edge, use totalCount - 1 - COUNT(rowIndex > target)
      // so the COUNT is small (few rows after the last match).
      if (input.edge === "first") {
        const q2Params: SqlParam[] = [input.tableId, Number(hit.rowIndex)];
        let q2Where = `WHERE "Row"."tableId" = $1 AND "Row"."rowIndex" < $2`;
        if (useTree) {
          q2Where += buildFilterTreeSql(filterTree, q2Params);
        } else if (filters.length > 0) {
          q2Where += buildFilterSql(filters, q2Params, conjunction);
        }
        const posResult = await ctx.db.$queryRawUnsafe<[{ pos: number }]>(
          `SELECT COUNT(*)::int AS pos FROM "Row" ${q2Where}`,
          ...q2Params,
        );
        absolutePosition = posResult[0]?.pos ?? 0;
      } else {
        const q2Params: SqlParam[] = [input.tableId, Number(hit.rowIndex)];
        let q2Where = `WHERE "Row"."tableId" = $1 AND "Row"."rowIndex" > $2`;
        if (useTree) {
          q2Where += buildFilterTreeSql(filterTree, q2Params);
        } else if (filters.length > 0) {
          q2Where += buildFilterSql(filters, q2Params, conjunction);
        }
        const countAfterResult = await ctx.db.$queryRawUnsafe<[{ pos: number }]>(
          `SELECT COUNT(*)::int AS pos FROM "Row" ${q2Where}`,
          ...q2Params,
        );
        const countAfter = countAfterResult[0]?.pos ?? 0;

        let total = input.totalCount;
        if (total == null) {
          if (!useTree && filters.length === 0) {
            total = table.rowCount;
          } else {
            const cntParams: SqlParam[] = [input.tableId];
            let cntWhere = `WHERE "Row"."tableId" = $1`;
            if (useTree) {
              cntWhere += buildFilterTreeSql(filterTree, cntParams);
            } else if (filters.length > 0) {
              cntWhere += buildFilterSql(filters, cntParams, conjunction);
            }
            const cntResult = await ctx.db.$queryRawUnsafe<[{ count: number }]>(
              `SELECT COUNT(*)::int AS count FROM "Row" ${cntWhere}`,
              ...cntParams,
            );
            total = cntResult[0]?.count ?? 0;
          }
        }
        absolutePosition = Math.max(0, total - 1 - countAfter);
      }
    } else {
      let usedViewRowRank = false;

      // Try ViewRowRank (only sort-only, no filters/search — search
      // doesn't affect rank because it doesn't filter the view).
      if (input.viewId && !useTree && filters.length === 0) {
        const view = await ctx.db.view.findFirst({
          where: { id: input.viewId, ranksStale: false },
          select: { id: true },
        });
        if (view) {
          const rankResult = await ctx.db.$queryRawUnsafe<[{ rank: number } | undefined]>(
            `SELECT "rank" FROM "ViewRowRank" WHERE "viewId" = $1 AND "rowId" = $2::uuid`,
            input.viewId, hit.id,
          );
          if (rankResult[0]) {
            absolutePosition = rankResult[0].rank - 1; // rank is 1-based
            usedViewRowRank = true;
          }
        }
      }

      if (!usedViewRowRank) {
        // COUNT with keyset predicate — much faster than ROW_NUMBER.
        // "first" edge: COUNT(before) ≈ small (target is early in sort)
        // "last" edge:  COUNT(after) ≈ small (target is late in sort)
        const hitCursor: SortedCursorInput = {
          rowIndex: Number(hit.rowIndex),
          sortValues: normalizeSortValuesFromCells(sorts, hit.cells),
        };

        if (input.edge === "first") {
          const q2Params: SqlParam[] = [input.tableId];
          let q2Where = `WHERE "Row"."tableId" = $1`;
          if (useTree) {
            q2Where += buildFilterTreeSql(filterTree, q2Params);
          } else if (filters.length > 0) {
            q2Where += buildFilterSql(filters, q2Params, conjunction);
          }
          q2Where += buildMultiSortBeforeCursorSql(sorts, hitCursor, q2Params);

          const posResult = await ctx.db.$queryRawUnsafe<[{ pos: number }]>(
            `SELECT COUNT(*)::int AS pos FROM "Row" ${q2Where}`,
            ...q2Params,
          );
          absolutePosition = posResult[0]?.pos ?? 0;
        } else {
          const q2Params: SqlParam[] = [input.tableId];
          let q2Where = `WHERE "Row"."tableId" = $1`;
          if (useTree) {
            q2Where += buildFilterTreeSql(filterTree, q2Params);
          } else if (filters.length > 0) {
            q2Where += buildFilterSql(filters, q2Params, conjunction);
          }
          q2Where += buildMultiSortCursorSql(sorts, hitCursor, q2Params);

          const countAfterResult = await ctx.db.$queryRawUnsafe<[{ pos: number }]>(
            `SELECT COUNT(*)::int AS pos FROM "Row" ${q2Where}`,
            ...q2Params,
          );
          const countAfter = countAfterResult[0]?.pos ?? 0;

          let total = input.totalCount;
          if (total == null) {
            if (!useTree && filters.length === 0) {
              total = table.rowCount;
            } else {
              const cntParams: SqlParam[] = [input.tableId];
              let cntWhere = `WHERE "Row"."tableId" = $1`;
              if (useTree) {
                cntWhere += buildFilterTreeSql(filterTree, cntParams);
              } else if (filters.length > 0) {
                cntWhere += buildFilterSql(filters, cntParams, conjunction);
              }
              const cntResult = await ctx.db.$queryRawUnsafe<[{ count: number }]>(
                `SELECT COUNT(*)::int AS count FROM "Row" ${cntWhere}`,
                ...cntParams,
              );
              total = cntResult[0]?.count ?? 0;
            }
          }
          absolutePosition = Math.max(0, total - 1 - countAfter);
        }
      }
    }

    return { rowId: hit.id, absolutePosition };
  });
