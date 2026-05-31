"use client";

import { useEffect } from "react";
import type { VirtualItem } from "@tanstack/react-virtual";
import type { RowItem } from "../useGridRows";

interface RowsQuery {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
}

interface UseInfiniteScrollArgs {
  virtualItems: VirtualItem[];
  rows: { id: string; cells: unknown }[];
  rowsQ: RowsQuery;
  totalCount: number;
  triggerJumpFetch: (idx: number, force?: boolean) => void;
  getRowAtIndex: (index: number) => RowItem | null | undefined;
  mapToActualIndex: (virtualIndex: number) => number;
}

/**
 * Handles two behaviours as the virtualizer scrolls:
 *
 * 1. Infinite pagination — fetches the next page when the last visible item
 *    is within 50 rows of the end of the loaded pages (but never more than
 *    5000 rows ahead, to prevent runaway cascades after mutations).
 *
 * 2. Jump cache — triggers windowFetch for skeleton rows that are visible
 *    but not yet in the loaded infinite pages or jump cache, and pre-fetches
 *    ahead/behind the current viewport to reduce skeleton flash.
 */
export function useInfiniteScroll({
  virtualItems,
  rows,
  rowsQ,
  totalCount,
  triggerJumpFetch,
  getRowAtIndex,
  mapToActualIndex,
}: UseInfiniteScrollArgs): void {
  useEffect(() => {
    if (virtualItems.length === 0) return;
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    const lastActual = mapToActualIndex(lastItem.index);

    // Gap guard (lastActual < rows.length + 5000) prevents a runaway cascade:
    // after mutations that truncate to page 0, rows.length drops to ~1000 while
    // the user may be at position 100K. Without it, fetchNextPage fires in a
    // loop reloading all 100 pages (30+ seconds). Distant positions are served
    // by the jump cache instead.
    if (
      lastActual >= rows.length - 50 &&
      lastActual < rows.length + 5000 &&
      rowsQ.hasNextPage &&
      !rowsQ.isFetchingNextPage
    ) {
      void rowsQ.fetchNextPage();
    }

    if (totalCount > rows.length) {
      const firstVis = virtualItems[0];
      const lastVis = virtualItems[virtualItems.length - 1];
      if (firstVis && lastVis) {
        const firstActual = mapToActualIndex(firstVis.index);
        const lastActualVis = mapToActualIndex(lastVis.index);

        for (const vItem of virtualItems) {
          const actualIdx = mapToActualIndex(vItem.index);
          if (actualIdx >= rows.length && !getRowAtIndex(actualIdx)) {
            triggerJumpFetch(actualIdx);
            break;
          }
        }

        const PREFETCH_DIST = 40;
        if (firstActual >= rows.length) {
          const topIdx = firstActual;
          const hasAbove = getRowAtIndex(topIdx - PREFETCH_DIST);
          if (!hasAbove && topIdx - PREFETCH_DIST >= rows.length) {
            triggerJumpFetch(topIdx - PREFETCH_DIST);
          }
        }
        if (lastActualVis >= rows.length) {
          const botIdx = lastActualVis;
          const hasBelow = getRowAtIndex(botIdx + PREFETCH_DIST);
          if (!hasBelow && botIdx + PREFETCH_DIST < totalCount) {
            triggerJumpFetch(botIdx + PREFETCH_DIST);
          }
        }
      }
    }
  }, [
    virtualItems,
    rows.length,
    rowsQ,
    totalCount,
    triggerJumpFetch,
    getRowAtIndex,
    mapToActualIndex,
  ]);
}
