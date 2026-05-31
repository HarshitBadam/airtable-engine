"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./HideFieldsPanel.module.css";
import {
  useHideFieldsDrag,
  HIDE_FIELDS_ITEM_HEIGHT,
} from "../hooks/useHideFieldsDrag";

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

const TextTypeIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <path
      fillRule="evenodd"
      d="M8.44187 3.26606C8.35522 3.10237 8.18518 3 7.99998 3C7.81477 3 7.64474 3.10237 7.55808 3.26606L3.05808 11.7661C2.92888 12.0101 3.02198 12.3127 3.26603 12.4419C3.51009 12.5711 3.81267 12.478 3.94187 12.2339L5.12455 10H10.8754L12.0581 12.2339C12.1873 12.478 12.4899 12.5711 12.7339 12.4419C12.978 12.3127 13.0711 12.0101 12.9419 11.7661L8.44187 3.26606ZM10.346 9L7.99998 4.56863L5.65396 9H10.346Z"
    />
  </svg>
);

const NumberTypeIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <path
      fillRule="nonzero"
      d="M6 2C5.86739 2 5.74021 2.05268 5.64645 2.14645C5.55268 2.24021 5.5 2.36739 5.5 2.5V5.5H2.5C2.36739 5.5 2.24021 5.55268 2.14645 5.64645C2.05268 5.74021 2 5.86739 2 6C2 6.13261 2.05268 6.25979 2.14645 6.35355C2.24021 6.44732 2.36739 6.5 2.5 6.5H5.5V9.5H2.5C2.36739 9.5 2.24021 9.55268 2.14645 9.64645C2.05268 9.74021 2 9.86739 2 10C2 10.1326 2.05268 10.2598 2.14645 10.3536C2.24021 10.4473 2.36739 10.5 2.5 10.5H5.5V13.5C5.5 13.6326 5.55268 13.7598 5.64645 13.8536C5.74021 13.9473 5.86739 14 6 14C6.13261 14 6.25979 13.9473 6.35355 13.8536C6.44732 13.7598 6.5 13.6326 6.5 13.5V10.5H9.5V13.5C9.5 13.6326 9.55268 13.7598 9.64645 13.8536C9.74021 13.9473 9.86739 14 10 14C10.1326 14 10.2598 13.9473 10.3536 13.8536C10.4473 13.7598 10.5 13.6326 10.5 13.5V10.5H13.5C13.6326 10.5 13.7598 10.4473 13.8536 10.3536C13.9473 10.2598 14 10.1326 14 10C14 9.86739 13.9473 9.74021 13.8536 9.64645C13.7598 9.55268 13.6326 9.5 13.5 9.5H10.5V6.5H13.5C13.6326 6.5 13.7598 6.44732 13.8536 6.35355C13.9473 6.25979 14 6.13261 14 6C14 5.86739 13.9473 5.74021 13.8536 5.64645C13.7598 5.55268 13.6326 5.5 13.5 5.5H10.5V2.5C10.5 2.36739 10.4473 2.24021 10.3536 2.14645C10.2598 2.05268 10.1326 2 10 2C9.86739 2 9.74021 2.05268 9.64645 2.14645C9.55268 2.24021 9.5 2.36739 9.5 2.5V5.5H6.5V2.5C6.5 2.36739 6.44732 2.24021 6.35355 2.14645C6.25979 2.05268 6.13261 2 6 2ZM6.5 6.5H9.5V9.5H6.5V6.5Z"
    />
  </svg>
);

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
