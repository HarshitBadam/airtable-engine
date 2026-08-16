"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useLatestRef } from "~/hooks/useLatestRef";
import type { SortDef, SortReorderResult } from "../utils/sortReorder";
import { reorderRowInJumpCache } from "../utils/sortReorder";
import type { RowItem, RowInfiniteInput } from "./useGridRows";
import { useJumpFetch } from "./useJumpFetch";

interface UseJumpCacheArgs {
  tableId: string;
  rows: RowItem[];
  inputKey: string;
  rowQueryInput: RowInfiniteInput;
  prevTotalCountRef: React.MutableRefObject<number>;
}

interface UseJumpCacheResult {
  jumpCache: Map<number, RowItem>;
  jumpCacheRef: React.MutableRefObject<Map<number, RowItem>>;
  jumpCacheGenRef: React.MutableRefObject<number>;
  protectedRowIdsRef: React.MutableRefObject<Set<string>>;
  triggerJumpFetch: (offset: number, force?: boolean) => void;
  clearJumpCache: () => void;
  getRowAtIndex: (absoluteIndex: number) => RowItem | null;
  getRowById: (rowId: string) => RowItem | null;
  updateJumpCacheRow: (
    rowId: string,
    updater: (row: RowItem) => RowItem,
  ) => void;
  removeFromJumpCache: (rowId: string) => void;
  addToJumpCache: (absoluteIndex: number, row: RowItem) => void;
  insertIntoJumpCache: (
    targetRowId: string,
    newRow: RowItem,
    position: "above" | "below",
  ) => void;
  removeByIdNoShift: (rowId: string) => void;
  addProtectedRowId: (id: string) => void;
  removeProtectedRowId: (id: string) => void;
  isRowProtected: (id: string) => boolean;
  reorderJumpCacheRow: (
    rowId: string,
    sorts: SortDef[],
    colTypes: Map<string, "TEXT" | "NUMBER">,
  ) => SortReorderResult;
}

export function useJumpCache({
  tableId,
  rows,
  inputKey,
  rowQueryInput,
  prevTotalCountRef,
}: UseJumpCacheArgs): UseJumpCacheResult {
  const [jumpCache, setJumpCache] = useState<Map<number, RowItem>>(new Map());
  const jumpCacheRef = useLatestRef(jumpCache);

  // Generation counter: incremented every time the jump cache is cleared.
  // doJumpFetch captures the generation at fetch-start; if the generation has
  // changed by the time results arrive the stale results are silently discarded.
  // This prevents a race where a slow in-flight fetch overwrites fresh data.
  const jumpCacheGenRef = useRef(0);

  // Protected rows: optimistically inserted rows whose positions must not be
  // overwritten by windowFetch until the user edits a sort/filter column.
  const protectedRowIdsRef = useRef<Set<string>>(new Set());

  // Dedup: remove protected rows from jump cache once they appear in the
  // infinite query pages (after a refetch). We only remove from the cache —
  // protection must be released exclusively by handleCellMembershipChange.
  useEffect(() => {
    const protIds = protectedRowIdsRef.current;
    if (protIds.size === 0) return;

    const rowIdSet = new Set(rows.map((r) => r.id));
    const idsToRemove: string[] = [];
    for (const id of protIds) {
      if (rowIdSet.has(id)) idsToRemove.push(id);
    }
    if (idsToRemove.length === 0) return;

    setJumpCache((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [key, item] of next) {
        if (idsToRemove.includes(item.id)) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [rows]);

  // Clear jump cache when query params change — also bumps generation so
  // any in-flight fetches with old params are discarded on arrival.
  useEffect(() => {
    jumpCacheGenRef.current += 1;
    setJumpCache(new Map());
  }, [inputKey]);

  const triggerJumpFetch = useJumpFetch({
    tableId,
    rows,
    rowQueryInput,
    jumpCacheRef,
    jumpCacheGenRef,
    protectedRowIdsRef,
    setJumpCache,
  });

  const getRowAtIndex = useCallback(
    (absoluteIndex: number): RowItem | null => {
      if (absoluteIndex < rows.length) {
        return rows[absoluteIndex] ?? null;
      }
      return jumpCacheRef.current.get(absoluteIndex) ?? null;
    },
    [jumpCacheRef, rows],
  );

  const clearJumpCache = useCallback(() => {
    jumpCacheGenRef.current += 1;
    setJumpCache(new Map());
  }, []);

  const getRowById = useCallback(
    (rowId: string): RowItem | null => {
      const fromPages = rows.find((r) => r.id === rowId);
      if (fromPages) return fromPages;
      for (const item of jumpCacheRef.current.values()) {
        if (item.id === rowId) return item;
      }
      return null;
    },
    [jumpCacheRef, rows],
  );

  const updateJumpCacheRow = useCallback(
    (rowId: string, updater: (row: RowItem) => RowItem) => {
      setJumpCache((prev) => {
        let found = false;
        const next = new Map(prev);
        for (const [key, item] of next) {
          if (item.id === rowId) {
            next.set(key, updater(item));
            found = true;
            break;
          }
        }
        return found ? next : prev;
      });
    },
    [],
  );

  const removeFromJumpCache = useCallback((rowId: string) => {
    jumpCacheGenRef.current += 1;
    setJumpCache((prev) => {
      let keyToRemove: number | null = null;
      for (const [key, item] of prev) {
        if (item.id === rowId) {
          keyToRemove = key;
          break;
        }
      }
      if (keyToRemove === null) return prev;
      const next = new Map<number, RowItem>();
      for (const [key, item] of prev) {
        if (key === keyToRemove) continue;
        next.set(key > keyToRemove ? key - 1 : key, item);
      }
      return next;
    });
  }, []);

  const addToJumpCache = useCallback((absoluteIndex: number, row: RowItem) => {
    setJumpCache((prev) => {
      const next = new Map(prev);
      next.set(absoluteIndex, row);
      return next;
    });
  }, []);

  const insertIntoJumpCache = useCallback(
    (targetRowId: string, newRow: RowItem, position: "above" | "below") => {
      jumpCacheGenRef.current += 1;
      setJumpCache((prev) => {
        let targetKey: number | null = null;
        for (const [key, item] of prev) {
          if (item.id === targetRowId) {
            targetKey = key;
            break;
          }
        }
        if (targetKey === null) return prev;

        const insertKey = position === "above" ? targetKey : targetKey + 1;
        const next = new Map<number, RowItem>();
        for (const [key, item] of prev) {
          next.set(key >= insertKey ? key + 1 : key, item);
        }
        next.set(insertKey, newRow);
        return next;
      });
    },
    [],
  );

  const removeByIdNoShift = useCallback((rowId: string) => {
    setJumpCache((prev) => {
      for (const [key, item] of prev) {
        if (item.id === rowId) {
          const next = new Map(prev);
          next.delete(key);
          return next;
        }
      }
      return prev;
    });
  }, []);

  const addProtectedRowId = useCallback((id: string) => {
    protectedRowIdsRef.current = new Set(protectedRowIdsRef.current).add(id);
  }, []);

  const removeProtectedRowId = useCallback((id: string) => {
    const next = new Set(protectedRowIdsRef.current);
    next.delete(id);
    protectedRowIdsRef.current = next;
  }, []);

  const isRowProtected = useCallback((id: string) => {
    return protectedRowIdsRef.current.has(id);
  }, []);

  const reorderJumpCacheRow = useCallback(
    (
      rowId: string,
      sorts: SortDef[],
      colTypes: Map<string, "TEXT" | "NUMBER">,
    ): SortReorderResult => {
      const current = jumpCacheRef.current;
      if (current.size === 0) return "skipped";
      const { cache: newCache, result } = reorderRowInJumpCache(
        current,
        rowId,
        sorts,
        colTypes,
        prevTotalCountRef.current,
      );
      if (result !== "skipped") {
        setJumpCache(newCache);
      }
      return result;
    },
    [jumpCacheRef, prevTotalCountRef],
  );

  return {
    jumpCache,
    jumpCacheRef,
    jumpCacheGenRef,
    protectedRowIdsRef,
    triggerJumpFetch,
    clearJumpCache,
    getRowAtIndex,
    getRowById,
    updateJumpCacheRow,
    removeFromJumpCache,
    addToJumpCache,
    insertIntoJumpCache,
    removeByIdNoShift,
    addProtectedRowId,
    removeProtectedRowId,
    isRowProtected,
    reorderJumpCacheRow,
  };
}
