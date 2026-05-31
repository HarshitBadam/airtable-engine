"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { useLatestRef } from "~/hooks/useLatestRef";
import type { SortDef, SortReorderResult } from "../utils/sortReorder";
import { reorderRowInJumpCache } from "../utils/sortReorder";
import type { RowItem, RowInfiniteInput } from "./useGridRows";

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
  updateJumpCacheRow: (rowId: string, updater: (row: RowItem) => RowItem) => void;
  removeFromJumpCache: (rowId: string) => void;
  addToJumpCache: (absoluteIndex: number, row: RowItem) => void;
  insertIntoJumpCache: (targetRowId: string, newRow: RowItem, position: "above" | "below") => void;
  removeByIdNoShift: (rowId: string) => void;
  addProtectedRowId: (id: string) => void;
  removeProtectedRowId: (id: string) => void;
  isRowProtected: (id: string) => boolean;
  reorderJumpCacheRow: (rowId: string, sorts: SortDef[], colTypes: Map<string, "TEXT" | "NUMBER">) => SortReorderResult;
}

export function useJumpCache({
  tableId,
  rows,
  inputKey,
  rowQueryInput,
  prevTotalCountRef,
}: UseJumpCacheArgs): UseJumpCacheResult {
  const utils = api.useUtils();

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

  const THROTTLE_MS = 200;
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFiredRef = useRef<number>(0);
  const pendingJumpRef = useRef<number | null>(null);

  // Track scroll direction to bias the fetch window toward where the user is heading.
  const scrollDirectionRef = useRef<"up" | "down">("down");
  const prevTriggerOffsetRef = useRef<number>(0);

  const { filters, conjunction: filterConjunction, filterTree, sorts: effectiveSorts, viewId } = rowQueryInput;
  const sendViewId = !!viewId;
  const activeViewId = viewId;

  const doJumpFetch = useCallback((rawOffset: number) => {
    const FETCH_LIMIT = 1000;
    const dir = scrollDirectionRef.current;
    const behind = dir === "up" ? 700 : 150;
    const fetchOffset = Math.max(0, rawOffset - behind);

    const gen = jumpCacheGenRef.current;

    return (async () => {
      try {
        const result = await utils.row.windowFetch.fetch({
          tableId,
          offset: fetchOffset,
          limit: FETCH_LIMIT,
          filters: !filterTree && filters?.length ? (filters as never) : undefined,
          conjunction: !filterTree && filters?.length ? filterConjunction : undefined,
          filterTree: filterTree ? (filterTree as never) : undefined,
          sorts: effectiveSorts?.length ? (effectiveSorts as never) : undefined,
          viewId: sendViewId ? (activeViewId ?? undefined) : undefined,
        });

        setJumpCache((prev) => {
          if (jumpCacheGenRef.current !== gen) return prev;

          const newCache = new Map(prev);
          if (newCache.size > 15000) {
            const protIds = protectedRowIdsRef.current;
            const saved = new Map<number, RowItem>();
            if (protIds.size > 0) {
              for (const [k, v] of newCache) {
                if (protIds.has(v.id)) saved.set(k, v);
              }
            }
            newCache.clear();
            for (const [k, v] of saved) newCache.set(k, v);
          }
          const protIds = protectedRowIdsRef.current;
          (result.items as RowItem[]).forEach((item, idx) => {
            const key = fetchOffset + idx;
            const existing = newCache.get(key);
            if (existing && protIds.has(existing.id)) return;
            newCache.set(key, item);
          });
          return newCache;
        });
      } catch (err) {
        console.error("windowFetch error:", err);
      }
    })();
  }, [tableId, filters, filterConjunction, filterTree, effectiveSorts, activeViewId, sendViewId, utils]);

  const triggerJumpFetch = useCallback((offset: number, force = false) => {
    if (offset < rows.length) return;
    if (!force && jumpCacheRef.current.has(offset)) return;

    if (offset < prevTriggerOffsetRef.current) {
      scrollDirectionRef.current = "up";
    } else if (offset > prevTriggerOffsetRef.current) {
      scrollDirectionRef.current = "down";
    }
    prevTriggerOffsetRef.current = offset;
    pendingJumpRef.current = offset;

    const now = Date.now();
    const timeSinceLastFire = now - lastFiredRef.current;

    if (timeSinceLastFire >= THROTTLE_MS) {
      lastFiredRef.current = now;
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
      void doJumpFetch(offset);
    }

    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    jumpTimerRef.current = setTimeout(() => {
      const currentOffset = pendingJumpRef.current;
      if (currentOffset === null) return;
      if (currentOffset === offset && timeSinceLastFire >= THROTTLE_MS) return;
      lastFiredRef.current = Date.now();
      void doJumpFetch(currentOffset);
    }, THROTTLE_MS);
  }, [rows.length, doJumpFetch]);

  const getRowAtIndex = useCallback(
    (absoluteIndex: number): RowItem | null => {
      if (absoluteIndex < rows.length) {
        return rows[absoluteIndex] ?? null;
      }
      return jumpCacheRef.current.get(absoluteIndex) ?? null;
    },
    [rows],
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
    [rows],
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

  const removeFromJumpCache = useCallback(
    (rowId: string) => {
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
    },
    [],
  );

  const addToJumpCache = useCallback(
    (absoluteIndex: number, row: RowItem) => {
      setJumpCache((prev) => {
        const next = new Map(prev);
        next.set(absoluteIndex, row);
        return next;
      });
    },
    [],
  );

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

  const removeByIdNoShift = useCallback(
    (rowId: string) => {
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
    },
    [],
  );

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
    (rowId: string, sorts: SortDef[], colTypes: Map<string, "TEXT" | "NUMBER">): SortReorderResult => {
      const current = jumpCacheRef.current;
      if (current.size === 0) return "skipped";
      const { cache: newCache, result } = reorderRowInJumpCache(
        current, rowId, sorts, colTypes, prevTotalCountRef.current,
      );
      if (result !== "skipped") {
        setJumpCache(newCache);
      }
      return result;
    },
    [prevTotalCountRef],
  );

  return {
    jumpCache, jumpCacheRef, jumpCacheGenRef, protectedRowIdsRef,
    triggerJumpFetch, clearJumpCache, getRowAtIndex, getRowById,
    updateJumpCacheRow, removeFromJumpCache, addToJumpCache,
    insertIntoJumpCache, removeByIdNoShift,
    addProtectedRowId, removeProtectedRowId, isRowProtected,
    reorderJumpCacheRow,
  };
}
