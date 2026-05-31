"use client";

import { useCallback } from "react";
import { api } from "~/trpc/react";
import { useGridStore, useGridStoreApi } from "~/components/grid/GridStore";
import { reorderRowInCache } from "../utils/sortReorder";
import { countOccurrences } from "~/components/grid/utils/countOccurrences";
import type { RowItem, RowInfiniteInput } from "./useGridRows";

interface ColumnDef {
  id: string;
  type: string;
}

interface UseRowRefreshArgs {
  rowQueryInput: RowInfiniteInput;
  triggerJumpFetch: (idx: number, force?: boolean) => void;
  reorderJumpCacheRow: (
    rowId: string,
    sorts: { columnId: string; direction: "asc" | "desc" }[],
    colTypes: Map<string, "TEXT" | "NUMBER">,
  ) => "moved" | "evicted" | "skipped";
  removeProtectedRowId: (rowId: string) => void;
  isRowProtected: (rowId: string) => boolean;
  gridScrollerRef: React.RefObject<HTMLDivElement | null>;
  dataRowHeightRef: React.RefObject<number>;
  columnsRef: React.RefObject<ColumnDef[]>;
  rowsRef: React.RefObject<{ id: string; cells: unknown }[]>;
}

export interface UseRowRefreshResult {
  refreshRows: (rowCountDelta?: number) => void;
  handleCellMembershipChange: (rowId: string, columnId: string, value: string | number | null) => void;
  handleCellValueChange: (
    rowId: string,
    columnId: string,
    oldValue: string | number | null,
    newValue: string | number | null,
  ) => void;
}

export function useRowRefresh({
  rowQueryInput,
  triggerJumpFetch,
  reorderJumpCacheRow,
  removeProtectedRowId,
  isRowProtected,
  gridScrollerRef,
  dataRowHeightRef,
  columnsRef,
  rowsRef,
}: UseRowRefreshArgs): UseRowRefreshResult {
  const utils = api.useUtils();
  const gridStoreApi = useGridStoreApi();
  const addFindCountDelta = useGridStore((s) => s.addFindCountDelta);

  // After a mutation, we need fresh data. But `utils.row.infinite.invalidate()`
  // refetches ALL cached pages sequentially (70 pages at row 70K = 35s).
  // This helper truncates to the first page, then invalidates — so only 1
  // page is refetched (<100ms). Other pages load on-demand as user scrolls.
  //
  // NOTE: We intentionally do NOT clear the jump cache here. Clearing would
  // wipe out rows that were optimistically added (e.g. the + button row),
  // causing them to disappear when an unrelated mutation (insert above/below,
  // delete, duplicate) triggers a refresh. The stale entries are harmless:
  // the forced jump fetch below overwrites visible positions with fresh
  // server data, and sort/filter changes clear the cache via a useEffect.
  //
  // @param rowCountDelta — optimistic adjustment to totalCount (+1 for
  //   insert/duplicate, 0 for reorder/sort, etc.). The invalidate refetch
  //   confirms the authoritative count from the server.
  const refreshRows = useCallback(
    (rowCountDelta = 0) => {
      utils.row.infinite.setInfiniteData(rowQueryInput, (old) => {
        if (!old?.pages?.length) return old;
        return {
          pages: old.pages.slice(0, 1).map((page) => ({
            ...page,
            totalCount: page.totalCount + rowCountDelta,
          })),
          pageParams: old.pageParams.slice(0, 1),
        } as typeof old;
      });
      void utils.row.infinite.invalidate();

      // If the user is scrolled beyond the first page (e.g. at row 99K),
      // trigger a forced windowFetch for the current scroll position so the
      // visible data is refreshed from the server. force=true bypasses the
      // "already cached" guard so stale jump cache entries get overwritten.
      requestAnimationFrame(() => {
        const scroller = gridScrollerRef.current;
        if (!scroller) return;
        const approxOffset = Math.floor(scroller.scrollTop / dataRowHeightRef.current);
        if (approxOffset > 0) {
          triggerJumpFetch(approxOffset, true);
        }
      });
    },
    [utils, rowQueryInput, triggerJumpFetch, gridScrollerRef, dataRowHeightRef],
  );

  // Targeted refresh after a cell edit changes sort/filter membership.
  //
  // Two strategies depending on where the row lives:
  //
  //  A) Infinite query pages (rows 0..~999):
  //     Use `reorderRowInCache` for instant client-side repositioning.
  //     The row moves to its correct sorted position via binary search
  //     — no server round-trip needed.  Three outcomes:
  //       "moved"   → row repositioned within loaded pages
  //       "evicted" → row sorts beyond loaded pages (removed from view)
  //       "skipped" → row not in pages (handled by strategy B)
  //
  //  B) Jump cache (rows beyond infinite pages):
  //     Do NOT remove the entry (avoids skeleton flash).  Instead, force
  //     a jump fetch that overwrites stale cache entries with fresh server
  //     data.  The old entry acts as a natural placeholder until the fetch
  //     completes — no gap, no skeleton.
  //
  //  Both paths fire a background `invalidate()` so the server confirms
  //  the final state.  React Query deduplicates rapid calls, so multiple
  //  edits don't stack up redundant refetches.
  const handleCellMembershipChange = useCallback(
    (rowId: string, columnId: string, _value: string | number | null) => {
      const store = gridStoreApi.getState();
      const effectiveSorts =
        store.autoSort && store.sorts.length > 0 ? store.sorts : store.permanentSorts;

      // Newly-inserted row grace period (Airtable behaviour):
      // Protected rows stay pinned at their insertion point until the user
      // commits a cell in a column that is part of the active sort or filter.
      // Any commit on a conditioned column releases the row — even null.
      // Null is a valid value for sorting (NULLS FIRST) and filtering
      // (e.g. "is_empty"), so explicitly confirming a null cell is the user
      // saying "the value IS null."
      if (isRowProtected(rowId)) {
        const conditionedCols = new Set<string>();
        for (const s of effectiveSorts) conditionedCols.add(s.columnId);
        for (const f of store.filters) conditionedCols.add(f.columnId);
        if (store.filterTree) {
          const collectFilterTreeCols = (
            items: { kind?: string; columnId?: string; items?: unknown[] }[],
          ) => {
            for (const item of items) {
              if (item.kind === "condition" && item.columnId) {
                conditionedCols.add(item.columnId);
              } else if (item.kind === "group" && Array.isArray(item.items)) {
                collectFilterTreeCols(item.items as typeof items);
              }
            }
          };
          collectFilterTreeCols(
            store.filterTree.items as { kind?: string; columnId?: string; items?: unknown[] }[],
          );
        }

        if (!conditionedCols.has(columnId)) {
          return;
        }
      }

      if (effectiveSorts.length === 0) {
        removeProtectedRowId(rowId);
        void utils.row.infinite.invalidate(rowQueryInput);
        return;
      }

      const colTypes = new Map(
        columnsRef.current.map((c) => [c.id, c.type as "TEXT" | "NUMBER"]),
      );
      const sorts = effectiveSorts.map((s: { columnId: string; direction: "asc" | "desc" }) => ({
        columnId: s.columnId,
        direction: s.direction,
      }));

      // Clear this row's optimistic protection — it has been committed on a
      // conditioned column and the reorder will place it at its correct position.
      removeProtectedRowId(rowId);

      // Check whether the row lives in the loaded infinite pages or only in
      // the jump cache.  This determines the reorder strategy below.
      const isInInfinitePages = rowsRef.current.some((r) => (r as RowItem).id === rowId);

      if (isInInfinitePages) {
        // Tier 1A: Client-side reorder within loaded infinite pages.
        // Instant visual feedback — binary search + splice.
        utils.row.infinite.setInfiniteData(rowQueryInput, (old) => {
          if (!old) return old;
          const { data: reordered } = reorderRowInCache(old, rowId, sorts, colTypes);
          return reordered as typeof old;
        });
      }

      // Tier 1B: Client-side reorder within jump cache.
      // Only attempt for rows in infinite pages (where it repositions within
      // the loaded window).  For rows that live ONLY in the jump cache
      // (e.g. added via "+"), the reorder would evict the row (it sorts
      // outside the tiny window), leaving the position empty → skeleton flash.
      // Better to keep the stale data visible and let the server refetch
      // place the row correctly.
      let jumpResult: "moved" | "evicted" | "skipped" = "skipped";
      if (isInInfinitePages) {
        jumpResult = reorderJumpCacheRow(rowId, sorts, colTypes);
      }

      // Tier 2: Server confirmation — always for infinite pages.
      void utils.row.infinite.invalidate(rowQueryInput);

      // Only re-fetch the jump window from server when the row wasn't
      // successfully repositioned client-side (evicted or not in cache).
      if (jumpResult !== "moved") {
        const scroller = gridScrollerRef.current;
        if (scroller) {
          const approxOffset = Math.floor(scroller.scrollTop / dataRowHeightRef.current);
          if (approxOffset > 0) {
            triggerJumpFetch(approxOffset, true);
          }
        }
      }
    },
    [
      gridStoreApi,
      utils,
      rowQueryInput,
      triggerJumpFetch,
      reorderJumpCacheRow,
      removeProtectedRowId,
      isRowProtected,
      columnsRef,
      rowsRef,
      gridScrollerRef,
      dataRowHeightRef,
    ],
  );

  // When a cell value changes, adjust the find count delta so "X of Y"
  // updates instantly without waiting for the server count to refresh.
  const handleCellValueChange = useCallback(
    (
      _rowId: string,
      _columnId: string,
      oldValue: string | number | null,
      newValue: string | number | null,
    ) => {
      const term = gridStoreApi.getState().search.trim();
      if (!term) return;
      const oldStr = oldValue != null ? String(oldValue) : "";
      const newStr = newValue != null ? String(newValue) : "";
      const delta = countOccurrences(newStr, term) - countOccurrences(oldStr, term);
      if (delta !== 0) addFindCountDelta(delta);
    },
    [gridStoreApi, addFindCountDelta],
  );

  return { refreshRows, handleCellMembershipChange, handleCellValueChange };
}
