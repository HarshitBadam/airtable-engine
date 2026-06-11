"use client";

import { useEffect } from "react";

interface UseScrollSyncArgs {
  gridScrollerRef: React.RefObject<HTMLDivElement | null>;
  scrollableHeaderRef: React.RefObject<HTMLDivElement | null>;
  scrollShadowRef: React.RefObject<HTMLDivElement | null>;
  hScrollRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Wires horizontal scroll sync between the hScrollbar, grid scroller, header,
 * and scroll shadow. Also forwards horizontal wheel events from the scroller to
 * the hScrollbar so trackpad swipes move horizontally without triggering
 * browser back/forward navigation.
 *
 * Single-container architecture:
 *   Vertical: 100% native (overflow-y: auto). Zero JS, zero lag.
 *   Horizontal: overflow-x: hidden on scroller — no native horizontal scroll.
 *     hScrollbar is the sole driver of horizontal position.
 */
export function useScrollSync({
  gridScrollerRef,
  scrollableHeaderRef,
  scrollShadowRef,
  hScrollRef,
}: UseScrollSyncArgs): void {
  useEffect(() => {
    const scroller = gridScrollerRef.current;
    const header = scrollableHeaderRef.current;
    const shadow = scrollShadowRef.current;
    const hScroll = hScrollRef.current;
    if (!scroller) return;

    // hScrollbar is the single source of truth for horizontal position.
    // Sets scroller (programmatic scrollLeft works even with overflow-x: hidden),
    // header, and scroll shadow.
    const handleHScroll = () => {
      if (!hScroll) return;
      scroller.scrollLeft = hScroll.scrollLeft;
      if (header) header.scrollLeft = hScroll.scrollLeft;
      if (shadow) shadow.style.opacity = hScroll.scrollLeft > 0 ? "1" : "0";
    };

    // Forward horizontal wheel/trackpad to the hScrollbar.
    //
    // Only intercept when the gesture is primarily horizontal. We preventDefault
    // there to stop browser back/forward navigation and drive the custom
    // hScrollbar. Crucially we DO NOT touch scrollTop: vertical scrolling stays
    // 100% native so Chrome owns the fling and rasterizes in step with it.
    // The previous version preventDefaulted on any deltaX !== 0 (true for most
    // macOS trackpad vertical swipes) and then re-applied scrollTop manually,
    // mixing manual and native scroll within a single gesture and causing jank.
    const handleScrollerWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        if (hScroll) hScroll.scrollLeft += e.deltaX;
      }
    };

    if (hScroll) hScroll.addEventListener("scroll", handleHScroll);
    scroller.addEventListener("wheel", handleScrollerWheel, { passive: false });
    return () => {
      if (hScroll) hScroll.removeEventListener("scroll", handleHScroll);
      scroller.removeEventListener("wheel", handleScrollerWheel);
    };
  }, [gridScrollerRef, scrollableHeaderRef, scrollShadowRef, hScrollRef]);
}
