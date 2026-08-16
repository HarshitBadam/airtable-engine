import type { Filter, FilterTree, Sort } from "~/shared/grid";
import { buildSortedCursor, type SortedCursor } from "~/shared/sortCursor";

interface LoadedRow {
  id: string;
  rowIndex: number;
  cells: unknown;
}

interface JumpQuery {
  filters?: Filter[];
  conjunction?: "and" | "or";
  filterTree?: FilterTree;
  sorts?: Sort[];
  viewId?: string;
}

export interface WindowFetchAnchor {
  anchorOffset: number;
  cursor: SortedCursor;
}

interface BuildJumpFetchRequestArgs {
  tableId: string;
  offset: number;
  limit: number;
  allowAnchor?: boolean;
  rows: LoadedRow[];
  jumpCache: Map<number, LoadedRow>;
  protectedRowIds: Set<string>;
  query: JumpQuery;
}

function nearestAnchor(
  targetOffset: number,
  rows: LoadedRow[],
  jumpCache: Map<number, LoadedRow>,
  protectedRowIds: Set<string>,
  sorts: Sort[] | undefined,
): WindowFetchAnchor | undefined {
  if (targetOffset <= 0) return undefined;

  let anchorIndex = -1;
  let anchorRow: LoadedRow | undefined;
  const pageIndex = Math.min(targetOffset - 1, rows.length - 1);

  if (pageIndex >= 0) {
    const candidate = rows[pageIndex];
    if (candidate && !protectedRowIds.has(candidate.id)) {
      anchorIndex = pageIndex;
      anchorRow = candidate;
    }
  }

  for (const [index, row] of jumpCache) {
    if (
      index < targetOffset &&
      index > anchorIndex &&
      !protectedRowIds.has(row.id)
    ) {
      anchorIndex = index;
      anchorRow = row;
    }
  }

  if (!anchorRow) return undefined;

  return {
    anchorOffset: anchorIndex + 1,
    cursor: sorts?.length
      ? buildSortedCursor(sorts, anchorRow)
      : { rowIndex: anchorRow.rowIndex, sortValues: [] },
  };
}

export function buildJumpFetchRequest({
  tableId,
  offset,
  limit,
  allowAnchor = true,
  rows,
  jumpCache,
  protectedRowIds,
  query,
}: BuildJumpFetchRequestArgs) {
  const filters =
    !query.filterTree && query.filters?.length ? query.filters : undefined;
  const sorts = query.sorts?.length ? query.sorts : undefined;
  const canAnchor =
    allowAnchor && Boolean(sorts ?? filters ?? query.filterTree);

  return {
    tableId,
    offset,
    limit,
    filters,
    conjunction: filters ? query.conjunction : undefined,
    filterTree: query.filterTree,
    sorts,
    viewId: query.viewId,
    anchor: canAnchor
      ? nearestAnchor(offset, rows, jumpCache, protectedRowIds, sorts)
      : undefined,
  };
}
