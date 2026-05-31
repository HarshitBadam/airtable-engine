import type { Filter, FilterTree, Sort } from "~/shared/grid";
import { escapeLikePattern, type SqlParam } from "~/server/sql/escape";
import { buildFilterSql, buildFilterTreeSql } from "~/server/sql/filterSql";
import { normalizeSortValuesFromCells } from "~/server/sql/sortSql";
import {
  validateAndResolveFilters,
  validateAndResolveSorts,
} from "./columnResolution";

export type RowSelect = {
  id: string;
  rowIndex: number;
  cells: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type CountRow = { count: number };

export type SortedNextCursor = {
  rowIndex: number;
  sortValues: (string | number | null)[];
};

/**
 * Mutates `params` in-place (appends bound parameters) and returns the SQL
 * fragment starting with `WHERE`. Callers may append further predicates.
 */
export function buildBaseWhere(
  tableId: string,
  search: string | undefined,
  useTree: boolean | undefined | null,
  filterTree: FilterTree | undefined,
  filters: Filter[],
  conjunction: "and" | "or",
  params: SqlParam[],
): string {
  params.push(tableId);
  let whereSql = `WHERE "Row"."tableId" = $${params.length}`;

  if (search && search.length > 0) {
    const escaped = escapeLikePattern(search);
    params.push(`%${escaped}%`);
    whereSql += ` AND "Row"."searchText" ILIKE $${params.length} ESCAPE '\\'`;
  }

  if (useTree && filterTree) {
    whereSql += buildFilterTreeSql(filterTree, params);
  } else {
    whereSql += buildFilterSql(filters, params, conjunction);
  }

  return whereSql;
}

export function buildCountSql(
  tableId: string,
  search: string | undefined,
  useTree: boolean | undefined | null,
  filterTree: FilterTree | undefined,
  filters: Filter[],
  conjunction: "and" | "or",
): { countSql: string; countParams: SqlParam[] } {
  const countParams: SqlParam[] = [];
  const countWhere = buildBaseWhere(
    tableId,
    search,
    useTree,
    filterTree,
    filters,
    conjunction,
    countParams,
  );
  return {
    countSql: `SELECT COUNT(*)::int AS count FROM "Row" ${countWhere}`,
    countParams,
  };
}

export async function validateSortsAndFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  sorts: Sort[],
  filters: Filter[],
  filterTree: FilterTree | undefined,
  useTree: boolean,
  tableId: string,
): Promise<Sort[]> {
  sorts = await validateAndResolveSorts(db, sorts, tableId, true);
  await validateAndResolveFilters(db, filters, filterTree, useTree, tableId);
  return sorts;
}

export function buildNextCursor(
  sorts: Sort[],
  last: RowSelect,
): number | SortedNextCursor {
  if (sorts.length === 0) {
    return last.rowIndex;
  }
  return {
    rowIndex: last.rowIndex,
    sortValues: normalizeSortValuesFromCells(sorts, last.cells),
  };
}
