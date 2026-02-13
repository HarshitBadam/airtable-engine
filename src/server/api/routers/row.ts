// src/server/api/routers/row.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  filterTreeSchema,
  type FilterTreeItem,
  type FilterTreeCondition,
  type FilterTree,
} from "~/shared/grid";

/**
 * Params we pass into $queryRawUnsafe.
 * Keep this narrow; Prisma accepts many types, but we only need these.
 */
type SqlParam = string | number | boolean | null | Date;

const filterSchema = z.discriminatedUnion("op", [
  z.object({ columnId: z.string(), op: z.literal("is_empty") }),
  z.object({ columnId: z.string(), op: z.literal("is_not_empty") }),
  z.object({ columnId: z.string(), op: z.literal("contains"), value: z.string() }),
  z.object({ columnId: z.string(), op: z.literal("not_contains"), value: z.string() }),
  z.object({ columnId: z.string(), op: z.literal("equals"), value: z.string() }),
  z.object({ columnId: z.string(), op: z.literal("not_equals"), value: z.string() }),
  z.object({ columnId: z.string(), op: z.literal("gt"), value: z.number() }),
  z.object({ columnId: z.string(), op: z.literal("lt"), value: z.number() }),
  z.object({ columnId: z.string(), op: z.literal("gte"), value: z.number() }),
  z.object({ columnId: z.string(), op: z.literal("lte"), value: z.number() }),
]);

type FilterInput = z.infer<typeof filterSchema>;

const sortSchema = z.object({
  columnId: z.string(),
  direction: z.enum(["asc", "desc"]),
  type: z.enum(["TEXT", "NUMBER"]),
});
type SortInput = z.infer<typeof sortSchema>;

/**
 * Multi-sort cursor: rowIndex + one sort value per sort field.
 */
const sortedCursorSchema = z.object({
  rowIndex: z.number(),
  sortValues: z.array(z.union([z.string(), z.number(), z.null()])),
});
type SortedCursorInput = z.infer<typeof sortedCursorSchema>;

type RowSelect = {
  id: string;
  rowIndex: number;
  cells: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type CountRow = { count: number };

/**
 * Sorting helpers
 * We only inject columnId as a literal after validating it belongs to this table.
 * We reuse the same escape function for filter literal injection too.
 */
function escapeLiteral(input: string): string {
  return input.replace(/'/g, "''");
}

/**
 * Escape special LIKE/ILIKE pattern characters so user input
 * is treated as a literal substring, not a wildcard.
 * Must be used with `ESCAPE '\'` in the SQL.
 */
function escapeLikePattern(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * PERF UPGRADE:
 * Build filter SQL using literal JSONB keys (cells->>'<colId>') so Postgres can use
 * expression indexes created by column.ensureIndexes.
 *
 * IMPORTANT: caller must validate all columnIds belong to this table before calling.
 * Values remain parameterized.
 */
function buildFilterSql(filters: FilterInput[], params: SqlParam[], conjunction: "and" | "or" = "and"): string {
  const clauses: string[] = [];

  for (const f of filters) {
    const colId = escapeLiteral(f.columnId);
    const colExpr = `("Row"."cells" ->> '${colId}')`;

    switch (f.op) {
      case "is_empty": {
        clauses.push(`(${colExpr} IS NULL OR ${colExpr} = '')`);
        break;
      }
      case "is_not_empty": {
        clauses.push(`(${colExpr} IS NOT NULL AND ${colExpr} <> '')`);
        break;
      }
      case "contains": {
        const escaped = escapeLikePattern(f.value);
        params.push(`%${escaped}%`);
        clauses.push(`(${colExpr} ILIKE $${params.length} ESCAPE '\\')`);
        break;
      }
      case "not_contains": {
        const escaped = escapeLikePattern(f.value);
        params.push(`%${escaped}%`);
        clauses.push(
          `(${colExpr} IS NULL OR ${colExpr} NOT ILIKE $${params.length} ESCAPE '\\')`,
        );
        break;
      }
      case "equals": {
        params.push(f.value);
        clauses.push(`(${colExpr} = $${params.length})`);
        break;
      }
      case "not_equals": {
        params.push(f.value);
        clauses.push(`(${colExpr} IS NULL OR ${colExpr} <> $${params.length})`);
        break;
      }
      case "gt":
      case "lt":
      case "gte":
      case "lte": {
        params.push(f.value);
        const opMap = { gt: ">", lt: "<", gte: ">=", lte: "<=" } as const;
        clauses.push(`(NULLIF(${colExpr}, '')::double precision ${opMap[f.op]} $${params.length})`);
        break;
      }
      default: {
        // exhaustive
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _exhaustive: never = f;
        break;
      }
    }
  }

  const joiner = conjunction === "or" ? " OR " : " AND ";
  return clauses.length ? ` AND (${clauses.join(joiner)})` : "";
}

/* ============================================================
   Filter tree SQL builder (nested condition groups)
   ============================================================ */

/**
 * Build a SQL clause for a single condition node.
 * Returns the clause string and may push params.
 */
function buildConditionClause(
  cond: FilterTreeCondition,
  params: SqlParam[],
): string | null {
  const colId = escapeLiteral(cond.columnId);
  const colExpr = `("Row"."cells" ->> '${colId}')`;
  const op = cond.op;

  switch (op) {
    case "is_empty":
      return `(${colExpr} IS NULL OR ${colExpr} = '')`;
    case "is_not_empty":
      return `(${colExpr} IS NOT NULL AND ${colExpr} <> '')`;
    case "contains": {
      if (typeof cond.value !== "string" || cond.value === "") return null;
      const escaped = escapeLikePattern(cond.value);
      params.push(`%${escaped}%`);
      return `(${colExpr} ILIKE $${params.length} ESCAPE '\\')`;
    }
    case "not_contains": {
      if (typeof cond.value !== "string" || cond.value === "") return null;
      const escaped = escapeLikePattern(cond.value);
      params.push(`%${escaped}%`);
      return `(${colExpr} IS NULL OR ${colExpr} NOT ILIKE $${params.length} ESCAPE '\\')`;
    }
    case "equals": {
      if (typeof cond.value === "string") {
        if (cond.value === "") return null;
        params.push(cond.value);
        return `(${colExpr} = $${params.length})`;
      }
      if (typeof cond.value === "number") {
        params.push(cond.value);
        return `(${colExpr} = $${params.length})`;
      }
      return null;
    }
    case "not_equals": {
      if (typeof cond.value === "string") {
        if (cond.value === "") return null;
        params.push(cond.value);
        return `(${colExpr} IS NULL OR ${colExpr} <> $${params.length})`;
      }
      if (typeof cond.value === "number") {
        params.push(cond.value);
        return `(${colExpr} IS NULL OR ${colExpr} <> $${params.length})`;
      }
      return null;
    }
    case "gt":
    case "lt":
    case "gte":
    case "lte": {
      if (typeof cond.value !== "number") return null;
      params.push(cond.value);
      const opMap = { gt: ">", lt: "<", gte: ">=", lte: "<=" } as const;
      return `(NULLIF(${colExpr}, '')::double precision ${opMap[op]} $${params.length})`;
    }
    default:
      return null;
  }
}

/**
 * Recursively build SQL for a filter tree item.
 * Returns a SQL fragment (without leading AND) or null if the item produces no clauses.
 */
function buildFilterTreeItemSql(
  item: FilterTreeItem,
  params: SqlParam[],
): string | null {
  if (item.kind === "condition") {
    return buildConditionClause(item, params);
  }

  // Group node
  const group = item;
  const clauses: string[] = [];

  for (const child of group.items) {
    const clause = buildFilterTreeItemSql(child, params);
    if (clause) clauses.push(clause);
  }

  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0]!;

  const joiner = group.conjunction === "or" ? " OR " : " AND ";
  return `(${clauses.join(joiner)})`;
}

/**
 * Build SQL WHERE fragment for a complete filter tree.
 * Returns a string like ` AND (...)` or empty string if no effective filters.
 */
function buildFilterTreeSql(tree: FilterTree, params: SqlParam[]): string {
  const clauses: string[] = [];

  for (const item of tree.items) {
    const clause = buildFilterTreeItemSql(item, params);
    if (clause) clauses.push(clause);
  }

  if (clauses.length === 0) return "";
  if (clauses.length === 1) return ` AND ${clauses[0]}`;

  const joiner = tree.conjunction === "or" ? " OR " : " AND ";
  return ` AND (${clauses.join(joiner)})`;
}

/**
 * Extract all columnIds from a filter tree (for validation).
 */
function extractColumnIds(tree: FilterTree): string[] {
  const ids = new Set<string>();
  const walk = (items: FilterTreeItem[]) => {
    for (const item of items) {
      if (item.kind === "condition") {
        ids.add(item.columnId);
      } else {
        walk(item.items);
      }
    }
  };
  walk(tree.items);
  return [...ids];
}

/**
 * Check if a filter tree has any effective conditions (non-empty groups with conditions).
 */
function filterTreeHasConditions(tree: FilterTree): boolean {
  const check = (items: FilterTreeItem[]): boolean => {
    for (const item of items) {
      if (item.kind === "condition") return true;
      if (check(item.items)) return true;
    }
    return false;
  };
  return check(tree.items);
}

/**
 * Small wrapper to keep call sites clean.
 * Prisma's $queryRawUnsafe returns a PrismaPromise, which is awaitable.
 */
async function queryRawUnsafe<T>(
  db: {
    $queryRawUnsafe: <R = unknown>(query: string, ...values: unknown[]) => PromiseLike<R>;
  },
  sql: string,
  params: SqlParam[],
): Promise<T> {
  return (await db.$queryRawUnsafe<T>(sql, ...params)) as T;
}

// ---------------------------------------------------------------------------
// Sort expression helpers
// ---------------------------------------------------------------------------

/**
 * Get the SQL expression for a sort column.
 * TEXT and NUMBER both use NULLIF to treat empty strings as NULL.
 *   TEXT:   NULLIF(cells->>'colId', '')
 *   NUMBER: NULLIF(cells->>'colId', '')::double precision
 */
function getSortExpr(sort: SortInput): string {
  const colId = escapeLiteral(sort.columnId);

  if (sort.type === "TEXT") {
    return `(NULLIF("Row"."cells" ->> '${colId}', ''))`;
  }
  // NUMBER
  return `(NULLIF("Row"."cells" ->> '${colId}', '')::double precision)`;
}

// ---------------------------------------------------------------------------
// Multi-sort ORDER BY builder
// ---------------------------------------------------------------------------

/**
 * Build the ORDER BY clause for multiple sorts.
 * Always uses NULLS LAST (for both ASC and DESC) with a stable rowIndex tiebreaker.
 *
 * For NULLS LAST with any direction, the null-rank is always `ASC`:
 *   (expr IS NULL) ASC   →   false(0) before true(1)   →   non-null first
 */
function buildMultiSortOrderBy(sorts: SortInput[]): string {
  if (sorts.length === 0) return `"Row"."rowIndex" ASC`;

  const parts: string[] = [];

  for (const sort of sorts) {
    const sortExpr = getSortExpr(sort);
    // NULLS LAST for all directions: null-rank is always ASC
    parts.push(`(${sortExpr} IS NULL) ASC`);
    parts.push(`${sortExpr} ${sort.direction.toUpperCase()}`);
  }

  // Stable tie-breaker
  parts.push(`"Row"."rowIndex" ASC`);

  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// Multi-sort keyset cursor predicate builder
// ---------------------------------------------------------------------------

/**
 * Build a lexicographic keyset cursor predicate for multi-sort pagination.
 *
 * The predicate is an OR of AND clauses:
 *   (after_by_field_0)
 *   OR (eq_0 AND after_by_field_1)
 *   OR (eq_0 AND eq_1 AND after_by_field_2)
 *   ...
 *   OR (eq_0 AND eq_1 AND ... AND eq_N-1 AND rowIndex > cursor.rowIndex)
 *
 * Where:
 *   eq_i      = expr_i IS NOT DISTINCT FROM cursor_i
 *   after_i   = depends on direction + NULLS LAST semantics:
 *     - if cursor_i is null: FALSE (nothing after null w/ NULLS LAST) → skip branch
 *     - if cursor_i is non-null:
 *         ASC:  (expr_i IS NULL) OR (expr_i > cursor_i)
 *         DESC: (expr_i IS NULL) OR (expr_i < cursor_i)
 */
function buildMultiSortCursorSql(
  sorts: SortInput[],
  cursor: SortedCursorInput,
  params: SqlParam[],
): string {
  const orClauses: string[] = [];

  for (let level = 0; level <= sorts.length; level++) {
    const andParts: string[] = [];

    // Equality on all prior dimensions (0..level-1)
    for (let j = 0; j < level && j < sorts.length; j++) {
      const sort = sorts[j]!;
      const sortExpr = getSortExpr(sort);
      const cursorVal = cursor.sortValues[j] ?? null;

      if (cursorVal === null) {
        andParts.push(`(${sortExpr} IS NULL)`);
      } else {
        params.push(cursorVal);
        andParts.push(`(${sortExpr} IS NOT DISTINCT FROM $${params.length})`);
      }
    }

    if (level < sorts.length) {
      // "After" on dimension `level`
      const sort = sorts[level]!;
      const sortExpr = getSortExpr(sort);
      const cursorVal = cursor.sortValues[level] ?? null;

      if (cursorVal === null) {
        // Nothing is after null with NULLS LAST → skip this OR branch
        continue;
      }

      // cursorVal is non-null
      const comp = sort.direction === "asc" ? ">" : "<";
      params.push(cursorVal);
      const pVal = params.length;

      // (expr IS NULL) → value is after cursor (null comes after non-null in NULLS LAST)
      // OR (expr <comp> cursorVal)
      andParts.push(`((${sortExpr} IS NULL) OR (${sortExpr} ${comp} $${pVal}))`);
    } else {
      // Final tie-break: all sort keys equal AND rowIndex > cursor.rowIndex
      params.push(cursor.rowIndex);
      andParts.push(`("Row"."rowIndex" > $${params.length})`);
    }

    if (andParts.length > 0) {
      orClauses.push(`(${andParts.join(" AND ")})`);
    }
  }

  if (orClauses.length === 0) {
    // Edge case: all cursor sort values are null, only tie-break matters
    params.push(cursor.rowIndex);
    return ` AND "Row"."rowIndex" > $${params.length}`;
  }

  return ` AND (\n      ${orClauses.join("\n      OR ")}\n    )`;
}

// ---------------------------------------------------------------------------
// Sort value normalization (for building nextCursor from last row)
// ---------------------------------------------------------------------------

function normalizeSortValueFromCells(
  sort: SortInput,
  cellsUnknown: unknown,
): string | number | null {
  const cells = (cellsUnknown ?? {}) as Record<string, unknown>;
  const raw = cells[sort.columnId];

  if (raw == null) return null;

  if (sort.type === "NUMBER") {
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isNaN(n) ? null : n;
  }

  // TEXT: treat empty string as null (matches NULLIF in SQL)
  if (typeof raw === "string") return raw === "" ? null : raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  try {
    return JSON.stringify(raw);
  } catch {
    return null;
  }
}

function normalizeSortValuesFromCells(
  sorts: SortInput[],
  cellsUnknown: unknown,
): (string | number | null)[] {
  return sorts.map((sort) => normalizeSortValueFromCells(sort, cellsUnknown));
}

// ---------------------------------------------------------------------------
// ORDER BY builder for raw SQL (used by applyPermanentSort)
// Uses table alias "r" instead of "Row" for subqueries.
// ---------------------------------------------------------------------------

function buildSortOrderByForAlias(sorts: SortInput[], alias: string): string {
  const parts: string[] = [];

  for (const sort of sorts) {
    const colId = escapeLiteral(sort.columnId);
    const expr =
      sort.type === "TEXT"
        ? `(NULLIF(${alias}."cells" ->> '${colId}', ''))`
        : `(NULLIF(${alias}."cells" ->> '${colId}', '')::double precision)`;

    parts.push(`(${expr} IS NULL) ASC`);
    parts.push(`${expr} ${sort.direction.toUpperCase()}`);
  }

  parts.push(`${alias}."rowIndex" ASC`);
  return parts.join(", ");
}

// ===========================================================================
// Router
// ===========================================================================

export const rowRouter = createTRPCRouter({
  infinite: protectedProcedure
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
      const sorts = input.sorts ?? [];
      const hasQuery = sorts.length > 0 || filters.length > 0 || Boolean(search && search.length > 0) || Boolean(useTree);

      // ── FAST PATH: no sorts/filters/search → parallelize auth + data ──
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
        if (!table) throw new Error("Table not found");

        const hasNextPage = rows.length > input.limit;
        const items = hasNextPage ? rows.slice(0, input.limit) : rows;

        let nextCursor: number | { rowIndex: number; sortValues: (string | number | null)[] } | null = null;
        if (hasNextPage && items.length > 0) {
          nextCursor = items[items.length - 1]!.rowIndex;
        }

        return { items, nextCursor, totalCount: table.rowCount };
      }

      // ── Shared auth check for sorted/filtered paths ──
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true, rowCount: true },
      });
      if (!table) throw new Error("Table not found");

      // Validate sort columns belong to this table + type matches DB
      if (sorts.length > 0) {
        const uniqueSortColIds = [...new Set(sorts.map((s) => s.columnId))];
        const cols = await ctx.db.column.findMany({
          where: { id: { in: uniqueSortColIds }, tableId: input.tableId },
          select: { id: true, type: true },
        });

        const colMap = new Map(cols.map((c) => [c.id, c.type]));
        for (const sort of sorts) {
          const dbType = colMap.get(sort.columnId);
          if (!dbType) throw new Error("Invalid sort column");
          if (dbType !== sort.type) throw new Error("Sort type mismatch");
        }
      }

      // Validate filter columnIds belong to this table (required before literal injection)
      {
        const colIdsToValidate: string[] = useTree
          ? extractColumnIds(filterTree)
          : filters.map((f) => f.columnId);
        const uniqueColIds = [...new Set(colIdsToValidate)];

        if (uniqueColIds.length > 0) {
          const count = await ctx.db.column.count({
            where: { tableId: input.tableId, id: { in: uniqueColIds } },
          });

          if (count !== uniqueColIds.length) {
            throw new Error("Invalid filter column");
          }
        }
      }

      const take = input.limit + 1;
      const isSorted = sorts.length > 0;
      const hasFiltersOrSearch = filters.length > 0 || Boolean(useTree) || Boolean(search && search.length > 0);

      // ── VIEWROWRANK PATH: materialized per-view ordering ──
      // Used when viewId is provided, ranks are fresh, and no filters/search
      // (ranks don't incorporate filter predicates).
      if (input.viewId && isSorted && !hasFiltersOrSearch) {
        const view = await ctx.db.view.findFirst({
          where: { id: input.viewId },
          select: { ranksStale: true },
        });

        if (view && !view.ranksStale) {
          const rankCount = await ctx.db.viewRowRank.count({
            where: { viewId: input.viewId },
          });

          if (rankCount > 0) {
            const cursor = input.cursor;
            // Detect cursor type → which phase we're in
            const isRankCursor = cursor && typeof cursor === "object" && "rank" in cursor;
            const isUnrankedTail = typeof cursor === "number";
            // Guard: if cursor is from the standard sorted path ({ rowIndex, sortValues }),
            // it can't be used with ViewRowRank. Fall through to the standard sorted path.
            const isSortedCursor = cursor && typeof cursor === "object" && "sortValues" in cursor;

            if (!isSortedCursor) {
              if (isUnrankedTail) {
                // ── Phase 2: Unranked tail (new rows after sort, natural order) ──
                const tailCursor = cursor as number;
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

                // Count unranked rows for totalCount
                const ucParams: SqlParam[] = [input.viewId, input.tableId];
                const ucSql = `
                  SELECT COUNT(*)::int AS count FROM "Row" r
                  LEFT JOIN "ViewRowRank" vrr ON vrr."rowId" = r."id" AND vrr."viewId" = $1
                  WHERE r."tableId" = $2 AND vrr."rank" IS NULL
                `;
                const ucRes = await queryRawUnsafe<CountRow[]>(ctx.db, ucSql, ucParams);
                const unrankedCount = ucRes[0]?.count ?? 0;

                return { items, nextCursor, totalCount: rankCount + unrankedCount };
              }

              // ── Phase 1: Ranked rows (frozen sort order) ──
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

              // Count unranked rows in parallel (for totalCount)
              const ucParams: SqlParam[] = [input.viewId, input.tableId];
              const ucSql = `
                SELECT COUNT(*)::int AS count FROM "Row" r
                LEFT JOIN "ViewRowRank" vrr ON vrr."rowId" = r."id" AND vrr."viewId" = $1
                WHERE r."tableId" = $2 AND vrr."rank" IS NULL
              `;

              const [rankedRows, ucRes] = await Promise.all([
                queryRawUnsafe<RowSelect[]>(ctx.db, rankedSql, rp),
                queryRawUnsafe<CountRow[]>(ctx.db, ucSql, ucParams),
              ]);
              const unrankedCount = ucRes[0]?.count ?? 0;
              const totalCount = rankCount + unrankedCount;

              let items: RowSelect[] = rankedRows;
              let hasNext = rankedRows.length > input.limit;
              if (hasNext) items = rankedRows.slice(0, input.limit);

              // If ranked rows exhausted, fill from unranked tail
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

              // Determine nextCursor based on last item's zone
              type InfiniteCursor = number | { rank: number } | { rowIndex: number; sortValues: (string | number | null)[] } | null;
              let nextCursor: InfiniteCursor = null;
              if (hasNext && items.length > 0) {
                const last = items[items.length - 1]!;
                // Check if this row has a rank (it's in the ranked zone)
                if (items.length <= rankedRows.length) {
                  // Last item is from ranked zone — find its rank
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
                  // Last item is from unranked tail
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

      // ── STANDARD SORTED/FILTERED PATH (live ORDER BY) ──

      // Cursor normalization
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

      // Build WHERE
      const params: SqlParam[] = [];
      params.push(input.tableId);
      let whereSql = `WHERE "Row"."tableId" = $${params.length}`;

      if (search && search.length > 0) {
        const escaped = escapeLikePattern(search);
        params.push(`%${escaped}%`);
        whereSql += ` AND "Row"."searchText" ILIKE $${params.length} ESCAPE '\\'`;
      }

      // Use tree-structured filters when available, fall back to flat filters
      if (useTree) {
        whereSql += buildFilterTreeSql(filterTree, params);
      } else {
        whereSql += buildFilterSql(filters, params, conjunction);
      }

      // Cursor predicate
      if (sorts.length === 0) {
        params.push(cursorRowIndex);
        whereSql += ` AND "Row"."rowIndex" > $${params.length}`;
      } else if (sortedCursor) {
        whereSql += buildMultiSortCursorSql(sorts, sortedCursor, params);
      }

      // ORDER BY
      const orderBySql = buildMultiSortOrderBy(sorts);

      // LIMIT
      params.push(take);
      const limitP = params.length;

      const sql = `
        SELECT "Row"."id", "Row"."rowIndex", "Row"."cells", "Row"."createdAt", "Row"."updatedAt"
        FROM "Row"
        ${whereSql}
        ORDER BY ${orderBySql}
        LIMIT $${limitP}
      `;

      // COUNT:
      const isFirstPage = input.cursor === null;
      const hasFilters = Boolean(useTree) || filters.length > 0;
      const needsCount = isFirstPage && (Boolean(search && search.length > 0) || hasFilters);

      let countPromise: Promise<CountRow[]> | null = null;
      if (needsCount) {
        const countParams: SqlParam[] = [];
        countParams.push(input.tableId);
        let countWhere = `WHERE "Row"."tableId" = $${countParams.length}`;

        if (search && search.length > 0) {
          const escaped = escapeLikePattern(search);
          countParams.push(`%${escaped}%`);
          countWhere += ` AND "Row"."searchText" ILIKE $${countParams.length} ESCAPE '\\'`;
        }

        if (useTree) {
          countWhere += buildFilterTreeSql(filterTree, countParams);
        } else {
          countWhere += buildFilterSql(filters, countParams, conjunction);
        }

        const countSql = `SELECT COUNT(*)::int AS count FROM "Row" ${countWhere}`;
        countPromise = queryRawUnsafe<CountRow[]>(ctx.db, countSql, countParams);
      }

      // Fire data + count queries in parallel
      const [rows, countResult] = await Promise.all([
        queryRawUnsafe<RowSelect[]>(ctx.db, sql, params),
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
        const last = items[items.length - 1]!;
        if (sorts.length === 0) {
          nextCursor = last.rowIndex;
        } else {
          nextCursor = {
            rowIndex: last.rowIndex,
            sortValues: normalizeSortValuesFromCells(sorts, last.cells),
          };
        }
      }

      const totalCount = countResult
        ? (countResult[0]?.count ?? 0)
        : table.rowCount;

      return { items, nextCursor, totalCount };
    }),

  // =========================================================================
  // applyPermanentSort — rewrite rowIndex for all rows in the table
  // =========================================================================
  applyPermanentSort: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        sorts: z.array(sortSchema).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true, rowCount: true },
      });
      if (!table) throw new Error("Table not found");

      // Validate sort columns exist + types match
      const uniqueSortColIds = [...new Set(input.sorts.map((s) => s.columnId))];
      const cols = await ctx.db.column.findMany({
        where: { id: { in: uniqueSortColIds }, tableId: input.tableId },
        select: { id: true, type: true },
      });

      const colMap = new Map(cols.map((c) => [c.id, c.type]));
      for (const sort of input.sorts) {
        const dbType = colMap.get(sort.columnId);
        if (!dbType) throw new Error("Invalid sort column");
        if (dbType !== sort.type) throw new Error("Sort type mismatch");
      }

      if (table.rowCount === 0) return { ok: true };

      const tableIdEscaped = escapeLiteral(input.tableId);
      const orderByClause = buildSortOrderByForAlias(input.sorts, "r");

      await ctx.db.$transaction(async (tx) => {
        // Phase 1: Compute new order and set to negative values (avoids unique constraint collisions)
        await tx.$executeRawUnsafe(`
          UPDATE "Row"
          SET "rowIndex" = -(subq.rn::int), "updatedAt" = now()
          FROM (
            SELECT r."id", ROW_NUMBER() OVER (ORDER BY ${orderByClause}) AS rn
            FROM "Row" r
            WHERE r."tableId" = '${tableIdEscaped}'
          ) subq
          WHERE "Row"."id" = subq."id"
        `);

        // Phase 2: Flip negative to positive (final range 1..N)
        await tx.$executeRawUnsafe(`
          UPDATE "Row"
          SET "rowIndex" = -"rowIndex"
          WHERE "tableId" = '${tableIdEscaped}' AND "rowIndex" < 0
        `);

        // Ensure nextRowIndex is correct (rowCount + 1)
        await tx.table.update({
          where: { id: input.tableId },
          data: {
            nextRowIndex: table.rowCount + 1,
            updatedAt: new Date(),
          },
        });
      }, { timeout: 120_000 });  // 120s for large tables (two full-table UPDATEs)

      return { ok: true };
    }),

  // =========================================================================
  // computeViewRanks — materialize sort ranks into ViewRowRank for a view
  // =========================================================================
  computeViewRanks: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        viewId: z.string(),
        sorts: z.array(sortSchema).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true, rowCount: true },
      });
      if (!table) throw new Error("Table not found");

      const view = await ctx.db.view.findFirst({
        where: { id: input.viewId, tableId: input.tableId },
        select: { id: true },
      });
      if (!view) throw new Error("View not found");

      // Validate sort columns
      const uniqueSortColIds = [...new Set(input.sorts.map((s) => s.columnId))];
      const cols = await ctx.db.column.findMany({
        where: { id: { in: uniqueSortColIds }, tableId: input.tableId },
        select: { id: true, type: true },
      });
      const colMap = new Map(cols.map((c) => [c.id, c.type]));
      for (const sort of input.sorts) {
        const dbType = colMap.get(sort.columnId);
        if (!dbType) throw new Error("Invalid sort column");
        if (dbType !== sort.type) throw new Error("Sort type mismatch");
      }

      if (table.rowCount === 0) {
        // Clear any existing ranks and mark fresh
        await ctx.db.$transaction([
          ctx.db.viewRowRank.deleteMany({ where: { viewId: input.viewId } }),
          ctx.db.view.update({
            where: { id: input.viewId },
            data: { ranksStale: false },
          }),
        ]);
        return { ok: true, rankCount: 0 };
      }

      const viewIdEscaped = escapeLiteral(input.viewId);
      const tableIdEscaped = escapeLiteral(input.tableId);
      const orderByClause = buildSortOrderByForAlias(input.sorts, "r");

      // Mark ranks as stale BEFORE the heavy transaction.
      // This prevents concurrent infinite/windowFetch queries from entering
      // the ViewRowRank path and contending with the bulk INSERT's
      // page-level B-tree index locks (which would hang the COUNT query).
      await ctx.db.view.update({
        where: { id: input.viewId },
        data: { ranksStale: true },
      });

      await ctx.db.$transaction(async (tx) => {
        // 1. Clear existing ranks for this view
        await tx.$executeRawUnsafe(
          `DELETE FROM "ViewRowRank" WHERE "viewId" = '${viewIdEscaped}'`,
        );

        // 2. Insert new ranks from ROW_NUMBER()
        await tx.$executeRawUnsafe(`
          INSERT INTO "ViewRowRank" ("viewId", "rank", "rowId")
          SELECT '${viewIdEscaped}', ROW_NUMBER() OVER (ORDER BY ${orderByClause})::int, r."id"
          FROM "Row" r
          WHERE r."tableId" = '${tableIdEscaped}'
        `);

        // 3. Mark view as fresh (only after successful INSERT)
        await tx.view.update({
          where: { id: input.viewId },
          data: { ranksStale: false },
        });
      }, { timeout: 120_000 }); // 120s for large tables (DELETE + INSERT with ROW_NUMBER)

      return { ok: true, rankCount: table.rowCount };
    }),

  addMany: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        count: z.number().min(1).max(200000).default(100000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      // Fetch table columns so we can generate visible cell data
      const columns = await ctx.db.column.findMany({
        where: { tableId: input.tableId },
        orderBy: { order: "asc" },
        select: { id: true, type: true },
      });

      const count = input.count;

      // ── Step 1: Reserve the rowIndex range (fast, in transaction) ──
      const updated = await ctx.db.$transaction(async (tx) => {
        const t = await tx.table.update({
          where: { id: input.tableId },
          data: {
            nextRowIndex: { increment: count },
            rowCount: { increment: count },
          },
          select: { nextRowIndex: true },
        });

        // NOTE: We intentionally do NOT mark ranks stale here.
        // New rows have no ViewRowRank entry and naturally fall to the
        // "unranked tail" (Phase 2) of the ViewRowRank pagination path.

        return t;
      });

      const startRowIndex = updated.nextRowIndex - count;
      const tableIdEscaped = escapeLiteral(input.tableId);

      // ── Step 2: INSERT in batches (outside transaction) ───────────
      // Splitting 100K rows into 25K batches reduces WAL pressure and
      // B-tree index maintenance contention per statement, improving
      // throughput on tables with 500K+ existing rows.
      const INSERT_BATCH = 25_000;
      for (let offset = 0; offset < count; offset += INSERT_BATCH) {
        const batchCount = Math.min(INSERT_BATCH, count - offset);
        const batchStart = startRowIndex + offset;

        // Build jsonb_build_object per batch (batchStart changes each iteration)
        const jsonbParts: string[] = [];
        const searchParts: string[] = [];
        for (const col of columns) {
          const colId = escapeLiteral(col.id);
          if (col.type === "NUMBER") {
            jsonbParts.push(`'${colId}', (${batchStart} + gs)`);
            searchParts.push(`(${batchStart} + gs)::text`);
          } else {
            jsonbParts.push(`'${colId}', 'Person ' || (${batchStart} + gs)`);
            searchParts.push(`'Person ' || (${batchStart} + gs)`);
          }
        }

        const cellsExpr = jsonbParts.length > 0
          ? `jsonb_build_object(${jsonbParts.join(", ")})`
          : `'{}'::jsonb`;
        const searchExpr = searchParts.length > 0
          ? searchParts.join(` || chr(31) || `)
          : `''::text`;

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
      }

      return { startRowIndex, count };
    }),

  /**
   * Insert a single empty row at a specific rowIndex position.
   *
   * Performance-optimised strategy:
   * 1. If `atIndex` slot is free → insert directly (0 rows shifted).
   * 2. Otherwise find the nearest gap ABOVE `atIndex` within a small window
   *    and shift only the rows between the gap and `atIndex` (≤ WINDOW rows).
   * 3. Fallback: use `nextRowIndex` (always free) as the gap so we shift at
   *    most from `atIndex` to `nextRowIndex` — still better than unbounded.
   */
  insertAt: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        atIndex: z.number().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true, nextRowIndex: true },
      });
      if (!table) throw new Error("Table not found");

      return ctx.db.$transaction(async (tx) => {
        let insertIndex = input.atIndex;


        // Check if the slot is already free (no row at atIndex)
        const existing = await tx.$queryRawUnsafe<{ cnt: bigint }[]>(
          `SELECT COUNT(*) AS cnt FROM "Row" WHERE "tableId" = $1 AND "rowIndex" = $2`,
          input.tableId, insertIndex,
        );
        const slotTaken = Number(existing[0]?.cnt ?? 0) > 0;

        if (slotTaken) {
          // Strategy: shift only the minimal number of rows.
          // `nextRowIndex` is guaranteed to be a free slot (no row exists there).
          // We shift rows in [atIndex, nextRowIndex - 1] upward by 1.
          // The two-pass negation trick avoids unique-constraint collisions.
          //
          // Cap: if more than SHIFT_CAP rows need shifting (e.g., insert at row 5
          // in a 100K-row table), place the new row at nextRowIndex instead.
          // The frontend invalidation/refetch will show it at the end; this is
          // fast and avoids locking the DB for seconds.
          const SHIFT_CAP = 5000;
          const shiftSize = table.nextRowIndex - insertIndex;

          if (shiftSize <= SHIFT_CAP) {
            await tx.$executeRawUnsafe(`
              UPDATE "Row"
              SET "rowIndex" = -("rowIndex" + 1)
              WHERE "tableId" = $1 AND "rowIndex" >= $2 AND "rowIndex" < $3
            `, input.tableId, insertIndex, table.nextRowIndex);

            await tx.$executeRawUnsafe(`
              UPDATE "Row"
              SET "rowIndex" = -"rowIndex", "updatedAt" = now()
              WHERE "tableId" = $1 AND "rowIndex" < 0
            `, input.tableId);
          } else {
            // Too many rows to shift — append at end instead
            insertIndex = table.nextRowIndex;
          }
        }

        // Insert the new empty row
        const newRow = await tx.row.create({
          data: {
            tableId: input.tableId,
            rowIndex: insertIndex,
            cells: {},
            searchText: "",
          },
          select: { id: true, rowIndex: true, cells: true, createdAt: true, updatedAt: true },
        });

        // Update table counters
        const newNextRowIndex = Math.max(table.nextRowIndex, insertIndex + 1);
        await tx.table.update({
          where: { id: input.tableId },
          data: {
            nextRowIndex: newNextRowIndex,
            rowCount: { increment: 1 },
          },
        });

        // NOTE: We intentionally do NOT mark ranks stale here.
        // The new row has no ViewRowRank entry and naturally falls to
        // the "unranked tail" (Phase 2) of the ViewRowRank pagination path.

        return newRow;
      }, { timeout: 30_000 });  // 30s for row shifting
    }),

  /**
   * Duplicate a row: copy its cells and insert the clone right below it.
   * Uses the same capped-shift strategy as insertAt.
   */
  duplicateAt: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        rowId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true, nextRowIndex: true },
      });
      if (!table) throw new Error("Table not found");

      const sourceRow = await ctx.db.row.findFirst({
        where: { id: input.rowId, tableId: input.tableId },
        select: { rowIndex: true, cells: true, searchText: true },
      });
      if (!sourceRow) throw new Error("Row not found");

      let insertIndex = sourceRow.rowIndex + 1;

      return ctx.db.$transaction(async (tx) => {
        // Check if slot is free
        const existing = await tx.$queryRawUnsafe<{ cnt: bigint }[]>(
          `SELECT COUNT(*) AS cnt FROM "Row" WHERE "tableId" = $1 AND "rowIndex" = $2`,
          input.tableId, insertIndex,
        );
        const slotTaken = Number(existing[0]?.cnt ?? 0) > 0;

        if (slotTaken) {
          const SHIFT_CAP = 5000;
          const shiftSize = table.nextRowIndex - insertIndex;

          if (shiftSize <= SHIFT_CAP) {
            await tx.$executeRawUnsafe(`
              UPDATE "Row"
              SET "rowIndex" = -("rowIndex" + 1)
              WHERE "tableId" = $1 AND "rowIndex" >= $2 AND "rowIndex" < $3
            `, input.tableId, insertIndex, table.nextRowIndex);

            await tx.$executeRawUnsafe(`
              UPDATE "Row"
              SET "rowIndex" = -"rowIndex", "updatedAt" = now()
              WHERE "tableId" = $1 AND "rowIndex" < 0
            `, input.tableId);
          } else {
            // Too many rows to shift — append at end
            insertIndex = table.nextRowIndex;
          }
        }

        // Insert the duplicated row with the same cells
        const newRow = await tx.row.create({
          data: {
            tableId: input.tableId,
            rowIndex: insertIndex,
            cells: sourceRow.cells ?? {},
            searchText: sourceRow.searchText ?? "",
          },
          select: { id: true, rowIndex: true, cells: true, createdAt: true, updatedAt: true },
        });

        const newNextRowIndex = Math.max(table.nextRowIndex, insertIndex + 1);
        await tx.table.update({
          where: { id: input.tableId },
          data: {
            nextRowIndex: newNextRowIndex,
            rowCount: { increment: 1 },
          },
        });

        // NOTE: We intentionally do NOT mark ranks stale here.
        // The duplicated row has no ViewRowRank entry and naturally
        // falls to the "unranked tail" (Phase 2).

        return newRow;
      }, { timeout: 30_000 });  // 30s for row shifting
    }),

  /**
   * Delete a single row by ID.
   */
  delete: protectedProcedure
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
      if (!table) throw new Error("Table not found");

      const row = await ctx.db.row.findFirst({
        where: { id: input.rowId, tableId: input.tableId },
        select: { id: true },
      });
      if (!row) throw new Error("Row not found");

      return ctx.db.$transaction(async (tx) => {
        // Clean up ViewRowRank entries for this row across ALL views.
        // This leaves a small gap in the rank sequence which is tolerable —
        // the JOIN in ViewRowRank queries naturally skips missing rows,
        // and rankCount stays accurate since we're removing the entry.
        await tx.$executeRawUnsafe(
          `DELETE FROM "ViewRowRank" WHERE "rowId" = $1::uuid`,
          input.rowId,
        );

        await tx.row.delete({ where: { id: input.rowId } });

        await tx.table.update({
          where: { id: input.tableId },
          data: { rowCount: { decrement: 1 } },
        });

        // NOTE: We intentionally do NOT mark ranks stale here.
        // The ViewRowRank entry was cleaned up above, and the remaining
        // ranks are still valid (frozen sort order is preserved).

        return { id: input.rowId };
      });
    }),

  /**
   * Reorder a single row: move it from one rowIndex to another.
   * Uses a 3-step SQL transaction with a temporary negative index
   * to avoid unique constraint violations on (tableId, rowIndex).
   */
  /**
   * Reorder a single row: move it from its current rowIndex to another.
   *
   * Strategy: park the row at a temp index, then shift each affected row
   * ONE AT A TIME in the correct order so every write fills the slot that
   * was just vacated — no negation trick, no unique-constraint risk.
   */
  reorder: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        rowId: z.string(),
        fromIndex: z.number().min(1),
        toIndex: z.number().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.fromIndex === input.toIndex) return { ok: true };

      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      const row = await ctx.db.row.findFirst({
        where: { id: input.rowId, tableId: input.tableId },
        select: { id: true, rowIndex: true },
      });
      if (!row) throw new Error("Row not found");

      const oldIdx = row.rowIndex;
      const newIdx = input.toIndex;
      if (oldIdx === newIdx) return { ok: true };

      await ctx.db.$transaction(async (tx) => {
        // Step 1: Park the dragged row at 0 (no real row ever uses 0).
        // This frees up oldIdx for the shift chain.
        await tx.row.update({
          where: { id: input.rowId },
          data: { rowIndex: 0 },
        });

        if (newIdx < oldIdx) {
          // Moving UP: shift each row in [newIdx .. oldIdx-1] → +1
          // Process in REVERSE order: highest first fills the empty slot above it.
          for (let i = oldIdx - 1; i >= newIdx; i--) {
            await tx.row.updateMany({
              where: { tableId: input.tableId, rowIndex: i },
              data: { rowIndex: i + 1 },
            });
          }
        } else {
          // Moving DOWN: shift each row in [oldIdx+1 .. newIdx] → -1
          // Process in FORWARD order: lowest first fills the empty slot below it.
          for (let i = oldIdx + 1; i <= newIdx; i++) {
            await tx.row.updateMany({
              where: { tableId: input.tableId, rowIndex: i },
              data: { rowIndex: i - 1 },
            });
          }
        }

        // Step 2: Place the dragged row at its new position.
        await tx.row.update({
          where: { id: input.rowId },
          data: { rowIndex: newIdx },
        });

        // NOTE: We intentionally do NOT mark ranks stale here.
        // Reorder only affects rowIndex (natural order), not the frozen
        // ViewRowRank sort order. Reorder is only allowed when no sorts
        // are active (canDragRows check on the frontend).
      });

      return { ok: true };
    }),

  updateCell: protectedProcedure
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
      if (!table) throw new Error("Table not found");

      const row = await ctx.db.row.findFirst({
        where: { id: input.rowId, tableId: input.tableId },
        select: { id: true, cells: true },
      });
      if (!row) throw new Error("Row not found");

      const currentCells = (row.cells ?? {}) as Record<string, unknown>;

      if (input.value === null || input.value === "") {
        delete currentCells[input.columnId];
      } else {
        currentCells[input.columnId] = input.value;
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
    }),

  // =========================================================================
  // windowFetch — positional window fetch for virtualized grid jumps
  // =========================================================================
  // Three-tier strategy:
  //   Tier 1 (no sort/filter/search): rowIndex BETWEEN → O(log N), instant
  //   Tier 2 (saved view with fresh ranks): JOIN ViewRowRank, rank BETWEEN → O(log N)
  //   Tier 3 (temporary sort / stale ranks): OFFSET + LIMIT → O(offset)
  windowFetch: protectedProcedure
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
      }),
    )
    .query(async ({ ctx, input }) => {
      const search = input.search?.trim();
      const filters = input.filters ?? [];
      const conjunction = input.conjunction;
      const filterTree = input.filterTree;
      const useTree = filterTree && filterTreeHasConditions(filterTree);
      const sorts = input.sorts ?? [];
      const hasQuery = sorts.length > 0 || filters.length > 0 || Boolean(search && search.length > 0) || Boolean(useTree);

      // ── TIER 1 FAST PATH: No sort/filter/search → parallelize auth + data ──
      if (!hasQuery) {
        const startRowIndex = input.offset + 1; // rowIndex is 1-based
        const endRowIndex = startRowIndex + input.limit - 1;

        const params: SqlParam[] = [input.tableId, startRowIndex, endRowIndex];
        const dataSql = `
          SELECT "id", "rowIndex", "cells", "createdAt", "updatedAt"
          FROM "Row"
          WHERE "tableId" = $1 AND "rowIndex" BETWEEN $2 AND $3
          ORDER BY "rowIndex" ASC
        `;

        // Fire ownership check + data query in parallel (data never leaves server if auth fails)
        const [table, items] = await Promise.all([
          ctx.db.table.findFirst({
            where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
            select: { id: true, rowCount: true },
          }),
          queryRawUnsafe<RowSelect[]>(ctx.db, dataSql, params),
        ]);
        if (!table) throw new Error("Table not found");

        let nextCursor: number | { rowIndex: number; sortValues: (string | number | null)[] } | null = null;
        if (items.length > 0) {
          nextCursor = items[items.length - 1]!.rowIndex;
        }

        return { items, totalCount: table.rowCount, nextCursor };
      }

      // ── Shared auth check for Tier 2/3 ──
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true, rowCount: true },
      });
      if (!table) throw new Error("Table not found");

      // Validate sort columns
      if (sorts.length > 0) {
        const uniqueSortColIds = [...new Set(sorts.map((s) => s.columnId))];
        const cols = await ctx.db.column.findMany({
          where: { id: { in: uniqueSortColIds }, tableId: input.tableId },
          select: { id: true, type: true },
        });
        const colMap = new Map(cols.map((c) => [c.id, c.type]));
        for (const sort of sorts) {
          const dbType = colMap.get(sort.columnId);
          if (!dbType) throw new Error("Invalid sort column");
          if (dbType !== sort.type) throw new Error("Sort type mismatch");
        }
      }

      // Validate filter columns
      {
        const colIdsToValidate: string[] = useTree
          ? extractColumnIds(filterTree)
          : filters.map((f) => f.columnId);
        const uniqueColIds = [...new Set(colIdsToValidate)];
        if (uniqueColIds.length > 0) {
          const count = await ctx.db.column.count({
            where: { tableId: input.tableId, id: { in: uniqueColIds } },
          });
          if (count !== uniqueColIds.length) throw new Error("Invalid filter column");
        }
      }

      // ── TIER 2: Saved view with fresh ViewRowRank → two-zone fetch ──
      // Only usable when ONLY sorts are active (no filters or search), because
      // ViewRowRank stores the full sorted order without any filter predicate.
      const hasFiltersOrSearch = filters.length > 0 || Boolean(useTree) || Boolean(search && search.length > 0);
      if (input.viewId && sorts.length > 0 && !hasFiltersOrSearch) {
        const view = await ctx.db.view.findFirst({
          where: { id: input.viewId },
          select: { ranksStale: true },
        });

        if (view && !view.ranksStale) {
          const rankCount = await ctx.db.viewRowRank.count({
            where: { viewId: input.viewId },
          });

          if (rankCount > 0) {
            // Count unranked rows (added after sort was applied)
            const ucParams: SqlParam[] = [input.viewId, input.tableId];
            const ucSql = `
              SELECT COUNT(*)::int AS count FROM "Row" r
              LEFT JOIN "ViewRowRank" vrr ON vrr."rowId" = r."id" AND vrr."viewId" = $1
              WHERE r."tableId" = $2 AND vrr."rank" IS NULL
            `;
            const ucRes = await queryRawUnsafe<CountRow[]>(ctx.db, ucSql, ucParams);
            const unrankedCount = ucRes[0]?.count ?? 0;
            const totalCount = rankCount + unrankedCount;

            let items: RowSelect[];

            if (input.offset < rankCount) {
              // Request starts in ranked zone
              const startRank = input.offset + 1;
              const endRank = startRank + input.limit - 1;

              const rp: SqlParam[] = [input.viewId, startRank, endRank];
              const rankedSql = `
                SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
                FROM "ViewRowRank" vrr
                JOIN "Row" r ON r."id" = vrr."rowId"
                WHERE vrr."viewId" = $1 AND vrr."rank" BETWEEN $2 AND $3
                ORDER BY vrr."rank" ASC
              `;
              items = await queryRawUnsafe<RowSelect[]>(ctx.db, rankedSql, rp);

              // If we need more from unranked tail
              const remaining = input.limit - items.length;
              if (remaining > 0 && unrankedCount > 0) {
                const tp: SqlParam[] = [input.viewId, input.tableId, remaining];
                const tailSql = `
                  SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
                  FROM "Row" r
                  LEFT JOIN "ViewRowRank" vrr ON vrr."rowId" = r."id" AND vrr."viewId" = $1
                  WHERE r."tableId" = $2 AND vrr."rank" IS NULL
                  ORDER BY r."rowIndex" ASC
                  LIMIT $3
                `;
                const tailRows = await queryRawUnsafe<RowSelect[]>(ctx.db, tailSql, tp);
                items = [...items, ...tailRows];
              }
            } else {
              // Request starts entirely in unranked tail
              const tailOffset = input.offset - rankCount;
              const tp: SqlParam[] = [input.viewId, input.tableId, input.limit, tailOffset];
              const tailSql = `
                SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
                FROM "Row" r
                LEFT JOIN "ViewRowRank" vrr ON vrr."rowId" = r."id" AND vrr."viewId" = $1
                WHERE r."tableId" = $2 AND vrr."rank" IS NULL
                ORDER BY r."rowIndex" ASC
                LIMIT $3 OFFSET $4
              `;
              items = await queryRawUnsafe<RowSelect[]>(ctx.db, tailSql, tp);
            }

            // Build nextCursor from last item
            let nextCursor: number | { rowIndex: number; sortValues: (string | number | null)[] } | null = null;
            if (items.length > 0) {
              const last = items[items.length - 1]!;
              nextCursor = {
                rowIndex: last.rowIndex,
                sortValues: normalizeSortValuesFromCells(sorts, last.cells),
              };
            }

            return { items, totalCount, nextCursor };
          }
        }
      }

      // ── TIER 3: Temporary sort / stale ranks → OFFSET + LIMIT ──
      const params: SqlParam[] = [];
      params.push(input.tableId);
      let whereSql = `WHERE "Row"."tableId" = $${params.length}`;

      if (search && search.length > 0) {
        const escaped = escapeLikePattern(search);
        params.push(`%${escaped}%`);
        whereSql += ` AND "Row"."searchText" ILIKE $${params.length} ESCAPE '\\'`;
      }

      if (useTree) {
        whereSql += buildFilterTreeSql(filterTree, params);
      } else {
        whereSql += buildFilterSql(filters, params, conjunction);
      }

      const orderBySql = buildMultiSortOrderBy(sorts);

      // LIMIT + OFFSET
      params.push(input.limit);
      const limitP = params.length;
      params.push(input.offset);
      const offsetP = params.length;

      const dataSql = `
        SELECT "Row"."id", "Row"."rowIndex", "Row"."cells", "Row"."createdAt", "Row"."updatedAt"
        FROM "Row"
        ${whereSql}
        ORDER BY ${orderBySql}
        LIMIT $${limitP} OFFSET $${offsetP}
      `;

      // Count query (always needed for windowFetch since we need totalCount for the scrollbar)
      const countParams: SqlParam[] = [];
      countParams.push(input.tableId);
      let countWhere = `WHERE "Row"."tableId" = $${countParams.length}`;

      if (search && search.length > 0) {
        const escaped = escapeLikePattern(search);
        countParams.push(`%${escaped}%`);
        countWhere += ` AND "Row"."searchText" ILIKE $${countParams.length} ESCAPE '\\'`;
      }

      if (useTree) {
        countWhere += buildFilterTreeSql(filterTree, countParams);
      } else {
        countWhere += buildFilterSql(filters, countParams, conjunction);
      }

      const countSql = `SELECT COUNT(*)::int AS count FROM "Row" ${countWhere}`;

      // Fire both in parallel
      const [items, countRes] = await Promise.all([
        queryRawUnsafe<RowSelect[]>(ctx.db, dataSql, params),
        queryRawUnsafe<CountRow[]>(ctx.db, countSql, countParams),
      ]);

      const totalCount = countRes[0]?.count ?? 0;

      // Build nextCursor from last item
      let nextCursor:
        | number
        | { rowIndex: number; sortValues: (string | number | null)[] }
        | null = null;
      if (items.length > 0) {
        const last = items[items.length - 1]!;
        if (sorts.length === 0) {
          nextCursor = last.rowIndex;
        } else {
          nextCursor = {
            rowIndex: last.rowIndex,
            sortValues: normalizeSortValuesFromCells(sorts, last.cells),
          };
        }
      }

      return { items, totalCount, nextCursor };
    }),
});
