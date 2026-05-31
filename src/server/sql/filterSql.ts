import type {
  Filter as FilterInput,
  FilterTree,
  FilterTreeCondition,
  FilterTreeItem,
} from "~/shared/grid";
import { escapeLikePattern, escapeLiteral, type SqlParam } from "./escape";

/**
 * Build filter SQL using literal JSONB keys (cells->>'<colId>') so Postgres
 * can use the expression indexes created by `ensureSortIndex`.
 *
 * Caller must validate that all `columnId`s belong to the target table
 * before calling. Values remain parameterised.
 */
export function buildFilterSql(
  filters: FilterInput[],
  params: SqlParam[],
  conjunction: "and" | "or" = "and",
): string {
  const clauses: string[] = [];

  for (const f of filters) {
    const colId = escapeLiteral(f.columnId);
    // NULLIF(cells->>'colId','') so Postgres can match the expression B-tree
    // index from ensureSortIndex (Index Scan instead of Seq Scan for
    // equality, empty, and range filters on TEXT columns).
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _exhaustive: never = f;
        break;
      }
    }
  }

  const joiner = conjunction === "or" ? " OR " : " AND ";
  return clauses.length ? ` AND (${clauses.join(joiner)})` : "";
}

function buildConditionClause(
  cond: FilterTreeCondition,
  params: SqlParam[],
): string | null {
  const colId = escapeLiteral(cond.columnId);
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

function buildFilterTreeItemSql(
  item: FilterTreeItem,
  params: SqlParam[],
): string | null {
  if (item.kind === "condition") {
    return buildConditionClause(item, params);
  }

  const clauses: string[] = [];

  for (const child of item.items) {
    const clause = buildFilterTreeItemSql(child, params);
    if (clause) clauses.push(clause);
  }

  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0]!;

  const joiner = item.conjunction === "or" ? " OR " : " AND ";
  return `(${clauses.join(joiner)})`;
}

/**
 * Build SQL WHERE fragment for a complete filter tree.
 * Returns either a leading-AND clause (` AND (...)`) or empty string.
 */
export function buildFilterTreeSql(tree: FilterTree, params: SqlParam[]): string {
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
 * Returns `{ colId, values }` when the pattern matches, null otherwise.
 */
export function detectOrEqualsPattern(
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

export function extractColumnIds(tree: FilterTree): string[] {
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

export function filterTreeHasConditions(tree: FilterTree): boolean {
  const check = (items: FilterTreeItem[]): boolean => {
    for (const item of items) {
      if (item.kind === "condition") return true;
      if (check(item.items)) return true;
    }
    return false;
  };
  return check(tree.items);
}
