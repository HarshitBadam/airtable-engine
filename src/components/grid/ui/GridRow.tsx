import React, { memo } from "react";
import styles from "./GridContainer.module.css";
import { useGridStore } from "~/components/grid/grid-store";
import { useShallow } from "zustand/react/shallow";
import type { NumberFormatConfig } from "~/shared/numberUtils";
import { formatCellValue } from "~/shared/numberUtils";

// ============================================
// SEARCH HIGHLIGHTING HELPERS
// ============================================

/** Return non-overlapping [start, end) ranges of `query` in `text` (case-insensitive). */
export function findAllRanges(text: string, query: string): [number, number][] {
  if (!query) return [];
  const ranges: [number, number][] = [];
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  let pos = 0;
  while (pos <= lower.length - qLower.length) {
    const idx = lower.indexOf(qLower, pos);
    if (idx === -1) break;
    ranges.push([idx, idx + qLower.length]);
    pos = idx + qLower.length; // non-overlapping
  }
  return ranges;
}

/** Render `text` with matching substrings highlighted. */
export function HighlightedText({ text, query }: { text: string; query: string }) {
  const ranges = findAllRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let lastEnd = 0;
  for (const [start, end] of ranges) {
    if (start > lastEnd) parts.push(text.slice(lastEnd, start));
    parts.push(
      <span key={start} style={{ backgroundColor: "#FFD66B" }}>
        {text.slice(start, end)}
      </span>,
    );
    lastEnd = end;
  }
  if (lastEnd < text.length) parts.push(text.slice(lastEnd));
  return <>{parts}</>;
}

// ============================================
// TYPES
// ============================================

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
}: GridRowProps) {
  // Subscribe to only this row's state — other rows won't re-render
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

  // Current find-match for this row only (same pattern as activeCell)
  const findMatchColId = useGridStore(
    (s) => (s.findCurrentMatch?.rowId === row.id ? s.findCurrentMatch.columnId : null),
  );

  // Sorted column IDs — for tinting sorted columns orange
  const sortedColumnIds = useGridStore(
    useShallow((s) => s.sorts.map((sort) => sort.columnId)),
  );

  // Filtered column IDs — for tinting filtered columns green
  const filteredColumnIds = useGridStore(
    useShallow((s) => {
      if (s.filters.length === 0) return [];
      return [...new Set(s.filters.map((f) => f.columnId))];
    }),
  );

  /** Pre-compute the lowercase search term once per render. */
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
  ) {
    const isNumber = col.type === "NUMBER";

    // Search match detection (only when not editing)
    const cellHasMatch =
      !isEditing && termLower.length > 0 && value.length > 0 && value.toLowerCase().includes(termLower);
    const isFindCurrent = cellHasMatch && findMatchColId === col.id;

    // Background priority: search highlight > filter green > sorted tint > default
    let cellBg: string | undefined;
    if (cellHasMatch) {
      cellBg = isFindCurrent ? "#FFD66B" : "#FFF3D3";
    } else if (isFiltered) {
      cellBg = "#EBFBEC";
    }

    return (
      <div
        key={col.id}
        className={`${styles.gridDataCell}${isActive ? ` ${styles.gridDataCellActive}` : ""}${isSorted ? ` ${styles.gridDataCellSorted}` : ""}`}
        style={{
          width: getColWidth(col.id),
          ...extraStyle,
          ...(cellBg ? { backgroundColor: cellBg } : {}),
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
            <div className={isNumber ? styles.gridCellNumber : styles.gridCellText}>
              {(() => {
                // For NUMBER columns, format the raw value using the column's config
                const displayText = isNumber
                  ? formatCellValue(value, col.type, col.config as NumberFormatConfig | null | undefined)
                  : value;
                return cellHasMatch
                  ? <HighlightedText text={displayText} query={searchTerm} />
                  : displayText;
              })()}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`${styles.gridRow}${isDeleting ? ` ${styles.gridRowDeleting}` : ''}`}>
      {/* Frozen group (serial number + frozen columns) — sticks to left */}
      <div className={styles.gridRowFrozenGroup} style={{ width: freezeWidth }}>
        <div className={styles.gridRowNumCell}>
          <div className={styles.gridRowNumOuter}>
            <div className={styles.gridRowNumInner}>{rowIndex + 1}</div>
          </div>
        </div>
        {frozenColumns.map((col) =>
          renderCell(
            col,
            getCellValue(row.cells, col.id),
            editingColId === col.id,
            activeColId === col.id,
            sortedColumnIds.includes(col.id),
            filteredColumnIds.includes(col.id),
          ),
        )}
      </div>

      {/* Scrollable cells */}
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
        );
      })}
    </div>
  );
});
