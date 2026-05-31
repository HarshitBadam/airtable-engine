"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useLatestRef } from "~/hooks/useLatestRef";
import { useRouter } from "next/navigation";
import { skipToken } from "@tanstack/react-query";
import { api } from "~/trpc/react";
import { useGridRows } from "~/components/grid/hooks/useGridRows";
import type { RowItem } from "~/components/grid/hooks/useGridRows";
import { useCellEditing } from "~/components/grid/hooks/useCellEditing";
import { useGridStore } from "~/components/grid/GridStore";
import { useGridTable } from "~/components/grid/hooks/useGridTable";
import { useRowMutations } from "~/components/grid/hooks/useRowMutations";
import { useColumnMutations } from "~/components/grid/hooks/useColumnMutations";
import { useTableManagement } from "~/components/grid/hooks/useTableManagement";
import { useViewManagement } from "~/components/grid/hooks/useViewManagement";
import { useViewConfigSave } from "~/components/grid/hooks/useViewConfigSave";
import { useFreezeDrag } from "~/components/grid/hooks/useFreezeDrag";
import { useResizeHandlers } from "~/components/grid/hooks/useResizeHandlers";
import { useRowRefresh } from "~/components/grid/hooks/useRowRefresh";
import { useScrollSync } from "~/components/grid/hooks/useScrollSync";
import { useInfiniteScroll } from "~/components/grid/hooks/useInfiniteScroll";
import { useViewScrollPersistence } from "~/components/grid/hooks/useViewScrollPersistence";
import { useSearchMatchCount } from "~/components/grid/hooks/useSearchMatchCount";
import { getCellValue as getCellValueUtil } from "~/components/grid/utils/getCellValue";
import { useColumnManagement } from "~/components/grid/hooks/useColumnManagement";
import { useGridVirtualizer } from "~/components/grid/hooks/useGridVirtualizer";
import { useFreezeLayout } from "~/components/grid/hooks/useFreezeLayout";
import { useGridBaseInfo } from "~/components/grid/hooks/useGridBaseInfo";
import { useGridCellInteraction } from "~/components/grid/hooks/useGridCellInteraction";

import type { GridColumnDef } from "../ui/GridRow";
import type { GridBarHandle } from "../ui/GridBar";
import type { GridWorkspaceState } from "../ui/GridWorkspaceContext";

const COLUMN_WIDTH = 180;

const ROW_HEIGHT_VALUES: Record<string, number> = {
  short: 32,
  medium: 56,
  tall: 88,
  extraTall: 128,
};

export function useGridWorkspace({
  baseId,
  tableId,
}: {
  baseId: string;
  tableId: string;
}): GridWorkspaceState {
  const router = useRouter();
  const utils = api.useUtils();

  useEffect(() => {
    localStorage.setItem(`base-lastTable-${baseId}`, tableId);
  }, [baseId, tableId]);

  const tableManagement = useTableManagement({ baseId, tableId, router, utils });

  const [frozenColCount, setFrozenColCount] = useState(1);
  const gridFooterRef = useRef<HTMLDivElement>(null);
  const gridBodyRef = useRef<HTMLDivElement>(null);
  const freezePillRef = useRef<HTMLDivElement>(null);
  const freezeTooltipRef = useRef<HTMLDivElement>(null);
  const freezeLineRef = useRef<HTMLDivElement>(null);
  const gridScrollerRef = useRef<HTMLDivElement>(null);
  const scrollShadowRef = useRef<HTMLDivElement>(null);
  const scrollableHeaderRef = useRef<HTMLDivElement>(null);
  const hScrollRef = useRef<HTMLDivElement>(null);
  const freezeSnapPreviewRef = useRef<HTMLDivElement>(null);
  const selectionOverlayRef = useRef<HTMLDivElement>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const columnWidthsRef = useLatestRef<Record<string, number>>(columnWidths);
  const getColWidth = useCallback(
    (colId: string) => columnWidths[colId] ?? COLUMN_WIDTH,
    [columnWidths],
  );

  const [rowHeight, setRowHeight] = useState(32);
  const rowHeightRef = useLatestRef(rowHeight);

  const rowHeightPreset = useGridStore((s) => s.rowHeightPreset);
  const setRowHeightPreset = useGridStore((s) => s.setRowHeightPreset);
  const dataRowHeight = ROW_HEIGHT_VALUES[rowHeightPreset] ?? 32;
  const dataRowHeightRef = useLatestRef<number>(dataRowHeight);

  const wrapHeaders = useGridStore((s) => s.wrapHeaders);
  const setWrapHeaders = useGridStore((s) => s.setWrapHeaders);

  const gridBarRef = useRef<GridBarHandle>(null);

  const { baseColor, baseBorderColor, baseTextColor, baseName } = useGridBaseInfo({
    baseId,
    tables: tableManagement.tables,
    activeTableId: tableManagement.activeTableId,
  });

  const isValidTable = tableId !== "default";
  const colsQ = api.column.list.useQuery(
    isValidTable ? { tableId } : skipToken,
    { staleTime: 60_000 },
  );
  const columns = colsQ.data ?? [];
  const columnsRef = useLatestRef<GridColumnDef[]>(columns);

  const {
    rows, totalCount, q: rowsQ, input: rowQueryInput, debouncedSearch,
    getRowAtIndex, getRowById, triggerJumpFetch, clearJumpCache, updateJumpCacheRow,
    addToJumpCache, insertIntoJumpCache, removeFromJumpCache, reorderJumpCacheRow,
    addProtectedRowId, removeProtectedRowId, isRowProtected, jumpCacheRef, jumpCache,
  } = useGridRows(tableId);
  const rowsRef = useLatestRef(rows);

  const { refreshRows, handleCellMembershipChange, handleCellValueChange } =
    useRowRefresh({
      rowQueryInput,
      triggerJumpFetch,
      reorderJumpCacheRow,
      removeProtectedRowId,
      isRowProtected,
      gridScrollerRef,
      dataRowHeightRef,
      columnsRef,
      rowsRef,
    });

  const { commit, cancel } = useCellEditing(
    tableId,
    rowQueryInput,
    updateJumpCacheRow,
    getRowById,
    handleCellMembershipChange,
    handleCellValueChange,
  );

  const { displayMatchCount, isSearchPending, search } = useSearchMatchCount({
    tableId,
    debouncedSearch,
    rowQueryInput,
  });

  const {
    orderedColumns,
    visibleColumns,
    visibleColumnsRef,
    hiddenColumnIds,
    toggleHiddenColumn,
    handleHideAllColumns,
    handleShowAllColumns,
    handleReorderColumns,
    currentSorts,
    sortHandlers,
    autoSort,
    stableCommit,
    stableCancel,
    commitRef,
  } = useColumnManagement({ columns, commit, cancel });

  useGridTable(columns, rows as RowItem[]);

  const activeSearchTerm = debouncedSearch.trim();
  const activeViewIdFromStore = useGridStore((s) => s.activeViewId);

  useViewScrollPersistence({
    activeViewId: activeViewIdFromStore,
    gridScrollerRef,
    rowQueryInput,
    clearJumpCache,
  });

  const getCellValue = useCallback(
    (cells: unknown, columnId: string): string =>
      getCellValueUtil(cells, columnId, orderedColumns),
    [orderedColumns],
  );

  const {
    snapPositions,
    frozenColumnCountRef,
    freezeWidth,
    freezeWidthRef,
    frozenColumns,
    scrollableColumns,
    scrollableColumnsWidth,
  } = useFreezeLayout({
    frozenColCount,
    visibleColumns,
    columnWidths,
    defaultColWidth: COLUMN_WIDTH,
  });

  const { virtualItems, mapToActualIndex, totalVirtualSize, mapToVirtualIndexRef } =
    useGridVirtualizer({
      totalCount,
      dataRowHeight,
      gridScrollerRef,
    });

  const { handleNextMatch, handlePrevMatch, currentMatchIdx } = useGridCellInteraction({
    // refs
    selectionOverlayRef, hScrollRef, gridScrollerRef, visibleColumnsRef, rowsRef,
    frozenColumnCountRef, freezeWidthRef, columnWidthsRef, dataRowHeightRef,
    mapToVirtualIndexRef, jumpCacheRef,
    // data
    tableId, activeSearchTerm, visibleColumns, rows, jumpCache,
    totalCount, displayMatchCount, rowQueryInput, getRowAtIndex,
    triggerJumpFetch, columnWidths, frozenColCount,
    // callbacks
    commitRef, getCellValue,
  });

  const { handleFreezeDragStart, handleFreezeLineMouseMove } =
    useFreezeDrag({
      gridBodyRef,
      freezePillRef,
      freezeTooltipRef,
      freezeLineRef,
      freezeSnapPreviewRef,
      freezeWidth,
      frozenColCount,
      snapPositions,
      setFrozenColCount,
    });

  const { handleResizeStart, handleRowHeightResizeStart } = useResizeHandlers({
    columnWidthsRef,
    rowHeightRef,
    defaultColWidth: COLUMN_WIDTH,
    setColumnWidths,
    setRowHeight,
  });

  useScrollSync({
    gridScrollerRef,
    scrollableHeaderRef,
    scrollShadowRef,
    hScrollRef,
  });

  useInfiniteScroll({
    virtualItems,
    rows,
    rowsQ,
    totalCount,
    triggerJumpFetch,
    getRowAtIndex,
    mapToActualIndex,
  });

  const viewManagement = useViewManagement({
    tableId,
    isValidTable,
    columns,
    utils,
  });

  const rowMutations = useRowMutations({
    tableId,
    isValidTable,
    rowQueryInput,
    totalCount: totalCount ?? null,
    gridScrollerRef,
    visibleColumnsRef,
    rowsRef: rowsRef as React.RefObject<RowItem[]>,
    addToJumpCache,
    insertIntoJumpCache,
    clearJumpCache,
    removeFromJumpCache,
    addProtectedRowId,
    getRowById,
    getRowAtIndex,
    refreshRows,
  });

  const columnMutations = useColumnMutations({
    tableId,
    isValidTable,
    activeViewIdFromStore,
    orderedColumns,
    refreshRows,
    gridBarRef,
  });

  const viewConfigSave = useViewConfigSave({
    tableId,
    utils,
    clearJumpCache,
    refreshRows,
    isCreatingColumnRef: columnMutations.isCreatingColumnRef,
  });

  const navigateToTable = useCallback(
    (id: string) => router.push(`/bases/${baseId}/tables/${id}`),
    [router, baseId],
  );

  return {
    baseId,
    baseColor,
    baseBorderColor,
    baseTextColor,
    baseName,

    ...tableManagement,

    ...viewManagement,

    orderedColumns,
    visibleColumns,
    hiddenColumnIds,
    toggleHiddenColumn,
    handleHideAllColumns,
    handleShowAllColumns,
    handleReorderColumns,
    currentSorts,
    sortHandlers,
    autoSort,
    ...viewConfigSave,

    gridBarRef,
    gridFooterRef,
    gridBodyRef,
    scrollableHeaderRef,
    gridScrollerRef,
    hScrollRef,
    scrollShadowRef,
    freezeSnapPreviewRef,
    freezeLineRef,
    freezePillRef,
    freezeTooltipRef,
    selectionOverlayRef,

    freezeWidth,
    rowHeight,
    scrollableColumnsWidth,
    frozenColumns,
    scrollableColumns,
    getColWidth,

    rows,
    virtualItems,
    totalVirtualSize,
    totalCount,
    dataRowHeight,
    mapToActualIndex,
    getRowAtIndex,

    getCellValue,
    stableCommit,
    stableCancel,

    handleResizeStart,
    handleRowHeightResizeStart,
    handleFreezeDragStart,
    handleFreezeLineMouseMove,

    ...rowMutations,
    ...columnMutations,

    search,
    activeSearchTerm,
    displayMatchCount,
    currentMatchIdx,
    isSearchPending,
    handleNextMatch,
    handlePrevMatch,

    rowHeightPreset,
    setRowHeightPreset,
    wrapHeaders,
    setWrapHeaders,

    navigateToTable,
  };
}
