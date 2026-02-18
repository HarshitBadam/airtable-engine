"use client";

import { useEffect, useMemo, useCallback, useRef, useState } from "react";
import type { inferProcedureInput } from "@trpc/server";
import { keepPreviousData } from "@tanstack/react-query";

import { api } from "~/trpc/react";
import { useDebouncedValue } from "~/hooks/useDebouncedValue";
import type { AppRouter } from "~/server/api/root";

import { useGridStore } from "./grid-store";
import { reorderRowInJumpCache, type SortDef, type SortReorderResult } from "./sortReorder";

export type RowInfiniteInput = inferProcedureInput<AppRouter["row"]["infinite"]>;

export type RowItem = {
  id: string;
  rowIndex: number;
  cells: unknown;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export function useGridRows(tableId: string) {
  const search = useGridStore((s) => s.search);
  const filters = useGridStore((s) => s.filters);
  const filterConjunction = useGridStore((s) => s.filterConjunction);
  const filterTree = useGridStore((s) => s.filterTree);

  // Which sorts drive the query: autoSort+sorts → live preview, otherwise permanentSorts
  const effectiveSorts = useGridStore((s) =>
    (s.autoSort && s.sorts.length > 0) ? s.sorts : s.permanentSorts,
  );

  const isUsingPermanentSorts = useGridStore((s) =>
    !(s.autoSort && s.sorts.length > 0),
  );

  const activeViewId = useGridStore((s) => s.activeViewId);
  const ranksComputing = useGridStore((s) => s.ranksComputing);
  const clearSelection = useGridStore((s) => s.clearSelection);

  const debouncedSearch = useDebouncedValue(search, 250);

  // Only send viewId when using permanent sorts, sorts exist, and ranks aren't being computed
  const sendViewId = isUsingPermanentSorts && effectiveSorts.length > 0 && !ranksComputing;

  const input: RowInfiniteInput = useMemo(
    () => ({
      tableId,
      limit: 1000,
      filters: !filterTree && filters.length ? filters : undefined,
      conjunction: !filterTree && filters.length ? filterConjunction : undefined,
      filterTree: filterTree ?? undefined,
      sorts: effectiveSorts.length > 0 ? effectiveSorts : undefined,
      viewId: sendViewId ? (activeViewId ?? undefined) : undefined,
    }),
    [tableId, filters, filterConjunction, filterTree, effectiveSorts, sendViewId, activeViewId],
  );

  // Clear cell selection whenever query parameters change
  const inputKey = JSON.stringify(input);
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey]);

  const q = api.row.infinite.useInfiniteQuery(input, {
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  // Sort transition: show skeletons while sorts change and fresh data loads
  const sortFingerprint = JSON.stringify(effectiveSorts);
  const [activeSortFingerprint, setActiveSortFingerprint] = useState(sortFingerprint);

  useEffect(() => {
    if (!q.isPlaceholderData) {
      setActiveSortFingerprint(sortFingerprint);
    }
  }, [q.isPlaceholderData, sortFingerprint]);

  const isSortLoading = sortFingerprint !== activeSortFingerprint;

  const rowOrderIds = useGridStore((s) => s.rowOrderIds);

  // Preserve totalCount during sort transitions to prevent flash
  const prevTotalCountRef = useRef(0);
  const freshTotalCount: number = q.data?.pages?.[0]?.totalCount ?? 0;
  if (!isSortLoading && freshTotalCount > 0) {
    prevTotalCountRef.current = freshTotalCount;
  }
  const totalCount = isSortLoading ? prevTotalCountRef.current : freshTotalCount;

  const rows = useMemo(() => {
    if (isSortLoading) return [];

    const flat = q.data?.pages.flatMap((p) => p.items) ?? [];

    // Custom row order only applies when no sorts are active
    if (rowOrderIds.length === 0 || effectiveSorts.length > 0) {
      return flat;
    }

    const rowMap = new Map(flat.map((r) => [r.id, r]));

    const ordered: typeof flat = [];
    const seen = new Set<string>();

    for (const id of rowOrderIds) {
      const r = rowMap.get(id);
      if (r) {
        ordered.push(r);
        seen.add(id);
      }
    }

    for (const r of flat) {
      if (!seen.has(r.id)) {
        ordered.push(r);
      }
    }

    return ordered;
  }, [q.data, rowOrderIds, effectiveSorts.length, isSortLoading]);

  // Jump cache
  const [jumpCache, setJumpCache] = useState<Map<number, RowItem>>(new Map());
  const jumpCacheRef = useRef(jumpCache);
  jumpCacheRef.current = jumpCache;

  // Generation counter: stale in-flight fetches are discarded when generation advances
  const jumpCacheGenRef = useRef(0);

  // Protected rows: optimistically-added row IDs that windowFetch shouldn't overwrite
  const protectedRowIdsRef = useRef<Set<string>>(new Set());

  // Remove protected rows from jump cache once they appear in infinite query pages
  useEffect(() => {
    if (q.isPlaceholderData) return; // wait for fresh data
    const protIds = protectedRowIdsRef.current;
    if (protIds.size === 0) return;

    const rowIdSet = new Set(rows.map((r) => (r as RowItem).id));
    const idsToRemove: string[] = [];
    for (const id of protIds) {
      if (rowIdSet.has(id)) idsToRemove.push(id);
    }
    if (idsToRemove.length === 0) return;

    const nextProt = new Set(protIds);
    for (const id of idsToRemove) nextProt.delete(id);
    protectedRowIdsRef.current = nextProt;

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q.isPlaceholderData]);

  // Clear jump cache when query params change — also bumps generation so
  // any in-flight fetches with old params are discarded on arrival.
  useEffect(() => {
    jumpCacheGenRef.current += 1;
    setJumpCache(new Map());
  }, [inputKey]);

  const utils = api.useUtils();

  // Throttled jump fetch: leading + trailing edge, at most once per THROTTLE_MS
  const THROTTLE_MS = 200;
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFiredRef = useRef<number>(0);
  const pendingJumpRef = useRef<number | null>(null);

  // Track scroll direction so we can bias the fetch window.
  // 'up' = user is scrolling towards row 0; 'down' = towards last row.
  const scrollDirectionRef = useRef<"up" | "down">("down");
  const prevTriggerOffsetRef = useRef<number>(0);

  const doJumpFetch = useCallback((rawOffset: number) => {
    // Bias fetch window: scrolling up loads more rows above, down loads more below
    const FETCH_LIMIT = 1000;
    const dir = scrollDirectionRef.current;
    const behind = dir === "up" ? 700 : 150;
    const fetchOffset = Math.max(0, rawOffset - behind);

    // Capture generation to discard results if cache is cleared mid-flight
    const gen = jumpCacheGenRef.current;

    return (async () => {
      try {
        const result = await utils.row.windowFetch.fetch({
          tableId,
          offset: fetchOffset,
          limit: FETCH_LIMIT,
          filters: !filterTree && filters.length ? (filters as never) : undefined,
          conjunction: !filterTree && filters.length ? filterConjunction : undefined,
          filterTree: filterTree ? (filterTree as never) : undefined,
          sorts: effectiveSorts.length > 0 ? (effectiveSorts as never) : undefined,
          viewId: sendViewId ? (activeViewId ?? undefined) : undefined,
        });

        setJumpCache((prev) => {
          // Discard stale results
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

    // Leading edge: fire immediately if enough time has passed
    if (timeSinceLastFire >= THROTTLE_MS) {
      lastFiredRef.current = now;
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
      void doJumpFetch(offset);
    }

    // Trailing edge: always schedule a trailing call to catch the final position
    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    jumpTimerRef.current = setTimeout(() => {
      const currentOffset = pendingJumpRef.current;
      if (currentOffset === null) return;
      // Don't double-fire if leading edge already handled this offset
      if (currentOffset === offset && timeSinceLastFire >= THROTTLE_MS) return;
      lastFiredRef.current = Date.now();
      void doJumpFetch(currentOffset);
    }, THROTTLE_MS);
  }, [rows.length, doJumpFetch]);

  // getRowAtIndex: absolute position (0-based) → row data or null (skeleton)
  const getRowAtIndex = useCallback(
    (absoluteIndex: number): RowItem | null => {
      if (absoluteIndex < rows.length) {
        return (rows[absoluteIndex] as RowItem) ?? null;
      }
      return jumpCacheRef.current.get(absoluteIndex) ?? null;
    },
    [rows],
  );

  /** Clear jump cache and bump generation to discard in-flight fetches. */
  const clearJumpCache = useCallback(() => {
    jumpCacheGenRef.current += 1;
    setJumpCache(new Map());
  }, []);

  /** Find a row by ID in infinite pages or jump cache. */
  const getRowById = useCallback(
    (rowId: string): RowItem | null => {
      const fromPages = rows.find((r) => (r as RowItem).id === rowId) as RowItem | undefined;
      if (fromPages) return fromPages;
      for (const item of jumpCacheRef.current.values()) {
        if (item.id === rowId) return item;
      }
      return null;
    },
    [rows],
  );

  /** Update a single row in the jump cache (optimistic mutation). */
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

  /** Remove a row from the jump cache and shift subsequent entries down. */
  const removeFromJumpCache = useCallback(
    (rowId: string) => {
      // Bump generation to discard in-flight fetches
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

  /** Insert a row into the jump cache at a specific absolute position. */
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

  /** Insert a row next to a target row in the jump cache, shifting entries to make room. */
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
          // Shift entries at or after insertKey up by 1 to make room
          next.set(key >= insertKey ? key + 1 : key, item);
        }
        next.set(insertKey, newRow);
        return next;
      });
    },
    [],
  );

  /** Remove a row from the jump cache by ID without shifting other entries. */
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

  /** Mark a row as protected from windowFetch overwrites (optimistic add). */
  const addProtectedRowId = useCallback((id: string) => {
    protectedRowIdsRef.current = new Set(protectedRowIdsRef.current).add(id);
  }, []);

  /** Unprotect a row (it was edited and is now participating in sorting). */
  const removeProtectedRowId = useCallback((id: string) => {
    const next = new Set(protectedRowIdsRef.current);
    next.delete(id);
    protectedRowIdsRef.current = next;
  }, []);

  /** Check whether a row is still protected (newly inserted, not yet sorted). */
  const isRowProtected = useCallback((id: string) => {
    return protectedRowIdsRef.current.has(id);
  }, []);

  /** Reorder a single row within the jump cache after a cell edit. */
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
    [],
  );

  return {
    q, rows, totalCount, input, debouncedSearch, isSortLoading,
    getRowAtIndex, getRowById, triggerJumpFetch,
    clearJumpCache, updateJumpCacheRow, removeFromJumpCache, addToJumpCache,
    insertIntoJumpCache, removeByIdNoShift, reorderJumpCacheRow,
    addProtectedRowId, removeProtectedRowId, isRowProtected, doJumpFetch,
    /** Ref to current jump cache map. */
    jumpCacheRef,
    /** Jump cache state (triggers re-renders, unlike the ref). */
    jumpCache,
  };
}
