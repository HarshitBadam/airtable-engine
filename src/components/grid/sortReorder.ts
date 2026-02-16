/**
 * Pure sort comparison and cache reordering logic.
 *
 * This module mirrors the server's SQL ORDER BY behaviour client-side,
 * enabling instant optimistic row repositioning after cell edits on
 * sorted columns — no server round-trip needed.
 *
 * All functions are pure (no React, no side effects, no cache access).
 * They operate on plain data and return new data.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortDef = { columnId: string; direction: "asc" | "desc" };
export type SortReorderResult = "moved" | "evicted" | "skipped";

/** Minimal row shape needed for sort comparison. */
interface SortableRow {
  id: string;
  rowIndex: number;
  cells: unknown;
}

// ---------------------------------------------------------------------------
// Sort comparison (mirrors server SQL ORDER BY)
// ---------------------------------------------------------------------------

/** Read a cell value as a comparable string (null for empty/missing). */
function getSortValue(cells: Record<string, unknown>, columnId: string): string | null {
  const v = cells[columnId];
  if (v == null) return null;
  if (typeof v === "string") return v === "" ? null : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  // Fallback for object / unknown — stringify to avoid [object Object]
  return typeof v === "object" ? JSON.stringify(v) : String(v as string);
}

/**
 * Compare two cell values for sorting.
 *  - NULLS LAST (null/empty → after everything)
 *  - TEXT  → case-sensitive lexicographic (localeCompare)
 *  - NUMBER → numeric comparison via parseFloat
 */
function compareSortValues(
  aRaw: string | null,
  bRaw: string | null,
  direction: "asc" | "desc",
  colType: "TEXT" | "NUMBER",
): number {
  if (aRaw == null && bRaw == null) return 0;
  if (aRaw == null) return 1;
  if (bRaw == null) return -1;

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

/** Safe cast of the opaque `cells` blob to a record. */
export function asCellRecord(cells: unknown): Record<string, unknown> {
  if (!cells || typeof cells !== "object") return {};
  return cells as Record<string, unknown>;
}

/**
 * Compare two rows by the active sort columns + stable tie-breaker.
 * Returns < 0 if a comes before b, > 0 if after, 0 if equal.
 */
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
  return aRowIndex - bRowIndex; // stable tie-breaker
}

// ---------------------------------------------------------------------------
// Cache reordering (pure — operates on data, returns new data)
// ---------------------------------------------------------------------------

interface PageShape<T> {
  items: T[];
  totalCount: number;
  [key: string]: unknown;
}

interface InfiniteShape<T> {
  pages: PageShape<T>[];
  pageParams: unknown[];
}

/**
 * Reorder a single row within the infinite query cache after a cell edit.
 *
 * Three possible outcomes:
 *  - **moved**:   row found a valid position within loaded pages.
 *  - **evicted**: row sorts beyond all loaded items; removed from pages
 *                 (it now lives in the unloaded region of the dataset).
 *  - **skipped**: row not found in loaded pages (e.g. jump-cache only).
 *
 * @returns The (possibly modified) data and the outcome.
 */
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

  // Remove from current position
  allItems.splice(idx, 1);

  // Binary-search for the correct insertion point
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

  // ── Boundary check ──
  // If the row sorts beyond all loaded items AND there are more unloaded
  // rows in the DB, we can't determine the exact position.  Evict the row
  // from the pages — it belongs somewhere in the unloaded region.
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

  // Position unchanged — return original data
  if (lo === idx) return { data, result: "moved" };

  // Insert at the new position
  allItems.splice(lo, 0, row);

  // Re-chunk into the original page structure
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
