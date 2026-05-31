import React, { memo } from "react";
import styles from "./GridContainer.module.css";
import { useGridStore } from "~/components/grid/GridStore";
import { useShallow } from "zustand/react/shallow";
import type { NumberFormatConfig } from "~/shared/numberUtils";
import { formatCellValue } from "~/shared/numberUtils";
import { HighlightedText } from "~/components/grid/utils/highlightText";


export type GridColumnDef = {
  id: string;
  name: string;
  type: string;
  /** Number format config (stored as JSON in DB, cast at usage site) */
  config?: unknown;
};

export interface GridRowProps {
  row: { id: string; cells: unknown };
  rowIndex: number;
  frozenColumns: GridColumnDef[];
  scrollableColumns: GridColumnDef[];
  freezeWidth: number;
  noFrozenColumns: boolean;
  getColWidth: (colId: string) => number;
  getCellValue: (cells: unknown, colId: string) => string;
  commit: (args: { rowId: string; columnId: string; columnType: "TEXT" | "NUMBER"; numberConfig?: unknown }) => void;
  cancel: () => void;
  onCellContextMenu?: (e: React.MouseEvent, rowId: string, columnId: string) => void;
  isDeleting?: boolean;
  /** Active search term for cell highlighting (debounced, trimmed). Empty string = no search. */
  searchTerm?: string;
  /** Callback when user starts dragging a row via the 6-dot handle. */
  onRowDragStart?: (rowIndex: number, rowId: string, e: React.MouseEvent) => void;
  /** Whether the drag handle should be interactive (false when sorts/filters are active). */
  canDragRows?: boolean;
  /** Dynamic data row height in px (default 32). */
  cellHeight?: number;
  /** Columns currently being backfilled — cells show grey placeholder text */
  backfillingColumnIds?: ReadonlySet<string>;
}

/**
 * Memoized row component — subscribes to Zustand store for only THIS row's
 * active/editing state, preventing cascade re-renders across all rows.
 */
export const GridRow = memo(function GridRow({
  row,
  rowIndex,
  frozenColumns,
  scrollableColumns,
  freezeWidth,
  noFrozenColumns,
  getColWidth,
  getCellValue,
  commit,
  cancel,
  onCellContextMenu,
  isDeleting,
  searchTerm = "",
  onRowDragStart,
  canDragRows = false,
  cellHeight = 32,
  backfillingColumnIds: _backfillingColumnIds,
}: GridRowProps) {
  const activeColId = useGridStore(
    (s) => (s.activeCell?.rowId === row.id ? s.activeCell.columnId : null),
  );
  const editingColId = useGridStore(
    (s) => (s.editingCell?.rowId === row.id ? s.editingCell.columnId : null),
  );
  const editorValue = useGridStore(
    (s) => (s.editingCell?.rowId === row.id ? s.editorValue : ""),
  );
  const setActiveCell = useGridStore((s) => s.setActiveCell);
  const startEditing = useGridStore((s) => s.startEditing);
  const setEditorValue = useGridStore((s) => s.setEditorValue);

  const findCurrentMatch = useGridStore((s) =>
    s.findCurrentMatch?.rowId === row.id ? s.findCurrentMatch : null,
  );
  const findMatchColId = findCurrentMatch?.columnId ?? null;
  const findCurrentOccurrenceIndex = findCurrentMatch?.occurrenceIndex;

  const sortedColumnIds = useGridStore(
    useShallow((s) => s.autoSort ? s.sorts.map((sort) => sort.columnId) : []),
  );

  const filteredColumnIds = useGridStore(
    useShallow((s) => {
      if (s.filters.length === 0) return [];
      return [...new Set(s.filters.map((f) => f.columnId))];
    }),
  );

  const termLower = searchTerm.toLowerCase();

  /** Render a single cell (shared by frozen + scrollable). */
  function renderCell(
    col: GridColumnDef,
    value: string,
    isEditing: boolean,
    isActive: boolean,
    isSorted: boolean,
    isFiltered: boolean,
    extraStyle?: React.CSSProperties,
    colIndex?: number,
  ) {
    const isNumber = col.type === "NUMBER";

    const cellHasMatch =
      !isEditing && termLower.length > 0 && value.length > 0 && value.toLowerCase().includes(termLower);
    const isFindCurrent = cellHasMatch && findMatchColId === col.id;

    // Find highlight takes precedence over filter/sort so substring matches are visible.
    // Current match = deep yellow (#FFD66B); other matches = faint yellow (#FFF3D3).
    const isFindCurrentCell = cellHasMatch && isFindCurrent;
    let cellBg: string | undefined;
    if (cellHasMatch) {
      cellBg = isFindCurrentCell ? "#FFD66B" : "#FFF3D3";
    } else if (isFiltered) {
      cellBg = "#EBFBEC";
    }
    const sortedClass = isSorted && !cellHasMatch ? ` ${styles.gridDataCellSorted}` : "";
    const findCurrentClass = isFindCurrentCell ? ` ${styles.gridDataCellFindCurrent}` : "";

    return (
      <div
        key={col.id}
        role="gridcell"
        {...(colIndex !== undefined ? { "aria-colindex": colIndex } : {})}
        data-find-current={isFindCurrentCell ? "true" : undefined}
        className={`${styles.gridDataCell}${isActive ? ` ${styles.gridDataCellActive}` : ""}${sortedClass}${findCurrentClass}`}
        style={{
          width: getColWidth(col.id),
          height: cellHeight,
          ...extraStyle,
          ...(cellBg ? { backgroundColor: cellBg } : {}),
          ...(isFindCurrentCell ? { backgroundColor: "#FFD66B" } : {}),
        }}
        onClick={() => setActiveCell({ rowId: row.id, columnId: col.id })}
        onDoubleClick={() => startEditing({ rowId: row.id, columnId: col.id }, value)}
        onContextMenu={(e) => onCellContextMenu?.(e, row.id, col.id)}
      >
        {isEditing ? (
          <input
            className={`${styles.gridCellEditor}${isNumber ? ` ${styles.gridCellEditorNumber}` : ""}`}
            value={editorValue}
            autoFocus
            onChange={(e) => setEditorValue(e.target.value)}
            onBlur={() => commit({ rowId: row.id, columnId: col.id, columnType: col.type as "TEXT" | "NUMBER", numberConfig: col.config })}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit({ rowId: row.id, columnId: col.id, columnType: col.type as "TEXT" | "NUMBER", numberConfig: col.config });
              if (e.key === "Escape") cancel();
            }}
          />
        ) : value ? (
          <div className={styles.gridCellContent}>
            <div
              className={isNumber ? styles.gridCellNumber : styles.gridCellText}
              style={undefined}
            >
              {(() => {
                const displayText = isNumber
                  ? formatCellValue(value, col.type, col.config as NumberFormatConfig | null | undefined)
                  : value;
                return cellHasMatch
                  ? (
                      <HighlightedText
                        text={displayText}
                        query={searchTerm}
                        currentOccurrenceIndex={
                          isFindCurrent ? findCurrentOccurrenceIndex : undefined
                        }
                      />
                    )
                  : displayText;
              })()}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="row"
      aria-rowindex={rowIndex + 2}
      className={`${styles.gridRow}${isDeleting ? ` ${styles.gridRowDeleting}` : ''}`}
    >
      <div className={styles.gridRowFrozenGroup} style={{ width: freezeWidth }}>
        <div className={styles.gridRowNumCell} style={{ height: cellHeight }}>
          <div className={styles.gridRowNumOuter}>
            <div className={styles.gridRowNumInner}>{rowIndex + 1}</div>
          </div>

          <div className={styles.gridRowNumHoverOverlay} style={{ height: cellHeight }}>
            <div className={styles.gridRowNumHoverLeft}>
              <svg
                className={`${styles.gridRowNumDragIcon}${!canDragRows ? ` ${styles.gridRowNumDragDisabled}` : ''}`}
                width="16" height="16" viewBox="0 0 16 16"
                onMouseDown={canDragRows ? (e) => { e.preventDefault(); onRowDragStart?.(rowIndex, row.id, e); } : undefined}
              >
                <path fillRule="nonzero" d="M5.75 4.5C6.16419 4.5 6.5 4.16419 6.5 3.75C6.5 3.33581 6.16419 3 5.75 3C5.33581 3 5 3.33581 5 3.75C5 4.16419 5.33581 4.5 5.75 4.5Z M10.25 4.5C10.6642 4.5 11 4.16419 11 3.75C11 3.33581 10.6642 3 10.25 3C9.83581 3 9.5 3.33581 9.5 3.75C9.5 4.16419 9.83581 4.5 10.25 4.5Z M5.75 8.75C6.16419 8.75 6.5 8.41419 6.5 8C6.5 7.58581 6.16419 7.25 5.75 7.25C5.33581 7.25 5 7.58581 5 8C5 8.41419 5.33581 8.75 5.75 8.75Z M10.25 8.75C10.6642 8.75 11 8.41419 11 8C11 7.58581 10.6642 7.25 10.25 7.25C9.83581 7.25 9.5 7.58581 9.5 8C9.5 8.41419 9.83581 8.75 10.25 8.75Z M5.75 13C6.16419 13 6.5 12.6642 6.5 12.25C6.5 11.8358 6.16419 11.5 5.75 11.5C5.33581 11.5 5 11.8358 5 12.25C5 12.6642 5.33581 13 5.75 13Z M10.25 13C10.6642 13 11 12.6642 11 12.25C11 11.8358 10.6642 11.5 10.25 11.5C9.83581 11.5 9.5 11.8358 9.5 12.25C9.5 12.6642 9.83581 13 10.25 13Z" fill="currentColor" />
              </svg>
              <input type="checkbox" className={styles.gridRowNumCheckbox} tabIndex={-1} onClick={(e) => e.stopPropagation()} />
            </div>
            <div className={styles.gridRowNumHoverSpacer} />
            <div className={styles.gridRowNumExpandBtn}>
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path fillRule="nonzero" d="M10 2.5C9.86739 2.5 9.74021 2.55268 9.64645 2.64645C9.55268 2.74021 9.5 2.86739 9.5 3C9.5 3.13261 9.55268 3.25979 9.64645 3.35355C9.74021 3.44732 9.86739 3.5 10 3.5H11.793L9.14648 6.14648C9.05274 6.24025 9.00008 6.36741 9.00008 6.5C9.00008 6.63259 9.05274 6.75975 9.14648 6.85352C9.24025 6.94726 9.36741 6.99992 9.5 6.99992C9.63259 6.99992 9.75975 6.94726 9.85352 6.85352L12.5 4.20703V6C12.5 6.13261 12.5527 6.25979 12.6464 6.35355C12.7402 6.44732 12.8674 6.5 13 6.5C13.1326 6.5 13.2598 6.44732 13.3536 6.35355C13.4473 6.25979 13.5 6.13261 13.5 6V3C13.498 2.99504 13.496 2.99012 13.4939 2.98523C13.4917 2.85861 13.4415 2.73755 13.3535 2.64648C13.2598 2.55272 13.1326 2.50003 13 2.5H10Z M6.5 9C6.3674 9.00002 6.24024 9.05271 6.14648 9.14648L3.5 11.793V10C3.5 9.86739 3.44732 9.74021 3.35355 9.64645C3.25979 9.55268 3.13261 9.5 3 9.5C2.86739 9.5 2.74021 9.55268 2.64645 9.64645C2.55268 9.74021 2.5 9.86739 2.5 10V13C2.50002 13.1326 2.55271 13.2598 2.64648 13.3535C2.74024 13.4473 2.8674 13.5 3 13.5H6C6.13261 13.5 6.25979 13.4473 6.35355 13.3536C6.44732 13.2598 6.5 13.1326 6.5 13C6.5 12.8674 6.44732 12.7402 6.35355 12.6464C6.25979 12.5527 6.13261 12.5 6 12.5H4.20703L6.85352 9.85352C6.94726 9.75975 6.99992 9.63259 6.99992 9.5C6.99992 9.36741 6.94726 9.24025 6.85352 9.14648C6.75976 9.05271 6.6326 9.00002 6.5 9Z" fill="currentColor" />
              </svg>
            </div>
          </div>
        </div>
        {frozenColumns.map((col, colIdx) =>
          renderCell(
            col,
            getCellValue(row.cells, col.id),
            editingColId === col.id,
            activeColId === col.id,
            sortedColumnIds.includes(col.id),
            filteredColumnIds.includes(col.id),
            undefined,
            colIdx + 2,
          ),
        )}
      </div>

      {scrollableColumns.map((col, colIdx) => {
        const isLastCol = colIdx === scrollableColumns.length - 1;
        return renderCell(
          col,
          getCellValue(row.cells, col.id),
          editingColId === col.id,
          activeColId === col.id,
          sortedColumnIds.includes(col.id),
          filteredColumnIds.includes(col.id),
          {
            ...(isLastCol ? { width: getColWidth(col.id) + 1 } : {}),
            ...(noFrozenColumns && colIdx === 0 ? { borderLeftColor: "transparent" } : {}),
          },
          frozenColumns.length + colIdx + 2,
        );
      })}
    </div>
  );
});
