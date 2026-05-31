import { useCallback, useRef } from "react";
import type React from "react";

interface UseFreezeDragProps {
  gridBodyRef: React.RefObject<HTMLDivElement | null>;
  freezePillRef: React.RefObject<HTMLDivElement | null>;
  freezeTooltipRef: React.RefObject<HTMLDivElement | null>;
  freezeLineRef: React.RefObject<HTMLDivElement | null>;
  freezeSnapPreviewRef: React.RefObject<HTMLDivElement | null>;
  freezeWidth: number;
  frozenColCount: number;
  snapPositions: number[];
  setFrozenColCount: (n: number) => void;
}

export function useFreezeDrag({
  gridBodyRef,
  freezePillRef,
  freezeTooltipRef,
  freezeLineRef,
  freezeSnapPreviewRef,
  freezeWidth,
  frozenColCount,
  snapPositions,
  setFrozenColCount,
}: UseFreezeDragProps) {
  const isDraggingFreezeRef = useRef(false);
  const freezeDragStartX = useRef(0);
  const freezeDragStartWidth = useRef(0);
  const freezeDragStartIdx = useRef(0);
  // Move pill via direct DOM manipulation (no re-render) for buttery-smooth tracking.
  // Only used on hover — pill stays fixed during drag.
  const movePill = useCallback((clientY: number) => {
    const body = gridBodyRef.current;
    const pill = freezePillRef.current;
    const tooltip = freezeTooltipRef.current;
    if (!body || !pill) return;
    const rect = body.getBoundingClientRect();
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    pill.style.top = `${y}px`;
    if (tooltip) {
      tooltip.style.top = `${y}px`;
    }
  }, [gridBodyRef, freezePillRef, freezeTooltipRef]);


  const handleFreezeDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingFreezeRef.current = true;
    freezeDragStartX.current = e.clientX;
    freezeDragStartWidth.current = freezeWidth;
    freezeDragStartIdx.current = frozenColCount;

    freezeLineRef.current?.classList.add("freeze-dragging");
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    const snaps = [...snapPositions];

    const findNearestSnap = (pos: number) => {
      let idx = 0;
      let dist = Infinity;
      for (let i = 0; i < snaps.length; i++) {
        const d = Math.abs(snaps[i]! - pos);
        if (d < dist) { dist = d; idx = i; }
      }
      return idx;
    };

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - freezeDragStartX.current;
      const rawWidth = freezeDragStartWidth.current + delta;
      const minW = snaps[0]!;
      const maxW = snaps[snaps.length - 1]!;
      const clamped = Math.max(minW, Math.min(rawWidth, maxW));

      if (freezeLineRef.current) {
        freezeLineRef.current.style.left = `${clamped - 3}px`;
      }

      const preview = freezeSnapPreviewRef.current;
      if (preview) {
        const nearIdx = findNearestSnap(clamped);
        if (nearIdx !== freezeDragStartIdx.current) {
          const snapX = snaps[nearIdx]!;
          preview.style.left = `${snapX - 1}px`;
          preview.style.opacity = "1";
        } else {
          preview.style.opacity = "0";
        }
      }
    };

    const handleMouseUp = () => {
      const line = freezeLineRef.current;
      const currentPos = line ? parseFloat(line.style.left) + 3 : freezeWidth;
      const nearestIdx = findNearestSnap(currentPos);

      if (line) {
        const snapWidth = snaps[nearestIdx]!;
        line.style.left = `${snapWidth - 3}px`;
      }
      if (freezeSnapPreviewRef.current) {
        freezeSnapPreviewRef.current.style.opacity = "0";
      }

      freezeLineRef.current?.classList.remove("freeze-dragging");
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      isDraggingFreezeRef.current = false;

      setFrozenColCount(nearestIdx);

      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [freezeWidth, frozenColCount, snapPositions, freezeLineRef, freezeSnapPreviewRef, setFrozenColCount]);

  const handleFreezeLineMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingFreezeRef.current) {
      movePill(e.clientY);
    }
  }, [movePill]);

  return { movePill, handleFreezeDragStart, handleFreezeLineMouseMove };
}
