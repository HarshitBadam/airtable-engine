// src/server/api/routers/row.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  filterTreeSchema,
  type FilterTreeItem,
  type FilterTreeCondition,
  type FilterTreeGroup,
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
    return buildConditionClause(item as FilterTreeCondition, params);
  }

  // Group node
  const group = item as FilterTreeGroup;
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
        ids.add((item as FilterTreeCondition).columnId);
      } else {
        walk((item as FilterTreeGroup).items);
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
      if (check((item as FilterTreeGroup).items)) return true;
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
        limit: z.number().min(1).max(500).default(200),

        // cursor:
        // - unsorted: number (rowIndex)
        // - sorted: { rowIndex, sortValues }
        cursor: z.union([z.number(), sortedCursorSchema]).nullable().default(null),

        search: z.string().max(200).optional(),
        filters: z.array(filterSchema).optional(),
        conjunction: z.enum(["and", "or"]).default("and"),
        /** Tree-structured filters (condition groups). Takes precedence over flat filters. */
        filterTree: filterTreeSchema.optional(),
        sorts: z.array(sortSchema).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true, rowCount: true },
      });
      if (!table) throw new Error("Table not found");

      const search = input.search?.trim();
      const filters = input.filters ?? [];
      const conjunction = input.conjunction;
      const filterTree = input.filterTree;
      const useTree = filterTree && filterTreeHasConditions(filterTree);
      const sorts = input.sorts ?? [];

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

      // Cursor normalization
      const cursor = input.cursor;
      const isSorted = sorts.length > 0;

      const cursorRowIndex =
        !isSorted
          ? typeof cursor === "number"
            ? cursor
            : 0
          : typeof cursor === "object" && cursor
            ? cursor.rowIndex
            : 0;

      const sortedCursor =
        isSorted && typeof cursor === "object" && cursor
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

      const rows = await queryRawUnsafe<RowSelect[]>(ctx.db, sql, params);

      const hasNextPage = rows.length > input.limit;
      const items = hasNextPage ? rows.slice(0, input.limit) : rows;

      let nextCursor:
        | number
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

      // COUNT:
      // - Only compute on the first page (cursor === null) to avoid expensive
      //   COUNT on every infinite-scroll page fetch.
      // - If neither search nor filters → use cached table.rowCount.
      // - The frontend reads totalCount from pages[0] only.
      let totalCount = table.rowCount;

      const isFirstPage = input.cursor === null;

      const hasFilters = useTree || filters.length > 0;
      if (isFirstPage && ((search && search.length > 0) || hasFilters)) {
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
        const res = await queryRawUnsafe<CountRow[]>(ctx.db, countSql, countParams);
        totalCount = res[0]?.count ?? 0;
      }

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
      });

      return { ok: true };
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

      const count = input.count;

      return ctx.db.$transaction(async (tx) => {
        const updated = await tx.table.update({
          where: { id: input.tableId },
          data: {
            nextRowIndex: { increment: count },
            rowCount: { increment: count },
          },
          select: { nextRowIndex: true },
        });

        const startRowIndex = updated.nextRowIndex - count;

        await tx.$executeRaw`
          INSERT INTO "Row" ("tableId", "rowIndex", "cells", "searchText", "createdAt", "updatedAt")
          SELECT
            ${input.tableId},
            ${startRowIndex} + gs,
            '{}'::jsonb,
            ''::text,
            now(),
            now()
          FROM generate_series(0, ${count} - 1) AS gs;
        `;

        return { startRowIndex, count };
      });
    }),

  /**
   * Insert a single empty row at a specific rowIndex position.
   * Shifts existing rows at or after `atIndex` up by 1.
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
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      return ctx.db.$transaction(async (tx) => {
        // Shift all rows at or after the target index up by 1.
        // Two-pass negation trick to avoid unique constraint violations
        // on (tableId, rowIndex): first negate, then restore with +1.
        await tx.$executeRawUnsafe(`
          UPDATE "Row"
          SET "rowIndex" = -("rowIndex" + 1)
          WHERE "tableId" = $1 AND "rowIndex" >= $2
        `, input.tableId, input.atIndex);

        await tx.$executeRawUnsafe(`
          UPDATE "Row"
          SET "rowIndex" = -"rowIndex", "updatedAt" = now()
          WHERE "tableId" = $1 AND "rowIndex" < 0
        `, input.tableId);

        // Insert the new empty row at the target index
        const newRow = await tx.row.create({
          data: {
            tableId: input.tableId,
            rowIndex: input.atIndex,
            cells: {},
            searchText: "",
          },
          select: { id: true, rowIndex: true, cells: true, createdAt: true, updatedAt: true },
        });

        // Update table counters
        await tx.table.update({
          where: { id: input.tableId },
          data: {
            nextRowIndex: { increment: 1 },
            rowCount: { increment: 1 },
          },
        });

        return newRow;
      });
    }),

  /**
   * Duplicate a row: copy its cells and insert the clone right below it.
   * Shifts subsequent rows up by 1 (same two-pass trick as insertAt).
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
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      const sourceRow = await ctx.db.row.findFirst({
        where: { id: input.rowId, tableId: input.tableId },
        select: { rowIndex: true, cells: true, searchText: true },
      });
      if (!sourceRow) throw new Error("Row not found");

      const atIndex = sourceRow.rowIndex + 1;

      return ctx.db.$transaction(async (tx) => {
        // Shift rows at or after atIndex (same two-pass negation trick)
        await tx.$executeRawUnsafe(`
          UPDATE "Row"
          SET "rowIndex" = -("rowIndex" + 1)
          WHERE "tableId" = $1 AND "rowIndex" >= $2
        `, input.tableId, atIndex);

        await tx.$executeRawUnsafe(`
          UPDATE "Row"
          SET "rowIndex" = -"rowIndex", "updatedAt" = now()
          WHERE "tableId" = $1 AND "rowIndex" < 0
        `, input.tableId);

        // Insert the duplicated row with the same cells
        const newRow = await tx.row.create({
          data: {
            tableId: input.tableId,
            rowIndex: atIndex,
            cells: sourceRow.cells ?? {},
            searchText: sourceRow.searchText ?? "",
          },
          select: { id: true, rowIndex: true, cells: true, createdAt: true, updatedAt: true },
        });

        await tx.table.update({
          where: { id: input.tableId },
          data: {
            nextRowIndex: { increment: 1 },
            rowCount: { increment: 1 },
          },
        });

        return newRow;
      });
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
        await tx.row.delete({ where: { id: input.rowId } });

        await tx.table.update({
          where: { id: input.tableId },
          data: { rowCount: { decrement: 1 } },
        });

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

      return ctx.db.row.update({
        where: { id: input.rowId },
        data: {
          cells: currentCells as unknown as object,
          searchText,
        },
        select: { id: true, rowIndex: true, cells: true, updatedAt: true },
      });
    }),
});
