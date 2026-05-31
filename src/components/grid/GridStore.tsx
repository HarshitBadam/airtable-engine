"use client";

import { createContext, useContext } from "react";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { configFingerprint, defaultViewConfig, type ViewConfig, type Filter, type Sort, type FilterTree, type RowHeightPreset } from "~/shared/grid";

export type { Sort };

type CellKey = { rowId: string; columnId: string };

/** Find current match can include which occurrence within a cell is selected (0-based). */
export type FindCurrentMatch = CellKey & { occurrenceIndex?: number };

/** UI-only filter condition (richer than the backend Filter type). */
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

  // `sorts` = the entries currently shown in the sort panel.
  //   - When autoSort=true these also drive the live query + orange indicators.
  //   - When autoSort=false these are staged; they don't affect the query
  //     until the user clicks the "Sort" button.
  sorts: Sort[];
  // `savedSorts` = baseline copy used *only* for fingerprint stability so that
  //   changing sorts (autoSort=true) doesn't mark the view as dirty.
  savedSorts: Sort[];
  // `permanentSorts` = the sort params applied when autoSort=false. Stored in
  //   the view config and used as the ORDER BY when autoSort is off.
  permanentSorts: Sort[];
  // `autoSort` = toggle state (persisted in view config).
  autoSort: boolean;
  // `ranksComputing` = true while computeViewRanks is in-flight.
  //   Used as a UI indicator (e.g. "Sorting..." in the toolbar).
  //   permanentSorts is NOT set until ranks are ready (onSuccess),
  //   so the query stays on its current path during computation.
  ranksComputing: boolean;

  hiddenColumnIds: string[];
  columnOrderIds: string[];
  rowOrderIds: string[];

  rowHeightPreset: RowHeightPreset;
  wrapHeaders: boolean;

  /** Frontend-only filter conditions for the FilterPanel UI. */
  filterConditions: FilterConditionUI[];
  setFilterConditions: (v: FilterConditionUI[]) => void;

  activeCell: CellKey | null;
  editingCell: CellKey | null;
  editorValue: string;

  /** The cell that is the "current" find match (highlighted with #FFD66B). */
  findCurrentMatch: FindCurrentMatch | null;
  /** Client-side delta added to server match count when user edits cells (e.g. add/remove search string). */
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
    search: "",  // Search is ephemeral — excluded from dirty tracking
    filters: s.savedFilters,
    filterConjunction: s.savedFilterConjunction,
    filterTree: s.savedFilterTree,
    sorts: s.savedSorts,
    permanentSorts: s.permanentSorts,
    autoSort: s.autoSort,
    hiddenColumnIds: s.hiddenColumnIds,
    columnOrderIds: s.columnOrderIds,
    // rowHeightPreset and wrapHeaders are auto-saved; excluded from dirty tracking
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

      // Convert saved Filter[] → FilterConditionUI[] so FilterPanel shows correct state
      const restoredConditions: FilterConditionUI[] = cfg.filters.map((f, idx) => ({
        id: `restored-${idx}-${Date.now()}`,
        columnId: f.columnId,
        operator: f.op,
        value: "value" in f ? String(f.value) : "",
        conjunction: cfg.filterConjunction,
      }));

      const restoredAutoSort = cfg.autoSort;

      // Restore sort panel entries:
      // - If autoSort=true: use cfg.sorts (the auto-saved temp sorts)
      // - If autoSort=false AND no saved temp sorts: seed from permanentSorts
      //   so the panel shows what's currently applied
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

        search: "",  // Search is ephemeral — never restored from saved config
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
        // Search is ephemeral — no fingerprint update (doesn't make view "dirty")
      })),

    // Filters are always temporary (like autoSort for sorts).
    // Changing them does NOT recalculate the fingerprint → no dirty flag.
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

export const GridStoreCtx = createContext<StoreApi<GridState> | null>(null);

export function useGridStore<T>(selector: (s: GridState) => T): T {
  const store = useContext(GridStoreCtx);
  if (!store) throw new Error("useGridStore must be used within GridStoreProvider");
  return useStore(store, selector);
}

/** Return the raw Zustand store API (for .getState() in event handlers). */
export function useGridStoreApi(): StoreApi<GridState> {
  const store = useContext(GridStoreCtx);
  if (!store) throw new Error("useGridStoreApi must be used within GridStoreProvider");
  return store;
}
