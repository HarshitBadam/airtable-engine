"use client";

import { useEffect } from "react";
import type { RowItem } from "./useGridRows";

interface CellCoords {
  rowId: string;
  columnId: string;
}

interface ColumnDef {
  id: string;
}

interface UseCellOverlaySyncArgs {
  hScrollRef: React.RefObject<HTMLDivElement | null>;
  updateSelectionOverlay: () => void;
  activeCell: CellCoords | null;
  editingCell: CellCoords | null;
  columnWidths: Record<string, number>;
  frozenColCount: number;
  visibleColumns: ColumnDef[];
  rows: { id: string; cells: unknown }[];
  totalCount: number;
  jumpCacheRef: React.RefObject<Map<number, RowItem>>;
  getRowAtIndex: (index: number) => RowItem | null | undefined;
  setActiveCell: (cell: CellCoords) => void;
  clearSelection: () => void;
}

/**
 * Three effects that keep the selection overlay and active cell in sync:
 *
 * 1. Re-positions the overlay on horizontal scroll (hScrollbar events).
 * 2. Re-positions the overlay when the active cell, visible columns, column
 *    widths, or freeze config change.
 * 3. Recovers from a stale active cell — when the row the selection is on
 *    disappears (filtered out, deleted), moves the selection to the last
 *    visible row so the blue box doesn't sit on the empty "add row" slab.
 */
export function useCellOverlaySync({
  hScrollRef,
  updateSelectionOverlay,
  activeCell,
  editingCell,
  columnWidths,
  frozenColCount,
  visibleColumns,
  rows,
  totalCount,
  jumpCacheRef,
  getRowAtIndex,
  setActiveCell,
  clearSelection,
}: UseCellOverlaySyncArgs): void {
  // Overlay is inside the scroll content, so it scrolls naturally with both
  // vertical and horizontal movement. The hScroll listener is still needed to
  // update frozen-column offsets and the clip-path for non-frozen cells.
  useEffect(() => {
    const hScroll = hScrollRef.current;
    const onHScroll = () => updateSelectionOverlay();
    hScroll?.addEventListener("scroll", onHScroll, { passive: true });
    return () => { hScroll?.removeEventListener("scroll", onHScroll); };
  }, [hScrollRef, updateSelectionOverlay]);

  useEffect(() => {
    updateSelectionOverlay();
  }, [activeCell, editingCell, columnWidths, frozenColCount, visibleColumns, rows, updateSelectionOverlay]);

  // When the active cell's row disappears (e.g. filtered out after editing a
  // filter column, or deleted by another tab), move the selection to the last
  // visible row. Without this the blue box sits on the empty "add row" slab.
  useEffect(() => {
    if (!activeCell) return;

    if (rows.some((r) => r.id === activeCell.rowId)) return;

    // Check jump cache — but only entries at valid positions (< totalCount).
    // After a filter-out, the row may still be in the jump cache at a stale
    // position that is now >= totalCount. Those entries are out-of-range and
    // should NOT prevent recovery.
    for (const [pos, item] of jumpCacheRef.current.entries()) {
      if (item.id === activeCell.rowId && pos < totalCount) return;
    }

    if (totalCount > 0) {
      const lastIdx = totalCount - 1;
      const lastRow = getRowAtIndex(lastIdx);
      if (lastRow) {
        setActiveCell({ rowId: lastRow.id, columnId: activeCell.columnId });
        return;
      }
    }
    clearSelection();
  }, [activeCell, rows, totalCount, getRowAtIndex, setActiveCell, clearSelection, jumpCacheRef]);
}
