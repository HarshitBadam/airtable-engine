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
  filters: Filter[];
  filterConjunction: "and" | "or";
  savedFilters: Filter[];
  savedFilterConjunction: "and" | "or";

  // ── Sort state ──────────────────────────────────────────────
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

  hiddenColumnIds: string[];
  columnOrderIds: string[];
  rowOrderIds: string[];

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
  setPermanentSorts: (v: Sort[]) => void;
  revertFilters: () => void;

  toggleHiddenColumn: (columnId: string) => void;
  setHiddenColumnIds: (ids: string[]) => void;
  setColumnOrderIds: (ids: string[]) => void;
  setRowOrderIds: (ids: string[]) => void;

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

function fingerprintFromParts(
  s: Pick<GridState, "search" | "savedFilters" | "savedFilterConjunction" | "savedSorts" | "autoSort" | "permanentSorts" | "hiddenColumnIds" | "columnOrderIds" | "rowOrderIds">,
) {
  return configFingerprint({
    search: s.search,
    filters: s.savedFilters,
    filterConjunction: s.savedFilterConjunction,
    sorts: s.savedSorts,
    permanentSorts: s.permanentSorts,
    autoSort: s.autoSort,
    hiddenColumnIds: s.hiddenColumnIds,
    columnOrderIds: s.columnOrderIds,
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
    savedFilters: [],
    savedFilterConjunction: "and",
    sorts: [],
    savedSorts: [],
    permanentSorts: [],
    autoSort: true,
    hiddenColumnIds: [],
    columnOrderIds: [],
    rowOrderIds: [],

    filterConditions: [],
    setFilterConditions: (filterConditions) => set((s) => ({ ...s, filterConditions })),

    activeCell: null,
    editingCell: null,
    editorValue: "",
    findCurrentMatch: null,

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

      // Restore autoSort from config (persisted toggle state)
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

        search: cfg.search,
        filters: cfg.filters,
        filterConjunction: cfg.filterConjunction,
        savedFilters: cfg.filters,
        savedFilterConjunction: cfg.filterConjunction,
        sorts: restoredSorts,
        savedSorts: cfg.sorts,
        autoSort: restoredAutoSort,
        permanentSorts: cfg.permanentSorts,
        hiddenColumnIds: cfg.hiddenColumnIds,
        columnOrderIds: cfg.columnOrderIds,
        rowOrderIds: cfg.rowOrderIds,

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
      set((s) => ({ ...s, sorts })),

    setAutoSort: (autoSort) =>
      set((s) => ({ ...s, autoSort })),

    setPermanentSorts: (permanentSorts) =>
      set((s) => ({ ...s, permanentSorts })),

    revertFilters: () =>
      set((s) => ({
        ...s,
        filters: s.savedFilters,
        filterConjunction: s.savedFilterConjunction,
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
