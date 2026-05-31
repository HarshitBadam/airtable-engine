import { useCallback } from "react";
import type React from "react";

const COLUMN_MIN_WIDTH = 60;

interface UseResizeHandlersProps {
  columnWidthsRef: React.MutableRefObject<Record<string, number>>;
  rowHeightRef: React.MutableRefObject<number>;
  defaultColWidth: number;
  setColumnWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setRowHeight: React.Dispatch<React.SetStateAction<number>>;
}

export function useResizeHandlers({
  columnWidthsRef,
  rowHeightRef,
  defaultColWidth,
  setColumnWidths,
  setRowHeight,
}: UseResizeHandlersProps) {
  const handleResizeStart = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidthsRef.current[colId] ?? defaultColWidth;

    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    let rafId = 0;
    let finalWidth = startWidth;

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      finalWidth = Math.max(COLUMN_MIN_WIDTH, startWidth + delta);
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setColumnWidths((prev) => ({ ...prev, [colId]: finalWidth }));
      });
    };

    const handleMouseUp = () => {
      cancelAnimationFrame(rafId);
      setColumnWidths((prev) => ({ ...prev, [colId]: finalWidth }));
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [columnWidthsRef, defaultColWidth, setColumnWidths]);

  const handleRowHeightResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = rowHeightRef.current;

    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    let rafId = 0;
    let finalHeight = startH;

    const handleMouseMove = (ev: MouseEvent) => {
      finalHeight = Math.max(24, Math.min(140, startH + (ev.clientY - startY)));
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setRowHeight(finalHeight);
      });
    };

    const handleMouseUp = () => {
      cancelAnimationFrame(rafId);
      setRowHeight(finalHeight);
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [rowHeightRef, setRowHeight]);

  return { handleResizeStart, handleRowHeightResizeStart };
}
