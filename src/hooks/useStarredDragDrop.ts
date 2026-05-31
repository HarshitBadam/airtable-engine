import { useState, useEffect, useRef, useCallback } from "react";

const ITEM_HEIGHT = 39.5; // 35.5px height + 4px margin-bottom

export type DragState = {
  dragIndex: number;
  overIndex: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  itemTop: number;
  itemLeft: number;
  itemWidth: number;
} | null;

type StarredBase = { id: string; name: string };

export function useStarredDragDrop(starredBases: StarredBase[], starredEntryWrapperClass: string | undefined) {
  const [localStarredOrder, setLocalStarredOrder] = useState<string[]>([]);
  const [dragState, setDragState] = useState<DragState>(null);
  const dragRef = useRef<DragState>(null);

  const starredIds = starredBases.map((b) => b.id).join(",");
  useEffect(() => {
    if (!dragRef.current) {
      setLocalStarredOrder(starredIds.split(",").filter(Boolean));
    }
  }, [starredIds]);

  const orderedStarredBases = localStarredOrder
    .map((id) => starredBases.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => b != null);

  const startStarredDrag = useCallback(
    (e: React.PointerEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();

      const handle = e.currentTarget as HTMLElement;
      const wrapper = starredEntryWrapperClass
        ? handle.closest<HTMLElement>(`.${starredEntryWrapperClass}`)
        : null;
      const rect = wrapper?.getBoundingClientRect();

      const startX = e.clientX;
      const startY = e.clientY;
      const itemCount = orderedStarredBases.length;
      const initial: NonNullable<DragState> = {
        dragIndex: index,
        overIndex: index,
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        itemTop: rect?.top ?? 0,
        itemLeft: rect?.left ?? 0,
        itemWidth: rect?.width ?? 275,
      };
      dragRef.current = initial;
      setDragState(initial);

      const onMove = (ev: PointerEvent) => {
        const currentX = ev.clientX;
        const currentY = ev.clientY;
        const offsetY = currentY - startY;
        const rawIndex = index + offsetY / ITEM_HEIGHT;
        const overIndex = Math.max(0, Math.min(itemCount - 1, Math.round(rawIndex)));
        const next = { ...initial, overIndex, currentX, currentY };
        dragRef.current = next;
        setDragState(next);
      };

      const onUp = () => {
        const final = dragRef.current;
        if (final && final.dragIndex !== final.overIndex) {
          setLocalStarredOrder((prev) => {
            const arr = [...prev];
            const [moved] = arr.splice(final.dragIndex, 1);
            if (moved) arr.splice(final.overIndex, 0, moved);
            return arr;
          });
        }
        dragRef.current = null;
        setDragState(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [orderedStarredBases.length]
  );

  const getStarredItemStyle = useCallback(
    (index: number): React.CSSProperties => {
      if (!dragState) return {};
      const { dragIndex, overIndex } = dragState;

      if (index === dragIndex) return {};

      if (dragIndex < overIndex) {
        if (index > dragIndex && index <= overIndex) {
          return { transform: `translateY(-${ITEM_HEIGHT}px)`, transition: "transform 200ms ease" };
        }
      } else if (dragIndex > overIndex) {
        if (index >= overIndex && index < dragIndex) {
          return { transform: `translateY(${ITEM_HEIGHT}px)`, transition: "transform 200ms ease" };
        }
      }

      return { transition: "transform 200ms ease" };
    },
    [dragState]
  );

  const getFloatingStyle = useCallback((): React.CSSProperties => {
    if (!dragState) return { display: "none" };
    const dx = dragState.currentX - dragState.startX;
    const dy = dragState.currentY - dragState.startY;
    return {
      position: "fixed",
      top: dragState.itemTop + dy,
      left: dragState.itemLeft + dx,
      width: dragState.itemWidth,
      zIndex: 9999,
      pointerEvents: "none",
    };
  }, [dragState]);

  return {
    localStarredOrder,
    dragState,
    dragRef,
    startStarredDrag,
    getStarredItemStyle,
    getFloatingStyle,
    orderedStarredBases,
  };
}
