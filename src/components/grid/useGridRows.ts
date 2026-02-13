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
  const clearSelection = useGridStore((s) => s.clearSelection);

  const debouncedSearch = useDebouncedValue(search, 250);

  const input: RowInfiniteInput = useMemo(
    () => ({
      tableId,
      limit: 1000,
      search: debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
      // When filterTree is present, send it instead of flat filters
      filters: !filterTree && filters.length ? filters : undefined,
      conjunction: !filterTree && filters.length ? filterConjunction : undefined,
      filterTree: filterTree ?? undefined,
      sorts: effectiveSorts.length > 0 ? effectiveSorts : undefined,
      // Pass viewId when using permanent sorts so backend can use ViewRowRank
      viewId: isUsingPermanentSorts && effectiveSorts.length > 0 ? (activeViewId ?? undefined) : undefined,
    }),
    [tableId, debouncedSearch, filters, filterConjunction, filterTree, effectiveSorts, isUsingPermanentSorts, activeViewId],
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

  // Clear jump cache when query params change
  useEffect(() => {
    setJumpCache(new Map());
  }, [inputKey]);

  const utils = api.useUtils();

  // Pending column defaults — while a column-create mutation is in flight,
  // any windowFetch response might return rows that don't have the default
  // value yet (MVCC snapshot).  This map holds {columnId: value} pairs that
  // should be injected into every newly-fetched row.
  const pendingColumnDefaultsRef = useRef<Map<string, string | number>>(new Map());

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

    void (async () => {
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
          viewId: isUsingPermanentSorts ? (activeViewId ?? undefined) : undefined,
        });

        setJumpCache((prev) => {
          const newCache = new Map(prev);
          if (newCache.size > 15000) newCache.clear();
          const pending = pendingColumnDefaultsRef.current;
          (result.items as RowItem[]).forEach((item, idx) => {
            // Stamp pending column defaults into newly-fetched rows so
            // they show the correct value even if the DB backfill hasn't
            // committed yet at the time of the windowFetch snapshot.
            let stamped = item;
            if (pending.size > 0) {
              const cells = { ...(item.cells as Record<string, unknown> ?? {}) };
              for (const [colId, val] of pending) {
                if (!(colId in cells)) cells[colId] = val;
              }
              stamped = { ...item, cells };
            }
            newCache.set(fetchOffset + idx, stamped);
          });
          return newCache;
        });
      } catch (err) {
        console.error("windowFetch error:", err);
      }
    })();
  }, [tableId, debouncedSearch, filters, filterConjunction, filterTree, effectiveSorts, activeViewId, isUsingPermanentSorts, utils]);

  const triggerJumpFetch = useCallback((offset: number) => {
    // Already loaded sequentially?
    if (offset < rows.length) return;

    // Already in jump cache? Check that the EXACT requested offset is cached.
    if (jumpCacheRef.current.has(offset)) return;

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

  /** Wipe the window-fetch jump cache so stale entries are re-fetched on
   *  next scroll. Use this after server-side bulk mutations (e.g. default
   *  value backfill) that change data the user hasn't scrolled to yet. */
  const clearJumpCache = useCallback(() => {
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

  /** Stamp a value into a specific column for ALL jump-cached rows (default value backfill). */
  const stampJumpCacheColumn = useCallback(
    (columnId: string, value: string | number) => {
      setJumpCache((prev) => {
        if (prev.size === 0) return prev;
        const next = new Map<number, RowItem>();
        for (const [key, item] of prev) {
          const cells = (item.cells ?? {}) as Record<string, unknown>;
          next.set(key, { ...item, cells: { ...cells, [columnId]: value } });
        }
        return next;
      });
    },
    [],
  );

  /** Rename a column ID in all jump-cached rows (temp → real ID swap). */
  const remapJumpCacheColumnId = useCallback(
    (oldColId: string, newColId: string) => {
      setJumpCache((prev) => {
        if (prev.size === 0) return prev;
        const next = new Map<number, RowItem>();
        for (const [key, item] of prev) {
          const cells = (item.cells ?? {}) as Record<string, unknown>;
          if (!(oldColId in cells)) {
            next.set(key, item);
          } else {
            const { [oldColId]: val, ...rest } = cells;
            next.set(key, { ...item, cells: { ...rest, [newColId]: val } });
          }
        }
        return next;
      });
    },
    [],
  );

  /** Copy a source column's value to a destination column for ALL jump-cached rows (field duplication). */
  const copyJumpCacheColumn = useCallback(
    (srcColId: string, dstColId: string) => {
      setJumpCache((prev) => {
        if (prev.size === 0) return prev;
        const next = new Map<number, RowItem>();
        for (const [key, item] of prev) {
          const cells = (item.cells ?? {}) as Record<string, unknown>;
          const srcVal = cells[srcColId];
          if (srcVal === undefined || dstColId in cells) {
            next.set(key, item);
          } else {
            next.set(key, { ...item, cells: { ...cells, [dstColId]: srcVal } });
          }
        }
        return next;
      });
    },
    [],
  );

  return {
    q, rows, totalCount, input, debouncedSearch,
    getRowAtIndex, getRowById, triggerJumpFetch,
    clearJumpCache, updateJumpCacheRow, stampJumpCacheColumn, remapJumpCacheColumnId,
    copyJumpCacheColumn, pendingColumnDefaultsRef,
  };
}
