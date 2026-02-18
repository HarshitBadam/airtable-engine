// src/server/api/routers/row.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { ensureSortIndex } from "~/server/db/ensureColumnIndexes";
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
    // Use NULLIF(cells->>'colId','') so Postgres matches the expression
    // B-tree index created by ensureSortIndex — enables Index Scan instead
    // of Seq Scan for equality, empty, and range filters on TEXT columns.
    const colExpr = `(NULLIF("Row"."cells" ->> '${colId}', ''))`;

    switch (f.op) {
      case "is_empty": {
        clauses.push(`(${colExpr} IS NULL)`);
        break;
      }
      case "is_not_empty": {
        clauses.push(`(${colExpr} IS NOT NULL)`);
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
        clauses.push(`(${colExpr}::double precision ${opMap[f.op]} $${params.length})`);
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
  // Use NULLIF to match the expression B-tree index from ensureSortIndex.
  const colExpr = `(NULLIF("Row"."cells" ->> '${colId}', ''))`;
  const op = cond.op;

  switch (op) {
    case "is_empty":
      return `(${colExpr} IS NULL)`;
    case "is_not_empty":
      return `(${colExpr} IS NOT NULL)`;
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
      return `(${colExpr}::double precision ${opMap[op]} $${params.length})`;
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
 * Detect if the filter is an OR of equality conditions on the SAME column.
 * When true, the windowFetch Tier 3 path can rewrite the query as UNION ALL
 * so Postgres uses a Merge Append of per-value index scans instead of
 * BitmapOr (which loses rowIndex ordering and requires a re-sort).
 *
 * Returns { colId, values } when the pattern matches, null otherwise.
 */
function detectOrEqualsPattern(
  filterTree: FilterTree | undefined,
  filters: FilterInput[],
  conjunction: string,
  useTree: boolean,
): { colId: string; values: (string | number)[] } | null {
  if (useTree && filterTree) {
    // Tree form: outer AND with a single OR group of equals on same column.
    const items = filterTree.items;
    if (items.length !== 1) return null;
    const item = items[0]!;
    if (item.kind !== "group" || item.conjunction !== "or") return null;
    if (item.items.length < 2) return null;

    let colId: string | null = null;
    const values: (string | number)[] = [];
    for (const cond of item.items) {
      if (cond.kind !== "condition" || cond.op !== "equals") return null;
      if (cond.value === undefined || cond.value === "") return null;
      if (colId === null) colId = cond.columnId;
      else if (colId !== cond.columnId) return null;
      values.push(cond.value);
    }
    return colId ? { colId, values } : null;
  }

  if (!useTree && filters.length >= 2 && conjunction === "or") {
    // Flat filters with OR conjunction: all must be equals on same column.
    let colId: string | null = null;
    const values: (string | number)[] = [];
    for (const f of filters) {
      if (f.op !== "equals") return null;
      if (colId === null) colId = f.columnId;
      else if (colId !== f.columnId) return null;
      values.push((f as { value: string }).value);
    }
    return colId ? { colId, values } : null;
  }

  return null;
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

/**
 * Run a query inside a short-lived transaction with `SET LOCAL enable_bitmapscan = off`.
 *
 * This forces Postgres to use Index Scan / Index-Only Scan instead of Bitmap
 * Heap Scan for the UNION ALL branches.  Bitmap Heap Scan materialises every
 * matching row from the heap (losing index ordering) whereas Index Scan streams
 * rows in index order — critical for Merge Append to work cheaply.
 *
 * `SET LOCAL` only applies within the transaction scope — no side-effects on
 * other concurrent queries or subsequent queries on the same connection.
 */
async function queryNoBitmap<T>(
  db: {
    $transaction: <R>(fn: (tx: {
      $executeRawUnsafe: (query: string) => PromiseLike<unknown>;
      $queryRawUnsafe: <Q = unknown>(query: string, ...values: unknown[]) => PromiseLike<Q>;
    }) => Promise<R>) => Promise<R>;
  },
  sql: string,
  params: SqlParam[],
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL enable_bitmapscan = off");
    return (await tx.$queryRawUnsafe<T>(sql, ...params)) as T;
  });
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
 *
 * NULL / empty = -infinity (Airtable convention):
 *   ASC  → NULLS FIRST  (smallest value, appears first)
 *   DESC → NULLS LAST   (smallest value, sinks to end)
 *
 * The rowIndex tiebreaker matches the FIRST sort's direction so Postgres
 * can serve both ASC and DESC from a single index via forward/backward scan:
 *   Index:  (expr ASC NULLS FIRST, "rowIndex" ASC)
 *   ASC  → forward scan  → expr ASC  NULLS FIRST, rowIndex ASC   ✓
 *   DESC → backward scan → expr DESC NULLS LAST,  rowIndex DESC  ✓
 */
function buildMultiSortOrderBy(sorts: SortInput[]): string {
  if (sorts.length === 0) return `"Row"."rowIndex" ASC`;

  const parts: string[] = [];

  for (const sort of sorts) {
    const sortExpr = getSortExpr(sort);
    const nulls = sort.direction === "asc" ? "NULLS FIRST" : "NULLS LAST";
    parts.push(`${sortExpr} ${sort.direction.toUpperCase()} ${nulls}`);
  }

  // Stable tie-breaker — direction matches first sort for index compatibility
  const rowIndexDir = sorts[0]!.direction === "desc" ? "DESC" : "ASC";
  parts.push(`"Row"."rowIndex" ${rowIndexDir}`);

  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// Multi-sort keyset cursor predicate builder
// ---------------------------------------------------------------------------

/**
 * Build a lexicographic keyset cursor predicate for multi-sort pagination.
 *
 * NULL = -infinity (Airtable convention):
 *   ASC  NULLS FIRST → null is the smallest, appears first
 *   DESC NULLS LAST  → null is the smallest, sinks to end
 *
 * "After cursor" logic per dimension:
 *   ASC  NULLS FIRST, cursorVal=null:     (expr IS NOT NULL)  — everything comes after null
 *   ASC  NULLS FIRST, cursorVal=non-null: (expr > cursorVal)  — null is before, not after
 *   DESC NULLS LAST,  cursorVal=null:     skip branch         — nothing after null (it's last)
 *   DESC NULLS LAST,  cursorVal=non-null: (expr < cursorVal) OR (expr IS NULL)  — null is after
 *
 * rowIndex tiebreaker matches first sort direction (ASC→>, DESC→<).
 */
function buildMultiSortCursorSql(
  sorts: SortInput[],
  cursor: SortedCursorInput,
  params: SqlParam[],
): string {
  // ── INDEX-COND-FRIENDLY KEYSET CURSOR ──
  //
  // Postgres CANNOT use an OR predicate as an Index Cond on a B-tree.
  // We emit the OR predicate for correctness, but ALSO prepend a simple
  // range bound on the FIRST sort key that IS usable as an Index Cond.
  // Result: deep-offset jumps become dramatically faster.

  // rowIndex tiebreaker direction matches the first sort
  const rowIndexOp = sorts.length > 0 && sorts[0]!.direction === "desc" ? "<" : ">";

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
        andParts.push(`(${sortExpr} = $${params.length})`);
      }
    }

    if (level < sorts.length) {
      // "After" on dimension `level`
      const sort = sorts[level]!;
      const sortExpr = getSortExpr(sort);
      const cursorVal = cursor.sortValues[level] ?? null;

      if (cursorVal === null) {
        if (sort.direction === "asc") {
          // ASC NULLS FIRST: everything non-null comes after null
          andParts.push(`(${sortExpr} IS NOT NULL)`);
        } else {
          // DESC NULLS LAST: nothing comes after null (it's last) → skip
          continue;
        }
      } else {
        if (sort.direction === "asc") {
          // ASC NULLS FIRST: null is before non-null, only greater values come after
          params.push(cursorVal);
          andParts.push(`(${sortExpr} > $${params.length})`);
        } else {
          // DESC NULLS LAST: null is after non-null (at end), so lesser OR null come after
          params.push(cursorVal);
          andParts.push(`(${sortExpr} IS NULL OR ${sortExpr} < $${params.length})`);
        }
      }
    } else {
      // Final tie-break: all sort keys equal, advance by rowIndex
      params.push(cursor.rowIndex);
      andParts.push(`("Row"."rowIndex" ${rowIndexOp} $${params.length})`);
    }

    if (andParts.length > 0) {
      orClauses.push(`(${andParts.join(" AND ")})`);
    }
  }

  if (orClauses.length === 0) {
    params.push(cursor.rowIndex);
    return ` AND "Row"."rowIndex" ${rowIndexOp} $${params.length}`;
  }

  // ── Prepend a simple range bound on the FIRST sort key ──
  // For ASC:  expr >= cursorVal  (seek forward in index)
  // For DESC: expr <= cursorVal OR expr IS NULL  (NULL is after non-null in DESC NULLS LAST)
  const firstCursorVal = cursor.sortValues[0] ?? null;
  let indexCondHint = "";
  if (firstCursorVal !== null && sorts.length > 0) {
    const firstSort = sorts[0]!;
    const firstExpr = getSortExpr(firstSort);
    if (firstSort.direction === "asc") {
      params.push(firstCursorVal);
      indexCondHint = ` AND ${firstExpr} >= $${params.length}`;
    } else {
      // Include NULLs: in DESC NULLS LAST they come after non-null values
      params.push(firstCursorVal);
      indexCondHint = ` AND (${firstExpr} <= $${params.length} OR ${firstExpr} IS NULL)`;
    }
  }

  return `${indexCondHint} AND (\n      ${orClauses.join("\n      OR ")}\n    )`;
}

// ---------------------------------------------------------------------------
// Reversed ORDER BY builder (for findEdgeMatch "last" queries)
// ---------------------------------------------------------------------------

/**
 * Build the ORDER BY clause with all directions reversed.
 *
 * ASC NULLS FIRST → DESC NULLS LAST (exact reverse for Postgres backward scan)
 * DESC NULLS LAST → ASC NULLS FIRST
 * rowIndex tiebreaker also reverses.
 */
function buildMultiSortOrderByReversed(sorts: SortInput[]): string {
  if (sorts.length === 0) return `"Row"."rowIndex" DESC`;

  const parts: string[] = [];
  for (const sort of sorts) {
    const sortExpr = getSortExpr(sort);
    if (sort.direction === "asc") {
      parts.push(`${sortExpr} DESC NULLS LAST`);
    } else {
      parts.push(`${sortExpr} ASC NULLS FIRST`);
    }
  }

  const rowIndexDir = sorts[0]!.direction === "desc" ? "ASC" : "DESC";
  parts.push(`"Row"."rowIndex" ${rowIndexDir}`);
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// "Before cursor" keyset predicate builder (for position counting)
// ---------------------------------------------------------------------------

/**
 * Build a lexicographic keyset predicate for rows STRICTLY BEFORE the cursor
 * in the current sort order.  Mirror of buildMultiSortCursorSql (which builds
 * the "after" predicate).
 *
 * Used by findEdgeMatch to COUNT rows before the target for position computation.
 */
function buildMultiSortBeforeCursorSql(
  sorts: SortInput[],
  cursor: SortedCursorInput,
  params: SqlParam[],
): string {
  const rowIndexOp = sorts.length > 0 && sorts[0]!.direction === "desc" ? ">" : "<";

  const orClauses: string[] = [];

  for (let level = 0; level <= sorts.length; level++) {
    const andParts: string[] = [];

    // Equality on all prior dimensions
    for (let j = 0; j < level && j < sorts.length; j++) {
      const sort = sorts[j]!;
      const sortExpr = getSortExpr(sort);
      const cursorVal = cursor.sortValues[j] ?? null;

      if (cursorVal === null) {
        andParts.push(`(${sortExpr} IS NULL)`);
      } else {
        params.push(cursorVal);
        andParts.push(`(${sortExpr} = $${params.length})`);
      }
    }

    if (level < sorts.length) {
      // "Before" on dimension `level`
      const sort = sorts[level]!;
      const sortExpr = getSortExpr(sort);
      const cursorVal = cursor.sortValues[level] ?? null;

      if (cursorVal === null) {
        if (sort.direction === "asc") {
          // ASC NULLS FIRST: null is first, nothing before it → skip
          continue;
        } else {
          // DESC NULLS LAST: null is last, everything non-null before it
          andParts.push(`(${sortExpr} IS NOT NULL)`);
        }
      } else {
        if (sort.direction === "asc") {
          // ASC NULLS FIRST: null and smaller values come before
          params.push(cursorVal);
          andParts.push(`(${sortExpr} IS NULL OR ${sortExpr} < $${params.length})`);
        } else {
          // DESC NULLS LAST: larger values come before in DESC
          params.push(cursorVal);
          andParts.push(`(${sortExpr} > $${params.length})`);
        }
      }
    } else {
      // Tiebreaker: all sort keys equal, rowIndex strictly before
      params.push(cursor.rowIndex);
      andParts.push(`("Row"."rowIndex" ${rowIndexOp} $${params.length})`);
    }

    if (andParts.length > 0) {
      orClauses.push(`(${andParts.join(" AND ")})`);
    }
  }

  if (orClauses.length === 0) return " AND FALSE";

  // Prepend index-cond-friendly range bound on the first sort key
  const firstCursorVal = cursor.sortValues[0] ?? null;
  let indexCondHint = "";
  if (firstCursorVal !== null && sorts.length > 0) {
    const firstSort = sorts[0]!;
    const firstExpr = getSortExpr(firstSort);
    if (firstSort.direction === "asc") {
      // Before in ASC: values ≤ cursorVal or NULL
      params.push(firstCursorVal);
      indexCondHint = ` AND (${firstExpr} <= $${params.length} OR ${firstExpr} IS NULL)`;
    } else {
      // Before in DESC: values ≥ cursorVal
      params.push(firstCursorVal);
      indexCondHint = ` AND ${firstExpr} >= $${params.length}`;
    }
  }

  return `${indexCondHint} AND (\n      ${orClauses.join("\n      OR ")}\n    )`;
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

    const nulls = sort.direction === "asc" ? "NULLS FIRST" : "NULLS LAST";
    parts.push(`${expr} ${sort.direction.toUpperCase()} ${nulls}`);
  }

  const rowIndexDir = sorts.length > 0 && sorts[0]!.direction === "desc" ? "DESC" : "ASC";
  parts.push(`${alias}."rowIndex" ${rowIndexDir}`);
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// Sort column validation + duplicate-column redirect
// ---------------------------------------------------------------------------

/**
 * Validate sort columns and resolve unbackfilled duplicates.
 *
 * 1. Every sort column must belong to `tableId` and the client-supplied type
 *    must match the DB type.
 * 2. If a column still has `sourceColumnId` set (the background backfill
 *    hasn't copied cell data yet), the sort is redirected to the source
 *    column — values are identical, and the source column already has an
 *    index.  This lets field duplication appear O(1) while the backfill
 *    runs asynchronously.
 * 3. When `buildIndexes` is true, sort indexes are ensured for every
 *    resolved column (fast-path <1ms when already present).
 *
 * Returns a *new* sorts array with possibly redirected columnIds.
 */
async function validateAndResolveSorts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  sorts: SortInput[],
  tableId: string,
  buildIndexes: boolean,
): Promise<SortInput[]> {
  if (sorts.length === 0) return sorts;

  const uniqueColIds = [...new Set(sorts.map((s) => s.columnId))];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const cols = await db.column.findMany({
    where: { id: { in: uniqueColIds }, tableId },
    select: { id: true, type: true, sourceColumnId: true },
  }) as { id: string; type: string; sourceColumnId: string | null }[];

  const colMap = new Map(cols.map((c) => [c.id, c]));

  // Validate
  for (const sort of sorts) {
    const col = colMap.get(sort.columnId);
    if (!col) throw new Error("Invalid sort column");
    if (col.type !== sort.type) throw new Error("Sort type mismatch");
  }

  // Redirect unbackfilled duplicates to their source column
  const hasRedirects = cols.some((c) => c.sourceColumnId);
  const resolved = hasRedirects
    ? sorts.map((sort) => {
        const col = colMap.get(sort.columnId)!;
        return col.sourceColumnId
          ? { ...sort, columnId: col.sourceColumnId }
          : sort;
      })
    : sorts;

  // Ensure sort indexes for resolved columns
  if (buildIndexes) {
    const resolvedColIds = [...new Set(resolved.map((s) => s.columnId))];

    // If redirects introduced columns not in the original set, fetch them
    const needsFetch = hasRedirects && resolvedColIds.some((id) => !colMap.has(id));
    const indexCols = needsFetch
      ? (await db.column.findMany({ // eslint-disable-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          where: { id: { in: resolvedColIds }, tableId },
          select: { id: true, type: true },
        }) as { id: string; type: string }[])
      : resolvedColIds.map((id) => {
          const c = colMap.get(id);
          return { id, type: c?.type ?? "TEXT" };
        });

    await Promise.all(
      indexCols.map((c) =>
        ensureSortIndex(db, tableId, c.id, c.type as "TEXT" | "NUMBER"),
      ),
    );
  }

  return resolved;
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
      let sorts = input.sorts ?? [];
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

      // Validate sort columns, redirect unbackfilled duplicates to their
      // source column, and ensure sort indexes exist.
      sorts = await validateAndResolveSorts(ctx.db, sorts, input.tableId, true);

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
      // Used when viewId is provided, ranks are fresh, and no filters/search.
      //
      // Why not for sort+filter?  ViewRowRank only stores (viewId, rank, rowId).
      // Evaluating filter conditions requires joining to Row for every ranked entry,
      // which is expensive at scale.  For jumping (large OFFSET), Tier 2 is WORSE:
      // it must scan offset/selectivity entries, while Tier 3 only sorts the
      // filtered subset.
      if (input.viewId && isSorted && !hasFiltersOrSearch) {
        const view = await ctx.db.view.findFirst({
          where: { id: input.viewId },
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
                // ── Phase 2: Unranked tail (new rows after sort, natural order) ──
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
              const rankedRows = await queryRawUnsafe<RowSelect[]>(ctx.db, rankedSql, rp);

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
      let cursorRowIndexParam: number | null = null; // track $N for UNION ALL
      if (sorts.length === 0) {
        params.push(cursorRowIndex);
        cursorRowIndexParam = params.length;
        whereSql += ` AND "Row"."rowIndex" > $${params.length}`;
      } else if (sortedCursor) {
        whereSql += buildMultiSortCursorSql(sorts, sortedCursor, params);
      }

      // ORDER BY
      const orderBySql = buildMultiSortOrderBy(sorts);

      // LIMIT
      params.push(take);
      const limitP = params.length;

      // ── UNION ALL optimisation for OR-of-equals filters (infinite scroll) ──
      // Same optimisation as windowFetch: split OR conditions into per-value
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
        // ── DEFERRED JOIN for sorted infinite scroll ──
        // The inner query selects only "id" so Postgres can use an Index-Only
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

      // COUNT:
      const isFirstPage = input.cursor === null;
      const hasFiltersForCount = Boolean(useTree) || filters.length > 0;
      const needsCount = isFirstPage && (Boolean(search && search.length > 0) || hasFiltersForCount);

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

      // Choose query runner: use queryNoBitmap for UNION ALL paths.
      const runInfiniteQuery = orEqInfinite
        ? () => queryNoBitmap<RowSelect[]>(ctx.db, sql, params)
        : () => queryRawUnsafe<RowSelect[]>(ctx.db, sql, params);

      // Fire data + count queries in parallel
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

      // Validate + redirect unbackfilled duplicates (no index build needed
      // for a full-table rewrite).
      const resolvedSorts = await validateAndResolveSorts(ctx.db, input.sorts, input.tableId, false);

      if (table.rowCount === 0) return { ok: true };

      const tableIdEscaped = escapeLiteral(input.tableId);
      const orderByClause = buildSortOrderByForAlias(resolvedSorts, "r");

      await ctx.db.$transaction(async (tx) => {
        // Phase 1: Compute new order and set to negative values (avoids unique constraint collisions)
        await tx.$executeRawUnsafe(`
          UPDATE "Row"
          SET "rowIndex" = -(subq.rn::float8), "updatedAt" = now()
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

      // Validate + redirect unbackfilled duplicates
      const resolvedSorts = await validateAndResolveSorts(ctx.db, input.sorts, input.tableId, false);

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
      const orderByClause = buildSortOrderByForAlias(resolvedSorts, "r");

      // ── TRANSACTIONAL rank materialization with advisory lock ─────
      //
      // Wrapped in a transaction with pg_advisory_xact_lock to prevent
      // concurrent computeViewRanks calls from racing (DELETE/INSERT
      // interleaving can violate the secondary UNIQUE on (viewId, rowId)).
      //
      // The advisory lock serialises calls per-view: if two calls race,
      // the second blocks until the first commits, then runs cleanly.
      //
      // The transaction holds one connection for the duration of the
      // rank computation.  This is acceptable given the pool size.

      // 1. Mark ranks stale — prevents concurrent queries from entering
      //    the ViewRowRank path during the heavy INSERT.
      await ctx.db.view.update({
        where: { id: input.viewId },
        data: { ranksStale: true },
      });

      try {
        // 2. Transaction: advisory lock → DELETE → INSERT
        await ctx.db.$transaction(
          async (tx) => {
            // Advisory lock scoped to this transaction — serialises concurrent
            // computeViewRanks calls for the same view.
            // Uses DO/PERFORM because pg_advisory_xact_lock returns void,
            // which Prisma's $queryRawUnsafe cannot deserialize.
            await tx.$executeRawUnsafe(
              `DO $$ BEGIN PERFORM pg_advisory_xact_lock(hashtext('vrr:${viewIdEscaped}')); END $$`,
            );

            // DELETE existing ranks
            await tx.$executeRawUnsafe(
              `DELETE FROM "ViewRowRank" WHERE "viewId" = '${viewIdEscaped}'`,
            );

            // INSERT new ranks — no ON CONFLICT needed because the advisory
            // lock guarantees exclusive access.
            await tx.$executeRawUnsafe(`
              INSERT INTO "ViewRowRank" ("viewId", "rank", "rowId")
              SELECT '${viewIdEscaped}', ROW_NUMBER() OVER (ORDER BY ${orderByClause})::int, r."id"
              FROM "Row" r
              WHERE r."tableId" = '${tableIdEscaped}'
            `);
          },
          {
            maxWait: 60000,  // wait up to 60s for a connection
            timeout: 120000, // allow up to 120s for the full transaction
          },
        );

        // 3. Mark view as fresh (auto-commit, outside the heavy transaction)
        await ctx.db.view.update({
          where: { id: input.viewId },
          data: { ranksStale: false },
        });
      } catch (err) {
        console.error(`computeViewRanks failed for view ${input.viewId}:`, err);
        // ranksStale remains true → system stays on Tier 3 (graceful degradation)
        throw err;
      }

      return { ok: true, rankCount: table.rowCount };
    }),

  addMany: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        count: z.number().min(1).max(200000).default(100000),
        populate: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      // Only fetch columns when populating with sample data
      const columns = input.populate
        ? await ctx.db.column.findMany({
            where: { tableId: input.tableId },
            orderBy: { order: "asc" },
            select: { id: true, type: true, name: true },
          })
        : [];

      const count = input.count;

      // ── Step 1: Reserve the rowIndex range (fast, in transaction) ──
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

      // ── Step 2: INSERT in batches (outside transaction) ──────────
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

        let cellsExpr: string;
        let searchExpr: string;

        if (input.populate && columns.length > 0) {
          // Build jsonb_build_object per batch (batchStart changes each iteration).
          // Use column names to pick realistic SQL array-cycling expressions.
          // Each array has a prime-ish length so combinations don't repeat quickly.
          const jsonbParts: string[] = [];
          const searchParts: string[] = [];
          const colNameLower = (n: string) => n.toLowerCase().trim();

          // ── faker.js-sourced data pools (generated via faker.seed(42)) ──
          // Pre-computed from @faker-js/faker to avoid runtime overhead.
          // Pools are cycled with prime-modulo indexing in SQL ARRAY[...][1 + (idx % N)].
          const FIRST_NAMES = [
            'Garnet','Valentine','Moses','Lavinia','Carley','Anderson','Sammie','Lea',
            'Melissa','Akeem','Waino','Riley','Coy','Cheyenne','Christelle','Elliott',
            'Judson','Hollie','Einar','Leopoldo','Brody','Eladio','Frederic','Jacky',
            'Ozella','Cody','Jordane','Larry','Alyce','Lenora','Cecile','Aniyah',
            'Uriel','Virgil','Rahsaan','Ellis','Axel','Marlee','Ignacio','Bonita',
            'Jerome','Alexzander','Sylvia','Destinee','Makayla','Elvie','Josie','Kasandra',
            'Christine','Wade','Ophelia','Trinity','Soledad','Laverne','Theodora','Ashlynn',
            'Cletus','Alvera','Eriberto','Gilda','Donavon','Rhoda','Fletcher','Earl',
            'Kari','Brooks','Princess','Araceli','Wyman','Olin','Cloyd','Abner',
            'Raven','Melany','Montana','Olen','April','Florida','Betty','Sally',
            'Linda','Erwin','Anibal','Elva','Monty','Louvenia','Sherwood','Jaquan',
            'Blake','Mia','Noemie','Kelli','Ole','Jeremy','Juana','Hettie',
            'Alda','Bernadette','Alexandrea','Louie',
          ]; // 100

          const LAST_NAMES = [
            'Lang','Franey','Roob','Blick','Crooks','Schowalter','Swaniawski','Dibbert',
            'Lindgren','Tremblay','Brown','Keebler','Stoltenberg','Langosh','Fadel','Hauck',
            'Hand','Prosacco','Witting','Graham','Monahan','Bechtelar','Upton','Considine',
            'Yost','Osinski','Ferry','Hilll','Nader','Borer','Hammes','Bauch',
            'Pagac','Langworth','Pollich','Wehner','Heaney','Walsh','Gerlach','Schumm',
            'Lehner','Botsford','Tromp','Hayes','Reinger','Torphy','Nitzsche','Moen',
            'Bradtke','Abshire','Lowe','Rath','Hane','Oberbrunner','Gleason','Wiza',
            'Toy','Schimmel','Mayer','Dietrich','Goyette','Weimann','Ward','Wisoky',
            'Stark','Weber','Marks','Morar','Robel','Greenholt','Schroeder','Veum',
            'Kuvalis','Schinner','Bashirian','Littel','McLaughlin','Hessel','Ledner',
            'Emmerich','Bogan','Lemke','Nienow','Wolf','Goldner','Block','Windler',
            'Predovic','Dach','Barton','Runte','Jakubowski','Hartmann','Beier','Hoeger',
            'Hermann',
          ]; // 97

          const CATCH_PHRASES = [
            'Decentralized demand-driven knowledge base','Reactive national database',
            'User-friendly real-time knowledge user','Polarised heuristic core',
            'Grass-roots regional access','Cross-platform analyzing algorithm',
            'Sustainable optimal infrastructure','Compatible immersive infrastructure',
            'Digitized high-level functionalities','Polarised modular alliance',
            'Immersive mobile instruction set','Sustainable national capability',
            'Business-focused motivating adapter','Persistent value-added local area network',
            'Implemented motivating hub','Organic value-added framework',
            'User-friendly transitional collaboration','Business-focused bifurcated access',
            'Compatible neutral application','Fully-configurable system-worthy adapter',
            'Sharable disintermediate artificial intelligence','Quality-focused mobile strategy',
            'Reduced secondary database','Digitized reciprocal projection',
            'Visionary global frame','Seamless executive task-force',
            'Sustainable high-level portal','Robust bottom-line support',
            'Open-source static encryption','Total fresh-thinking access',
            'Triple-buffered bifurcated encryption','User-centric well-modulated local area network',
            'Profit-focused holistic definition','Fundamental needs-based portal',
            'Self-enabling scalable architecture','Open-source asymmetric knowledge base',
            'Managed tertiary focus group','Cross-platform client-server pricing structure',
            'Proactive bifurcated architecture','Quality-focused asynchronous protocol',
            'Reactive attitude-oriented architecture','Virtual fault-tolerant frame',
            'Sharable well-modulated website','Robust fault-tolerant architecture',
            'Seamless leading edge hardware','Triple-buffered bottom-line installation',
            'AI-driven human-resource analyzer','Cross-platform clear-thinking model',
            'Reverse-engineered logistical toolset','Immersive disintermediate strategy',
            'Ergonomic zero administration access','Versatile actuating success',
            'Optimized zero trust approach','Organic zero defect internet solution',
            'Proactive next generation hub','Proactive maximized support',
            'Automated disintermediate time-frame','Total homogeneous microservice',
            'Face to face composite implementation','Grass-roots logistical approach',
            'Versatile zero tolerance open architecture','Optional eco-centric projection',
            'Public-key coherent synergy','Smart well-modulated parallelism',
            'Polarised heuristic task-force','Synchronised analyzing adapter',
            'Immersive stable website','Decentralized maximized framework',
            'Versatile sustainable software','Multi-tiered global data-warehouse',
            'Balanced systematic projection','Visionary zero trust knowledge user',
            'Seamless well-modulated solution','Expanded homogeneous attitude',
            'User-friendly methodical conglomeration','Progressive mobile forecast',
            'Cross-platform needs-based interface','Seamless intangible solution',
            'Organic leading edge strategy',
          ]; // 79

          // faker.js free_email domains (faker.definitions.internet.free_email)
          const EMAIL_PROVIDERS = [
            'gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com',
            'protonmail.com','aol.com','mail.com','zoho.com','fastmail.com',
            'yandex.com','tutanota.com','gmx.com',
          ]; // 13

          const FILE_EXTS = ['pdf','docx','xlsx','png','jpg','csv','txt','pptx','zip','svg']; // 10
          const FILE_PREFIXES = [
            'report','invoice','presentation','document','spreadsheet','summary',
            'analysis','proposal','contract','memo','brief','overview','review',
            'draft','plan','notes','agenda','schedule','budget','forecast',
          ]; // 20

          // SQL helper: builds ARRAY[...][1 + ((idx) % len)]
          const sqlArrayPick = (arr: string[], idxExpr: string) => {
            const escaped = arr.map(s => `'${s.replace(/'/g, "''")}'`).join(',');
            return `(ARRAY[${escaped}])[1 + ((${idxExpr}) % ${arr.length})]`;
          };

          // Use different prime multipliers per field so combinations don't align.
          // idx is the absolute row index: batchStart + gs
          const idx = `(${batchStart} + gs)`;

          for (const col of columns) {
            const colId = escapeLiteral(col.id);
            const name = colNameLower(col.name);

            if (col.type === "NUMBER") {
              jsonbParts.push(`'${colId}', (${batchStart} + gs)`);
              searchParts.push(`(${batchStart} + gs)::text`);
            } else if (name === "name") {
              const expr = `${sqlArrayPick(FIRST_NAMES, idx)} || ' ' || ${sqlArrayPick(LAST_NAMES, `${idx} * 7 + 3`)}`;
              jsonbParts.push(`'${colId}', ${expr}`);
              searchParts.push(expr);
            } else if (name === "notes") {
              const expr = sqlArrayPick(CATCH_PHRASES, `${idx} * 3 + 1`);
              jsonbParts.push(`'${colId}', ${expr}`);
              searchParts.push(expr);
            } else if (name === "assignee") {
              const expr = `lower(${sqlArrayPick(FIRST_NAMES, `${idx} * 11 + 5`)}) || '.' || lower(${sqlArrayPick(LAST_NAMES, `${idx} * 13 + 7`)}) || '@' || ${sqlArrayPick(EMAIL_PROVIDERS, `${idx} * 17 + 2`)}`;
              jsonbParts.push(`'${colId}', ${expr}`);
              searchParts.push(expr);
            } else if (name === "status") {
              const expr = sqlArrayPick(['Todo','In progress','In review','Done','Blocked'], idx);
              jsonbParts.push(`'${colId}', ${expr}`);
              searchParts.push(expr);
            } else if (name === "attachments") {
              const expr = `'https://storage.example.com/' || ${sqlArrayPick(FILE_PREFIXES, `${idx} * 3`)} || '-' || ${idx} || '.' || ${sqlArrayPick(FILE_EXTS, `${idx} * 7`)}`;
              jsonbParts.push(`'${colId}', ${expr}`);
              searchParts.push(expr);
            } else {
              const expr = `${sqlArrayPick(FIRST_NAMES, `${idx} * 3`)} || ' ' || ${sqlArrayPick(LAST_NAMES, `${idx} * 5 + 1`)}`;
              jsonbParts.push(`'${colId}', ${expr}`);
              searchParts.push(expr);
            }
          }

          cellsExpr = `jsonb_build_object(${jsonbParts.join(", ")})`;
          searchExpr = searchParts.join(` || chr(31) || `);
        } else {
          cellsExpr = `'{}'::jsonb`;
          searchExpr = `''::text`;
        }

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

      // ── Step 3: Reconcile rowCount with the actual number of rows ──
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
    }),

  /**
   * Insert a single empty row at a specific position.
   *
   * Strategy (Float rowIndex, zero shifting):
   *   position="end"   → atomically claim nextRowIndex (O(1), race-safe)
   *   position="above"  → midpoint between prev row and atIndex
   *   position="below"  → midpoint between atIndex and next row
   *
   * No existing rows are ever touched — just one INSERT.
   */
  insertAt: protectedProcedure
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
      if (!table) throw new Error("Table not found");

      // ── Float midpoint insertion: O(log N), zero row shifting ──
      //
      // Instead of shifting existing rows (O(N)), we place the new row
      // at a midpoint between two neighbours.
      //   e.g.  rows 4.0, 5.0 → insert above 5.0 → (4.0+5.0)/2 = 4.5
      // This never touches any existing row — just one INSERT.
      //
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
          // Insert before the row at atIndex.
          // Find the previous row and compute midpoint.
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
          // 'below': insert after the row at atIndex.
          // Find the next row and compute midpoint.
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

        // Single INSERT — O(log N) via B-tree index
        const newRow = await tx.row.create({
          data: {
            tableId: input.tableId,
            rowIndex: insertIndex,
            cells: {},
            searchText: "",
          },
          select: { id: true, rowIndex: true, cells: true, createdAt: true, updatedAt: true },
        });

        // Keep rowCount and nextRowIndex accurate.
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
        select: { id: true },
      });
      if (!table) throw new Error("Table not found");

      const sourceRow = await ctx.db.row.findFirst({
        where: { id: input.rowId, tableId: input.tableId },
        select: { rowIndex: true, cells: true, searchText: true },
      });
      if (!sourceRow) throw new Error("Row not found");

      // ── Float midpoint: place the clone right after the source row ──
      // Wrapped in a transaction so the row INSERT and the Table counter
      // UPDATE are atomic — if either fails, both roll back and rowCount
      // stays consistent (same pattern as the delete mutation).

      return ctx.db.$transaction(async (tx) => {
        // Find the next row after the source and compute the midpoint.
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

        // Keep rowCount and nextRowIndex accurate
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
    }),

  /**
   * Delete a single row by ID.
   *
   * Idempotent: if the row is already gone (concurrent delete, double-click),
   * the mutation succeeds with count: 0 instead of throwing.
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

      return ctx.db.$transaction(async (tx) => {
        // Clean up ViewRowRank entries for this row across ALL views.
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
          // Only decrement rowCount if a row was actually deleted
          await tx.table.update({
            where: { id: input.tableId },
            data: { rowCount: { decrement: 1 } },
          });
        }

        return { id: input.rowId };
      });
    }),

  /**
   * Clear all rows from a table (delete every row, reset counters).
   * Idempotent: calling on an already-empty table is a no-op.
   */
  clearData: protectedProcedure
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
      if (!table) throw new Error("Table not found");

      if (table.rowCount === 0) return { deletedCount: 0 };

      const tableIdEscaped = escapeLiteral(input.tableId);

      await ctx.db.$transaction(async (tx) => {
        // Delete all ViewRowRank entries for rows in this table
        await tx.$executeRawUnsafe(`
          DELETE FROM "ViewRowRank"
          WHERE "rowId" IN (
            SELECT "id" FROM "Row" WHERE "tableId" = '${tableIdEscaped}'
          )
        `);

        // Delete all rows
        await tx.$executeRawUnsafe(`
          DELETE FROM "Row" WHERE "tableId" = '${tableIdEscaped}'
        `);

        // Reset table counters
        await tx.table.update({
          where: { id: input.tableId },
          data: {
            rowCount: 0,
            nextRowIndex: 1,
          },
        });
      }, { timeout: 120_000 }); // 120s for large tables

      return { deletedCount: table.rowCount };
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
      if (!table) throw new Error("Table not found");

      // Wrap the entire reorder in a transaction so the neighbour lookups
      // and the UPDATE are atomic — prevents a concurrent reorder from
      // reading stale neighbours and placing a row at a wrong midpoint.
      await ctx.db.$transaction(async (tx) => {
        const row = await tx.row.findFirst({
          where: { id: input.rowId, tableId: input.tableId },
          select: { id: true, rowIndex: true },
        });
        if (!row) throw new Error("Row not found");

        if (row.rowIndex === input.toIndex) return;

        // ── Float midpoint reorder: O(log N), zero row shifting ──
        // Find the two neighbours at the drop position and place the
        // dragged row at the midpoint.
        const targetIdx = input.toIndex;

        // Find the row at or just before the target, and the row just after
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

      // Validate the column exists and coerce value to match its type.
      // This prevents storing a string in a NUMBER column or vice versa,
      // which would break sorting and filtering.
      const column = await ctx.db.column.findFirst({
        where: { id: input.columnId, tableId: input.tableId },
        select: { id: true, type: true, sourceColumnId: true },
      });
      if (!column) throw new Error("Column not found");

      const row = await ctx.db.row.findFirst({
        where: { id: input.rowId, tableId: input.tableId },
        select: { id: true, cells: true },
      });
      if (!row) throw new Error("Row not found");

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
        // For NUMBER columns, coerce string inputs to numbers.
        // If the value can't be parsed as a number, reject it.
        const num = typeof input.value === "number" ? input.value : Number(input.value);
        if (Number.isNaN(num)) {
          throw new Error("Invalid number value");
        }
        currentCells[input.columnId] = num;
      } else {
        // TEXT column — store as string
        currentCells[input.columnId] = typeof input.value === "number"
          ? String(input.value)
          : input.value;
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
  //   Tier 1 (no sort/filter/search): rowIndex estimation + B-tree seek → O(log N)
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
        // ── Count-skip optimisation ──
        // When true, the server skips the expensive COUNT(*) query and
        // returns knownTotal as-is.  The client should only set this when
        // it already has a valid totalCount from a prior fetch with the
        // same filter/sort parameters.
        skipCount: z.boolean().optional(),
        knownTotal: z.number().int().optional(),
        // ── Cursor anchor optimisation ──
        // If the client has a cached keyset cursor near the target offset,
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

      // ── TIER 1 FAST PATH: No sort/filter/search → rowIndex estimation + B-tree seek ──
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
        if (!table) throw new Error("Table not found");

        // Edge case: empty table or requesting beyond the end
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

        // Linear interpolation: estimate the rowIndex at the target position
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

      // ── Shared auth check for Tier 2/3 ──
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true, rowCount: true },
      });
      if (!table) throw new Error("Table not found");

      // Validate sort columns, redirect unbackfilled duplicates, ensure indexes.
      sorts = await validateAndResolveSorts(ctx.db, sorts, input.tableId, true);

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

      // ── TIER 2: Saved view with fresh ViewRowRank → O(limit) fetch ──
      // Only for sort-only (no filters/search).  Sort+filter stays on Tier 3
      // because evaluating filters requires joining every ranked entry to Row
      // — worse than Tier 3's approach
      // of filtering first then sorting the smaller filtered set.
      const hasFiltersOrSearch = filters.length > 0 || Boolean(useTree) || Boolean(search && search.length > 0);
      if (input.viewId && sorts.length > 0 && !hasFiltersOrSearch) {
        const view = await ctx.db.view.findFirst({
          where: { id: input.viewId },
          select: { ranksStale: true },
        });

        if (view && !view.ranksStale) {
          // ── O(log N) probe: check if the target offset exists in the ranked zone ──
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

            // Build nextCursor from last item
            let nextCursor: number | { rowIndex: number; sortValues: (string | number | null)[] } | null = null;
            if (items.length > 0) {
              const last = items[items.length - 1]!;
              nextCursor = {
                rowIndex: last.rowIndex,
                sortValues: normalizeSortValuesFromCells(sorts, last.cells),
              };
            }

            // totalCount = table.rowCount always (rankCount + unrankedCount = rowCount)
            return { items, totalCount: table.rowCount, nextCursor };
          }

          // Offset is beyond the ranked zone → fall through to Tier 3 (with anchors)
        }
      }

      // ── TIER 3: Temporary sort / stale ranks → OFFSET + LIMIT ──
      //
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

      // ── Apply cursor anchor (keyset skip) when available ──
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

      // ── UNION ALL optimisation for OR-of-equals filters ──
      //
      // When the filter is `col = 'A' OR col = 'B'` (same column, no sorts,
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
        // Standard deferred join: lightweight inner query finds the IDs,
        // outer query fetches full row data only for the final window.
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

      // Count query — needed for totalCount (scrollbar).
      // Skipped when the client already knows the total (skipCount=true).
      let totalCount: number;

      // Choose query runner: use queryNoBitmap for UNION ALL paths to force
      // Index Scan (4-5× faster than Bitmap Heap Scan for large offsets).
      const runDataQuery = orEqPattern
        ? () => queryNoBitmap<RowSelect[]>(ctx.db, dataSql, params)
        : () => queryRawUnsafe<RowSelect[]>(ctx.db, dataSql, params);

      if (input.skipCount && typeof input.knownTotal === "number") {
        // Client already has the count from a previous fetch with this
        // same filter/sort combo — no need to rescan.
        totalCount = input.knownTotal;

        const items = await runDataQuery();

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
      }

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
        runDataQuery(),
        queryRawUnsafe<CountRow[]>(ctx.db, countSql, countParams),
      ]);

      totalCount = countRes[0]?.count ?? 0;

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

  // =========================================================================
  // searchMatchCount — count total substring occurrences across rows (respects filters)
  // =========================================================================
  searchMatchCount: protectedProcedure
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
    }),

  // =========================================================================
  // findEdgeMatch — fast O(log N) first/last match for wrap-around navigation
  // =========================================================================
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
  // =========================================================================
  findEdgeMatch: protectedProcedure
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

      // ── Q1: Find the edge match row (LIMIT 1) ───────────────────────
      const q1Params: SqlParam[] = [input.tableId, `%${escaped}%`];
      let q1Where = `WHERE "Row"."tableId" = $1 AND "Row"."searchText" ILIKE $2 ESCAPE '\\'`;
      if (useTree) {
        q1Where += buildFilterTreeSql(filterTree, q1Params);
      } else if (filters.length > 0) {
        q1Where += buildFilterSql(filters, q1Params, conjunction);
      }

      // Forward ORDER BY for "first", reversed for "last"
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

      // ── Q2: Compute absolute position ────────────────────────────────
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
          // "last": count rows AFTER the target, derive position
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

          // Resolve totalCount
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
        // ── Sorted case ─────────────────────────────────────────────────
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
            // Count rows strictly before the target in sort order
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
            // Count rows strictly after the target in sort order
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

            // Resolve totalCount
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
    }),

  // =========================================================================
  // searchMatchAt — get row id, absolute position, and occurrence info for
  // the match at a global index.  Used by wrap-around find navigation
  // ("prev from first" → jump to last, "next from last" → jump to first).
  //
  // When `sorts` are provided the match ordering and absolute position
  // respect the view's sort order (uses existing composite B-tree indexes).
  // When omitted, ordering falls back to rowIndex ASC.
  // =========================================================================
  searchMatchAt: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        search: z.string().min(1),
        matchIndex: z.number().int().min(0),
        filters: z.array(filterSchema).optional(),
        conjunction: z.enum(["and", "or"]).default("and"),
        filterTree: filterTreeSchema.optional(),
        sorts: z.array(sortSchema).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { ownerId: ctx.session.user.id } },
        select: { id: true },
      });
      if (!table) return { rowId: null, rowOffset: null, occurrenceInRow: null, absolutePosition: null };

      const sorts = await validateAndResolveSorts(
        ctx.db, input.sorts ?? [], input.tableId, true,
      );

      const escaped = escapeLikePattern(input.search);
      const searchLower = input.search.toLowerCase();
      const filters = input.filters ?? [];
      const conjunction = input.conjunction;
      const filterTree = input.filterTree;
      const useTree = filterTree && filterTreeHasConditions(filterTree);

      // ── Query 1: Find the target match row ────────────────────────
      // Only scans ILIKE-matching rows (much fewer than total), so it's fast.
      // Include cells only when sorts are active (needed for sort ORDER BY).
      const q1Params: SqlParam[] = [searchLower, input.tableId, `%${escaped}%`];
      let q1Where = `WHERE "Row"."tableId" = $2 AND "Row"."searchText" ILIKE $3 ESCAPE '\\'`;
      if (useTree) {
        q1Where += buildFilterTreeSql(filterTree, q1Params);
      } else if (filters.length > 0) {
        q1Where += buildFilterSql(filters, q1Params, conjunction);
      }
      q1Params.push(input.matchIndex + 1);
      const q1ThresholdP = q1Params.length;

      const q1SelectCells = sorts.length > 0 ? ', "Row"."cells"' : '';
      const q1CteOrder = sorts.length > 0
        ? buildSortOrderByForAlias(sorts, 't')
        : `t."rowIndex" ASC`;

      const findResult = await ctx.db.$queryRawUnsafe<
        [{ id: string; rowIndex: number; rn: number; cnt: number; cum: number } | undefined]
      >(
        `WITH t AS (
          SELECT "Row"."id", "Row"."rowIndex"${q1SelectCells},
            (LENGTH("Row"."searchText") - LENGTH(REPLACE(LOWER("Row"."searchText"), $1, ''))) / NULLIF(LENGTH($1), 0) AS cnt
          FROM "Row"
          ${q1Where}
        ),
        t2 AS (
          SELECT id, "rowIndex", cnt,
            SUM(cnt) OVER (ORDER BY ${q1CteOrder})::int AS cum,
            ROW_NUMBER() OVER (ORDER BY ${q1CteOrder})::int - 1 AS rn
          FROM t
        )
        SELECT id, "rowIndex", rn, cnt, cum FROM t2 WHERE cum >= $${q1ThresholdP} ORDER BY rn ASC LIMIT 1`,
        ...q1Params,
      );

      const hit = findResult[0];
      if (!hit) return { rowId: null, rowOffset: null, occurrenceInRow: null, absolutePosition: null };
      const occurrenceInRow = input.matchIndex - (Number(hit.cum) - Number(hit.cnt));

      // ── Query 2: Compute absolute position ────────────────────────
      // The row's 0-based position among ALL filtered rows (not just matching).
      // This is what windowFetch needs as `offset` to scroll to the right page.
      let absolutePosition: number;

      if (sorts.length === 0) {
        // Unsorted: COUNT rows with smaller rowIndex — O(log N) with B-tree.
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
        // Sorted: lightweight ROW_NUMBER — selects only "id" (no cells/searchText
        // materialization). With INCLUDE("id") on the composite sort index this
        // can be an Index Only Scan.
        const q2Params: SqlParam[] = [input.tableId];
        let q2Where = `WHERE "Row"."tableId" = $1`;
        if (useTree) {
          q2Where += buildFilterTreeSql(filterTree, q2Params);
        } else if (filters.length > 0) {
          q2Where += buildFilterSql(filters, q2Params, conjunction);
        }
        q2Params.push(hit.id);
        const targetIdP = q2Params.length;
        const q2OrderBy = buildSortOrderByForAlias(sorts, '"Row"');

        const posResult = await ctx.db.$queryRawUnsafe<[{ pos: number } | undefined]>(
          `SELECT (sub.rn - 1)::int AS pos FROM (
            SELECT "Row"."id", ROW_NUMBER() OVER (ORDER BY ${q2OrderBy})::int AS rn
            FROM "Row"
            ${q2Where}
          ) sub WHERE sub.id = $${targetIdP}::uuid`,
          ...q2Params,
        );
        absolutePosition = posResult[0]?.pos ?? 0;
      }

      return {
        rowId: hit.id,
        rowOffset: Number(hit.rn),
        occurrenceInRow,
        absolutePosition,
      };
    }),
});
