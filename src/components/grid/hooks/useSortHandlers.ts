"use client";

import { useCallback } from "react";
import type { Sort } from "~/shared/grid";
import { useGridStore } from "~/components/grid/GridStore";

export type SortColumnType = "TEXT" | "NUMBER";

export interface SortHandlers {
  pickSort: (columnId: string, columnType: SortColumnType) => void;
  addSort: (columnId: string, columnType: SortColumnType) => void;
  changeSortField: (index: number, columnId: string, columnType: SortColumnType) => void;
  changeSortDirection: (index: number, direction: "asc" | "desc") => void;
  removeSort: (index: number) => void;
}

export function useSortHandlers(): SortHandlers {
  const currentSorts = useGridStore((s) => s.sorts);
  const setSorts = useGridStore((s) => s.setSorts);

  const pickSort = useCallback<SortHandlers["pickSort"]>(
    (columnId, columnType) => {
      setSorts([{ columnId, direction: "asc", type: columnType }]);
    },
    [setSorts],
  );

  const addSort = useCallback<SortHandlers["addSort"]>(
    (columnId, columnType) => {
      setSorts([...currentSorts, { columnId, direction: "asc", type: columnType }]);
    },
    [currentSorts, setSorts],
  );

  const changeSortField = useCallback<SortHandlers["changeSortField"]>(
    (index, columnId, columnType) => {
      const next: Sort[] = currentSorts.map((s, i) =>
        i === index ? { columnId, direction: s.direction, type: columnType } : s,
      );
      setSorts(next);
    },
    [currentSorts, setSorts],
  );

  const changeSortDirection = useCallback<SortHandlers["changeSortDirection"]>(
    (index, direction) => {
      const next: Sort[] = currentSorts.map((s, i) => (i === index ? { ...s, direction } : s));
      setSorts(next);
    },
    [currentSorts, setSorts],
  );

  const removeSort = useCallback<SortHandlers["removeSort"]>(
    (index) => {
      setSorts(currentSorts.filter((_, i) => i !== index));
    },
    [currentSorts, setSorts],
  );

  return { pickSort, addSort, changeSortField, changeSortDirection, removeSort };
}
