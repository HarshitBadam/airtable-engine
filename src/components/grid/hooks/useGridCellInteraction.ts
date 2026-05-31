"use client";

import type React from "react";
import { useLatestRef } from "~/hooks/useLatestRef";
import { useGridStore } from "~/components/grid/GridStore";
import { useGridCellOverlay } from "~/components/grid/hooks/useGridCellOverlay";
import { useFindInView } from "~/components/grid/hooks/search/useFindInView";
import { useGridKeyboard } from "~/components/grid/hooks/useGridKeyboard";
import { useCellOverlaySync } from "~/components/grid/hooks/useCellOverlaySync";
import type { GridColumnDef } from "~/components/grid/ui/GridRow";
import type { RowItem, RowInfiniteInput } from "~/components/grid/hooks/useGridRows";

type CellCoords = { rowId: string; columnId: string };

type CommitArgs = {
  rowId: string;
  columnId: string;
  columnType: "TEXT" | "NUMBER";
  numberConfig?: unknown;
};

interface UseGridCellInteractionArgs {
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
  tableId: string;
  activeSearchTerm: string;
  visibleColumns: GridColumnDef[];
  rows: { id: string; cells: unknown }[];
  jumpCache: ReadonlyMap<number, RowItem>;
  totalCount: number;
  displayMatchCount: number;
  rowQueryInput: RowInfiniteInput;
  getRowAtIndex: (index: number) => RowItem | null | undefined;
  triggerJumpFetch: (offset: number, force?: boolean) => void;
  columnWidths: Record<string, number>;
  frozenColCount: number;
  commitRef: React.MutableRefObject<(args: CommitArgs) => void>;
  getCellValue: (cells: unknown, columnId: string) => string;
}

/**
 * Sub-orchestrator for all cell-selection interaction: the selection overlay,
 * find-in-view navigation, keyboard shortcuts, and overlay synchronisation.
 * Extracted from useGridWorkspace to keep the interaction concern self-contained.
 */
export function useGridCellInteraction({
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
  tableId,
  activeSearchTerm,
  visibleColumns,
  rows,
  jumpCache,
  totalCount,
  displayMatchCount,
  rowQueryInput,
  getRowAtIndex,
  triggerJumpFetch,
  columnWidths,
  frozenColCount,
  commitRef,
  getCellValue,
}: UseGridCellInteractionArgs) {
  const activeCell = useGridStore((s) => s.activeCell);
  const editingCell = useGridStore((s) => s.editingCell);
  const setActiveCell = useGridStore((s) => s.setActiveCell);
  const startEditing = useGridStore((s) => s.startEditing);
  const clearSelection = useGridStore((s) => s.clearSelection);

  const activeCellRef = useLatestRef<CellCoords | null>(activeCell);
  const editingCellRef = useLatestRef<CellCoords | null>(editingCell);

  const { updateSelectionOverlay, scrollCellIntoView } = useGridCellOverlay({
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
  });

  const { handleNextMatch, handlePrevMatch, currentMatchIdx } = useFindInView({
    tableId,
    activeSearchTerm,
    visibleColumns,
    rows,
    jumpCache,
    totalCount,
    displayMatchCount,
    rowQueryInput,
    getRowAtIndex,
    triggerJumpFetch,
    scrollCellIntoView,
  });

  useGridKeyboard({
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
  });

  useCellOverlaySync({
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
  });

  return { handleNextMatch, handlePrevMatch, currentMatchIdx };
}
