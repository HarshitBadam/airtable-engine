"use client";

import React, { createContext, useContext, useRef } from "react";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { configFingerprint, defaultViewConfig, type ViewConfig, type Filter, type Sort } from "~/shared/grid";

// re-export for convenience
export type { Sort };

type CellKey = { rowId: string; columnId: string };

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
  filters: Filter[];                 // current UI filters (temporary, live preview)
  filterConjunction: "and" | "or";   // current UI conjunction (temporary)
  savedFilters: Filter[];            // baseline from view config (persisted in DB)
  savedFilterConjunction: "and" | "or"; // baseline conjunction from view config
  sorts: Sort[];           // current UI sorts (may be temporary or saved)
  savedSorts: Sort[];      // baseline from view config (persisted in DB)
  autoSort: boolean;       // true = sorts are temporary; false = sorts are persisted
  hiddenColumnIds: string[];
  columnOrderIds: string[];

  /** Frontend-only filter conditions for the FilterPanel UI. */
  filterConditions: FilterConditionUI[];
  setFilterConditions: (v: FilterConditionUI[]) => void;

  activeCell: CellKey | null;
  editingCell: CellKey | null;
  editorValue: string;

  /** The cell that is the "current" find match (highlighted with #FFD66B). */
  findCurrentMatch: CellKey | null;

  initializeFromView: (viewId: string, config: ViewConfig) => void;

  setSearch: (v: string) => void;
  setFilters: (v: Filter[]) => void;
  setFilterConjunction: (v: "and" | "or") => void;
  setSorts: (v: Sort[]) => void;
  setAutoSort: (v: boolean) => void;
  revertSorts: () => void;
  revertFilters: () => void;

  toggleHiddenColumn: (columnId: string) => void;
  setHiddenColumnIds: (ids: string[]) => void;
  setColumnOrderIds: (ids: string[]) => void;

  setActiveCell: (cell: CellKey | null) => void;
  clearSelection: () => void;

  startEditing: (cell: CellKey, initial: string) => void;
  setEditorValue: (v: string) => void;
  stopEditing: () => void;

  setFindCurrentMatch: (match: CellKey | null) => void;

  markSaved: () => void;
  markSortsSaved: () => void;
  markFiltersSaved: () => void;
};

function fingerprintFromParts(s: Pick<GridState, "search" | "savedFilters" | "savedFilterConjunction" | "sorts" | "savedSorts" | "autoSort" | "hiddenColumnIds" | "columnOrderIds">) {
  return configFingerprint({
    search: s.search,
    // Filters are always temporary — use saved baselines so filter
    // changes never dirty the view (same pattern as autoSort for sorts).
    filters: s.savedFilters,
    filterConjunction: s.savedFilterConjunction,
    // When autoSort is on, temporary sort changes don't dirty the view
    sorts: s.autoSort ? s.savedSorts : s.sorts,
    hiddenColumnIds: s.hiddenColumnIds,
    columnOrderIds: s.columnOrderIds,
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
    savedFilters: [],
    savedFilterConjunction: "and",
    sorts: [],
    savedSorts: [],
    autoSort: true,
    hiddenColumnIds: [],
    columnOrderIds: [],

    filterConditions: [],
    setFilterConditions: (filterConditions) => set((s) => ({ ...s, filterConditions })),

    activeCell: null,
    editingCell: null,
    editorValue: "",
    findCurrentMatch: null,

    initializeFromView: (viewId, cfg) => {
      const fp2 = configFingerprint(cfg);

      // Convert saved Filter[] → FilterConditionUI[] so FilterPanel shows correct state
      // when opened. Without this, the sync effect would overwrite saved filters with [].
      const restoredConditions: FilterConditionUI[] = cfg.filters.map((f, idx) => ({
        id: `restored-${idx}-${Date.now()}`,
        columnId: f.columnId,
        operator: f.op,
        value: "value" in f ? String(f.value) : "",
        conjunction: cfg.filterConjunction,
      }));

      set({
        initialized: true,
        activeViewId: viewId,
        savedFingerprint: fp2,
        fingerprint: fp2,

        search: cfg.search,
        filters: cfg.filters,
        filterConjunction: cfg.filterConjunction,
        savedFilters: cfg.filters,
        savedFilterConjunction: cfg.filterConjunction,
        sorts: cfg.sorts,
        savedSorts: cfg.sorts,
        autoSort: true,
        hiddenColumnIds: cfg.hiddenColumnIds,
        columnOrderIds: cfg.columnOrderIds,

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
        fingerprint: fingerprintFromParts({ ...s, search }),
      })),

    // Filters are always temporary (like autoSort for sorts).
    // Changing them does NOT recalculate the fingerprint → no dirty flag.
    setFilters: (filters) => set((s) => ({ ...s, filters })),

    setFilterConjunction: (filterConjunction) =>
      set((s) => ({ ...s, filterConjunction })),

    setSorts: (sorts) =>
      set((s) => ({
        ...s,
        sorts,
        fingerprint: fingerprintFromParts({ ...s, sorts }),
      })),

    setAutoSort: (autoSort) =>
      set((s) => {
        // When switching from autoSort=true → false, revert sorts to savedSorts
        // (discard temporary sorts — they were never meant to persist)
        const shouldRevert = s.autoSort && !autoSort;
        const newSorts = shouldRevert ? s.savedSorts : s.sorts;
        return {
          ...s,
          autoSort,
          sorts: newSorts,
          fingerprint: fingerprintFromParts({ ...s, autoSort, sorts: newSorts }),
        };
      }),

    revertSorts: () =>
      set((s) => ({
        ...s,
        sorts: s.savedSorts,
        fingerprint: fingerprintFromParts({ ...s, sorts: s.savedSorts }),
      })),

    revertFilters: () =>
      set((s) => ({
        ...s,
        filters: s.savedFilters,
        filterConjunction: s.savedFilterConjunction,
        // Also revert the UI conditions so FilterPanel reflects the saved state
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

    setActiveCell: (activeCell) => set((s) => ({ ...s, activeCell })),
    clearSelection: () => set((s) => ({ ...s, activeCell: null, editingCell: null, editorValue: "" })),

    startEditing: (editingCell, initial) => set((s) => ({ ...s, editingCell, editorValue: initial })),
    setEditorValue: (editorValue) => set((s) => ({ ...s, editorValue })),
    stopEditing: () => set((s) => ({ ...s, editingCell: null, editorValue: "" })),

    setFindCurrentMatch: (findCurrentMatch) => set((s) => ({ ...s, findCurrentMatch })),

    markSaved: () => set((s) => ({ ...s, savedFingerprint: s.fingerprint })),
    markSortsSaved: () => set((s) => ({ ...s, savedSorts: s.sorts })),
    markFiltersSaved: () =>
      set((s) => ({
        ...s,
        savedFilters: s.filters,
        savedFilterConjunction: s.filterConjunction,
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
