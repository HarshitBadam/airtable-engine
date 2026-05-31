import { ensureSortIndex } from "~/server/db/ensureColumnIndexes";
import type {
  Filter as FilterInput,
  FilterTree,
  FilterTreeItem,
  Sort as SortInput,
} from "~/shared/grid";
import { extractColumnIds } from "~/server/sql/filterSql";

const MAX_SOURCE_CHAIN_DEPTH = 10;

type ColumnRow = { id: string; type?: string; sourceColumnId: string | null };

// Walk `column.sourceColumnId` up the duplication chain to the column that
// owns actual cell data. Cached so repeated visits are free.
async function resolveSourceColumnChain(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  startId: string,
  tableId: string,
  chainCache: Map<string, string | null>,
): Promise<string> {
  let id = startId;
  for (let depth = 0; depth < MAX_SOURCE_CHAIN_DEPTH; depth++) {
    let srcId = chainCache.get(id);
    if (srcId === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const row = (await db.column.findFirst({
        where: { id, tableId },
        select: { sourceColumnId: true },
      })) as { sourceColumnId: string | null } | null;
      srcId = row?.sourceColumnId ?? null;
      chainCache.set(id, srcId);
    }
    if (!srcId) return id;
    id = srcId;
  }
  return id;
}

/**
 * Validate sort columns and resolve unbackfilled duplicates.
 *
 * 1. Every sort column must belong to `tableId` and the client-supplied
 *    type must match the DB type.
 * 2. If a column still has `sourceColumnId` set (the background backfill
 *    hasn't copied cell data yet), the sort is redirected to the source
 *    column — values are identical and the source column already has an
 *    index. This lets field duplication appear instant while the backfill
 *    runs asynchronously.
 * 3. When `buildIndexes` is true, sort indexes are ensured for every
 *    resolved column (fast-path <1ms when already present).
 *
 * Returns a *new* sorts array with possibly redirected columnIds.
 */
export async function validateAndResolveSorts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  sorts: SortInput[],
  tableId: string,
  buildIndexes: boolean,
): Promise<SortInput[]> {
  if (sorts.length === 0) return sorts;

  const uniqueColIds = [...new Set(sorts.map((s) => s.columnId))];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const cols = (await db.column.findMany({
    where: { id: { in: uniqueColIds }, tableId },
    select: { id: true, type: true, sourceColumnId: true },
  })) as ColumnRow[];

  const colMap = new Map(cols.map((c) => [c.id, c]));

  for (const sort of sorts) {
    const col = colMap.get(sort.columnId);
    if (!col) throw new Error("Invalid sort column");
    if (col.type !== sort.type) throw new Error("Sort type mismatch");
  }

  const hasRedirects = cols.some((c) => c.sourceColumnId);
  let resolved = sorts;
  if (hasRedirects) {
    const chainCache = new Map<string, string | null>(
      cols.map((c) => [c.id, c.sourceColumnId]),
    );

    resolved = await Promise.all(
      sorts.map(async (sort) => {
        const col = colMap.get(sort.columnId)!;
        if (!col.sourceColumnId) return sort;
        const resolvedId = await resolveSourceColumnChain(db, sort.columnId, tableId, chainCache);
        return resolvedId !== sort.columnId
          ? { ...sort, columnId: resolvedId }
          : sort;
      }),
    );
  }

  if (buildIndexes) {
    const resolvedColIds = [...new Set(resolved.map((s) => s.columnId))];

    const needsFetch = hasRedirects && resolvedColIds.some((id) => !colMap.has(id));
    const indexCols = needsFetch
      ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        ((await db.column.findMany({
          where: { id: { in: resolvedColIds }, tableId },
          select: { id: true, type: true },
        })) as { id: string; type: string }[])
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

/**
 * Validate and resolve filter columns, mirroring `validateAndResolveSorts`.
 *
 * Mutates `filters` and `filterTree` IN-PLACE (columnId swaps) so the
 * caller's `buildFilterSql` / `buildFilterTreeSql` calls use the resolved
 * IDs. Returns true when any redirects were applied.
 */
export async function validateAndResolveFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  filters: FilterInput[],
  filterTree: FilterTree | undefined,
  useTree: boolean,
  tableId: string,
): Promise<boolean> {
  const colIdsToValidate: string[] =
    useTree && filterTree
      ? extractColumnIds(filterTree)
      : filters.map((f) => f.columnId);
  const uniqueColIds = [...new Set(colIdsToValidate)];

  if (uniqueColIds.length === 0) return false;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const cols = (await db.column.findMany({
    where: { id: { in: uniqueColIds }, tableId },
    select: { id: true, sourceColumnId: true },
  })) as ColumnRow[];

  if (cols.length !== uniqueColIds.length) {
    throw new Error("Invalid filter column");
  }

  const hasRedirects = cols.some((c) => c.sourceColumnId);
  if (!hasRedirects) return false;

  const chainCache = new Map<string, string | null>(
    cols.map((c) => [c.id, c.sourceColumnId]),
  );

  const redirectMap = new Map<string, string>();
  for (const c of cols) {
    if (c.sourceColumnId) {
      redirectMap.set(c.id, await resolveSourceColumnChain(db, c.id, tableId, chainCache));
    }
  }

  for (const f of filters) {
    const redirect = redirectMap.get(f.columnId);
    if (redirect) (f as { columnId: string }).columnId = redirect;
  }

  if (useTree && filterTree) {
    const walkAndRedirect = (items: FilterTreeItem[]) => {
      for (const item of items) {
        if (item.kind === "condition") {
          const redirect = redirectMap.get(item.columnId);
          if (redirect) (item as { columnId: string }).columnId = redirect;
        } else {
          walkAndRedirect(item.items);
        }
      }
    };
    walkAndRedirect(filterTree.items);
  }

  return true;
}
