import { useCallback } from "react";
import type React from "react";
import type { GridColumnDef } from "~/components/grid/ui/GridRow";
import type { RowItem } from "./useGridRows";

const ROW_NUM_WIDTH = 83;
const DEFAULT_COLUMN_WIDTH = 180;

type CellRef = { rowId: string; columnId: string };

interface UseGridCellOverlayProps {
  selectionOverlayRef: React.RefObject<HTMLDivElement | null>;
  hScrollRef: React.RefObject<HTMLDivElement | null>;
  gridScrollerRef: React.RefObject<HTMLDivElement | null>;
  visibleColumnsRef: React.MutableRefObject<GridColumnDef[]>;
  rowsRef: React.MutableRefObject<{ id: string; cells: unknown }[]>;
  frozenColumnCountRef: React.MutableRefObject<number>;
  freezeWidthRef: React.MutableRefObject<number>;
  columnWidthsRef: React.MutableRefObject<Record<string, number>>;
  dataRowHeightRef: React.MutableRefObject<number>;
  mapToVirtualIndexRef: React.MutableRefObject<(n: number) => number>;
  jumpCacheRef: React.MutableRefObject<Map<number, RowItem>>;
  activeCellRef: React.MutableRefObject<CellRef | null>;
  editingCellRef: React.MutableRefObject<CellRef | null>;
}

export function useGridCellOverlay({
  selectionOverlayRef,
  hScrollRef,
  gridScrollerRef,
  visibleColumnsRef,
  rowsRef,
  frozenColumnCountRef,
  freezeWidthRef,
  columnWidthsRef,
  dataRowHeightRef,
  mapToVirtualIndexRef,
  jumpCacheRef,
  activeCellRef,
  editingCellRef,
}: UseGridCellOverlayProps) {
  // The overlay lives inside gridContentScrollerInner so it scrolls with the
  // rows at compositor speed (no JS-driven repositioning on scroll). Both
  // vertical and horizontal scroll are handled by the compositor. Only frozen
  // columns (position:sticky) need a JS correction on horizontal scroll, and
  // a clip-path is applied to prevent non-frozen overlays from painting over
  // the frozen area.
  const updateSelectionOverlay = useCallback(() => {
    const overlay = selectionOverlayRef.current;
    if (!overlay) return;

    const targetCell = editingCellRef.current ?? activeCellRef.current;
    if (!targetCell) {
      overlay.style.display = "none";
      return;
    }

    const cols = visibleColumnsRef.current;
    const rws = rowsRef.current;
    const frozenCount = frozenColumnCountRef.current;

    const colIdx = cols.findIndex((c) => c.id === targetCell.columnId);
    let rowIdx = rws.findIndex((r) => r.id === targetCell.rowId);
    if (rowIdx === -1) {
      for (const [pos, item] of jumpCacheRef.current.entries()) {
        if (item.id === targetCell.rowId) { rowIdx = pos; break; }
      }
    }
    if (colIdx === -1 || rowIdx === -1) {
      overlay.style.display = "none";
      return;
    }

    const hScroll = hScrollRef.current;
    const scrollLeft = hScroll?.scrollLeft ?? 0;
    const widths = columnWidthsRef.current;
    const colWidth = widths[targetCell.columnId] ?? DEFAULT_COLUMN_WIDTH;
    const isFrozen = colIdx < frozenCount;

    let cellX = ROW_NUM_WIDTH;
    for (let i = 0; i < colIdx; i++) {
      cellX += widths[cols[i]!.id] ?? DEFAULT_COLUMN_WIDTH;
    }
    if (isFrozen) cellX += scrollLeft;

    const drh = dataRowHeightRef.current;
    const virtualRowIdxForOverlay = mapToVirtualIndexRef.current(rowIdx);
    const cellY = virtualRowIdxForOverlay * drh;

    const handle = overlay.firstElementChild as HTMLElement | null;

    overlay.style.display = "block";

    let overlayTop: number;
    let overlayHeight: number;
    let overlayLeft: number;
    let overlayWidth: number;

    if (editingCellRef.current) {
      if (handle) handle.style.display = "none";
      overlay.style.borderWidth = "3px";
      overlayTop = cellY - 3;
      overlayLeft = cellX - 3;
      overlayWidth = colWidth + 6;
      overlayHeight = drh + 6;
    } else {
      if (handle) handle.style.display = "";
      overlay.style.borderWidth = "2px";
      overlayTop = cellY - 2;
      overlayLeft = cellX - 1;
      overlayWidth = colWidth + 2;
      overlayHeight = drh + 3;
    }

    overlay.style.transform = `translate(${overlayLeft}px, ${overlayTop}px)`;
    overlay.style.width = `${overlayWidth}px`;
    overlay.style.height = `${overlayHeight}px`;

    // Clip the overlay at the freeze bar for non-frozen cells so it doesn't
    // paint over the frozen columns when scrolled partially behind them.
    if (!isFrozen && frozenCount > 0) {
      const fw = freezeWidthRef.current;
      const freezeEdgeContent = scrollLeft + fw;
      const clipLeft = freezeEdgeContent - overlayLeft;
      if (clipLeft >= overlayWidth) {
        overlay.style.display = "none";
      } else if (clipLeft > 0) {
        overlay.style.clipPath = `inset(-6px -6px -6px ${clipLeft}px)`;
      } else {
        overlay.style.clipPath = "";
      }
    } else {
      overlay.style.clipPath = "";
    }
  }, [selectionOverlayRef, hScrollRef, visibleColumnsRef, rowsRef, frozenColumnCountRef, freezeWidthRef, columnWidthsRef, dataRowHeightRef, mapToVirtualIndexRef, jumpCacheRef, activeCellRef, editingCellRef]);

  const scrollCellIntoView = useCallback((colIdx: number, rowIdx: number) => {
    const scroller = gridScrollerRef.current;
    const hScroll = hScrollRef.current;
    if (!scroller) return;

    const cols = visibleColumnsRef.current;
    const widths = columnWidthsRef.current;
    const frozenCount = frozenColumnCountRef.current;
    const fw = freezeWidthRef.current;

    const drhScroll = dataRowHeightRef.current;
    const virtualRowIdx = mapToVirtualIndexRef.current(rowIdx);
    const cellTop = virtualRowIdx * drhScroll;
    const cellBottom = cellTop + drhScroll;
    if (cellTop < scroller.scrollTop) {
      scroller.scrollTop = cellTop;
    } else if (cellBottom > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = cellBottom - scroller.clientHeight;
    }

    if (colIdx >= frozenCount && hScroll) {
      let contentX = ROW_NUM_WIDTH;
      for (let i = 0; i < colIdx; i++) {
        contentX += widths[cols[i]!.id] ?? DEFAULT_COLUMN_WIDTH;
      }
      const colWidth = widths[cols[colIdx]!.id] ?? DEFAULT_COLUMN_WIDTH;
      const contentRight = contentX + colWidth;

      const viewLeft = hScroll.scrollLeft + fw;
      const viewRight = hScroll.scrollLeft + scroller.clientWidth;

      if (contentX < viewLeft) {
        hScroll.scrollLeft = contentX - fw;
      } else if (contentRight > viewRight) {
        hScroll.scrollLeft = contentRight - scroller.clientWidth;
      }
    }
  }, [gridScrollerRef, hScrollRef, visibleColumnsRef, columnWidthsRef, frozenColumnCountRef, freezeWidthRef, dataRowHeightRef, mapToVirtualIndexRef]);

  return { updateSelectionOverlay, scrollCellIntoView };
}
