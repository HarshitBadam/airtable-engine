import { useRef, useEffect } from "react";
import type React from "react";

interface UseVerticalScrollbarParams {
  gridScrollerRef: React.RefObject<HTMLDivElement | null>;
}

export function useVerticalScrollbar({ gridScrollerRef }: UseVerticalScrollbarParams) {
  const vThumbRef = useRef<HTMLDivElement>(null);
  const isDraggingV = useRef(false);
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const scroller = gridScrollerRef.current;
    const thumb = vThumbRef.current;
    if (!scroller || !thumb) return;

    const TRACK_PADDING = 3;

    const update = () => {
      const { clientHeight, scrollHeight, scrollTop } = scroller;
      if (scrollHeight <= clientHeight) {
        thumb.style.display = "none";
        return;
      }
      thumb.style.display = "block";
      const trackH = clientHeight - TRACK_PADDING * 2;
      const ratio = clientHeight / scrollHeight;
      const thumbH = Math.max(30, ratio * trackH);
      const maxScroll = scrollHeight - clientHeight;
      const top = TRACK_PADDING + (maxScroll > 0 ? (scrollTop / maxScroll) * (trackH - thumbH) : 0);
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

    const onScroll = () => { update(); showThumb(); };

    update();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      ro.disconnect();
      clearTimeout(fadeTimer.current);
    };
  }, [gridScrollerRef]);

  useEffect(() => {
    const thumb = vThumbRef.current;
    const scroller = gridScrollerRef.current;
    if (!thumb || !scroller) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      isDraggingV.current = true;
      dragStartY.current = e.clientY;
      dragStartScrollTop.current = scroller.scrollTop;
      thumb.style.opacity = "1";
      clearTimeout(fadeTimer.current);
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingV.current) return;
      const TRACK_PADDING = 3;
      const { clientHeight, scrollHeight } = scroller;
      const trackH = clientHeight - TRACK_PADDING * 2;
      const thumbH = Math.max(30, (clientHeight / scrollHeight) * trackH);
      const trackSpace = trackH - thumbH;
      const maxScroll = scrollHeight - clientHeight;
      if (trackSpace > 0) {
        const deltaY = e.clientY - dragStartY.current;
        scroller.scrollTop = dragStartScrollTop.current + (deltaY / trackSpace) * maxScroll;
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
  }, [gridScrollerRef]);

  return { vThumbRef };
}
