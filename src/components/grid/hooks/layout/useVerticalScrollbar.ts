import { useRef, useEffect } from "react";
import type React from "react";
import type { GridScrollController } from "~/components/grid/hooks/layout/useGridVirtualizer";

interface UseVerticalScrollbarParams {
  gridScrollerRef: React.RefObject<HTMLDivElement | null>;
  scroll: GridScrollController;
}

/**
 * Custom vertical scrollbar thumb. Vertical scrolling is JS-driven, so the
 * thumb geometry comes from the scroll controller (offset/maxScroll/viewport)
 * instead of the element's scrollTop/scrollHeight, and it subscribes to the
 * controller instead of a native 'scroll' event.
 */
export function useVerticalScrollbar({ gridScrollerRef, scroll }: UseVerticalScrollbarParams) {
  const vThumbRef = useRef<HTMLDivElement>(null);
  const isDraggingV = useRef(false);
  const dragStartY = useRef(0);
  const dragStartOffset = useRef(0);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const scroller = gridScrollerRef.current;
    const thumb = vThumbRef.current;
    if (!scroller || !thumb) return;

    const TRACK_PADDING = 3;

    const update = () => {
      const viewport = scroll.getViewport();
      const maxScroll = scroll.getMaxScroll();
      if (maxScroll <= 0) {
        thumb.style.display = "none";
        return;
      }
      thumb.style.display = "block";
      const contentHeight = viewport + maxScroll;
      const trackH = viewport - TRACK_PADDING * 2;
      const ratio = viewport / contentHeight;
      const thumbH = Math.max(30, ratio * trackH);
      const top = TRACK_PADDING + (scroll.getOffset() / maxScroll) * (trackH - thumbH);
      thumb.style.height = `${thumbH}px`;
      thumb.style.top = `${top}px`;
    };

    const showThumb = () => {
      thumb.style.opacity = "1";
      clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => {
        if (!isDraggingV.current) thumb.style.opacity = "0";
      }, 1200);
    };

    update();
    const unsubscribe = scroll.subscribe(() => {
      update();
      showThumb();
    });
    const ro = new ResizeObserver(update);
    ro.observe(scroller);
    return () => {
      unsubscribe();
      ro.disconnect();
      clearTimeout(fadeTimer.current);
    };
  }, [gridScrollerRef, scroll]);

  useEffect(() => {
    const thumb = vThumbRef.current;
    if (!thumb) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      isDraggingV.current = true;
      dragStartY.current = e.clientY;
      dragStartOffset.current = scroll.getOffset();
      thumb.style.opacity = "1";
      clearTimeout(fadeTimer.current);
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingV.current) return;
      const TRACK_PADDING = 3;
      const viewport = scroll.getViewport();
      const maxScroll = scroll.getMaxScroll();
      if (maxScroll <= 0) return;
      const contentHeight = viewport + maxScroll;
      const trackH = viewport - TRACK_PADDING * 2;
      const thumbH = Math.max(30, (viewport / contentHeight) * trackH);
      const trackSpace = trackH - thumbH;
      if (trackSpace > 0) {
        const deltaY = e.clientY - dragStartY.current;
        scroll.setOffset(dragStartOffset.current + (deltaY / trackSpace) * maxScroll);
      }
    };

    const onMouseUp = () => {
      if (!isDraggingV.current) return;
      isDraggingV.current = false;
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      fadeTimer.current = setTimeout(() => {
        thumb.style.opacity = "0";
      }, 1200);
    };

    thumb.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      thumb.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [scroll]);

  return { vThumbRef };
}
