"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { InfiniteData } from "@tanstack/react-query";
import type { inferProcedureOutput } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";
import { api } from "~/trpc/react";
import { useGridStore, useGridStoreApi } from "~/components/grid/GridStore";
import { useLatestRef } from "~/hooks/useLatestRef";
import { countOccurrences } from "~/components/grid/utils/countOccurrences";
import type { GridScrollController } from "~/components/grid/hooks/layout/useGridVirtualizer";
import type { RowItem, RowInfiniteInput } from "../useGridRows";

type RowInfinitePage = inferProcedureOutput<AppRouter["row"]["infinite"]>;
type RowInfiniteCursor = RowInfinitePage["nextCursor"];
type RowInfiniteData = InfiniteData<RowInfinitePage, RowInfiniteCursor>;

interface ColumnRef {
  id: string;
}

interface UseRowMutationsArgs {
  tableId: string;
  isValidTable: boolean;
  rowQueryInput: RowInfiniteInput;
  totalCount: number | null | undefined;
  scroll: GridScrollController;
  visibleColumnsRef: React.RefObject<ColumnRef[]>;
  rowsRef: React.RefObject<RowItem[]>;
  addToJumpCache: (pos: number, row: RowItem) => void;
  insertIntoJumpCache: (rowId: string, newRow: RowItem, position: "above" | "below") => void;
  clearJumpCache: () => void;
  removeFromJumpCache: (rowId: string) => void;
  addProtectedRowId: (rowId: string) => void;
  getRowById: (rowId: string) => RowItem | undefined | null;
  getRowAtIndex: (index: number) => RowItem | undefined | null;
  refreshRows: (delta?: number) => void;
}

export interface UseRowMutationsResult {
  handleAddRow: () => void;
  handleAddBulkRows: (populate?: boolean) => void;
  handleInsertAt: (rowId: string, position: "above" | "below") => void;
  handleInsertRecordAbove: (rowId: string) => void;
  handleInsertRecordBelow: (rowId: string) => void;
  handleDuplicateRecord: (rowId: string) => void;
  handleDeleteRecord: (rowId: string) => void;
  handleReorderRow: (rowId: string, fromVisualIdx: number, toVisualIdx: number) => void;
  isBulkAdding: boolean;
  canDragRows: boolean;
}

export function useRowMutations(args: UseRowMutationsArgs): UseRowMutationsResult {
  const {
    tableId,
    isValidTable,
    rowQueryInput,
    totalCount,
    scroll,
    visibleColumnsRef,
    rowsRef,
    addToJumpCache,
    insertIntoJumpCache,
    clearJumpCache,
    removeFromJumpCache,
    addProtectedRowId,
    getRowById,
    getRowAtIndex,
    refreshRows,
  } = args;

  const utils = api.useUtils();
  const gridStoreApi = useGridStoreApi();

  const activeCell = useGridStore((s) => s.activeCell);
  const clearSelection = useGridStore((s) => s.clearSelection);
  const setActiveCell = useGridStore((s) => s.setActiveCell);
  const startEditing = useGridStore((s) => s.startEditing);
  const addFindCountDelta = useGridStore((s) => s.addFindCountDelta);
  const rowOrderIds = useGridStore((s) => s.rowOrderIds);
  const setRowOrderIdsTop = useGridStore((s) => s.setRowOrderIds);

  const autoSort = useGridStore((s) => s.autoSort);
  const sorts = useGridStore((s) => s.sorts);
  const filters = useGridStore((s) => s.filters);

  const rowOrderIdsRef = useLatestRef(rowOrderIds);

  const [deletingRowIds, setDeletingRowIds] = useState<Set<string>>(new Set());
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const newRowTargetIndexRef = useRef<number | null>(null);

  const hasTemporarySorts = autoSort && sorts.length > 0;
  const canDragRows = !hasTemporarySorts && filters.length === 0;

  const addRowMut = api.row.addMany.useMutation();

  const duplicateRowMut = api.row.duplicateAt.useMutation({
    onSuccess: (data, vars) => {
      const currentOrder = rowOrderIdsRef.current;
      if (currentOrder.length > 0) {
        const sourceIdx = currentOrder.indexOf(vars.rowId);
        if (sourceIdx !== -1) {
          const order = [...currentOrder];
          order.splice(sourceIdx + 1, 0, data.id);
          setRowOrderIdsTop(order);
        }
      }

      const term = gridStoreApi.getState().search.trim();
      if (term) {
        const sourceRow = getRowById(vars.rowId);
        if (sourceRow) {
          const cells = (sourceRow.cells ?? {}) as Record<string, unknown>;
          let delta = 0;
          for (const val of Object.values(cells)) {
            if (typeof val === "string" || typeof val === "number") delta += countOccurrences(String(val), term);
          }
          if (delta > 0) addFindCountDelta(delta);
        }
      }

      refreshRows(1);
    },
  });

  const deleteRowMut = api.row.delete.useMutation({
    onSuccess: (_data, vars) => {
      removeFromJumpCache(vars.rowId);
      setDeletingRowIds((prev) => {
        const next = new Set(prev);
        next.delete(vars.rowId);
        return next;
      });
    },
    onError: (_e, vars) => {
      setDeletingRowIds((prev) => {
        const next = new Set(prev);
        next.delete(vars.rowId);
        return next;
      });
      refreshRows();
    },
  });

  const reorderMut = api.row.reorder.useMutation({
    onSuccess: () => {
      refreshRows();
    },
  });

  const insertAtMut = api.row.insertAt.useMutation();

  const handleAddRow = useCallback(() => {
    if (!isValidTable) return;
    insertAtMut.mutate({ tableId, atIndex: 0, position: "end" }, {
      onSuccess: (newRow) => {
        const cachedData = utils.row.infinite.getInfiniteData(rowQueryInput);
        const currentTotal = cachedData?.pages?.[0]?.totalCount ?? totalCount;

        addToJumpCache(currentTotal!, newRow as RowItem);

        utils.row.infinite.setInfiniteData(rowQueryInput, (old) => {
          if (!old?.pages?.length) return old;
          return {
            ...old,
            pages: old.pages.map((page, i) =>
              i === 0 ? { ...page, totalCount: page.totalCount + 1 } : page,
            ),
          };
        });

        addProtectedRowId(newRow.id);

        const store = gridStoreApi.getState();
        const hasActiveSorts = (store.autoSort && store.sorts.length > 0) || store.permanentSorts.length > 0;
        const hasActiveFilters = store.filters.length > 0 || !!store.filterTree;
        if (!hasActiveSorts && !hasActiveFilters) {
          void utils.row.infinite.invalidate();
        }

        requestAnimationFrame(() => {
          scroll.setOffset(scroll.getMaxScroll());
        });

        const firstCol = visibleColumnsRef.current[0];
        if (firstCol) {
          requestAnimationFrame(() => {
            setActiveCell({ rowId: newRow.id, columnId: firstCol.id });
            startEditing({ rowId: newRow.id, columnId: firstCol.id }, '');
          });
        }
      },
      onError: (err) => {
        console.error("[handleAddRow] insertAt failed:", err.message);
      },
    });
  }, [isValidTable, tableId, insertAtMut, utils, rowQueryInput, totalCount, addToJumpCache, addProtectedRowId, setActiveCell, startEditing, gridStoreApi, scroll, visibleColumnsRef]);

  const handleAddBulkRows = useCallback((populate = true) => {
    if (!isValidTable || isBulkAdding) return;
    setIsBulkAdding(true);
    addRowMut.mutate({ tableId, count: 100_000, populate }, {
      onSuccess: (data) => {
        clearJumpCache();
        refreshRows(data.count);
        setIsBulkAdding(false);
      },
      onError: () => {
        setIsBulkAdding(false);
      },
    });
  }, [isValidTable, isBulkAdding, tableId, addRowMut, refreshRows, clearJumpCache]);

  useEffect(() => {
    if (newRowTargetIndexRef.current === null) return;
    const rows = rowsRef.current;
    if (rows.length === 0) return;
    const firstCol = visibleColumnsRef.current[0];
    if (!firstCol) return;

    const targetIdx = newRowTargetIndexRef.current;
    const newRow = (rows as Array<{ id: string; rowIndex: number; cells: unknown }>).find(
      (r) => r.rowIndex === targetIdx,
    );
    if (!newRow) return;

    newRowTargetIndexRef.current = null;

    scroll.setOffset(scroll.getMaxScroll());
    requestAnimationFrame(() => {
      setActiveCell({ rowId: newRow.id, columnId: firstCol.id });
      startEditing({ rowId: newRow.id, columnId: firstCol.id }, '');
    });
  });

  const handleInsertAt = useCallback((rowId: string, position: "above" | "below") => {
    if (!isValidTable) return;
    const targetRow = getRowById(rowId);
    if (!targetRow) return;

    insertAtMut.mutate({ tableId, atIndex: targetRow.rowIndex, position }, {
      onSuccess: (newRow) => {
        const isTargetInPages = rowsRef.current.some(
          (r) => r.id === rowId,
        );

        if (isTargetInPages) {
          utils.row.infinite.setInfiniteData(rowQueryInput, (old): RowInfiniteData | undefined => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page, pageIdx) => {
                const itemIdx = page.items.findIndex((r) => r.id === rowId);
                if (itemIdx >= 0) {
                  const insertIdx = position === "above" ? itemIdx : itemIdx + 1;
                  const newItems = [...page.items];
                  newItems.splice(insertIdx, 0, newRow as (typeof newItems)[number]);
                  return {
                    ...page,
                    items: newItems,
                    totalCount: pageIdx === 0 ? page.totalCount + 1 : page.totalCount,
                  };
                }
                return pageIdx === 0
                  ? { ...page, totalCount: page.totalCount + 1 }
                  : page;
              }),
            };
          });
        } else {
          insertIntoJumpCache(rowId, newRow as RowItem, position);
          utils.row.infinite.setInfiniteData(rowQueryInput, (old): RowInfiniteData | undefined => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page, i) =>
                i === 0 ? { ...page, totalCount: page.totalCount + 1 } : page,
              ),
            };
          });
        }

        addProtectedRowId(newRow.id);

        const firstCol = visibleColumnsRef.current[0];
        if (firstCol) {
          requestAnimationFrame(() => {
            setActiveCell({ rowId: newRow.id, columnId: firstCol.id });
            startEditing({ rowId: newRow.id, columnId: firstCol.id }, '');
          });
        }
      },
    });
  }, [isValidTable, tableId, insertAtMut, setActiveCell, startEditing, getRowById, utils, rowQueryInput, insertIntoJumpCache, addProtectedRowId, rowsRef, visibleColumnsRef]);

  const handleInsertRecordAbove = useCallback(
    (rowId: string) => handleInsertAt(rowId, "above"),
    [handleInsertAt],
  );

  const handleInsertRecordBelow = useCallback(
    (rowId: string) => handleInsertAt(rowId, "below"),
    [handleInsertAt],
  );

  const handleDuplicateRecord = useCallback((rowId: string) => {
    if (!isValidTable) return;
    duplicateRowMut.mutate({ tableId, rowId });
  }, [isValidTable, tableId, duplicateRowMut]);

  const handleDeleteRecord = useCallback((rowId: string) => {
    if (!isValidTable) return;
    if (deletingRowIds.has(rowId)) return;
    if (activeCell?.rowId === rowId) clearSelection();

    const term = gridStoreApi.getState().search.trim();
    if (term) {
      const row = getRowById(rowId);
      if (row) {
        const cells = (row.cells ?? {}) as Record<string, unknown>;
        let delta = 0;
        for (const val of Object.values(cells)) {
          if (typeof val === "string" || typeof val === "number") delta += countOccurrences(String(val), term);
        }
        if (delta > 0) addFindCountDelta(-delta);
      }
    }

    setDeletingRowIds((prev) => new Set(prev).add(rowId));

    const currentOrder = rowOrderIdsRef.current;
    if (currentOrder.length > 0 && currentOrder.includes(rowId)) {
      setRowOrderIdsTop(currentOrder.filter((id) => id !== rowId));
    }

    const isInInfinitePages = rowsRef.current.some(
      (r) => r.id === rowId,
    );
    utils.row.infinite.setInfiniteData(rowQueryInput, (old): RowInfiniteData | undefined => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page, i) => ({
          ...page,
          items: isInInfinitePages
            ? page.items.filter((r) => r.id !== rowId)
            : page.items,
          totalCount: i === 0 ? Math.max(0, page.totalCount - 1) : page.totalCount,
        })),
      };
    });

    if (!isInInfinitePages) {
      removeFromJumpCache(rowId);
    }

    deleteRowMut.mutate({ tableId, rowId });
  }, [isValidTable, tableId, activeCell, clearSelection, deletingRowIds, deleteRowMut, utils, rowQueryInput, setRowOrderIdsTop, rowsRef, rowOrderIdsRef, getRowById, addFindCountDelta, gridStoreApi, removeFromJumpCache]);

  const handleReorderRow = useCallback(
    (rowId: string, fromVisualIdx: number, toVisualIdx: number) => {
      if (fromVisualIdx === toVisualIdx) return;
      if (!isValidTable) return;

      const sourceRow = getRowById(rowId);
      const targetRow = getRowAtIndex(toVisualIdx);

      if (!sourceRow || !targetRow) return;

      reorderMut.mutate({
        tableId,
        rowId,
        fromIndex: sourceRow.rowIndex,
        toIndex: targetRow.rowIndex,
      });
    },
    [isValidTable, tableId, getRowById, getRowAtIndex, reorderMut],
  );

  return {
    handleAddRow,
    handleAddBulkRows,
    handleInsertAt,
    handleInsertRecordAbove,
    handleInsertRecordBelow,
    handleDuplicateRecord,
    handleDeleteRecord,
    handleReorderRow,
    isBulkAdding,
    canDragRows,
  };
}
