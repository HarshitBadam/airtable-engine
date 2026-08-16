import type { Filter, FilterTree, Sort } from "~/shared/grid";
import { escapeLiteral, type SqlParam } from "~/server/sql/escape";
import { detectOrEqualsPattern } from "~/server/sql/filterSql";
import {
  buildMultiSortCursorSql,
  buildMultiSortOrderBy,
  type SortedCursorInput,
} from "~/server/sql/sortSql";
import { buildBaseWhere } from "./rowQueryHelpers";

interface BuildWindowFetchSqlArgs {
  tableId: string;
  offset: number;
  limit: number;
  search: string | undefined;
  useTree: boolean | undefined;
  filterTree: FilterTree | undefined;
  filters: Filter[];
  conjunction: "and" | "or";
  sorts: Sort[];
  anchor:
    | {
        anchorOffset: number;
        cursor: SortedCursorInput;
      }
    | undefined;
}

interface WindowFetchSql {
  sql: string;
  params: SqlParam[];
  disableBitmapScan: boolean;
}

export function buildWindowFetchSql({
  tableId,
  offset,
  limit,
  search,
  useTree,
  filterTree,
  filters,
  conjunction,
  sorts,
  anchor,
}: BuildWindowFetchSqlArgs): WindowFetchSql {
  const params: SqlParam[] = [];
  let whereSql = buildBaseWhere(
    tableId,
    search,
    useTree,
    filterTree,
    filters,
    conjunction,
    params,
  );
  let effectiveOffset = offset;
  let anchorRowIndexParam: number | null = null;

  if (anchor && anchor.anchorOffset <= offset) {
    if (sorts.length > 0 && anchor.cursor.sortValues.length === sorts.length) {
      whereSql += buildMultiSortCursorSql(sorts, anchor.cursor, params);
      effectiveOffset = offset - anchor.anchorOffset;
    } else if (sorts.length === 0) {
      params.push(anchor.cursor.rowIndex);
      anchorRowIndexParam = params.length;
      whereSql += ` AND "Row"."rowIndex" > $${params.length}`;
      effectiveOffset = offset - anchor.anchorOffset;
    }
  }

  const orderBySql = buildMultiSortOrderBy(sorts);
  params.push(limit);
  const limitParam = params.length;
  params.push(effectiveOffset);
  const offsetParam = params.length;
  const orEquals =
    !search && sorts.length === 0
      ? detectOrEqualsPattern(
          filterTree,
          filters,
          conjunction,
          Boolean(useTree),
        )
      : null;

  if (!orEquals) {
    return {
      sql: `
        SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
        FROM (
          SELECT "Row"."id"
          FROM "Row"
          ${whereSql}
          ORDER BY ${orderBySql}
          LIMIT $${limitParam} OFFSET $${offsetParam}
        ) sub
        JOIN "Row" r ON r."id" = sub."id"
        ORDER BY ${orderBySql.replace(/"Row"\./g, "r.")}
      `,
      params,
      disableBitmapScan: false,
    };
  }

  const columnExpression = `(NULLIF("Row"."cells" ->> '${escapeLiteral(orEquals.colId)}', ''))`;
  const anchorClause = anchorRowIndexParam
    ? ` AND "Row"."rowIndex" > $${anchorRowIndexParam}`
    : "";
  params.push(effectiveOffset + limit);
  const branchLimitParam = params.length;
  const branches = orEquals.values.map((value) => {
    params.push(value);
    return `(SELECT "Row"."id", "Row"."rowIndex" FROM "Row" WHERE "Row"."tableId" = $1 AND ${columnExpression} = $${params.length}${anchorClause} ORDER BY "Row"."rowIndex" ASC LIMIT $${branchLimitParam})`;
  });

  return {
    sql: `
      SELECT r."id", r."rowIndex", r."cells", r."createdAt", r."updatedAt"
      FROM (
        SELECT "id" FROM (
          ${branches.join("\n          UNION ALL\n          ")}
        ) u
        ORDER BY u."rowIndex" ASC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      ) sub
      JOIN "Row" r ON r."id" = sub."id"
      ORDER BY r."rowIndex" ASC
    `,
    params,
    disableBitmapScan: true,
  };
}
