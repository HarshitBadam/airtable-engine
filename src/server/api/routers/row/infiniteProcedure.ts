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

export const infinite = protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      limit: z.number().min(1).max(2000).default(1000),

      // cursor:
      // - unsorted / unranked tail: number (rowIndex)
      // - sorted (live ORDER BY): { rowIndex, sortValues }
      // - ViewRowRank ranked phase: { rank: number }
      cursor: z.union([
        z.number(),
        sortedCursorSchema,
        z.object({ rank: z.number() }),
      ]).nullable().default(null),

      search: z.string().max(200).optional(),
      filters: z.array(filterSchema).optional(),
      conjunction: z.enum(["and", "or"]).default("and"),
      /** Tree-structured filters (condition groups). Takes precedence over flat filters. */
      filterTree: filterTreeSchema.optional(),
      sorts: z.array(sortSchema).optional(),
      /** View ID — when provided, backend checks for fresh ViewRowRank and uses
       *  rank-based ordering instead of live ORDER BY. */
      viewId: z.string().optional(),
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

    if (!hasQuery) {
      const cursor = input.cursor;
      const cursorRowIndex = typeof cursor === "number" ? cursor : 0;
      const take = input.limit + 1;

      const dataParams: SqlParam[] = [input.tableId, cursorRowIndex, take];
      const dataSql = `
        SELECT "Row"."id", "Row"."rowIndex", "Row"."cells", "Row"."createdAt", "Row"."updatedAt"
        FROM "Row"
        WHERE "Row"."tableId" = $1 AND "Row"."rowIndex" > $2
        ORDER BY "Row"."rowIndex" ASC
        LIMIT $3
      `;

      const [table, rows] = await Promise.all([
        ctx.db.table.findFirst({
          where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
          select: { id: true, rowCount: true },
        }),
        queryRawUnsafe<RowSelect[]>(ctx.db, dataSql, dataParams),
      ]);
      if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

      const hasNextPage = rows.length > input.limit;
      const items = hasNextPage ? rows.slice(0, input.limit) : rows;

      let nextCursor: number | { rowIndex: number; sortValues: (string | number | null)[] } | null = null;
      if (hasNextPage && items.length > 0) {
        nextCursor = items[items.length - 1]!.rowIndex;
      }

      return { items, nextCursor, totalCount: table.rowCount };
    }

    const table = await ctx.db.table.findFirst({
      where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
      select: { id: true, rowCount: true },
    });
    if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

    sorts = await validateSortsAndFilters(ctx.db, sorts, filters, filterTree, !!useTree, input.tableId);

    const take = input.limit + 1;
    const isSorted = sorts.length > 0;
    const hasFiltersOrSearch = filters.length > 0 || Boolean(useTree) || Boolean(search && search.length > 0);

    // VIEWROWRANK PATH: used when viewId is provided, ranks are fresh, no filters/search.
    //
    // Why not for sort+filter?  ViewRowRank only stores (viewId, rank, rowId).
    // Evaluating filter conditions requires joining to Row for every ranked entry,
    // which is expensive at scale.  For jumping (large OFFSET), Tier 2 is WORSE:
    // it must scan offset/selectivity entries, while Tier 3 only sorts the
    // filtered subset.
    if (input.viewId && isSorted && !hasFiltersOrSearch) {
      const view = await ctx.db.view.findFirst({
        where: {
          id: input.viewId,
          tableId: input.tableId,
          table: { base: { ownerId: ctx.session.user.id } },
        },
        select: { ranksStale: true },
      });

      if (view && !view.ranksStale) {
        // O(log N): backwards index scan on PK (viewId, rank) — instant
        // regardless of table size, vs COUNT(*) which is O(N).
        const [maxRankRow] = await queryRawUnsafe<{ maxRank: number | null }[]>(
          ctx.db,
          `SELECT MAX("rank") AS "maxRank" FROM "ViewRowRank" WHERE "viewId" = $1`,
          [input.viewId],
        );
        const rankCount = maxRankRow?.maxRank ?? 0;

        if (rankCount > 0) {
          // Unranked count via simple arithmetic — avoids the expensive
          // LEFT JOIN anti-join COUNT that was taking 300-500ms per call.
          const unrankedCount = Math.max(0, table.rowCount - rankCount);
          const totalCount = table.rowCount;

          const cursor = input.cursor;
          const isRankCursor = cursor && typeof cursor === "object" && "rank" in cursor;
          const isUnrankedTail = typeof cursor === "number";
          const isSortedCursor = cursor && typeof cursor === "object" && "sortValues" in cursor;

          if (!isSortedCursor) {
            if (isUnrankedTail) {
              // Phase 2: Unranked tail (new rows after sort, natural order).
              const tailCursor = cursor;
              const tp: SqlParam[] = [input.viewId, input.tableId, tailCursor, take];
              const tailSql = `
                SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
                FROM "Row" r
                LEFT JOIN "ViewRowRank" vrr ON vrr."rowId" = r."id" AND vrr."viewId" = $1
                WHERE r."tableId" = $2 AND vrr."rank" IS NULL AND r."rowIndex" > $3
                ORDER BY r."rowIndex" ASC
                LIMIT $4
              `;
              const rows = await queryRawUnsafe<RowSelect[]>(ctx.db, tailSql, tp);
              const hasNext = rows.length > input.limit;
              const items = hasNext ? rows.slice(0, input.limit) : rows;
              let nextCursor: number | { rank: number } | { rowIndex: number; sortValues: (string | number | null)[] } | null = null;
              if (hasNext && items.length > 0) {
                nextCursor = items[items.length - 1]!.rowIndex;
              }

              return { items, nextCursor, totalCount };
            }

            // Phase 1: Ranked rows (frozen sort order).
            const cursorRank = isRankCursor ? (cursor as { rank: number }).rank : 0;
            const rp: SqlParam[] = [input.viewId, cursorRank, take];
            const rankedSql = `
              SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
              FROM "ViewRowRank" vrr
              JOIN "Row" r ON r."id" = vrr."rowId"
              WHERE vrr."viewId" = $1 AND vrr."rank" > $2
              ORDER BY vrr."rank" ASC
              LIMIT $3
            `;
            const rankedRows = await queryRawUnsafe<RowSelect[]>(ctx.db, rankedSql, rp);

            let items: RowSelect[] = rankedRows;
            let hasNext = rankedRows.length > input.limit;
            if (hasNext) items = rankedRows.slice(0, input.limit);

            if (!hasNext && unrankedCount > 0) {
              const remaining = take - rankedRows.length;
              if (remaining > 0) {
                const tp: SqlParam[] = [input.viewId, input.tableId, 0, remaining];
                const tailSql = `
                  SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
                  FROM "Row" r
                  LEFT JOIN "ViewRowRank" vrr ON vrr."rowId" = r."id" AND vrr."viewId" = $1
                  WHERE r."tableId" = $2 AND vrr."rank" IS NULL AND r."rowIndex" > $3
                  ORDER BY r."rowIndex" ASC
                  LIMIT $4
                `;
                const tailRows = await queryRawUnsafe<RowSelect[]>(ctx.db, tailSql, tp);
                const combined = [...rankedRows, ...tailRows];
                hasNext = combined.length > input.limit;
                items = hasNext ? combined.slice(0, input.limit) : combined;
              }
            }

            type InfiniteCursor = number | { rank: number } | { rowIndex: number; sortValues: (string | number | null)[] } | null;
            let nextCursor: InfiniteCursor = null;
            if (hasNext && items.length > 0) {
              const last = items[items.length - 1]!;
              if (items.length <= rankedRows.length) {
                const lastRankRes = await queryRawUnsafe<{ rank: number }[]>(ctx.db,
                  `SELECT "rank" FROM "ViewRowRank" WHERE "viewId" = $1 AND "rowId" = $2::uuid`,
                  [input.viewId, last.id],
                );
                if (lastRankRes.length > 0) {
                  nextCursor = { rank: lastRankRes[0]!.rank };
                } else {
                  nextCursor = last.rowIndex; // shouldn't happen, but fallback
                }
              } else {
                nextCursor = last.rowIndex;
              }
            } else if (!hasNext && items.length > 0 && items.length === rankedRows.length && unrankedCount > 0) {
              // Ranked group ended exactly at page boundary, but unranked rows exist
              // Set a number cursor (0) to start fetching unranked rows
              nextCursor = 0;
            }

            return { items, nextCursor, totalCount };
          }
          // isSortedCursor === true → fall through to standard sorted path
        }
      }
    }

    const cursor = input.cursor;

    const cursorRowIndex =
      !isSorted
        ? typeof cursor === "number"
          ? cursor
          : 0
        : typeof cursor === "object" && cursor && "rowIndex" in cursor
          ? cursor.rowIndex
          : 0;

    const sortedCursor =
      isSorted && typeof cursor === "object" && cursor && "sortValues" in cursor
        ? cursor
        : null;

    const params: SqlParam[] = [];
    let whereSql = buildBaseWhere(input.tableId, search, useTree, filterTree, filters, conjunction, params);

    let cursorRowIndexParam: number | null = null; // track $N for UNION ALL
    if (sorts.length === 0) {
      params.push(cursorRowIndex);
      cursorRowIndexParam = params.length;
      whereSql += ` AND "Row"."rowIndex" > $${params.length}`;
    } else if (sortedCursor) {
      whereSql += buildMultiSortCursorSql(sorts, sortedCursor, params);
    }

    const orderBySql = buildMultiSortOrderBy(sorts);

    params.push(take);
    const limitP = params.length;

    // UNION ALL optimisation for OR-of-equals filters (infinite scroll):
    // same optimisation as windowFetch — split OR conditions into per-value
    // branches so Postgres uses Merge Append instead of BitmapOr + re-sort.
    const orEqInfinite =
      !search && sorts.length === 0
        ? detectOrEqualsPattern(filterTree, filters, conjunction, Boolean(useTree))
        : null;

    let sql: string;
    if (orEqInfinite && cursorRowIndexParam !== null) {
      const colId = escapeLiteral(orEqInfinite.colId);
      const colExpr = `(NULLIF("Row"."cells" ->> '${colId}', ''))`;
      const branches: string[] = [];
      for (const val of orEqInfinite.values) {
        params.push(val);
        branches.push(
          `(SELECT "Row"."id", "Row"."rowIndex", "Row"."cells", "Row"."createdAt", "Row"."updatedAt" FROM "Row" WHERE "Row"."tableId" = $1 AND ${colExpr} = $${params.length} AND "Row"."rowIndex" > $${cursorRowIndexParam} ORDER BY "Row"."rowIndex" ASC LIMIT $${limitP})`,
        );
      }
      sql = `
        SELECT * FROM (
          ${branches.join("\n            UNION ALL\n            ")}
        ) u
        ORDER BY u."rowIndex" ASC
        LIMIT $${limitP}
      `;
    } else if (isSorted) {
      // DEFERRED JOIN for sorted infinite scroll:
      // the inner query selects only "id" so Postgres can use an Index-Only
      // Scan on the covering sort index (INCLUDE "id").  Without this, the
      // keyset cursor predicate causes Postgres to scan from the start of
      // the index and do a heap fetch for EVERY entry (including those
      // eliminated by the filter).
      //
      // With the covering index, the inner scan reads compact index pages
      // sequentially with no heap access.  The outer join fetches full row
      // data only for the ~1000 result rows.
      sql = `
        SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
        FROM (
          SELECT "Row"."id"
          FROM "Row"
          ${whereSql}
          ORDER BY ${orderBySql}
          LIMIT $${limitP}
        ) sub
        JOIN "Row" r ON r."id" = sub."id"
        ORDER BY ${orderBySql.replace(/"Row"\./g, 'r.')}
      `;
    } else {
      sql = `
        SELECT "Row"."id", "Row"."rowIndex", "Row"."cells", "Row"."createdAt", "Row"."updatedAt"
        FROM "Row"
        ${whereSql}
        ORDER BY ${orderBySql}
        LIMIT $${limitP}
      `;
    }

    const isFirstPage = input.cursor === null;
    const hasFiltersForCount = Boolean(useTree) || filters.length > 0;
    const needsCount = isFirstPage && (Boolean(search && search.length > 0) || hasFiltersForCount);

    let countPromise: Promise<CountRow[]> | null = null;
    if (needsCount) {
      const { countSql, countParams } = buildCountSql(input.tableId, search, useTree, filterTree, filters, conjunction);
      countPromise = queryRawUnsafe<CountRow[]>(ctx.db, countSql, countParams);
    }

    const runInfiniteQuery = orEqInfinite
      ? () => queryNoBitmap<RowSelect[]>(ctx.db, sql, params)
      : () => queryRawUnsafe<RowSelect[]>(ctx.db, sql, params);

    const [rows, countResult] = await Promise.all([
      runInfiniteQuery(),
      countPromise,
    ]);

    const hasNextPage = rows.length > input.limit;
    const items = hasNextPage ? rows.slice(0, input.limit) : rows;

    let nextCursor:
      | number
      | { rank: number }
      | { rowIndex: number; sortValues: (string | number | null)[] }
      | null = null;

    if (hasNextPage && items.length > 0) {
      nextCursor = buildNextCursor(sorts, items[items.length - 1]!);
    }

    const totalCount = countResult
      ? (countResult[0]?.count ?? 0)
      : table.rowCount;

    return { items, nextCursor, totalCount };
  });
