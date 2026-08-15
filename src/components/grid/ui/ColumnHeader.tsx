import React from "react";
import styles from "./GridHeaderArea.module.css";
import { HighlightedText } from "~/components/grid/utils/highlightText";
import type { GridColumnDef } from "./GridRow";

export interface ColumnHeaderCellProps {
  col: GridColumnDef;
  /** True only for the first scrollable column when there are no frozen columns — removes the left border. */
  isFirstScrollable?: boolean;
  getColWidth: (colId: string) => number;
  rowHeight: number;
  wrapHeaders: boolean;
  isMenuOpen: boolean;
  isSorted: boolean;
  isFiltered: boolean;
  /** Pre-lowercased search string for fast containment check. */
  searchTermLower: string;
  /** Original-case search term forwarded to HighlightedText. */
  searchTerm?: string;
  /** columnId of the current find-match in the header sentinel row, or null. */
  findHeaderMatchColId: string | null;
  /** 1-indexed column position for aria-colindex (optional). */
  colIndex?: number;
  onMenuToggle: (e: React.MouseEvent, colId: string) => void;
  onResizeStart: (e: React.MouseEvent, colId: string) => void;
  onRowHeightResizeStart: (e: React.MouseEvent) => void;
}

export function ColumnHeaderCell({
  col,
  isFirstScrollable = false,
  getColWidth,
  rowHeight,
  wrapHeaders,
  isMenuOpen,
  isSorted,
  isFiltered,
  searchTermLower,
  searchTerm,
  findHeaderMatchColId,
  colIndex,
  onMenuToggle,
  onResizeStart,
  onRowHeightResizeStart,
}: ColumnHeaderCellProps) {
  const hasMatch = searchTermLower.length > 0 && col.name.toLowerCase().includes(searchTermLower);
  const isCurrent = hasMatch && findHeaderMatchColId === col.id;

  // Background priority: active find-match (gold) > any find-match (cream) > filtered (light green) > none
  const headerBg = hasMatch
    ? (isCurrent ? "#FFD66B" : "#FFF3D3")
    : isFiltered ? "#F9FEF9" : undefined;

  return (
    <div
      role="columnheader"
      aria-label={col.name}
      {...(colIndex !== undefined ? { "aria-colindex": colIndex } : {})}
      data-col-header-id={col.id}
      className={[
        styles.gridHeaderCell,
        wrapHeaders ? styles.gridHeaderCellWrap : "",
        isMenuOpen ? styles.gridHeaderCellMenuOpen : "",
        isSorted ? styles.gridHeaderCellSorted : "",
      ].filter(Boolean).join(" ")}
      style={{
        width: getColWidth(col.id),
        ...(wrapHeaders
          ? { minHeight: rowHeight, height: "auto", overflow: "visible" }
          : { height: rowHeight }),
        ...(isFirstScrollable ? { borderLeftColor: "transparent" } : {}),
        ...(headerBg ? { backgroundColor: headerBg } : {}),
      }}
    >
      <div
        className={`${styles.gridHeaderCellMedia}${wrapHeaders ? ` ${styles.gridHeaderCellMediaWrap}` : ""}`}
        style={wrapHeaders ? { height: "auto", minHeight: 30 } : undefined}
      >
        <span className={styles.gridHeaderCellIcon}>
          {col.type === "TEXT" ? (
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M8.44187 3.26606C8.35522 3.10237 8.18518 3 7.99998 3C7.81477 3 7.64474 3.10237 7.55808 3.26606L3.05808 11.7661C2.92888 12.0101 3.02198 12.3127 3.26603 12.4419C3.51009 12.5711 3.81267 12.478 3.94187 12.2339L5.12455 10H10.8754L12.0581 12.2339C12.1873 12.478 12.4899 12.5711 12.7339 12.4419C12.978 12.3127 13.0711 12.0101 12.9419 11.7661L8.44187 3.26606ZM10.346 9L7.99998 4.56863L5.65396 9H10.346Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="nonzero" d="M6 2C5.86739 2 5.74021 2.05268 5.64645 2.14645C5.55268 2.24021 5.5 2.36739 5.5 2.5V5.5H2.5C2.36739 5.5 2.24021 5.55268 2.14645 5.64645C2.05268 5.74021 2 5.86739 2 6C2 6.13261 2.05268 6.25979 2.14645 6.35355C2.24021 6.44732 2.36739 6.5 2.5 6.5H5.5V9.5H2.5C2.36739 9.5 2.24021 9.55268 2.14645 9.64645C2.05268 9.74021 2 9.86739 2 10C2 10.1326 2.05268 10.2598 2.14645 10.3536C2.24021 10.4473 2.36739 10.5 2.5 10.5H5.5V13.5C5.5 13.6326 5.55268 13.7598 5.64645 13.8536C5.74021 13.9473 5.86739 14 6 14C6.13261 14 6.25979 13.9473 6.35355 13.8536C6.44732 13.7598 6.5 13.6326 6.5 13.5V10.5H9.5V13.5C9.5 13.6326 9.55268 13.7598 9.64645 13.8536C9.74021 13.9473 9.86739 14 10 14C10.1326 14 10.2598 13.9473 10.3536 13.8536C10.4473 13.7598 10.5 13.6326 10.5 13.5V10.5H13.5C13.6326 10.5 13.7598 10.4473 13.8536 10.3536C13.9473 10.2598 14 10.1326 14 10C14 9.86739 13.9473 9.74021 13.8536 9.64645C13.7598 9.55268 13.6326 9.5 13.5 9.5H10.5V6.5H13.5C13.6326 6.5 13.7598 6.44732 13.8536 6.35355C13.9473 6.25979 14 6.13261 14 6C14 5.86739 13.9473 5.74021 13.8536 5.64645C13.7598 5.55268 13.6326 5.5 13.5 5.5H10.5V2.5C10.5 2.36739 10.4473 2.24021 10.3536 2.14645C10.2598 2.05268 10.1326 2 10 2C9.86739 2 9.74021 2.05268 9.64645 2.14645C9.55268 2.24021 9.5 2.36739 9.5 2.5V5.5H6.5V2.5C6.5 2.36739 6.44732 2.24021 6.35355 2.14645C6.25979 2.05268 6.13261 2 6 2ZM6.5 6.5H9.5V9.5H6.5V6.5Z" />
            </svg>
          )}
        </span>
        <span
          className={`${styles.gridHeaderCellName}${wrapHeaders ? ` ${styles.gridHeaderCellNameWrap}` : ""}`}
          style={wrapHeaders ? { whiteSpace: "normal", overflow: "visible", height: "auto", textOverflow: "clip", top: 0 } : undefined}
        >
          {hasMatch ? <HighlightedText text={col.name} query={searchTerm!} /> : col.name}
        </span>
      </div>

      <span
        className={styles.gridHeaderCellChevron}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onMenuToggle(e, col.id); }}
      >
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="nonzero" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" />
        </svg>
      </span>

      <div
        className={styles.gridHeaderCellResizeHandle}
        onMouseDown={(e) => onResizeStart(e, col.id)}
      />
      <div
        className={styles.gridHeaderBottomResizeHandle}
        onMouseDown={onRowHeightResizeStart}
      />
    </div>
  );
}
