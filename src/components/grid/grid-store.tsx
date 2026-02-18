"use client";

import React, { createContext, useContext, useRef } from "react";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { configFingerprint, defaultViewConfig, type ViewConfig, type Filter, type Sort, type FilterTree, type RowHeightPreset } from "~/shared/grid";

export type { Sort };

type CellKey = { rowId: string; columnId: string };

export type FindCurrentMatch = CellKey & { occurrenceIndex?: number };

export type FilterConditionUI = {
  id: string;
  columnId: string;
  operator: string;
  value: string;
  conjunction: "and" | "or";
};

type GridState = {
  tableId: string;

  initialized: boolean;
  activeViewId: string | null;

  savedFingerprint: string;
  fingerprint: string;

  search: string;
  filters: Filter[];
  filterConjunction: "and" | "or";
  /** Tree-structured filters for condition groups. When set, takes precedence over flat filters. */
  filterTree: FilterTree | undefined;
  savedFilters: Filter[];
  savedFilterConjunction: "and" | "or";
  savedFilterTree: FilterTree | undefined;

  sorts: Sort[];
  savedSorts: Sort[];
  permanentSorts: Sort[];
  autoSort: boolean;
  ranksComputing: boolean;

  hiddenColumnIds: string[];
  columnOrderIds: string[];
  rowOrderIds: string[];

  rowHeightPreset: RowHeightPreset;
  wrapHeaders: boolean;

  filterConditions: FilterConditionUI[];
  setFilterConditions: (v: FilterConditionUI[]) => void;

  activeCell: CellKey | null;
  editingCell: CellKey | null;
  editorValue: string;

  findCurrentMatch: FindCurrentMatch | null;
  findCountDelta: number;

  initializeFromView: (viewId: string, config: ViewConfig) => void;

  setSearch: (v: string) => void;
  setFilters: (v: Filter[]) => void;
  setFilterConjunction: (v: "and" | "or") => void;
  setFilterTree: (v: FilterTree | undefined) => void;
  setSorts: (v: Sort[]) => void;
  setAutoSort: (v: boolean) => void;
  setPermanentSorts: (v: Sort[]) => void;
  setRanksComputing: (v: boolean) => void;
  revertFilters: () => void;

  toggleHiddenColumn: (columnId: string) => void;
  setHiddenColumnIds: (ids: string[]) => void;
  setColumnOrderIds: (ids: string[]) => void;
  setRowOrderIds: (ids: string[]) => void;

  setRowHeightPreset: (v: RowHeightPreset) => void;
  setWrapHeaders: (v: boolean) => void;

  setActiveCell: (cell: CellKey | null) => void;
  clearSelection: () => void;

  startEditing: (cell: CellKey, initial: string) => void;
  setEditorValue: (v: string) => void;
  stopEditing: () => void;

  setFindCurrentMatch: (match: FindCurrentMatch | null) => void;
  addFindCountDelta: (delta: number) => void;
  resetFindCountDelta: () => void;

  markSaved: () => void;
  markSortsSaved: () => void;
  markFiltersSaved: () => void;
};

function fingerprintFromParts(
  s: Pick<GridState, "savedFilters" | "savedFilterConjunction" | "savedFilterTree" | "savedSorts" | "autoSort" | "permanentSorts" | "hiddenColumnIds" | "columnOrderIds" | "rowOrderIds">,
) {
  return configFingerprint({
    search: "",
    filters: s.savedFilters,
    filterConjunction: s.savedFilterConjunction,
    filterTree: s.savedFilterTree,
    sorts: s.savedSorts,
    permanentSorts: s.permanentSorts,
    autoSort: s.autoSort,
    hiddenColumnIds: s.hiddenColumnIds,
    columnOrderIds: s.columnOrderIds,
    rowHeightPreset: "short",
    wrapHeaders: false,
    rowOrderIds: s.rowOrderIds,
  });
}

export function createGridStore(tableId: string) {
  const fp = configFingerprint(defaultViewConfig);

  return createStore<GridState>()((set) => ({
    tableId,

    initialized: false,
    activeViewId: null,

    savedFingerprint: fp,
    fingerprint: fp,

    search: "",
    filters: [],
    filterConjunction: "and",
    filterTree: undefined,
    savedFilters: [],
    savedFilterConjunction: "and",
    savedFilterTree: undefined,
    sorts: [],
    savedSorts: [],
    permanentSorts: [],
    autoSort: true,
    ranksComputing: false,
    hiddenColumnIds: [],
    columnOrderIds: [],
    rowOrderIds: [],

    rowHeightPreset: "short",
    wrapHeaders: false,

    filterConditions: [],
    setFilterConditions: (filterConditions) => set((s) => ({ ...s, filterConditions })),

    activeCell: null,
    editingCell: null,
    editorValue: "",
    findCurrentMatch: null,
    findCountDelta: 0,

    initializeFromView: (viewId, cfg) => {
      const fp2 = configFingerprint(cfg);

      const restoredConditions: FilterConditionUI[] = cfg.filters.map((f, idx) => ({
        id: `restored-${idx}-${Date.now()}`,
        columnId: f.columnId,
        operator: f.op,
        value: "value" in f ? String(f.value) : "",
        conjunction: cfg.filterConjunction,
      }));

      const restoredAutoSort = cfg.autoSort;

      const restoredSorts =
        cfg.sorts.length > 0
          ? cfg.sorts
          : !restoredAutoSort && cfg.permanentSorts.length > 0
            ? cfg.permanentSorts
            : [];

      set({
        initialized: true,
        activeViewId: viewId,
        savedFingerprint: fp2,
        fingerprint: fp2,

        search: "",
        filters: cfg.filters,
        filterConjunction: cfg.filterConjunction,
        filterTree: cfg.filterTree,
        savedFilters: cfg.filters,
        savedFilterConjunction: cfg.filterConjunction,
        savedFilterTree: cfg.filterTree,
        sorts: restoredSorts,
        savedSorts: cfg.sorts,
        autoSort: restoredAutoSort,
        permanentSorts: cfg.permanentSorts,
        ranksComputing: false,
        hiddenColumnIds: cfg.hiddenColumnIds,
        columnOrderIds: cfg.columnOrderIds,
        rowOrderIds: cfg.rowOrderIds,

        rowHeightPreset: cfg.rowHeightPreset,
        wrapHeaders: cfg.wrapHeaders,

        filterConditions: restoredConditions,

        activeCell: null,
        editingCell: null,
        editorValue: "",
      });
    },

    setSearch: (search) =>
      set((s) => ({
        ...s,
        search,
      })),

    setFilters: (filters) => set((s) => ({ ...s, filters })),

    setFilterConjunction: (filterConjunction) =>
      set((s) => ({ ...s, filterConjunction })),

    setFilterTree: (filterTree) =>
      set((s) => ({ ...s, filterTree })),

    setSorts: (sorts) =>
      set((s) => ({ ...s, sorts })),

    setAutoSort: (autoSort) =>
      set((s) => ({ ...s, autoSort })),

    setPermanentSorts: (permanentSorts) =>
      set((s) => ({ ...s, permanentSorts })),

    setRanksComputing: (ranksComputing) =>
      set((s) => ({ ...s, ranksComputing })),

    revertFilters: () =>
      set((s) => ({
        ...s,
        filters: s.savedFilters,
        filterConjunction: s.savedFilterConjunction,
        filterTree: s.savedFilterTree,
        filterConditions: s.savedFilters.map((f, idx) => ({
          id: `reverted-${idx}-${Date.now()}`,
          columnId: f.columnId,
          operator: f.op,
          value: "value" in f ? String(f.value) : "",
          conjunction: s.savedFilterConjunction,
        })),
      })),

    toggleHiddenColumn: (columnId) =>
      set((s) => {
        const hidden = new Set(s.hiddenColumnIds);

        if (hidden.has(columnId)) {
          hidden.delete(columnId);
        } else {
          hidden.add(columnId);
        }

        const hiddenColumnIds = Array.from(hidden);
        return {
          ...s,
          hiddenColumnIds,
          fingerprint: fingerprintFromParts({ ...s, hiddenColumnIds }),
        };
      }),

    setHiddenColumnIds: (hiddenColumnIds) =>
      set((s) => ({
        ...s,
        hiddenColumnIds,
        fingerprint: fingerprintFromParts({ ...s, hiddenColumnIds }),
      })),

    setColumnOrderIds: (columnOrderIds) =>
      set((s) => ({
        ...s,
        columnOrderIds,
        fingerprint: fingerprintFromParts({ ...s, columnOrderIds }),
      })),

    setRowOrderIds: (rowOrderIds) =>
      set((s) => ({
        ...s,
        rowOrderIds,
        fingerprint: fingerprintFromParts({ ...s, rowOrderIds }),
      })),

    setRowHeightPreset: (rowHeightPreset) => set((s) => ({ ...s, rowHeightPreset })),
    setWrapHeaders: (wrapHeaders) => set((s) => ({ ...s, wrapHeaders })),

    setActiveCell: (activeCell) => set((s) => ({ ...s, activeCell })),
    clearSelection: () => set((s) => ({ ...s, activeCell: null, editingCell: null, editorValue: "" })),

    startEditing: (editingCell, initial) => set((s) => ({ ...s, editingCell, editorValue: initial })),
    setEditorValue: (editorValue) => set((s) => ({ ...s, editorValue })),
    stopEditing: () => set((s) => ({ ...s, editingCell: null, editorValue: "" })),

    setFindCurrentMatch: (findCurrentMatch) => set((s) => ({ ...s, findCurrentMatch })),
    addFindCountDelta: (delta) =>
      set((s) => ({ ...s, findCountDelta: s.findCountDelta + delta })),
    resetFindCountDelta: () => set((s) => ({ ...s, findCountDelta: 0 })),

    markSaved: () => set((s) => ({ ...s, savedFingerprint: s.fingerprint })),
    markSortsSaved: () => set((s) => ({ ...s, savedSorts: s.sorts })),
    markFiltersSaved: () =>
      set((s) => ({
        ...s,
        savedFilters: s.filters,
        savedFilterConjunction: s.filterConjunction,
        savedFilterTree: s.filterTree,
      })),
  }));
}

const Ctx = createContext<StoreApi<GridState> | null>(null);

export function GridStoreProvider({ tableId, children }: { tableId: string; children: React.ReactNode }) {
  const ref = useRef<StoreApi<GridState> | null>(null);
  ref.current ??= createGridStore(tableId);
  return <Ctx.Provider value={ref.current}>{children}</Ctx.Provider>;
}

export function useGridStore<T>(selector: (s: GridState) => T): T {
  const store = useContext(Ctx);
  if (!store) throw new Error("useGridStore must be used within GridStoreProvider");
  return useStore(store, selector);
}

export function useGridStoreApi(): StoreApi<GridState> {
  const store = useContext(Ctx);
  if (!store) throw new Error("useGridStoreApi must be used within GridStoreProvider");
  return store;
}
