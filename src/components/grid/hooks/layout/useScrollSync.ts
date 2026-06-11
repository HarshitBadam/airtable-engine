"use client";

import { useEffect } from "react";
import type { GridScrollController } from "~/components/grid/hooks/layout/useGridVirtualizer";

interface UseScrollSyncArgs {
  gridScrollerRef: React.RefObject<HTMLDivElement | null>;
  scrollableHeaderRef: React.RefObject<HTMLDivElement | null>;
  scrollShadowRef: React.RefObject<HTMLDivElement | null>;
  hScrollRef: React.RefObject<HTMLDivElement | null>;
  scroll: GridScrollController;
}

/**
 * Wires scroll input for the grid.
 *
 * Single-container architecture:
 *   Vertical: JS-driven (overflow-y: hidden). Wheel deltaY feeds the scroll
 *     controller's offset. macOS momentum still feels inertial because the OS
 *     keeps emitting wheel events during the fling. This avoids the giant
 *     natively-scrolled layer that caused Chrome checkerboarding (grey flash).
 *   Horizontal: overflow-x: hidden on scroller — no native horizontal scroll.
 *     hScrollbar is the sole driver of horizontal position; horizontal-dominant
 *     wheel gestures are forwarded to it.
 */
export function useScrollSync({
  gridScrollerRef,
  scrollableHeaderRef,
  scrollShadowRef,
  hScrollRef,
  scroll,
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

    // Horizontal-dominant gestures drive the hScrollbar (preventDefault stops
    // browser back/forward navigation). Everything else is vertical: apply
    // deltaY to the JS scroll offset. deltaMode 1 = line-based wheel (e.g.
    // Firefox with a mouse) — convert lines to pixels.
    const LINE_HEIGHT = 32;
    const handleScrollerWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        if (hScroll) hScroll.scrollLeft += e.deltaX;
      } else if (e.deltaY !== 0) {
        e.preventDefault();
        const dy = e.deltaMode === 1 ? e.deltaY * LINE_HEIGHT : e.deltaY;
        scroll.scrollBy(dy);
      }
    };

    if (hScroll) hScroll.addEventListener("scroll", handleHScroll);
    scroller.addEventListener("wheel", handleScrollerWheel, { passive: false });
    return () => {
      if (hScroll) hScroll.removeEventListener("scroll", handleHScroll);
      scroller.removeEventListener("wheel", handleScrollerWheel);
    };
  }, [gridScrollerRef, scrollableHeaderRef, scrollShadowRef, hScrollRef, scroll]);
}
