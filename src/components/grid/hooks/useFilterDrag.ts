import { useState, useRef, useCallback } from "react";
import {
  type FilterTreeItem,
  isGroup,
  addChildToGroup,
} from "~/components/grid/utils/filterTree";

interface UseFilterDragParams {
  rootItems: FilterTreeItem[];
  setRootItems: React.Dispatch<React.SetStateAction<FilterTreeItem[]>>;
  closeDropdown: () => void;
}

const ROW_HEIGHT = 40;

export function useFilterDrag({ rootItems, setRootItems, closeDropdown }: UseFilterDragParams) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dropIntoGroupId, setDropIntoGroupId] = useState<string | null>(null);
  const [expandingGroupId, setExpandingGroupId] = useState<string | null>(null);
  const [inGroupDrag, setInGroupDrag] = useState<{
    groupId: string;
    fromIdx: number;
    overIdx: number;
  } | null>(null);
  const [inGroupDragPos, setInGroupDragPos] = useState<{ x: number; y: number } | null>(null);

  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);
  const itemRectsRef = useRef<DOMRect[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);
  const dropIntoGroupIdRef = useRef<string | null>(null);
  const inGroupDragRef = useRef<{ groupId: string; fromIdx: number; overIdx: number } | null>(null);
  const inGroupItemRectsRef = useRef<DOMRect[]>([]);
  const groupBoxRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const groupContentRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const reorderRoot = useCallback((fromIdx: number, toIdx: number) => {
    setRootItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      if (moved) next.splice(toIdx, 0, moved);
      return next;
    });
  }, [setRootItems]);

  const reorderInGroup = useCallback((groupId: string, fromIdx: number, toIdx: number) => {
    setRootItems((prev) =>
      prev.map((item) => {
        if (isGroup(item) && item.id === groupId) {
          const next = [...item.items];
          const [moved] = next.splice(fromIdx, 1);
          if (moved) next.splice(toIdx, 0, moved);
          return { ...item, items: next };
        }
        return item;
      }),
    );
  }, [setRootItems]);

  const moveItemIntoGroup = useCallback(
    (itemIdx: number, groupId: string) => {
      setRootItems((prev) => {
        const item = prev[itemIdx];
        if (!item) return prev;
        if (isGroup(item) && item.id === groupId) return prev;
        const next = prev.filter((_, i) => i !== itemIdx);
        return addChildToGroup(next, groupId, item);
      });
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
      setExpandingGroupId(groupId);
      expandTimerRef.current = setTimeout(() => {
        setExpandingGroupId(null);
        expandTimerRef.current = null;
      }, 300);
    },
    [setRootItems],
  );

  const handleDragStart = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      closeDropdown();

      if (rowsContainerRef.current) {
        const els = rowsContainerRef.current.querySelectorAll<HTMLDivElement>("[data-filter-row]");
        itemRectsRef.current = Array.from(els).map((el) => el.getBoundingClientRect());
      }

      dragIndexRef.current = index;
      dragOverIndexRef.current = index;
      dropIntoGroupIdRef.current = null;
      setDragIndex(index);
      setDragOverIndex(index);
      setDropIntoGroupId(null);
      setDragPos({ x: e.clientX, y: e.clientY });

      const handleMouseMove = (ev: MouseEvent) => {
        setDragPos({ x: ev.clientX, y: ev.clientY });

        let foundGroupId: string | null = null;
        for (const [gid, el] of groupBoxRefs.current.entries()) {
          const rect = el.getBoundingClientRect();
          if (
            ev.clientX >= rect.left &&
            ev.clientX <= rect.right &&
            ev.clientY >= rect.top &&
            ev.clientY <= rect.bottom
          ) {
            const draggedItem = rootItems[index];
            if (!draggedItem || (isGroup(draggedItem) && draggedItem.id === gid)) continue;
            foundGroupId = gid;
            break;
          }
        }

        if (foundGroupId) {
          dropIntoGroupIdRef.current = foundGroupId;
          setDropIntoGroupId(foundGroupId);
          return;
        }

        dropIntoGroupIdRef.current = null;
        setDropIntoGroupId(null);

        const rects = itemRectsRef.current;
        let newOver = index;
        for (let i = 0; i < rects.length; i++) {
          const rect = rects[i]!;
          if (ev.clientY > rect.top + rect.height / 2) newOver = i;
        }
        newOver = Math.max(0, Math.min(newOver, rootItems.length - 1));
        dragOverIndexRef.current = newOver;
        setDragOverIndex(newOver);
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "";

        const fromIdx = dragIndexRef.current;
        const toIdx = dragOverIndexRef.current;
        const targetGroupId = dropIntoGroupIdRef.current;

        dragIndexRef.current = null;
        dragOverIndexRef.current = null;
        dropIntoGroupIdRef.current = null;
        setDragIndex(null);
        setDragOverIndex(null);
        setDragPos(null);
        setDropIntoGroupId(null);

        if (targetGroupId && fromIdx !== null) {
          moveItemIntoGroup(fromIdx, targetGroupId);
        } else if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
          reorderRoot(fromIdx, toIdx);
        }
      };

      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [rootItems, reorderRoot, moveItemIntoGroup, closeDropdown],
  );

  const handleInGroupDragStart = useCallback(
    (e: React.MouseEvent, groupId: string, childIdx: number) => {
      e.preventDefault();
      closeDropdown();

      const containerEl = groupContentRefs.current.get(groupId);
      if (containerEl) {
        const els = containerEl.querySelectorAll<HTMLDivElement>("[data-filter-row]");
        inGroupItemRectsRef.current = Array.from(els).map((el) => el.getBoundingClientRect());
      }

      const state = { groupId, fromIdx: childIdx, overIdx: childIdx };
      inGroupDragRef.current = state;
      setInGroupDrag(state);
      setInGroupDragPos({ x: e.clientX, y: e.clientY });

      const handleMouseMove = (ev: MouseEvent) => {
        setInGroupDragPos({ x: ev.clientX, y: ev.clientY });

        const rects = inGroupItemRectsRef.current;
        let newOver = childIdx;
        for (let i = 0; i < rects.length; i++) {
          const rect = rects[i]!;
          if (ev.clientY > rect.top + rect.height / 2) newOver = i;
        }
        newOver = Math.max(0, Math.min(newOver, rects.length - 1));
        if (inGroupDragRef.current) {
          inGroupDragRef.current = { ...inGroupDragRef.current, overIdx: newOver };
          setInGroupDrag({ ...inGroupDragRef.current });
        }
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "";

        const dragState = inGroupDragRef.current;
        inGroupDragRef.current = null;
        setInGroupDrag(null);
        setInGroupDragPos(null);

        if (dragState && dragState.fromIdx !== dragState.overIdx) {
          reorderInGroup(dragState.groupId, dragState.fromIdx, dragState.overIdx);
        }
      };

      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [reorderInGroup, closeDropdown],
  );

  const getRowDragStyle = (index: number): React.CSSProperties | undefined => {
    if (dragIndex === null || dragOverIndex === null) return undefined;
    if (dropIntoGroupId) return index === dragIndex ? { opacity: 0.35 } : undefined;

    const rects = itemRectsRef.current;
    const draggedHeight = rects[dragIndex]?.height ?? ROW_HEIGHT;

    if (index === dragIndex) {
      let offset = 0;
      if (dragOverIndex > dragIndex) {
        for (let i = dragIndex + 1; i <= dragOverIndex; i++) offset += rects[i]?.height ?? ROW_HEIGHT;
      } else {
        for (let i = dragOverIndex; i < dragIndex; i++) offset -= rects[i]?.height ?? ROW_HEIGHT;
      }
      return { transform: `translateY(${offset}px)`, zIndex: 10 };
    }

    if (dragOverIndex > dragIndex && index > dragIndex && index <= dragOverIndex) {
      return { transform: `translateY(${-draggedHeight}px)` };
    }
    if (dragOverIndex < dragIndex && index >= dragOverIndex && index < dragIndex) {
      return { transform: `translateY(${draggedHeight}px)` };
    }
    return undefined;
  };

  const getInGroupDragStyle = (
    groupId: string,
    childIdx: number,
  ): React.CSSProperties | undefined => {
    if (inGroupDrag?.groupId !== groupId) return undefined;
    const { fromIdx, overIdx } = inGroupDrag;
    const rects = inGroupItemRectsRef.current;
    const draggedHeight = rects[fromIdx]?.height ?? ROW_HEIGHT;

    if (childIdx === fromIdx) {
      let offset = 0;
      if (overIdx > fromIdx) {
        for (let i = fromIdx + 1; i <= overIdx; i++) offset += rects[i]?.height ?? ROW_HEIGHT;
      } else {
        for (let i = overIdx; i < fromIdx; i++) offset -= rects[i]?.height ?? ROW_HEIGHT;
      }
      return { transform: `translateY(${offset}px)`, opacity: 0.35, zIndex: 10 };
    }
    if (overIdx > fromIdx && childIdx > fromIdx && childIdx <= overIdx) {
      return { transform: `translateY(${-draggedHeight}px)` };
    }
    if (overIdx < fromIdx && childIdx >= overIdx && childIdx < fromIdx) {
      return { transform: `translateY(${draggedHeight}px)` };
    }
    return undefined;
  };

  return {
    dragIndex,
    dragOverIndex,
    dragPos,
    dropIntoGroupId,
    expandingGroupId,
    inGroupDrag,
    inGroupDragPos,
    rowsContainerRef,
    itemRectsRef,
    inGroupItemRectsRef,
    groupBoxRefs,
    groupContentRefs,
    ROW_HEIGHT,
    handleDragStart,
    handleInGroupDragStart,
    getRowDragStyle,
    getInGroupDragStyle,
  };
}
