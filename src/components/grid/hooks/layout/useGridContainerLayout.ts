import { useRef, useState, useEffect } from "react";

/**
 * Measures the header row height when `wrapHeaders` is active.
 * Uses a ResizeObserver on both the frozen and scrollable header sections
 * and returns the taller of the two (clamped to at least `rowHeight`).
 *
 * Returns a stable `frozenHeaderMeasureRef` that must be attached to the
 * frozen header DOM node in the caller, plus the computed `effectiveHeaderHeight`.
 */
export function useGridContainerLayout({
  wrapHeaders,
  rowHeight,
  scrollableHeaderRef,
}: {
  wrapHeaders: boolean;
  rowHeight: number;
  scrollableHeaderRef: React.RefObject<HTMLDivElement | null>;
}) {
  const frozenHeaderMeasureRef = useRef<HTMLDivElement>(null);
  const [measuredHeaderHeight, setMeasuredHeaderHeight] = useState(rowHeight);

  useEffect(() => {
    if (!wrapHeaders) {
      setMeasuredHeaderHeight(rowHeight);
      return;
    }
    const frozenEl = frozenHeaderMeasureRef.current;
    const scrollEl = scrollableHeaderRef.current;
    if (!frozenEl && !scrollEl) {
      setMeasuredHeaderHeight(rowHeight);
      return;
    }
    const measure = () => {
      const fh = frozenEl?.getBoundingClientRect().height ?? 0;
      const sh = scrollEl?.getBoundingClientRect().height ?? 0;
      const maxH = Math.max(fh, sh, rowHeight);
      setMeasuredHeaderHeight(maxH);
    };
    const ro = new ResizeObserver(measure);
    if (frozenEl) ro.observe(frozenEl);
    if (scrollEl) ro.observe(scrollEl);
    measure();
    return () => ro.disconnect();
    // scrollableHeaderRef is a stable ref object — excluded from deps intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapHeaders, rowHeight]);

  const effectiveHeaderHeight = wrapHeaders ? measuredHeaderHeight : rowHeight;

  return { frozenHeaderMeasureRef, effectiveHeaderHeight };
}
