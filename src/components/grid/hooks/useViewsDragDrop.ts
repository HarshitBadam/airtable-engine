import { useState, useRef, useCallback, useEffect } from 'react';

interface DragState {
  dragIndex: number;
  startY: number;
  currentIndex: number;
  itemHeight: number;
  orderedIds: string[];
}

export function useViewsDragDrop(
  views: { id: string; name: string }[],
  viewSearchQuery: string,
  onReorderViews?: (orderedViewIds: string[]) => void,
) {
  const viewListRef = useRef<HTMLUListElement>(null);

  const [localViewOrder, setLocalViewOrder] = useState<string[] | null>(null);
  const prevViewIdsRef = useRef<string>('');

  // Reset local order when the server-authoritative view list changes
  useEffect(() => {
    const ids = views.map((v) => v.id).join(',');
    if (ids !== prevViewIdsRef.current) {
      prevViewIdsRef.current = ids;
      setLocalViewOrder(null);
    }
  }, [views]);

  const dragState = useRef<DragState | null>(null);
  const [dragActiveIndex, setDragActiveIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragDeltaY, setDragDeltaY] = useState(0);

  const filteredViews = views.filter(
    (v) => !viewSearchQuery || v.name.toLowerCase().includes(viewSearchQuery.toLowerCase()),
  );

  const orderedViews = localViewOrder
    ? localViewOrder
        .map((id) => filteredViews.find((v) => v.id === id))
        .filter(Boolean) as typeof filteredViews
    : filteredViews;

  const handleDragStart = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      const listEl = viewListRef.current;
      if (!listEl) return;
      const items = listEl.querySelectorAll<HTMLLIElement>('[data-view-drag-item]');
      if (!items[index]) return;
      const itemHeight = items[index].getBoundingClientRect().height;
      const ids = orderedViews.map((v) => v.id);
      dragState.current = { dragIndex: index, startY: e.clientY, currentIndex: index, itemHeight, orderedIds: ids };
      setDragActiveIndex(index);
      setDragOverIndex(index);
      setDragDeltaY(0);
    },
    [orderedViews],
  );

  useEffect(() => {
    if (dragActiveIndex === null) return;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      const ds = dragState.current;
      if (!ds) return;
      const delta = e.clientY - ds.startY;
      setDragDeltaY(delta);
      const rawIndex = ds.dragIndex + Math.round(delta / ds.itemHeight);
      const clampedIndex = Math.max(0, Math.min(rawIndex, ds.orderedIds.length - 1));
      if (clampedIndex !== ds.currentIndex) {
        ds.currentIndex = clampedIndex;
        setDragOverIndex(clampedIndex);
      }
    };

    const handleMouseUp = () => {
      const ds = dragState.current;
      if (ds && ds.dragIndex !== ds.currentIndex) {
        const newOrder = [...ds.orderedIds];
        const [moved] = newOrder.splice(ds.dragIndex, 1);
        newOrder.splice(ds.currentIndex, 0, moved!);
        setLocalViewOrder(newOrder);
        onReorderViews?.(newOrder);
      }
      dragState.current = null;
      setDragActiveIndex(null);
      setDragOverIndex(null);
      setDragDeltaY(0);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragActiveIndex, onReorderViews]);

  const getItemTransform = (index: number): React.CSSProperties => {
    if (dragActiveIndex === null || dragOverIndex === null) return {};
    const ds = dragState.current;
    if (!ds) return {};

    if (index === dragActiveIndex) {
      return {
        transform: `translateY(${dragDeltaY}px)`,
        zIndex: 10,
        position: 'relative',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        transition: 'none',
      };
    }

    const from = dragActiveIndex;
    const to = dragOverIndex;
    const h = ds.itemHeight;

    if (from < to) {
      if (index > from && index <= to) {
        return { transform: `translateY(${-h}px)`, transition: 'transform 0.2s ease' };
      }
    } else if (from > to) {
      if (index >= to && index < from) {
        return { transform: `translateY(${h}px)`, transition: 'transform 0.2s ease' };
      }
    }

    return { transform: 'translateY(0px)', transition: 'transform 0.2s ease' };
  };

  return { viewListRef, orderedViews, dragActiveIndex, handleDragStart, getItemTransform };
}
