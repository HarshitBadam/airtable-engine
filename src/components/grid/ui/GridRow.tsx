import React, { memo } from "react";
import styles from "./GridContainer.module.css";
import { useGridStore } from "~/components/grid/grid-store";

// ============================================
// TYPES
// ============================================

export type GridColumnDef = { id: string; name: string; type: string };

export interface GridRowProps {
  row: { id: string; cells: unknown };
  rowIndex: number;
  frozenColumns: GridColumnDef[];
  scrollableColumns: GridColumnDef[];
  freezeWidth: number;
  noFrozenColumns: boolean;
  getColWidth: (colId: string) => number;
  getCellValue: (cells: unknown, colId: string) => string;
  commit: (args: { rowId: string; columnId: string; columnType: "TEXT" | "NUMBER" }) => void;
  cancel: () => void;
  onCellContextMenu?: (e: React.MouseEvent, rowId: string, columnId: string) => void;
  isDeleting?: boolean;
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

  return (
    <div className={`${styles.gridRow}${isDeleting ? ` ${styles.gridRowDeleting}` : ''}`}>
      {/* Frozen group (serial number + frozen columns) — sticks to left */}
      <div className={styles.gridRowFrozenGroup} style={{ width: freezeWidth }}>
        <div className={styles.gridRowNumCell}>
          <div className={styles.gridRowNumOuter}>
            <div className={styles.gridRowNumInner}>{rowIndex + 1}</div>
          </div>
        </div>
        {frozenColumns.map((col) => {
          const value = getCellValue(row.cells, col.id);
          const isEditing = editingColId === col.id;
          const isActive = activeColId === col.id;
          const isNumber = col.type === "NUMBER";
          return (
            <div
              key={col.id}
              className={`${styles.gridDataCell}${isActive ? ` ${styles.gridDataCellActive}` : ""}`}
              style={{ width: getColWidth(col.id) }}
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
                  onBlur={() => commit({ rowId: row.id, columnId: col.id, columnType: col.type as "TEXT" | "NUMBER" })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit({ rowId: row.id, columnId: col.id, columnType: col.type as "TEXT" | "NUMBER" });
                    if (e.key === "Escape") cancel();
                  }}
                />
              ) : value ? (
                <div className={styles.gridCellContent}>
                  <div className={isNumber ? styles.gridCellNumber : styles.gridCellText}>
                    {value}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Scrollable cells */}
      {scrollableColumns.map((col, colIdx) => {
        const value = getCellValue(row.cells, col.id);
        const isEditing = editingColId === col.id;
        const isActive = activeColId === col.id;
        const isNumber = col.type === "NUMBER";
        const isLastCol = colIdx === scrollableColumns.length - 1;
        return (
          <div
            key={col.id}
            className={`${styles.gridDataCell}${isActive ? ` ${styles.gridDataCellActive}` : ""}`}
            style={{
              width: getColWidth(col.id) + (isLastCol ? 1 : 0),
              ...(noFrozenColumns && colIdx === 0 ? { borderLeftColor: 'transparent' } : {}),
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
                onBlur={() => commit({ rowId: row.id, columnId: col.id, columnType: col.type as "TEXT" | "NUMBER" })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit({ rowId: row.id, columnId: col.id, columnType: col.type as "TEXT" | "NUMBER" });
                  if (e.key === "Escape") cancel();
                }}
              />
            ) : value ? (
              <div className={styles.gridCellContent}>
                <div className={isNumber ? styles.gridCellNumber : styles.gridCellText}>
                  {value}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});
