"use client";

import { useEffect, useCallback } from "react";
import type { RowItem } from "./useGridRows";

interface CellCoords {
  rowId: string;
  columnId: string;
}

interface ColumnDef {
  id: string;
  type: string;
  config?: unknown;
}

interface UseGridKeyboardArgs {
  activeCell: CellCoords | null;
  editingCell: CellCoords | null;
  visibleColumns: ColumnDef[];
  totalCount: number;
  rows: { id: string; cells: unknown }[];
  jumpCacheRef: React.RefObject<Map<number, RowItem>>;
  commitRef: React.RefObject<(args: {
    rowId: string;
    columnId: string;
    columnType: "TEXT" | "NUMBER";
    numberConfig?: unknown;
  }) => void>;
  setActiveCell: (cell: CellCoords) => void;
  startEditing: (cell: CellCoords, value: string) => void;
  clearSelection: () => void;
  getCellValue: (cells: unknown, columnId: string) => string;
  scrollCellIntoView: (colIdx: number, rowPos: number) => void;
  getRowAtIndex: (index: number) => RowItem | null | undefined;
}

export function useGridKeyboard({
  activeCell,
  editingCell,
  visibleColumns,
  totalCount,
  rows,
  jumpCacheRef,
  commitRef,
  setActiveCell,
  startEditing,
  clearSelection,
  getCellValue,
  scrollCellIntoView,
  getRowAtIndex,
}: UseGridKeyboardArgs): void {
  const findRowPosition = useCallback(
    (rowId: string): number => {
      const idx = rows.findIndex((r) => r.id === rowId);
      if (idx !== -1) return idx;
      for (const [pos, item] of jumpCacheRef.current.entries()) {
        if (item.id === rowId) return pos;
      }
      return -1;
    },
    [rows, jumpCacheRef],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeCell) return;
      if (editingCell && e.key !== "Tab") return;

      const { rowId, columnId } = activeCell;

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.key)) {
        e.preventDefault();

        if (editingCell && e.key === "Tab") {
          const col = visibleColumns.find((c) => c.id === columnId);
          if (col) {
            commitRef.current({ rowId, columnId, columnType: col.type as "TEXT" | "NUMBER", numberConfig: col.config });
          }
        }

        const rowPos = findRowPosition(rowId);
        const colIdx = visibleColumns.findIndex((c) => c.id === columnId);
        if (rowPos === -1 || colIdx === -1) return;

        let newRowPos = rowPos;
        let newColIdx = colIdx;
        const lastCol = visibleColumns.length - 1;

        switch (e.key) {
          case "ArrowUp": newRowPos = Math.max(0, rowPos - 1); break;
          case "ArrowDown": newRowPos = Math.min(totalCount - 1, rowPos + 1); break;
          case "ArrowLeft": newColIdx = Math.max(0, colIdx - 1); break;
          case "ArrowRight": newColIdx = Math.min(lastCol, colIdx + 1); break;
          case "Tab":
            if (e.shiftKey) {
              if (colIdx > 0) {
                newColIdx = colIdx - 1;
              } else if (rowPos > 0) {
                newColIdx = lastCol;
                newRowPos = rowPos - 1;
              } else {
                newColIdx = lastCol;
                newRowPos = totalCount - 1;
              }
            } else {
              if (colIdx < lastCol) {
                newColIdx = colIdx + 1;
              } else if (rowPos < totalCount - 1) {
                newColIdx = 0;
                newRowPos = rowPos + 1;
              } else {
                newColIdx = 0;
                newRowPos = 0;
              }
            }
            break;
        }

        const newRow = getRowAtIndex(newRowPos);
        const newCol = visibleColumns[newColIdx];
        if (newRow && newCol) {
          setActiveCell({ rowId: newRow.id, columnId: newCol.id });
          scrollCellIntoView(newColIdx, newRowPos);
        }
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const rowPos = findRowPosition(rowId);
        const row = rowPos !== -1 ? getRowAtIndex(rowPos) : null;
        const col = visibleColumns.find((c) => c.id === columnId);
        if (row && col) {
          const value = getCellValue(row.cells, col.id);
          startEditing({ rowId, columnId }, value);
        }
      }

      if (e.key === "Escape") {
        clearSelection();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    activeCell,
    editingCell,
    rows,
    totalCount,
    visibleColumns,
    setActiveCell,
    startEditing,
    clearSelection,
    getCellValue,
    scrollCellIntoView,
    findRowPosition,
    getRowAtIndex,
    commitRef,
  ]);
}
