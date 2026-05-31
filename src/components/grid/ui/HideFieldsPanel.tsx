"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./HideFieldsPanel.module.css";
import {
  useHideFieldsDrag,
  HIDE_FIELDS_ITEM_HEIGHT,
} from "../hooks/useHideFieldsDrag";
import { TextTypeIcon, NumberTypeIcon } from "./SortIcons";

export interface HideFieldColumn {
  id: string;
  name: string;
  type: string; // "TEXT" | "NUMBER"
}

interface HideFieldsPanelProps {
  columns: HideFieldColumn[];
  hiddenColumnIds: string[];
  onToggleColumn: (columnId: string) => void;
  onHideAll: () => void;
  onShowAll: () => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

const QuestionIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <path
      fillRule="nonzero"
      d="M8.07349 4.50134C7.75062 4.49155 7.43049 4.55078 7.13904 4.67151C6.36183 4.99344 5.75017 5.76895 5.75 6.74988C5.74997 6.88249 5.80262 7.00968 5.89636 7.10347C5.99011 7.19726 6.11727 7.24997 6.24988 7.25C6.31554 7.25002 6.38056 7.2371 6.44123 7.21199C6.5019 7.18687 6.55703 7.15006 6.60347 7.10364C6.64991 7.05722 6.68675 7.00211 6.71189 6.94145C6.73704 6.8808 6.74998 6.81578 6.75 6.75012C6.75013 6.17215 7.08092 5.77793 7.52173 5.59534C7.96254 5.41275 8.47515 5.45759 8.88391 5.86621C9.24251 6.22468 9.34907 6.75995 9.15503 7.22839C8.96099 7.69684 8.50716 8.00009 8.00012 8C7.93445 7.99999 7.86942 8.01292 7.80875 8.03804C7.74808 8.06316 7.69295 8.09999 7.6465 8.14642C7.60006 8.19285 7.56322 8.24797 7.53809 8.30864C7.51295 8.36931 7.50001 8.43433 7.5 8.5V9C7.5 9.13261 7.55268 9.25979 7.64645 9.35355C7.74021 9.44732 7.86739 9.5 8 9.5C8.13261 9.5 8.25979 9.44732 8.35355 9.35355C8.44732 9.25979 8.5 9.13261 8.5 9V8.93738C9.1999 8.77686 9.79665 8.2924 10.0789 7.61108C10.4266 6.77156 10.2336 5.80137 9.59094 5.15894C9.15735 4.7255 8.61159 4.51766 8.07349 4.50134Z M8 12C8.41419 12 8.75 11.6642 8.75 11.25C8.75 10.8358 8.41419 10.5 8 10.5C7.58581 10.5 7.25 10.8358 7.25 11.25C7.25 11.6642 7.58581 12 8 12Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z"
    />
  </svg>
);

const DotsSixVerticalIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <path
      fillRule="nonzero"
      d="M5.75 4.5C6.16419 4.5 6.5 4.16419 6.5 3.75C6.5 3.33581 6.16419 3 5.75 3C5.33581 3 5 3.33581 5 3.75C5 4.16419 5.33581 4.5 5.75 4.5Z M10.25 4.5C10.6642 4.5 11 4.16419 11 3.75C11 3.33581 10.6642 3 10.25 3C9.83581 3 9.5 3.33581 9.5 3.75C9.5 4.16419 9.83581 4.5 10.25 4.5Z M5.75 8.75C6.16419 8.75 6.5 8.41419 6.5 8C6.5 7.58581 6.16419 7.25 5.75 7.25C5.33581 7.25 5 7.58581 5 8C5 8.41419 5.33581 8.75 5.75 8.75Z M10.25 8.75C10.6642 8.75 11 8.41419 11 8C11 7.58581 10.6642 7.25 10.25 7.25C9.83581 7.25 9.5 7.58581 9.5 8C9.5 8.41419 9.83581 8.75 10.25 8.75Z M5.75 13C6.16419 13 6.5 12.6642 6.5 12.25C6.5 11.8358 6.16419 11.5 5.75 11.5C5.33581 11.5 5 11.8358 5 12.25C5 12.6642 5.33581 13 5.75 13Z M10.25 13C10.6642 13 11 12.6642 11 12.25C11 11.8358 10.6642 11.5 10.25 11.5C9.83581 11.5 9.5 11.8358 9.5 12.25C9.5 12.6642 9.83581 13 10.25 13Z"
    />
  </svg>
);

export function HideFieldsPanel({
  columns,
  hiddenColumnIds,
  onToggleColumn,
  onHideAll,
  onShowAll,
  onReorder,
}: HideFieldsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredColumns = columns.filter((col) =>
    col.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const {
    dragIndex,
    dragOverIndex,
    dragPos,
    dragItemRef,
    fieldListRef,
    itemRectsRef,
    handleDragStart,
    getItemDragStyle,
  } = useHideFieldsDrag(filteredColumns.length, onReorder);

  const isHidden = useCallback(
    (colId: string) => hiddenColumnIds.includes(colId),
    [hiddenColumnIds],
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const [maxFieldListHeight, setMaxFieldListHeight] = useState<number>(421);

  useEffect(() => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    // searchRegion = 44px (8px margin-top + 36px), buttonsRow = 42px (8px margin-top + 26px + 8px margin-bottom)
    const chrome = 44 + 42;
    const available = window.innerHeight - rect.top - 8 - chrome;
    const clamped = Math.max(100, Math.min(421, available));
    setMaxFieldListHeight(clamped);
  }, [columns.length]);

  const renderFieldContent = (
    col: HideFieldColumn,
    index: number,
    isDragOverlay: boolean,
  ) => {
    const hidden = isHidden(col.id);
    return (
      <>
        <div
          className={styles.fieldItemLeft}
          onClick={isDragOverlay ? undefined : () => onToggleColumn(col.id)}
          style={isDragOverlay ? { pointerEvents: "none" } : undefined}
        >
          <div
            className={`${styles.togglePill} ${hidden ? styles.togglePillOff : styles.togglePillOn}`}
          >
            <div className={styles.togglePillCircle} />
          </div>

          <span className={styles.fieldTypeIcon}>
            {col.type === "NUMBER" ? <NumberTypeIcon /> : <TextTypeIcon />}
          </span>

          <span className={styles.fieldName}>{col.name}</span>
        </div>

        <div
          className={styles.dragHandle}
          onMouseDown={isDragOverlay ? undefined : (e) => handleDragStart(e, index)}
          style={isDragOverlay ? { cursor: "grabbing" } : undefined}
        >
          <DotsSixVerticalIcon />
        </div>
      </>
    );
  };

  return (
    <>
    <div ref={panelRef} className={styles.hideFieldsPanel}>
      <div className={styles.panelContent}>
      <div className={styles.searchRegion}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Find a field"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
        <span className={styles.searchHelpIcon}>
          <QuestionIcon />
        </span>
      </div>

      <div
        ref={fieldListRef}
        className={styles.fieldList}
        style={{ maxHeight: maxFieldListHeight }}
      >
        {filteredColumns.map((col, i) => (
          <div
            key={col.id}
            data-field-item
            className={
              dragIndex === i ? styles.fieldItemPlaceholder : styles.fieldItem
            }
            style={getItemDragStyle(i)}
          >
            {renderFieldContent(col, i, false)}
          </div>
        ))}
      </div>

      <div className={styles.buttonsRow}>
        <button
          type="button"
          className={styles.actionButton}
          onClick={onHideAll}
        >
          Hide all
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={onShowAll}
        >
          Show all
        </button>
      </div>
      </div>

    </div>

      {/* Dragged item overlay — rendered via portal to body for correct fixed positioning */}
      {dragIndex !== null && dragPos && filteredColumns[dragIndex] && createPortal(
        <div
          ref={dragItemRef}
          className={styles.fieldItemDragging}
          style={{
            left: itemRectsRef.current[dragIndex]?.left ?? 0,
            top: dragPos.y - (HIDE_FIELDS_ITEM_HEIGHT / 2),
            width: itemRectsRef.current[dragIndex]?.width ?? 288,
          }}
        >
          {renderFieldContent(filteredColumns[dragIndex], dragIndex, true)}
        </div>,
        document.body,
      )}
    </>
  );
}
