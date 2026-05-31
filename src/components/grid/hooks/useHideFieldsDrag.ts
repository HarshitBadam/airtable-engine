"use client";

import type React from "react";
import { useState, useRef, useCallback } from "react";

// Row height: content 18px + 3px top pad + 3px bottom pad + 2px margin
export const HIDE_FIELDS_ITEM_HEIGHT = 26;

export interface UseHideFieldsDragReturn {
  dragIndex: number | null;
  dragOverIndex: number | null;
  dragPos: { x: number; y: number } | null;
  dragItemRef: React.RefObject<HTMLDivElement | null>;
  fieldListRef: React.RefObject<HTMLDivElement | null>;
  itemRectsRef: React.MutableRefObject<DOMRect[]>;
  handleDragStart: (e: React.MouseEvent, index: number) => void;
  getItemDragStyle: (index: number) => React.CSSProperties | undefined;
}

export function useHideFieldsDrag(
  columnsLength: number,
  onReorder?: (fromIndex: number, toIndex: number) => void,
): UseHideFieldsDragReturn {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const dragItemRef = useRef<HTMLDivElement | null>(null);
  const fieldListRef = useRef<HTMLDivElement | null>(null);
  const itemRectsRef = useRef<DOMRect[]>([]);
  // Refs to track latest drag indices (avoids calling onReorder inside setState updaters)
  const dragIndexRef = useRef<number | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);

  const handleDragStart = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();

      if (fieldListRef.current) {
        const items = fieldListRef.current.querySelectorAll<HTMLDivElement>(
          "[data-field-item]",
        );
        itemRectsRef.current = Array.from(items).map((el) =>
          el.getBoundingClientRect(),
        );
      }

      dragIndexRef.current = index;
      dragOverIndexRef.current = index;
      setDragIndex(index);
      setDragOverIndex(index);
      setDragPos({ x: e.clientX, y: e.clientY });

      const handleMouseMove = (ev: MouseEvent) => {
        setDragPos({ x: ev.clientX, y: ev.clientY });

        const rects = itemRectsRef.current;
        let newOver = index;
        for (let i = 0; i < rects.length; i++) {
          const rect = rects[i]!;
          const midY = rect.top + rect.height / 2;
          if (ev.clientY > midY) {
            newOver = i;
          }
        }
        newOver = Math.max(0, Math.min(newOver, columnsLength - 1));
        dragOverIndexRef.current = newOver;
        setDragOverIndex(newOver);
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        document.body.style.userSelect = "";
        document.body.style.setProperty("-webkit-user-select", "");

        // Read from refs (not state) to avoid calling onReorder inside a setState updater
        const fromIdx = dragIndexRef.current;
        const toIdx = dragOverIndexRef.current;

        dragIndexRef.current = null;
        dragOverIndexRef.current = null;
        setDragIndex(null);
        setDragOverIndex(null);
        setDragPos(null);

        if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx && onReorder) {
          onReorder(fromIdx, toIdx);
        }
      };

      document.body.style.userSelect = "none";
      document.body.style.setProperty("-webkit-user-select", "none");
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [columnsLength, onReorder],
  );

  const getItemDragStyle = useCallback(
    (index: number): React.CSSProperties | undefined => {
      if (dragIndex === null || dragOverIndex === null) return undefined;

      if (index === dragIndex) {
        const delta = dragOverIndex - dragIndex;
        return {
          transform: `translateY(${delta * HIDE_FIELDS_ITEM_HEIGHT}px)`,
          transition: "transform 0.15s ease",
        };
      }

      if (dragOverIndex > dragIndex) {
        if (index > dragIndex && index <= dragOverIndex) {
          return {
            transform: `translateY(${-HIDE_FIELDS_ITEM_HEIGHT}px)`,
            transition: "transform 0.15s ease",
          };
        }
      } else if (dragOverIndex < dragIndex) {
        if (index >= dragOverIndex && index < dragIndex) {
          return {
            transform: `translateY(${HIDE_FIELDS_ITEM_HEIGHT}px)`,
            transition: "transform 0.15s ease",
          };
        }
      }

      return { transition: "transform 0.15s ease" };
    },
    [dragIndex, dragOverIndex],
  );

  return {
    dragIndex,
    dragOverIndex,
    dragPos,
    dragItemRef,
    fieldListRef,
    itemRectsRef,
    handleDragStart,
    getItemDragStyle,
  };
}
