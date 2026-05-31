import { z } from "zod";
import type { Sort as SortInput } from "~/shared/grid";
import { escapeLiteral, type SqlParam } from "./escape";

export const sortedCursorSchema = z.object({
  rowIndex: z.number(),
  sortValues: z.array(z.union([z.string(), z.number(), z.null()])),
});
export type SortedCursorInput = z.infer<typeof sortedCursorSchema>;

/**
 * SQL expression for a sort column.
 *
 * TEXT and NUMBER both use `NULLIF` to treat empty strings as NULL so the
 * value matches the expression B-tree index from `ensureSortIndex`:
 *
 *   TEXT:   NULLIF(cells->>'colId', '')
 *   NUMBER: NULLIF(cells->>'colId', '')::double precision
 */
export function getSortExpr(sort: SortInput): string {
  const colId = escapeLiteral(sort.columnId);

  if (sort.type === "TEXT") {
    return `(NULLIF("Row"."cells" ->> '${colId}', ''))`;
  }
  return `(NULLIF("Row"."cells" ->> '${colId}', '')::double precision)`;
}

/**
 * Build the ORDER BY clause for multiple sorts.
 *
 * NULL / empty = -infinity (Airtable convention):
 *   ASC  → NULLS FIRST  (smallest value, appears first)
 *   DESC → NULLS LAST   (smallest value, sinks to end)
 *
 * The rowIndex tie-breaker matches the FIRST sort's direction so Postgres
 * can serve both ASC and DESC from a single index via forward/backward scan:
 *   Index:  (expr ASC NULLS FIRST, "rowIndex" ASC)
 *   ASC  → forward scan  → expr ASC  NULLS FIRST, rowIndex ASC
 *   DESC → backward scan → expr DESC NULLS LAST,  rowIndex DESC
 */
export function buildMultiSortOrderBy(sorts: SortInput[]): string {
  if (sorts.length === 0) return `"Row"."rowIndex" ASC`;

  const parts: string[] = [];

  for (const sort of sorts) {
    const sortExpr = getSortExpr(sort);
    const nulls = sort.direction === "asc" ? "NULLS FIRST" : "NULLS LAST";
    parts.push(`${sortExpr} ${sort.direction.toUpperCase()} ${nulls}`);
  }

  const rowIndexDir = sorts[0]!.direction === "desc" ? "DESC" : "ASC";
  parts.push(`"Row"."rowIndex" ${rowIndexDir}`);

  return parts.join(", ");
}

/**
 * Build a lexicographic keyset cursor predicate for multi-sort pagination.
 *
 * NULL = -infinity (Airtable convention):
 *   ASC  NULLS FIRST → null is the smallest, appears first
 *   DESC NULLS LAST  → null is the smallest, sinks to end
 *
 * "After cursor" logic per dimension:
 *   ASC  NULLS FIRST, cursorVal=null:     (expr IS NOT NULL)
 *   ASC  NULLS FIRST, cursorVal=non-null: (expr > cursorVal)
 *   DESC NULLS LAST,  cursorVal=null:     skip branch (nothing after null in DESC)
 *   DESC NULLS LAST,  cursorVal=non-null: (expr < cursorVal) OR (expr IS NULL)
 *
 * rowIndex tiebreaker matches first sort direction (ASC→>, DESC→<).
 *
 * Postgres can't use an OR predicate as an Index Cond on a B-tree, so we
 * also prepend a simple range bound on the FIRST sort key as an
 * Index-Cond-friendly hint. Result: deep-offset jumps become dramatically
 * faster.
 */
export function buildMultiSortCursorSql(
  sorts: SortInput[],
  cursor: SortedCursorInput,
  params: SqlParam[],
): string {
  const rowIndexOp = sorts.length > 0 && sorts[0]!.direction === "desc" ? "<" : ">";

  const orClauses: string[] = [];

  for (let level = 0; level <= sorts.length; level++) {
    const andParts: string[] = [];

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
      const sort = sorts[level]!;
      const sortExpr = getSortExpr(sort);
      const cursorVal = cursor.sortValues[level] ?? null;

      if (cursorVal === null) {
        if (sort.direction === "asc") {
          andParts.push(`(${sortExpr} IS NOT NULL)`);
        } else {
          continue;
        }
      } else {
        if (sort.direction === "asc") {
          params.push(cursorVal);
          andParts.push(`(${sortExpr} > $${params.length})`);
        } else {
          params.push(cursorVal);
          andParts.push(`(${sortExpr} IS NULL OR ${sortExpr} < $${params.length})`);
        }
      }
    } else {
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

  const firstCursorVal = cursor.sortValues[0] ?? null;
  let indexCondHint = "";
  if (firstCursorVal !== null && sorts.length > 0) {
    const firstSort = sorts[0]!;
    const firstExpr = getSortExpr(firstSort);
    if (firstSort.direction === "asc") {
      params.push(firstCursorVal);
      indexCondHint = ` AND ${firstExpr} >= $${params.length}`;
    } else {
      params.push(firstCursorVal);
      indexCondHint = ` AND (${firstExpr} <= $${params.length} OR ${firstExpr} IS NULL)`;
    }
  }

  return `${indexCondHint} AND (\n      ${orClauses.join("\n      OR ")}\n    )`;
}

/**
 * Build the ORDER BY clause with all directions reversed (used by
 * `findEdgeMatch` "last" queries).
 *
 *   ASC NULLS FIRST → DESC NULLS LAST   (exact reverse for backward scan)
 *   DESC NULLS LAST → ASC NULLS FIRST
 */
export function buildMultiSortOrderByReversed(sorts: SortInput[]): string {
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

/**
 * Build a lexicographic keyset predicate for rows STRICTLY BEFORE the
 * cursor in the current sort order. Mirror of `buildMultiSortCursorSql`.
 */
export function buildMultiSortBeforeCursorSql(
  sorts: SortInput[],
  cursor: SortedCursorInput,
  params: SqlParam[],
): string {
  const rowIndexOp = sorts.length > 0 && sorts[0]!.direction === "desc" ? ">" : "<";

  const orClauses: string[] = [];

  for (let level = 0; level <= sorts.length; level++) {
    const andParts: string[] = [];

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
      const sort = sorts[level]!;
      const sortExpr = getSortExpr(sort);
      const cursorVal = cursor.sortValues[level] ?? null;

      if (cursorVal === null) {
        if (sort.direction === "asc") {
          continue;
        } else {
          andParts.push(`(${sortExpr} IS NOT NULL)`);
        }
      } else {
        if (sort.direction === "asc") {
          params.push(cursorVal);
          andParts.push(`(${sortExpr} IS NULL OR ${sortExpr} < $${params.length})`);
        } else {
          params.push(cursorVal);
          andParts.push(`(${sortExpr} > $${params.length})`);
        }
      }
    } else {
      params.push(cursor.rowIndex);
      andParts.push(`("Row"."rowIndex" ${rowIndexOp} $${params.length})`);
    }

    if (andParts.length > 0) {
      orClauses.push(`(${andParts.join(" AND ")})`);
    }
  }

  if (orClauses.length === 0) return " AND FALSE";

  const firstCursorVal = cursor.sortValues[0] ?? null;
  let indexCondHint = "";
  if (firstCursorVal !== null && sorts.length > 0) {
    const firstSort = sorts[0]!;
    const firstExpr = getSortExpr(firstSort);
    if (firstSort.direction === "asc") {
      params.push(firstCursorVal);
      indexCondHint = ` AND (${firstExpr} <= $${params.length} OR ${firstExpr} IS NULL)`;
    } else {
      params.push(firstCursorVal);
      indexCondHint = ` AND ${firstExpr} >= $${params.length}`;
    }
  }

  return `${indexCondHint} AND (\n      ${orClauses.join("\n      OR ")}\n    )`;
}

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

  // TEXT: empty string treated as null (matches NULLIF in SQL).
  if (typeof raw === "string") return raw === "" ? null : raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  try {
    return JSON.stringify(raw);
  } catch {
    return null;
  }
}

export function normalizeSortValuesFromCells(
  sorts: SortInput[],
  cellsUnknown: unknown,
): (string | number | null)[] {
  return sorts.map((sort) => normalizeSortValueFromCells(sort, cellsUnknown));
}

/**
 * ORDER BY for raw SQL using a custom table alias (e.g. "r" or "t" inside
 * a CTE). `applyPermanentSort` and `computeViewRanks` both need this.
 */
export function buildSortOrderByForAlias(sorts: SortInput[], alias: string): string {
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
