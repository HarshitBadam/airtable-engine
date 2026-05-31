"use client";

import { useRef, useEffect } from "react";
import { useLatestRef } from "~/hooks/useLatestRef";
import { api } from "~/trpc/react";
import type { RowInfiniteInput } from "../useGridRows";

interface UseViewScrollPersistenceArgs {
  activeViewId: string | null | undefined;
  gridScrollerRef: React.RefObject<HTMLDivElement | null>;
  rowQueryInput: RowInfiniteInput;
  clearJumpCache: () => void;
}

/**
 * Handles three scroll position behaviours tied to view changes:
 *
 * 1. On view switch — saves the outgoing view's scrollTop to localStorage,
 *    invalidates the row cache for fresh data, clears the jump cache, and
 *    restores the incoming view's scrollTop (double-rAF so the virtualizer
 *    has time to measure before the scroll is applied).
 *
 * 2. On unmount — persists the final scrollTop so the next mount can restore it.
 *
 * 3. On query change (sort/filter within the same view) — scrolls to top so
 *    the user sees the first results immediately. Guards against view switches
 *    (which are handled by case 1) to avoid a visible flicker.
 */
export function useViewScrollPersistence({
  activeViewId,
  gridScrollerRef,
  rowQueryInput,
  clearJumpCache,
}: UseViewScrollPersistenceArgs): void {
  const utils = api.useUtils();

  const prevViewIdRef = useRef(activeViewId);
  const unmountViewIdRef = useLatestRef<string | null>(activeViewId ?? null);

  useEffect(() => {
    if (prevViewIdRef.current !== activeViewId) {
      const scroller = gridScrollerRef.current;
      if (scroller && prevViewIdRef.current) {
        localStorage.setItem(`view-scrollTop-${prevViewIdRef.current}`, String(scroller.scrollTop));
      }
      prevViewIdRef.current = activeViewId;
      void utils.row.infinite.invalidate();
      clearJumpCache();
      // Restore incoming view's scroll position (after data loads, so defer).
      // Double rAF: first lets React re-render, second lets the virtualizer measure.
      if (scroller && activeViewId) {
        const saved = localStorage.getItem(`view-scrollTop-${activeViewId}`);
        const scrollTop = saved ? Number(saved) : 0;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scroller.scrollTop = scrollTop;
          });
        });
      }
    }
  }, [activeViewId, utils, clearJumpCache, gridScrollerRef]);

  useEffect(() => {
    return () => {
      const viewId = unmountViewIdRef.current;
      const scroller = gridScrollerRef.current;
      if (viewId && scroller) {
        localStorage.setItem(`view-scrollTop-${viewId}`, String(scroller.scrollTop));
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevInputKeyRef = useRef<string>("");
  const prevInputViewIdRef = useRef<string | undefined>(rowQueryInput.viewId);

  // Scroll to top when sort/filter params change within the same view.
  // When the query changes, the row at position 0 is different — scroll to top
  // so the user sees the first results immediately instead of stale data mid-table.
  //
  // IMPORTANT: View switches also change rowQueryInput (because viewId is in
  // the input). Those are handled above (save/restore per-view scroll with
  // double-rAF). Guard by comparing the viewId: if it changed, this is a view
  // switch — skip to avoid a visible flicker.
  useEffect(() => {
    const key = JSON.stringify(rowQueryInput);
    const currentViewId = rowQueryInput.viewId;

    if (!prevInputKeyRef.current) {
      prevInputKeyRef.current = key;
      prevInputViewIdRef.current = currentViewId;
      return;
    }
    if (key === prevInputKeyRef.current) return;

    const isViewSwitch = currentViewId !== prevInputViewIdRef.current;
    prevInputKeyRef.current = key;
    prevInputViewIdRef.current = currentViewId;

    if (isViewSwitch) return;

    const scroller = gridScrollerRef.current;
    if (scroller) {
      requestAnimationFrame(() => {
        scroller.scrollTop = 0;
      });
    }
  }, [rowQueryInput, gridScrollerRef]);
}
