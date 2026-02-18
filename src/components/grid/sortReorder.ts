// Client-side sort comparison and cache reordering (mirrors server SQL ORDER BY)

export type SortDef = { columnId: string; direction: "asc" | "desc" };
export type SortReorderResult = "moved" | "evicted" | "skipped";

interface SortableRow {
  id: string;
  rowIndex: number;
  cells: unknown;
}

/** Read a cell value as a comparable string (null for empty/missing). */
function getSortValue(cells: Record<string, unknown>, columnId: string): string | null {
  const v = cells[columnId];
  if (v == null) return null;
  if (typeof v === "string") return v === "" ? null : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return typeof v === "object" ? JSON.stringify(v) : String(v as string);
}

/** Compare two cell values (nulls first for ASC, text via localeCompare, numbers via parseFloat). */
function compareSortValues(
  aRaw: string | null,
  bRaw: string | null,
  direction: "asc" | "desc",
  colType: "TEXT" | "NUMBER",
): number {
  if (aRaw == null && bRaw == null) return 0;
  if (aRaw == null) return direction === "asc" ? -1 : 1;
  if (bRaw == null) return direction === "asc" ? 1 : -1;

  let cmp: number;
  if (colType === "NUMBER") {
    const an = parseFloat(aRaw);
    const bn = parseFloat(bRaw);
    if (isNaN(an) && isNaN(bn)) return 0;
    if (isNaN(an)) return 1;
    if (isNaN(bn)) return -1;
    cmp = an - bn;
  } else {
    cmp = aRaw.localeCompare(bRaw);
  }

  return direction === "desc" ? -cmp : cmp;
}

export function asCellRecord(cells: unknown): Record<string, unknown> {
  if (!cells || typeof cells !== "object") return {};
  return cells as Record<string, unknown>;
}

/** Compare two rows by sort columns with rowIndex as stable tie-breaker. */
export function compareRows(
  aCells: Record<string, unknown>,
  bCells: Record<string, unknown>,
  aRowIndex: number,
  bRowIndex: number,
  sorts: SortDef[],
  colTypes: Map<string, "TEXT" | "NUMBER">,
): number {
  for (const sort of sorts) {
    const aVal = getSortValue(aCells, sort.columnId);
    const bVal = getSortValue(bCells, sort.columnId);
    const cmp = compareSortValues(aVal, bVal, sort.direction, colTypes.get(sort.columnId) ?? "TEXT");
    if (cmp !== 0) return cmp;
  }
  return aRowIndex - bRowIndex;
}

/** Reorder a single row within the jump cache after a cell edit.
 *  Binary-searches for the new position; returns "moved", "evicted", or "skipped". */
export function reorderRowInJumpCache<T extends SortableRow>(
  cache: ReadonlyMap<number, T>,
  rowId: string,
  sorts: SortDef[],
  colTypes: Map<string, "TEXT" | "NUMBER">,
  totalInDb: number,
): { cache: Map<number, T>; result: SortReorderResult } {
  const entries = [...cache.entries()].sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return { cache: new Map(cache), result: "skipped" };

  const rowEntryIdx = entries.findIndex(([, r]) => r.id === rowId);
  if (rowEntryIdx === -1) return { cache: new Map(cache), result: "skipped" };

  const row = entries[rowEntryIdx]![1];
  const rowCells = asCellRecord(row.cells);

  const keys = entries.map(([k]) => k);
  const firstKey = keys[0]!;
  const lastKey = keys[keys.length - 1]!;

  const others = entries.filter(([, r]) => r.id !== rowId).map(([, r]) => r);

  let lo = 0;
  let hi = others.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const other = others[mid]!;
    const cmp = compareRows(
      rowCells,
      asCellRecord(other.cells),
      row.rowIndex,
      other.rowIndex,
      sorts,
      colTypes,
    );
    if (cmp <= 0) hi = mid;
    else lo = mid + 1;
  }

  // Boundary checks (skip if row was the only entry)
  if (others.length > 0) {
    if (lo >= others.length && lastKey < totalInDb - 1) {
      const newCache = new Map<number, T>();
      others.forEach((r, i) => newCache.set(keys[i]!, r));
      return { cache: newCache, result: "evicted" };
    }

    if (lo === 0 && firstKey > 0) {
      const newCache = new Map<number, T>();
      others.forEach((r, i) => newCache.set(keys[i]!, r));
      return { cache: newCache, result: "evicted" };
    }
  }

  if (lo === rowEntryIdx) return { cache: new Map(cache), result: "moved" };

  others.splice(lo, 0, row);
  const newCache = new Map<number, T>();
  others.forEach((r, i) => newCache.set(keys[i]!, r));

  return { cache: newCache, result: "moved" };
}

interface PageShape<T> {
  items: T[];
  totalCount: number;
  [key: string]: unknown;
}

interface InfiniteShape<T> {
  pages: PageShape<T>[];
  pageParams: unknown[];
}

/** Reorder a single row within the infinite query cache after a cell edit.
 *  Returns "moved", "evicted", or "skipped". */
export function reorderRowInCache<T extends SortableRow>(
  data: InfiniteShape<T>,
  rowId: string,
  sorts: SortDef[],
  colTypes: Map<string, "TEXT" | "NUMBER">,
): { data: InfiniteShape<T>; result: SortReorderResult } {
  const pageLengths = data.pages.map((p) => p.items.length);
  const allItems: T[] = data.pages.flatMap((p) => [...p.items]);
  const totalInDb = data.pages[0]?.totalCount ?? 0;

  // Find the edited row
  const idx = allItems.findIndex((r) => r.id === rowId);
  if (idx === -1) return { data, result: "skipped" };

  const row = allItems[idx]!;
  const rowCells = asCellRecord(row.cells);

  allItems.splice(idx, 1);

  let lo = 0;
  let hi = allItems.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const other = allItems[mid]!;
    const cmp = compareRows(
      rowCells,
      asCellRecord(other.cells),
      row.rowIndex,
      other.rowIndex,
      sorts,
      colTypes,
    );
    if (cmp <= 0) hi = mid;
    else lo = mid + 1;
  }

  // Evict if row sorts beyond loaded items and more exist in DB
  if (lo >= allItems.length && allItems.length < totalInDb - 1) {
    let offset = 0;
    return {
      data: {
        ...data,
        pages: data.pages.map((page, i) => {
          const available = allItems.length - offset;
          const take = Math.min(pageLengths[i] ?? 0, Math.max(0, available));
          const items = allItems.slice(offset, offset + take);
          offset += take;
          return { ...page, items };
        }),
      },
      result: "evicted",
    };
  }

  if (lo === idx) return { data, result: "moved" };

  allItems.splice(lo, 0, row);

  let offset = 0;
  return {
    data: {
      ...data,
      pages: data.pages.map((page, i) => {
        const len = pageLengths[i] ?? page.items.length;
        const items = allItems.slice(offset, offset + len);
        offset += len;
        return { ...page, items };
      }),
    },
    result: "moved",
  };
}
