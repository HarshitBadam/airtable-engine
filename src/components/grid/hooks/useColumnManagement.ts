"use client";

import { useCallback, useMemo } from "react";
import { useGridStore } from "~/components/grid/GridStore";
import { useLatestRef } from "~/hooks/useLatestRef";
import { useSortHandlers } from "~/components/grid/hooks/useSortHandlers";
import type { GridColumnDef } from "~/components/grid/ui/GridRow";

type CommitArgs = { rowId: string; columnId: string; columnType: "TEXT" | "NUMBER"; numberConfig?: unknown };

interface UseColumnManagementArgs {
  columns: GridColumnDef[];
  commit: (args: CommitArgs) => void;
  cancel: () => void;
}

export function useColumnManagement({
  columns,
  commit,
  cancel,
}: UseColumnManagementArgs) {
  const hiddenColumnIds = useGridStore((s) => s.hiddenColumnIds);
  const toggleHiddenColumn = useGridStore((s) => s.toggleHiddenColumn);
  const setHiddenColumnIds = useGridStore((s) => s.setHiddenColumnIds);
  const columnOrderIds = useGridStore((s) => s.columnOrderIds);
  const setColumnOrderIds = useGridStore((s) => s.setColumnOrderIds);
  const currentSorts = useGridStore((s) => s.sorts);
  const autoSort = useGridStore((s) => s.autoSort);

  const sortHandlers = useSortHandlers();

  // Stable refs prevent stale closures in child callbacks
  const commitRef = useLatestRef(commit);
  const stableCommit = useCallback(
    (args: { rowId: string; columnId: string; columnType: "TEXT" | "NUMBER"; numberConfig?: unknown }) =>
      commitRef.current(args),
    [],
  );
  const cancelRef = useLatestRef(cancel);
  const stableCancel = useCallback(() => cancelRef.current(), []);

  const orderedColumns = useMemo(() => {
    if (columnOrderIds.length === 0) return columns;
    const byId = new Map(columns.map((c) => [c.id, c]));
    return columnOrderIds
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => c != null);
  }, [columns, columnOrderIds]);

  const visibleColumns = useMemo(() => {
    const hiddenSet = new Set(hiddenColumnIds);
    return orderedColumns.filter((c) => !hiddenSet.has(c.id));
  }, [orderedColumns, hiddenColumnIds]);
  const visibleColumnsRef = useLatestRef(visibleColumns);

  const handleHideAllColumns = useCallback(() => {
    setHiddenColumnIds(orderedColumns.map((c) => c.id));
  }, [orderedColumns, setHiddenColumnIds]);

  const handleShowAllColumns = useCallback(() => {
    setHiddenColumnIds([]);
  }, [setHiddenColumnIds]);

  const handleReorderColumns = useCallback(
    (fromIndex: number, toIndex: number) => {
      const ids = orderedColumns.map((c) => c.id);
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, moved!);
      setColumnOrderIds(ids);
    },
    [orderedColumns, setColumnOrderIds],
  );

  return {
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
  };
}
