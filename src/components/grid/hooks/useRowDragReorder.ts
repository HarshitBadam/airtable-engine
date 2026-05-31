import { useRef, useState, useCallback } from "react";
import type React from "react";
import styles from "../ui/GridContainer.module.css";

interface UseRowDragReorderParams {
  canDragRows: boolean;
  gridScrollerRef: React.RefObject<HTMLDivElement | null>;
  totalCount: number;
  DATA_ROW_HEIGHT: number;
  onReorderRow?: (rowId: string, fromIndex: number, toIndex: number) => void;
}

export function useRowDragReorder({
  canDragRows,
  gridScrollerRef,
  totalCount,
  DATA_ROW_HEIGHT,
  onReorderRow,
}: UseRowDragReorderParams) {
  const [dragState, setDragState] = useState<{
    rowId: string;
    fromIndex: number;
    currentDropIndex: number;
  } | null>(null);

  const autoScrollRafRef = useRef<number>(0);

  const handleRowDragStart = useCallback(
    (rowIndex: number, rowId: string, e: React.MouseEvent) => {
      if (!canDragRows) return;
      e.preventDefault();

      const scroller = gridScrollerRef.current;
      if (!scroller) return;

      const rowEl = (e.target as HTMLElement).closest(`.${styles.gridRow}`);
      if (!rowEl) return;

      const ghost = rowEl.cloneNode(true) as HTMLElement;
      const rowRect = rowEl.getBoundingClientRect();
      const offsetY = e.clientY - rowRect.top;
      ghost.style.position = "fixed";
      ghost.style.left = `${rowRect.left}px`;
      ghost.style.top = `${e.clientY - offsetY}px`;
      ghost.style.width = `${rowRect.width}px`;
      ghost.style.height = `${rowRect.height}px`;
      ghost.style.pointerEvents = "none";
      ghost.style.opacity = "0.85";
      ghost.style.zIndex = "99999";
      ghost.style.boxShadow = "0 2px 8px rgba(0,0,0,0.18)";
      ghost.style.overflow = "hidden";
      ghost.style.background = "#FFFFFF";
      document.body.appendChild(ghost);

      (rowEl as HTMLElement).style.opacity = "0.35";

      let currentDropIdx = rowIndex;
      setDragState({ rowId, fromIndex: rowIndex, currentDropIndex: rowIndex });
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";

      const handleMove = (ev: MouseEvent) => {
        ghost.style.top = `${ev.clientY - offsetY}px`;

        const rect = scroller.getBoundingClientRect();
        const relY = ev.clientY - rect.top + scroller.scrollTop;
        const dropIdx = Math.max(0, Math.min(totalCount - 1, Math.floor(relY / DATA_ROW_HEIGHT)));

        if (dropIdx !== currentDropIdx) {
          currentDropIdx = dropIdx;
          setDragState({ rowId, fromIndex: rowIndex, currentDropIndex: dropIdx });
        }

        const EDGE = 40;
        const SPEED = 8;
        cancelAnimationFrame(autoScrollRafRef.current);

        if (ev.clientY < rect.top + EDGE) {
          const tick = () => {
            scroller.scrollTop -= SPEED;
            autoScrollRafRef.current = requestAnimationFrame(tick);
          };
          autoScrollRafRef.current = requestAnimationFrame(tick);
        } else if (ev.clientY > rect.bottom - EDGE) {
          const tick = () => {
            scroller.scrollTop += SPEED;
            autoScrollRafRef.current = requestAnimationFrame(tick);
          };
          autoScrollRafRef.current = requestAnimationFrame(tick);
        }
      };

      const handleUp = () => {
        cancelAnimationFrame(autoScrollRafRef.current);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "";

        setDragState(null);

        if (currentDropIdx !== rowIndex) {
          const scrollerRect = scroller.getBoundingClientRect();
          const targetViewportY =
            currentDropIdx * DATA_ROW_HEIGHT - scroller.scrollTop + scrollerRect.top;

          ghost.style.transition = "top 150ms ease-out, opacity 150ms ease-out";
          ghost.style.top = `${targetViewportY}px`;
          ghost.style.opacity = "0.4";

          const finalDropIdx = currentDropIdx;
          setTimeout(() => {
            ghost.remove();
            if (rowEl.parentElement) (rowEl as HTMLElement).style.opacity = "";
            onReorderRow?.(rowId, rowIndex, finalDropIdx);
          }, 150);
        } else {
          ghost.remove();
          if (rowEl.parentElement) (rowEl as HTMLElement).style.opacity = "";
        }
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [canDragRows, gridScrollerRef, totalCount, DATA_ROW_HEIGHT, onReorderRow],
  );

  return { dragState, handleRowDragStart };
}
