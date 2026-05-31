import { useRef, useEffect, useCallback } from "react";
import { useLatestRef } from "~/hooks/useLatestRef";
import { api } from "~/trpc/react";
import { useGridStore } from "~/components/grid/GridStore";
import type { RowHeightPreset } from "~/shared/grid";

interface UseViewConfigSaveProps {
  tableId: string;
  utils: ReturnType<typeof api.useUtils>;
  clearJumpCache: () => void;
  refreshRows: (rowCountDelta?: number) => void;
  isCreatingColumnRef: React.MutableRefObject<boolean>;
}

export function useViewConfigSave({
  tableId,
  utils,
  clearJumpCache,
  refreshRows,
  isCreatingColumnRef,
}: UseViewConfigSaveProps) {
  const autoSort = useGridStore((s) => s.autoSort);
  const setAutoSort = useGridStore((s) => s.setAutoSort);
  const currentSorts = useGridStore((s) => s.sorts);
  const setSorts = useGridStore((s) => s.setSorts);
  const permanentSorts = useGridStore((s) => s.permanentSorts);
  const setPermanentSorts = useGridStore((s) => s.setPermanentSorts);
  const setRanksComputing = useGridStore((s) => s.setRanksComputing);
  const markSortsSaved = useGridStore((s) => s.markSortsSaved);
  const markSaved = useGridStore((s) => s.markSaved);
  const filtersForSave = useGridStore((s) => s.filters);
  const filterConjunctionForSave = useGridStore((s) => s.filterConjunction);
  const filterTreeForSave = useGridStore((s) => s.filterTree);
  const markFiltersSaved = useGridStore((s) => s.markFiltersSaved);
  const hiddenColumnIds = useGridStore((s) => s.hiddenColumnIds);
  const columnOrderIds = useGridStore((s) => s.columnOrderIds);
  const rowOrderIdsForSave = useGridStore((s) => s.rowOrderIds);
  const rowHeightPreset = useGridStore((s) => s.rowHeightPreset);
  const wrapHeaders = useGridStore((s) => s.wrapHeaders);
  const activeViewIdFromStore = useGridStore((s) => s.activeViewId);

  const effectiveSortCount = autoSort ? currentSorts.length : 0;
  const hasTemporarySorts = autoSort && currentSorts.length > 0;

  const sortSaveMut = api.view.update.useMutation({
    onSuccess: () => {
      markSaved();
      void utils.view.list.invalidate({ tableId });
    },
  });

  const handleToggleAutoSort = useCallback(() => {
    const newAutoSort = !autoSort;
    setAutoSort(newAutoSort);

    if (activeViewIdFromStore) {
      sortSaveMut.mutate({
        viewId: activeViewIdFromStore,
        config: {
          search: "",
          filters: filtersForSave,
          filterConjunction: filterConjunctionForSave,
          filterTree: filterTreeForSave,
          sorts: newAutoSort ? currentSorts : [],
          permanentSorts,
          autoSort: newAutoSort,
          hiddenColumnIds,
          columnOrderIds,
          rowOrderIds: rowOrderIdsForSave,
        },
      });
    }
  }, [autoSort, setAutoSort, activeViewIdFromStore, sortSaveMut, filtersForSave, filterConjunctionForSave, filterTreeForSave, currentSorts, permanentSorts, hiddenColumnIds, columnOrderIds, rowOrderIdsForSave]);

  const computeRanksMut = api.row.computeViewRanks.useMutation({
    onSuccess: () => {
      setRanksComputing(false);
      refreshRows();
    },
    onError: () => {
      setRanksComputing(false);
    },
  });

  // "Sort" button (autoSort=false):
  // 1. Set permanentSorts IMMEDIATELY → query uses Tier 3 (live ORDER BY) → user sees sorted data in <1s
  // 2. Fire computeViewRanks in background → when done, query auto-upgrades to Tier 2
  // 3. While computing, viewId is suppressed (ranksComputing=true) to avoid racing with the INSERT
  const handleSaveSorts = useCallback(() => {
    if (!activeViewIdFromStore || currentSorts.length === 0) return;

    setPermanentSorts(currentSorts);
    setRanksComputing(true);
    clearJumpCache();

    computeRanksMut.mutate({
      tableId,
      viewId: activeViewIdFromStore,
      sorts: currentSorts,
    });

    sortSaveMut.mutate({
      viewId: activeViewIdFromStore,
      config: {
        search: "",
        filters: filtersForSave,
        filterConjunction: filterConjunctionForSave,
        filterTree: filterTreeForSave,
        sorts: [],
        permanentSorts: currentSorts,
        autoSort: false,
        hiddenColumnIds,
        columnOrderIds,
        rowOrderIds: rowOrderIdsForSave,
      },
    });
  }, [activeViewIdFromStore, currentSorts, tableId, filtersForSave, filterConjunctionForSave, filterTreeForSave, hiddenColumnIds, columnOrderIds, rowOrderIdsForSave, setRanksComputing, computeRanksMut, sortSaveMut, setPermanentSorts, clearJumpCache]);

  const handleCancelSorts = useCallback(() => {
    setSorts(permanentSorts);
  }, [setSorts, permanentSorts]);

  const layoutAutoSaveMut = api.view.update.useMutation({
    onSuccess: () => {
      markSaved();
      void utils.view.list.invalidate({ tableId });
    },
  });

  const sortsForConfig = autoSort ? currentSorts : [];
  const latestConfig = {
    search: "",
    filters: filtersForSave,
    filterConjunction: filterConjunctionForSave,
    filterTree: filterTreeForSave,
    sorts: sortsForConfig,
    permanentSorts,
    autoSort,
    hiddenColumnIds,
    columnOrderIds,
    rowOrderIds: rowOrderIdsForSave,
    rowHeightPreset,
    wrapHeaders,
  };
  const latestConfigRef = useLatestRef(latestConfig);

  const layoutBaselineRef = useRef<string>("");
  const layoutTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!activeViewIdFromStore) return;

    const layoutKey = `${activeViewIdFromStore}|${columnOrderIds.join(",")}|${hiddenColumnIds.join(",")}|${rowOrderIdsForSave.join(",")}`;

    if (!layoutBaselineRef.current.startsWith(activeViewIdFromStore + "|")) {
      layoutBaselineRef.current = layoutKey;
      return;
    }

    if (layoutKey === layoutBaselineRef.current) return;

    clearTimeout(layoutTimerRef.current);
    layoutTimerRef.current = setTimeout(() => {
      if (!activeViewIdFromStore) return;
      if (isCreatingColumnRef.current) return;
      layoutBaselineRef.current = layoutKey;
      layoutAutoSaveMut.mutate({
        viewId: activeViewIdFromStore,
        config: latestConfigRef.current,
      });
    }, 400);

    return () => clearTimeout(layoutTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnOrderIds, hiddenColumnIds, rowOrderIdsForSave, activeViewIdFromStore]);

  const rowHeightAutoSaveMut = api.view.update.useMutation({
    onSuccess: () => {
      void utils.view.list.invalidate({ tableId });
    },
  });
  const rhBaselineRef = useRef<string>("");
  useEffect(() => {
    if (!activeViewIdFromStore) return;
    const key = `${activeViewIdFromStore}|${rowHeightPreset}|${wrapHeaders}`;
    if (!rhBaselineRef.current.startsWith(activeViewIdFromStore + "|")) {
      rhBaselineRef.current = key;
      return;
    }
    if (key === rhBaselineRef.current) return;
    rhBaselineRef.current = key;
    rowHeightAutoSaveMut.mutate({
      viewId: activeViewIdFromStore,
      config: latestConfigRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowHeightPreset, wrapHeaders, activeViewIdFromStore]);

  const filterAutoSaveMut = api.view.update.useMutation({
    onSuccess: () => {
      markFiltersSaved();
      void utils.view.list.invalidate({ tableId });
    },
  });

  const filterBaselineRef = useRef<string>("");
  const filterTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const filterKey = `${activeViewIdFromStore}|${JSON.stringify(filtersForSave)}|${filterConjunctionForSave}|${JSON.stringify(filterTreeForSave)}`;

  useEffect(() => {
    if (!activeViewIdFromStore) return;

    if (!filterBaselineRef.current.startsWith(activeViewIdFromStore + "|")) {
      filterBaselineRef.current = filterKey;
      return;
    }

    if (filterKey === filterBaselineRef.current) return;

    clearTimeout(filterTimerRef.current);
    filterTimerRef.current = setTimeout(() => {
      if (!activeViewIdFromStore) return;
      filterBaselineRef.current = filterKey;
      filterAutoSaveMut.mutate({
        viewId: activeViewIdFromStore,
        config: latestConfigRef.current,
      });
    }, 600);

    return () => clearTimeout(filterTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, activeViewIdFromStore]);

  const sortAutoSaveMut = api.view.update.useMutation({
    onSuccess: () => {
      markSortsSaved();
      void utils.view.list.invalidate({ tableId });
    },
  });

  const sortBaselineRef = useRef<string>("");
  const sortTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const sortKey = `${activeViewIdFromStore}|${autoSort}|${JSON.stringify(currentSorts)}`;

  useEffect(() => {
    if (!activeViewIdFromStore) return;

    // autoSort=false → sorts are staged, never auto-saved. Just track baseline.
    if (!autoSort) {
      sortBaselineRef.current = sortKey;
      return;
    }

    if (!sortBaselineRef.current.startsWith(activeViewIdFromStore + "|")) {
      sortBaselineRef.current = sortKey;
      return;
    }

    if (sortKey === sortBaselineRef.current) return;

    clearTimeout(sortTimerRef.current);
    sortTimerRef.current = setTimeout(() => {
      if (!activeViewIdFromStore) return;
      sortBaselineRef.current = sortKey;
      sortAutoSaveMut.mutate({
        viewId: activeViewIdFromStore,
        config: latestConfigRef.current,
      });
    }, 400);

    return () => clearTimeout(sortTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, activeViewIdFromStore, autoSort]);

  return {
    handleToggleAutoSort,
    handleSaveSorts,
    handleCancelSorts,
    effectiveSortCount,
    hasTemporarySorts,
  };
}
