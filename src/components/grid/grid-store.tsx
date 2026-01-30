"use client";

import React, { createContext, useContext, useRef } from "react";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { configFingerprint, defaultViewConfig, type ViewConfig, type Filter, type Sort } from "~/shared/grid";

type CellKey = { rowId: string; columnId: string };

type GridState = {
  tableId: string;

  initialized: boolean;
  activeViewId: string | null;

  savedFingerprint: string;
  fingerprint: string;

  search: string;
  filters: Filter[];
  sort: Sort | null;
  hiddenColumnIds: string[];

  activeCell: CellKey | null;
  editingCell: CellKey | null;
  editorValue: string;

  initializeFromView: (viewId: string, config: ViewConfig) => void;

  setSearch: (v: string) => void;
  setFilters: (v: Filter[]) => void;
  setSort: (v: Sort | null) => void;

  toggleHiddenColumn: (columnId: string) => void;
  setHiddenColumnIds: (ids: string[]) => void;

  setActiveCell: (cell: CellKey | null) => void;
  clearSelection: () => void;

  startEditing: (cell: CellKey, initial: string) => void;
  setEditorValue: (v: string) => void;
  stopEditing: () => void;

  markSaved: () => void;
};

function fingerprintFromParts(s: Pick<GridState, "search" | "filters" | "sort" | "hiddenColumnIds">) {
  return configFingerprint({
    search: s.search,
    filters: s.filters,
    sort: s.sort,
    hiddenColumnIds: s.hiddenColumnIds,
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
    sort: null,
    hiddenColumnIds: [],

    activeCell: null,
    editingCell: null,
    editorValue: "",

    initializeFromView: (viewId, cfg) => {
      const fp2 = configFingerprint(cfg);

      set({
        initialized: true,
        activeViewId: viewId,
        savedFingerprint: fp2,
        fingerprint: fp2,

        search: cfg.search,
        filters: cfg.filters,
        sort: cfg.sort,
        hiddenColumnIds: cfg.hiddenColumnIds,

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

    setFilters: (filters) =>
      set((s) => ({
        ...s,
        filters,
        fingerprint: fingerprintFromParts({ ...s, filters }),
      })),

    setSort: (sort) =>
      set((s) => ({
        ...s,
        sort,
        fingerprint: fingerprintFromParts({ ...s, sort }),
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

    setActiveCell: (activeCell) => set((s) => ({ ...s, activeCell })),
    clearSelection: () => set((s) => ({ ...s, activeCell: null, editingCell: null, editorValue: "" })),

    startEditing: (editingCell, initial) => set((s) => ({ ...s, editingCell, editorValue: initial })),
    setEditorValue: (editorValue) => set((s) => ({ ...s, editorValue })),
    stopEditing: () => set((s) => ({ ...s, editingCell: null, editorValue: "" })),

    markSaved: () => set((s) => ({ ...s, savedFingerprint: s.fingerprint })),
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
