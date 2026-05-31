"use client";

import { useState, useRef, useCallback } from "react";
import { api } from "~/trpc/react";
import { useGridStore } from "~/components/grid/GridStore";
import { useLatestRef } from "~/hooks/useLatestRef";
import type { NumberFormatConfig } from "~/shared/numberUtils";
import type { GridBarHandle } from "~/components/grid/ui/GridBar";

interface ColumnDef {
  id: string;
  name: string;
  type: string;
  defaultValue?: string | null;
  config?: unknown;
  sourceColumnId?: string | null;
}

interface UseColumnMutationsArgs {
  tableId: string;
  isValidTable: boolean;
  activeViewIdFromStore: string | null | undefined;
  orderedColumns: readonly ColumnDef[];
  refreshRows: (delta?: number) => void;
  gridBarRef: React.RefObject<GridBarHandle | null>;
}

export interface UseColumnMutationsResult {
  handleDeleteField: (columnId: string) => void;
  handleCreateField: (name: string, type: string, defaultValue: string, numberConfig?: NumberFormatConfig, insertPosition?: { anchorColId: string; side: "left" | "right" }) => void;
  handleEditFieldSave: (columnId: string, name: string, numberConfig?: NumberFormatConfig) => void;
  handleHideField: (columnId: string) => void;
  handleFilterByField: (columnId: string) => void;
  handleSortByField: (columnId: string, direction: "asc" | "desc") => void;
  handleDuplicateField: (columnId: string, duplicateCells: boolean) => void;
  backfillingColumnIds: ReadonlySet<string>;
  isCreatingColumnRef: React.MutableRefObject<boolean>;
}

export function useColumnMutations(args: UseColumnMutationsArgs): UseColumnMutationsResult {
  const { tableId, isValidTable, activeViewIdFromStore, orderedColumns, refreshRows, gridBarRef } = args;

  const utils = api.useUtils();

  const activeCell = useGridStore((s) => s.activeCell);
  const clearSelection = useGridStore((s) => s.clearSelection);
  const setActiveCell = useGridStore((s) => s.setActiveCell);
  const columnOrderIds = useGridStore((s) => s.columnOrderIds);
  const setColumnOrderIds = useGridStore((s) => s.setColumnOrderIds);
  const hiddenColumnIds = useGridStore((s) => s.hiddenColumnIds);
  const setHiddenColumnIds = useGridStore((s) => s.setHiddenColumnIds);
  const currentSorts = useGridStore((s) => s.sorts);
  const setSorts = useGridStore((s) => s.setSorts);
  const filtersForSave = useGridStore((s) => s.filters);
  const setFilters = useGridStore((s) => s.setFilters);
  const filterTreeForSave = useGridStore((s) => s.filterTree);
  const setFilterTree = useGridStore((s) => s.setFilterTree);
  const filterConditions = useGridStore((s) => s.filterConditions);
  const setFilterConditions = useGridStore((s) => s.setFilterConditions);
  const toggleHiddenColumn = useGridStore((s) => s.toggleHiddenColumn);

  const columnOrderIdsRef = useLatestRef(columnOrderIds);
  const hiddenColumnIdsRef = useLatestRef(hiddenColumnIds);
  const currentSortsRef = useLatestRef(currentSorts);
  const filtersRef = useLatestRef(filtersForSave);
  const filterTreeRef = useLatestRef(filterTreeForSave);
  const activeCellRef = useLatestRef(activeCell);

  const [backfillingColumnIds, setBackfillingColumnIds] = useState<ReadonlySet<string>>(new Set());
  const isCreatingColumnRef = useRef(false);
  const tempColCounter = useRef(0);
  const insertFieldTargetRef = useRef<{ anchorColId: string; side: "left" | "right" } | null>(null);
  const backfillRetries = useRef<Map<string, number>>(new Map());
  const BACKFILL_MAX_RETRIES = 2;

  const backfillMut = api.column.backfill.useMutation({
    onSuccess: (_data, vars) => {
      backfillRetries.current.delete(vars.columnId);
      setBackfillingColumnIds((prev) => {
        const next = new Set(prev);
        next.delete(vars.columnId);
        return next;
      });
      refreshRows();
      void utils.view.list.invalidate({ tableId });
    },
    onError: (err, vars) => {
      const attempt = backfillRetries.current.get(vars.columnId) ?? 0;
      if (attempt < BACKFILL_MAX_RETRIES) {
        console.warn(`[backfill] attempt ${attempt + 1} failed for ${vars.columnId}, retrying...`, err);
        backfillRetries.current.set(vars.columnId, attempt + 1);
        backfillMut.mutate(vars);
        return;
      }
      console.error("[backfill] failed after retries for column", vars.columnId, err);
      backfillRetries.current.delete(vars.columnId);
      setBackfillingColumnIds((prev) => {
        const next = new Set(prev);
        next.delete(vars.columnId);
        return next;
      });
    },
  });

  const createColumnMut = api.column.create.useMutation({
    onMutate: async (vars) => {
      isCreatingColumnRef.current = true;
      const tempId = `__temp_col_${++tempColCounter.current}_${Date.now()}`;

      await utils.column.list.cancel({ tableId });
      const prevCols = utils.column.list.getData({ tableId });
      const prevOrderIds = columnOrderIdsRef.current;

      const tempCol = {
        id: tempId,
        name: vars.name,
        type: vars.type,
        order: 999999,
        defaultValue: vars.defaultValue ?? null,
        config: vars.numberConfig ? (vars.numberConfig as unknown as object) : null,
        sourceColumnId: vars.sourceColumnId ?? null,
      };
      utils.column.list.setData({ tableId }, (old) => {
        if (!old) return [tempCol];
        return [...old, tempCol];
      });

      const currentOrder = columnOrderIdsRef.current;
      if (currentOrder.length > 0) {
        const target = insertFieldTargetRef.current;
        if (target) {
          const anchorIdx = currentOrder.indexOf(target.anchorColId);
          if (anchorIdx !== -1) {
            const insertIdx = target.side === "right" ? anchorIdx + 1 : anchorIdx;
            const newOrder = [...currentOrder];
            newOrder.splice(insertIdx, 0, tempId);
            setColumnOrderIds(newOrder);
          } else {
            setColumnOrderIds([...currentOrder, tempId]);
          }
          insertFieldTargetRef.current = null;
        } else {
          setColumnOrderIds([...currentOrder, tempId]);
        }
      }

      return { tempId, prevCols, prevOrderIds };
    },
    onSuccess: (newCol, vars, ctx) => {
      if (!ctx) return;
      const { tempId } = ctx;

      utils.column.list.setData({ tableId }, (old) => {
        if (!old) return old;
        return old.map((c) =>
          c.id === tempId
            ? { id: newCol.id, name: newCol.name, type: newCol.type, order: newCol.order, defaultValue: newCol.defaultValue, config: newCol.config, sourceColumnId: newCol.sourceColumnId }
            : c,
        );
      });

      const currentOrder = columnOrderIdsRef.current;
      const idx = currentOrder.indexOf(tempId);
      if (idx !== -1) {
        const updated = [...currentOrder];
        updated[idx] = newCol.id;
        setColumnOrderIds(updated);
      }

      const ac = activeCellRef.current;
      if (ac?.columnId === tempId) {
        setActiveCell({ rowId: ac.rowId, columnId: newCol.id });
      }

      isCreatingColumnRef.current = false;

      void utils.view.list.invalidate({ tableId });

      if (vars.sourceColumnId) {
        setBackfillingColumnIds((prev) => new Set(prev).add(newCol.id));
        backfillMut.mutate({
          tableId,
          columnId: newCol.id,
          sourceColumnId: vars.sourceColumnId,
        });
      }
    },
    onError: (_err, _vars, ctx) => {
      isCreatingColumnRef.current = false;
      if (!ctx) return;
      if (ctx.prevCols) utils.column.list.setData({ tableId }, ctx.prevCols);
      setColumnOrderIds(ctx.prevOrderIds);
    },
  });

  const deleteColumnMut = api.column.delete.useMutation({
    onMutate: async (vars) => {
      await utils.column.list.cancel({ tableId });
      const prevCols = utils.column.list.getData({ tableId });

      const prevOrderIds = columnOrderIdsRef.current;
      const prevHiddenIds = hiddenColumnIdsRef.current;
      const prevSorts = currentSortsRef.current;
      const prevFilters = filtersRef.current;
      const prevFilterTree = filterTreeRef.current;

      utils.column.list.setData({ tableId }, (old) => {
        if (!old) return old;
        return old.filter((c) => c.id !== vars.columnId);
      });

      setColumnOrderIds(prevOrderIds.filter((id: string) => id !== vars.columnId));
      setHiddenColumnIds(prevHiddenIds.filter((id: string) => id !== vars.columnId));

      const newSorts = prevSorts.filter((s) => s.columnId !== vars.columnId);
      if (newSorts.length !== prevSorts.length) setSorts(newSorts);
      const newFilters = prevFilters.filter((f) => f.columnId !== vars.columnId);
      if (newFilters.length !== prevFilters.length) setFilters(newFilters);

      if (prevFilterTree) {
        type TreeItem = { kind?: string; columnId?: string; items?: TreeItem[]; [k: string]: unknown };
        const cleanTreeItems = (items: TreeItem[]): TreeItem[] =>
          items
            .filter((it) => !(it.kind === "condition" && it.columnId === vars.columnId))
            .map((it) =>
              it.kind === "group" && Array.isArray(it.items)
                ? { ...it, items: cleanTreeItems(it.items) }
                : it,
            );
        const cleaned = {
          ...prevFilterTree,
          items: cleanTreeItems(prevFilterTree.items as TreeItem[]),
        };
        setFilterTree(cleaned as typeof prevFilterTree);
      }

      return { prevCols, prevOrderIds, prevHiddenIds, prevSorts, prevFilters, prevFilterTree };
    },
    onError: (_e, _v, ctx) => {
      if (!ctx) return;
      if (ctx.prevCols) utils.column.list.setData({ tableId }, ctx.prevCols);
      setColumnOrderIds(ctx.prevOrderIds);
      setHiddenColumnIds(ctx.prevHiddenIds);
      setSorts(ctx.prevSorts);
      setFilters(ctx.prevFilters);
      setFilterTree(ctx.prevFilterTree);
    },
    onSuccess: () => {
      refreshRows();
      void utils.column.list.invalidate({ tableId });
      void utils.view.list.invalidate({ tableId });
    },
  });

  const updateColumnMut = api.column.update.useMutation({
    onMutate: async (vars) => {
      await utils.column.list.cancel({ tableId });
      const prevCols = utils.column.list.getData({ tableId });
      if (prevCols) {
        utils.column.list.setData({ tableId }, prevCols.map((c) =>
          c.id === vars.columnId
            ? { ...c, ...(vars.name !== undefined ? { name: vars.name } : {}), ...(vars.numberConfig !== undefined ? { config: vars.numberConfig } : {}) }
            : c,
        ));
      }
      return { prevCols };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevCols) utils.column.list.setData({ tableId }, ctx.prevCols);
    },
    onSuccess: () => {
      void utils.column.list.invalidate({ tableId });
    },
  });

  const handleDeleteField = useCallback((columnId: string) => {
    if (!isValidTable) return;
    if (activeCell?.columnId === columnId) clearSelection();
    deleteColumnMut.mutate({ tableId, columnId });
  }, [isValidTable, tableId, activeCell, clearSelection, deleteColumnMut]);

  const handleCreateField = useCallback((
    name: string,
    type: string,
    defaultValue: string,
    numberConfig?: NumberFormatConfig,
    insertPosition?: { anchorColId: string; side: "left" | "right" },
  ) => {
    if (!isValidTable) return;
    insertFieldTargetRef.current = insertPosition ?? null;
    const dbType: "TEXT" | "NUMBER" = type === "Number" ? "NUMBER" : "TEXT";
    const baseName = name.trim() || (dbType === "NUMBER" ? "Number" : "Label");
    const existingNames = new Set(orderedColumns.map((c) => c.name));
    let fieldName = baseName;
    if (existingNames.has(fieldName)) {
      let i = 2;
      while (existingNames.has(`${baseName} ${i}`)) i++;
      fieldName = `${baseName} ${i}`;
    }
    createColumnMut.mutate({
      tableId,
      name: fieldName,
      type: dbType,
      defaultValue: defaultValue.trim() || undefined,
      numberConfig: numberConfig ?? undefined,
      viewId: activeViewIdFromStore ?? undefined,
      anchorColumnId: insertPosition?.anchorColId ?? undefined,
      insertSide: insertPosition?.side ?? undefined,
    });
  }, [isValidTable, tableId, activeViewIdFromStore, createColumnMut, orderedColumns]);

  const handleEditFieldSave = useCallback((columnId: string, name: string, numberConfig?: NumberFormatConfig) => {
    if (!isValidTable) return;
    updateColumnMut.mutate({
      tableId,
      columnId,
      name: name.trim() || undefined,
      numberConfig: numberConfig ?? undefined,
    });
  }, [isValidTable, tableId, updateColumnMut]);

  const handleHideField = useCallback((columnId: string) => {
    toggleHiddenColumn(columnId);
  }, [toggleHiddenColumn]);

  const handleFilterByField = useCallback((columnId: string) => {
    const col = orderedColumns.find((c) => c.id === columnId);
    if (!col) return;
    const defaultOp = col.type === "NUMBER" ? "equals" : "contains";
    const existingConditions = filterConditions ?? [];
    const newCondition = {
      id: crypto.randomUUID(),
      columnId,
      operator: defaultOp,
      value: "",
      conjunction: "and" as const,
    };
    setFilterConditions([...existingConditions, newCondition]);
    gridBarRef.current?.openFilterPanel();
  }, [orderedColumns, filterConditions, setFilterConditions, gridBarRef]);

  const handleSortByField = useCallback((columnId: string, direction: "asc" | "desc") => {
    const col = orderedColumns.find((c) => c.id === columnId);
    if (!col) return;
    const colType: "TEXT" | "NUMBER" = col.type === "NUMBER" ? "NUMBER" : "TEXT";
    const existing = currentSorts.findIndex((s) => s.columnId === columnId);
    let newSorts;
    if (existing !== -1) {
      newSorts = currentSorts.map((s, i) => i === existing ? { ...s, direction } : s);
    } else {
      newSorts = [...currentSorts, { columnId, direction, type: colType }];
    }
    setSorts(newSorts);
    gridBarRef.current?.openSortPanel();
  }, [orderedColumns, currentSorts, setSorts, gridBarRef]);

  const handleDuplicateField = useCallback((columnId: string, duplicateCells: boolean) => {
    if (!isValidTable) return;
    const col = orderedColumns.find((c) => c.id === columnId);
    if (!col) return;
    const dbType: "TEXT" | "NUMBER" = col.type === "NUMBER" ? "NUMBER" : "TEXT";
    const baseCopyName = `${col.name} copy`;
    const existingNames = new Set(orderedColumns.map((c) => c.name));
    let copyName = baseCopyName;
    if (existingNames.has(copyName)) {
      let i = 2;
      while (existingNames.has(`${baseCopyName} ${i}`)) i++;
      copyName = `${baseCopyName} ${i}`;
    }
    insertFieldTargetRef.current = { anchorColId: columnId, side: "right" };
    createColumnMut.mutate({
      tableId,
      name: copyName,
      type: dbType,
      defaultValue: col.defaultValue ?? undefined,
      numberConfig: col.config ? (col.config as { decimalPlaces: number; thousandsSep: string; showThousands: boolean; largeNumAbbrev: string | null; allowNegative: boolean }) : undefined,
      viewId: activeViewIdFromStore ?? undefined,
      sourceColumnId: duplicateCells ? columnId : undefined,
    });
  }, [isValidTable, orderedColumns, tableId, activeViewIdFromStore, createColumnMut]);

  return {
    handleDeleteField,
    handleCreateField,
    handleEditFieldSave,
    handleHideField,
    handleFilterByField,
    handleSortByField,
    handleDuplicateField,
    backfillingColumnIds,
    isCreatingColumnRef,
  };
}
