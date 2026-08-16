import type { Sort } from "./grid";

export type SortedCursor = {
  rowIndex: number;
  sortValues: (string | number | null)[];
};

function normalizeSortValue(
  sort: Sort,
  cellsUnknown: unknown,
): string | number | null {
  const cells = (cellsUnknown ?? {}) as Record<string, unknown>;
  const raw = cells[sort.columnId];

  if (raw == null) return null;

  if (sort.type === "NUMBER") {
    const value = typeof raw === "number" ? raw : Number(raw);
    return Number.isNaN(value) ? null : value;
  }

  if (typeof raw === "string") return raw === "" ? null : raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);

  try {
    return JSON.stringify(raw);
  } catch {
    return null;
  }
}

export function buildSortedCursor(
  sorts: Sort[],
  row: { rowIndex: number; cells: unknown },
): SortedCursor {
  return {
    rowIndex: row.rowIndex,
    sortValues: sorts.map((sort) => normalizeSortValue(sort, row.cells)),
  };
}
