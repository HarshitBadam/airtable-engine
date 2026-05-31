"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { inferProcedureInput } from "@trpc/server";
import { keepPreviousData } from "@tanstack/react-query";

import { api } from "~/trpc/react";
import { useDebouncedValue } from "~/hooks/useDebouncedValue";
import type { AppRouter } from "~/server/api/root";

import { useGridStore } from "../GridStore";
import { useJumpCache } from "./useJumpCache";

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
  //    table is being rebuilt. Suppressing viewId forces Tier 3 (live ORDER BY).
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

  // When sorts change, show skeleton rows instead of stale data in the wrong order.
  // Track the sort fingerprint that the current fresh data was fetched with.
  const sortFingerprint = JSON.stringify(effectiveSorts);
  const [activeSortFingerprint, setActiveSortFingerprint] = useState(sortFingerprint);

  useEffect(() => {
    if (!q.isPlaceholderData) {
      setActiveSortFingerprint(sortFingerprint);
    }
  }, [q.isPlaceholderData, sortFingerprint]);

  const isSortLoading = sortFingerprint !== activeSortFingerprint;

  const rowOrderIds = useGridStore((s) => s.rowOrderIds);

  // Preserve totalCount during sort transitions so the virtualizer doesn't
  // shrink to 0 rows and flash.
  const prevTotalCountRef = useRef(0);
  const freshTotalCount: number = q.data?.pages?.[0]?.totalCount ?? 0;
  if (!isSortLoading && freshTotalCount > 0) {
    prevTotalCountRef.current = freshTotalCount;
  }
  const totalCount = isSortLoading ? prevTotalCountRef.current : freshTotalCount;

  const rows = useMemo(() => {
    if (isSortLoading) return [];

    const flat = q.data?.pages.flatMap((p) => p.items) ?? [];

    // Only apply custom row order when:
    // 1. rowOrderIds is non-empty (user has manually reordered)
    // 2. No sorts are active (custom order only applies in natural view)
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

  const jumpCacheApi = useJumpCache({
    tableId,
    rows: rows as RowItem[],
    inputKey,
    rowQueryInput: input,
    prevTotalCountRef,
  });

  return {
    q, rows, totalCount, input, debouncedSearch, isSortLoading,
    ...jumpCacheApi,
  };
}
