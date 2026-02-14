"use client";

import { useEffect, useMemo, useCallback, useRef, useState } from "react";
import type { inferProcedureInput } from "@trpc/server";
import { keepPreviousData } from "@tanstack/react-query";

import { api } from "~/trpc/react";
import { useDebouncedValue } from "~/hooks/useDebouncedValue";
import type { AppRouter } from "~/server/api/root";

import { useGridStore } from "./grid-store";

export type RowInfiniteInput = inferProcedureInput<AppRouter["row"]["infinite"]>;

/** Shape of a row returned by both `infinite` and `windowFetch` endpoints. */
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

  // Which sorts drive the query?
  // autoSort=true  + sorts exist → use sorts (live preview, orange indicators)
  // autoSort=true  + sorts empty → fall back to permanentSorts (base order)
  // autoSort=false              → always permanentSorts (entries are just staged)
  const effectiveSorts = useGridStore((s) =>
    (s.autoSort && s.sorts.length > 0) ? s.sorts : s.permanentSorts,
  );

  // Track whether the current effective sorts are the permanent sorts.
  // This determines whether Tier 2 (ViewRowRank) can be used for jumps.
  const isUsingPermanentSorts = useGridStore((s) =>
    !(s.autoSort && s.sorts.length > 0),
  );

  const activeViewId = useGridStore((s) => s.activeViewId);
  const ranksComputing = useGridStore((s) => s.ranksComputing);
  const clearSelection = useGridStore((s) => s.clearSelection);

  const debouncedSearch = useDebouncedValue(search, 250);

  // Only send viewId (which enables the Tier 2 ViewRowRank path) when:
  // 1. We're using permanent sorts (not live autoSort preview)
  // 2. Sorts exist
  // 3. Ranks are NOT currently being computed — if they are, the ViewRowRank
  //    table is being rebuilt.  Sending viewId would race with the INSERT and
  //    either hit stale/empty data or contend for locks.  Suppressing viewId
  //    forces Tier 3 (live ORDER BY), which is correct and fast for first-page loads.
  const sendViewId = isUsingPermanentSorts && effectiveSorts.length > 0 && !ranksComputing;

  const input: RowInfiniteInput = useMemo(
    () => ({
      tableId,
      limit: 1000,
      search: debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
      filters: !filterTree && filters.length ? filters : undefined,
      conjunction: !filterTree && filters.length ? filterConjunction : undefined,
      filterTree: filterTree ?? undefined,
      sorts: effectiveSorts.length > 0 ? effectiveSorts : undefined,
      viewId: sendViewId ? (activeViewId ?? undefined) : undefined,
    }),
    [tableId, debouncedSearch, filters, filterConjunction, filterTree, effectiveSorts, sendViewId, activeViewId],
  );

  // Clear cell selection whenever the actual query parameters change.
  // Uses value-based comparison (JSON string) so referential identity
  // of the `input` object doesn't cause false positives.
  const inputKey = JSON.stringify(input);
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey]);

  const q = api.row.infinite.useInfiniteQuery(input, {
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    // Keep showing the previous rows while the new filtered/sorted query loads.
    // This prevents the "flash to empty" lag when filters/sorts change.
    placeholderData: keepPreviousData,
  });

  // Per-view row ordering: when the user has manually reordered rows via drag,
  // rowOrderIds defines the display order. We apply it client-side.
  const rowOrderIds = useGridStore((s) => s.rowOrderIds);

  // Stabilise `rows` — flatMap creates a new array on every render; useMemo
  // ensures the reference only changes when the underlying query data changes.
  // If the view has a custom rowOrderIds, reorder the rows accordingly.
  const rows = useMemo(() => {
    const flat = q.data?.pages.flatMap((p) => p.items) ?? [];

    // Only apply custom row order when:
    // 1. rowOrderIds is non-empty (user has manually reordered)
    // 2. No sorts or search are active (custom order only applies in natural view)
    if (rowOrderIds.length === 0 || effectiveSorts.length > 0 || debouncedSearch.trim()) {
      return flat;
    }

    // Build a map for O(1) lookup
    const rowMap = new Map(flat.map((r) => [r.id, r]));

    // Reorder: known rows first (in custom order), then any new rows at the end
    const ordered: typeof flat = [];
    const seen = new Set<string>();

    for (const id of rowOrderIds) {
      const r = rowMap.get(id);
      if (r) {
        ordered.push(r);
        seen.add(id);
      }
    }

    // Append rows not in the custom order (newly added rows)
    for (const r of flat) {
      if (!seen.has(r.id)) {
        ordered.push(r);
      }
    }

    return ordered;
  }, [q.data, rowOrderIds, effectiveSorts.length, debouncedSearch]);

  const totalCount: number = q.data?.pages?.[0]?.totalCount ?? 0;

  // ========================================================================
  // Jump cache — for windowFetch when user scrolls far from loaded range
  // ========================================================================
  const [jumpCache, setJumpCache] = useState<Map<number, RowItem>>(new Map());
  const jumpCacheRef = useRef(jumpCache);
  jumpCacheRef.current = jumpCache;

  // Generation counter: incremented every time the jump cache is cleared.
  // doJumpFetch captures the generation at fetch-start; if the generation has
  // changed by the time results arrive (meaning the cache was cleared again),
  // the stale results are silently discarded.  This prevents a race where a
  // slow in-flight fetch overwrites fresh data from a newer clear+fetch cycle
  // (e.g. rapid successive deletes, or a parameter change during a fetch).
  const jumpCacheGenRef = useRef(0);

  // Clear jump cache when query params change — also bumps generation so
  // any in-flight fetches with old params are discarded on arrival.
  useEffect(() => {
    jumpCacheGenRef.current += 1;
    setJumpCache(new Map());
  }, [inputKey]);

  const utils = api.useUtils();

  // Throttled jump fetch: fires immediately on first call, then at most once
  // per THROTTLE_MS during continuous scrolling, plus a trailing edge call.
  // This prevents the "skeleton gap" where continuous scrolling suppressed all fetches.
  const THROTTLE_MS = 200;
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFiredRef = useRef<number>(0);
  const pendingJumpRef = useRef<number | null>(null);

  // Track scroll direction so we can bias the fetch window.
  // 'up' = user is scrolling towards row 0; 'down' = towards last row.
  const scrollDirectionRef = useRef<"up" | "down">("down");
  const prevTriggerOffsetRef = useRef<number>(0);

  const doJumpFetch = useCallback((rawOffset: number) => {
    // ── Bias the fetch window based on scroll direction ──────────────
    // When scrolling UP the first skeleton is at the TOP of the viewport.
    // We need lots of rows ABOVE it (the direction the user is heading).
    // When scrolling DOWN the skeleton is at the BOTTOM — need rows below.
    const FETCH_LIMIT = 1000;            // fetch 1000 rows per request
    const dir = scrollDirectionRef.current;
    let behind: number;                 // rows to load BEHIND the trigger
    if (dir === "up") {
      behind = 700;                     // 700 rows above, 300 below
    } else {
      behind = 150;                     // 150 rows above, 850 below
    }
    const fetchOffset = Math.max(0, rawOffset - behind);

    // Capture generation at fetch-start. If clearJumpCache() is called
    // while this fetch is in-flight, the generation will have advanced
    // and we discard these results to prevent stale data from overwriting
    // the freshly cleared (or re-populated) cache.
    const gen = jumpCacheGenRef.current;

    return (async () => {
      try {
        const result = await utils.row.windowFetch.fetch({
          tableId,
          offset: fetchOffset,
          limit: FETCH_LIMIT,
          search: debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
          filters: !filterTree && filters.length ? (filters as never) : undefined,
          conjunction: !filterTree && filters.length ? filterConjunction : undefined,
          filterTree: filterTree ? (filterTree as never) : undefined,
          sorts: effectiveSorts.length > 0 ? (effectiveSorts as never) : undefined,
          viewId: sendViewId ? (activeViewId ?? undefined) : undefined,
        });

        setJumpCache((prev) => {
          // Discard stale results: if the cache was cleared after this
          // fetch was issued, a newer fetch is authoritative.
          if (jumpCacheGenRef.current !== gen) return prev;

          const newCache = new Map(prev);
          if (newCache.size > 15000) newCache.clear();
          (result.items as RowItem[]).forEach((item, idx) => {
            newCache.set(fetchOffset + idx, item);
          });
          return newCache;
        });
      } catch (err) {
        console.error("windowFetch error:", err);
      }
    })();
  }, [tableId, debouncedSearch, filters, filterConjunction, filterTree, effectiveSorts, activeViewId, sendViewId, utils]);

  const triggerJumpFetch = useCallback((offset: number, force = false) => {
    // Already loaded sequentially?
    if (offset < rows.length) return;

    // Already in jump cache? Skip unless force=true (used by refreshRows
    // to overwrite stale entries after a mutation without clearing the cache).
    if (!force && jumpCacheRef.current.has(offset)) return;

    // Track scroll direction: compare with the previous trigger offset
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
      doJumpFetch(offset);
    }

    // Trailing edge: always schedule a trailing call to catch the final position
    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    jumpTimerRef.current = setTimeout(() => {
      const currentOffset = pendingJumpRef.current;
      if (currentOffset === null) return;
      // Don't double-fire if leading edge already handled this offset
      if (currentOffset === offset && timeSinceLastFire >= THROTTLE_MS) return;
      lastFiredRef.current = Date.now();
      doJumpFetch(currentOffset);
    }, THROTTLE_MS);
  }, [rows.length, doJumpFetch]);

  // getRowAtIndex: absolute position (0-based) → row data or null (skeleton)
  const getRowAtIndex = useCallback(
    (absoluteIndex: number): RowItem | null => {
      // 1. Check infinite query cache (sequential pages)
      if (absoluteIndex < rows.length) {
        return (rows[absoluteIndex] as RowItem) ?? null;
      }
      // 2. Check jump cache
      return jumpCacheRef.current.get(absoluteIndex) ?? null;
    },
    [rows],
  );

  /** Wipe the window-fetch jump cache and bump the generation counter so
   *  any in-flight doJumpFetch calls (issued before this clear) will discard
   *  their results on arrival.  Use after mutations that invalidate position-
   *  based mappings (deletes, bulk ops) or when query params change. */
  const clearJumpCache = useCallback(() => {
    jumpCacheGenRef.current += 1;
    setJumpCache(new Map());
  }, []);

  /** Look up a row by ID across both infinite pages AND the jump cache. */
  const getRowById = useCallback(
    (rowId: string): RowItem | null => {
      // 1. Search infinite query pages
      const fromPages = rows.find((r) => (r as RowItem).id === rowId) as RowItem | undefined;
      if (fromPages) return fromPages;
      // 2. Search jump cache
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

  /** Remove a row from the jump cache by ID and shift subsequent entries
   *  down by 1 position (keeps positions consistent after deletion). */
  const removeFromJumpCache = useCallback(
    (rowId: string) => {
      // Bump generation so any in-flight doJumpFetch (e.g. trailing prefetch
      // from the initial jump) discards its stale pre-delete results instead
      // of overwriting the shifted cache.
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
          // Shift entries after the removed one down by 1 position
          next.set(key > keyToRemove ? key - 1 : key, item);
        }
        return next;
      });
    },
    [],
  );

  /** Insert a row into the jump cache at a specific absolute position.
   *  Used for optimistic insertion (e.g. + button) so the row renders
   *  immediately without waiting for a windowFetch round-trip. */
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

  /** Insert a row into the jump cache next to a target row, shifting subsequent
   *  entries up by 1 to make room.  Used for insert-above/below so the new row
   *  appears instantly at the correct position without a full data reload.
   *  Bumps the generation counter to invalidate any in-flight fetches. */
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

  /** Remove a row from the jump cache by ID WITHOUT shifting other entries.
   *  Leaves a gap at the old position (filled by the next fetch).
   *  Use this after a confirmed delete — it avoids the index-shifting cascade
   *  that causes phantom rows when combined with skeleton detection. */
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

  return {
    q, rows, totalCount, input, debouncedSearch,
    getRowAtIndex, getRowById, triggerJumpFetch,
    clearJumpCache, updateJumpCacheRow, removeFromJumpCache, addToJumpCache,
    insertIntoJumpCache, removeByIdNoShift, doJumpFetch,
    /** Ref to the current jump cache Map<actualIndex, RowItem>.
     *  Used by GridWorkspace for overlay positioning & keyboard navigation
     *  on rows that live outside the infinite-query page range. */
    jumpCacheRef,
  };
}
