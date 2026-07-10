"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useLatestRef } from "~/hooks/useLatestRef";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";

const MAX_SCROLL_HEIGHT = 15_000_000;

/** Bottom chrome inside the scroll content: add-row block + padding.
 *  Must match the inner-height formula in GridContentArea
 *  (totalSize + DATA_ROW_HEIGHT + 103). */
const CONTENT_BOTTOM_EXTRA = 103;

/**
 * JS-driven vertical scroll controller. The grid no longer uses native
 * vertical scrolling (the multi-million-px scroll layer caused Chrome
 * compositor checkerboarding — grey flashes — during fast flings).
 * A single offset number is the source of truth; everything that used to
 * read/write `scroller.scrollTop` goes through this controller instead.
 */
export interface GridScrollController {
  getOffset: () => number;
  /** Clamps to [0, maxScroll], updates React state, TanStack Virtual, and
   *  notifies subscribers. */
  setOffset: (next: number) => void;
  scrollBy: (delta: number) => void;
  /** Called synchronously on every offset change. Returns an unsubscribe fn. */
  subscribe: (fn: (offset: number) => void) => () => void;
  getMaxScroll: () => number;
  getViewport: () => number;
}

interface UseGridVirtualizerArgs {
  totalCount: number;
  dataRowHeight: number;
  gridScrollerRef: React.RefObject<HTMLDivElement | null>;
}

interface UseGridVirtualizerResult {
  virtualItems: VirtualItem[];
  virtualCount: number;
  isScaled: boolean;
  mapToActualIndex: (virtualIndex: number) => number;
  mapToVirtualIndex: (actualIndex: number) => number;
  mapToVirtualIndexRef: React.MutableRefObject<(n: number) => number>;
  totalVirtualSize: number;
  scrollOffset: number;
  scroll: GridScrollController;
}

export function useGridVirtualizer({
  totalCount,
  dataRowHeight,
  gridScrollerRef,
}: UseGridVirtualizerArgs): UseGridVirtualizerResult {
  const maxVirtualRows = Math.floor(MAX_SCROLL_HEIGHT / dataRowHeight);
  const virtualCount = Math.min(totalCount, maxVirtualRows);
  const isScaled = totalCount > maxVirtualRows;

  const mapToActualIndex = useCallback((virtualIndex: number): number => {
    if (!isScaled || virtualCount <= 1) return virtualIndex;
    return Math.round(virtualIndex * (totalCount - 1) / (virtualCount - 1));
  }, [isScaled, totalCount, virtualCount]);

  const mapToVirtualIndex = useCallback((actualIndex: number): number => {
    if (!isScaled || totalCount <= 1) return actualIndex;
    return Math.round(actualIndex * (virtualCount - 1) / (totalCount - 1));
  }, [isScaled, totalCount, virtualCount]);

  const mapToVirtualIndexRef = useLatestRef(mapToVirtualIndex);

  // ---- JS vertical scroll offset (source of truth) ----
  const [scrollOffset, setScrollOffsetState] = useState(0);
  const scrollOffsetRef = useRef(0);
  const virtualCountRef = useLatestRef(virtualCount);
  const dataRowHeightRef = useLatestRef(dataRowHeight);
  const subscribersRef = useRef(new Set<(offset: number) => void>());
  // TanStack's observeElementOffset callback — fed on every offset change so
  // the virtualizer recomputes the window without any native scroll event.
  const offsetCallbackRef = useRef<((offset: number, isScrolling: boolean) => void) | null>(null);

  const getMaxScroll = useCallback((): number => {
    const el = gridScrollerRef.current;
    if (!el) return 0;
    const contentHeight =
      virtualCountRef.current * dataRowHeightRef.current +
      dataRowHeightRef.current +
      CONTENT_BOTTOM_EXTRA;
    return Math.max(0, contentHeight - el.clientHeight);
  }, [gridScrollerRef, virtualCountRef, dataRowHeightRef]);

  const applyOffset = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(next, getMaxScroll()));
    if (clamped === scrollOffsetRef.current) return;
    scrollOffsetRef.current = clamped;
    setScrollOffsetState(clamped);
    offsetCallbackRef.current?.(clamped, false);
    for (const fn of subscribersRef.current) fn(clamped);
  }, [getMaxScroll]);

  const applyOffsetRef = useLatestRef(applyOffset);

  const rowVirtualizer = useVirtualizer({
    count: virtualCount,
    // Still returned so TanStack measures the viewport rect (clientHeight).
    getScrollElement: () => gridScrollerRef.current,
    estimateSize: () => dataRowHeight,
    overscan: 15,
    // Vertical scroll is JS-driven: feed our offset instead of observing a
    // native 'scroll' event on the element.
    observeElementOffset: (_instance, cb) => {
      offsetCallbackRef.current = cb;
      cb(scrollOffsetRef.current, false);
      return () => {
        offsetCallbackRef.current = null;
      };
    },
    // Route scrollToIndex/scrollToOffset through the controller.
    scrollToFn: (offset, { adjustments }) => {
      applyOffsetRef.current(offset + (adjustments ?? 0));
    },
  });

  // Preserve relative position when the row height preset changes.
  const prevDataRowHeightRef = useRef(dataRowHeight);
  useEffect(() => {
    const prevH = prevDataRowHeightRef.current;
    prevDataRowHeightRef.current = dataRowHeight;
    rowVirtualizer.measure();
    if (prevH !== dataRowHeight && prevH > 0) {
      const ratio = scrollOffsetRef.current / prevH;
      applyOffset(ratio * dataRowHeight);
    }
  }, [dataRowHeight, rowVirtualizer, applyOffset]);

  // Re-clamp when content shrinks (rows deleted, filter applied) or the
  // viewport resizes — without native scroll the browser no longer does this
  // for us.
  useEffect(() => {
    applyOffset(scrollOffsetRef.current);
    // The offset can remain at zero while rowCount changes from the initial
    // empty state to the loaded total. Scrollbar geometry still needs a
    // notification because maxScroll has changed.
    for (const fn of subscribersRef.current) fn(scrollOffsetRef.current);
  }, [virtualCount, dataRowHeight, applyOffset]);

  useEffect(() => {
    const el = gridScrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      applyOffset(scrollOffsetRef.current);
      // Notify subscribers even when the offset itself didn't change — the
      // scrollbar thumb geometry depends on the viewport height.
      for (const fn of subscribersRef.current) fn(scrollOffsetRef.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridScrollerRef, applyOffset]);

  const scroll = useMemo<GridScrollController>(() => ({
    getOffset: () => scrollOffsetRef.current,
    setOffset: (next) => applyOffset(next),
    scrollBy: (delta) => applyOffset(scrollOffsetRef.current + delta),
    subscribe: (fn) => {
      subscribersRef.current.add(fn);
      return () => {
        subscribersRef.current.delete(fn);
      };
    },
    getMaxScroll,
    getViewport: () => gridScrollerRef.current?.clientHeight ?? 0,
  }), [applyOffset, getMaxScroll, gridScrollerRef]);

  return {
    virtualItems: rowVirtualizer.getVirtualItems(),
    virtualCount,
    isScaled,
    mapToActualIndex,
    mapToVirtualIndex,
    mapToVirtualIndexRef,
    totalVirtualSize: rowVirtualizer.getTotalSize(),
    scrollOffset,
    scroll,
  };
}
