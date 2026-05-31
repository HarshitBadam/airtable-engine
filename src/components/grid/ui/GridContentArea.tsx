import React from "react";
import styles from "./GridContainer.module.css";
import { GridRow } from "./GridRow";
import { GridSkeletonRow } from "./GridSkeletonRow";
import { useWorkspace } from "./GridWorkspaceContext";
import { useRowDragReorder } from "~/components/grid/hooks/rows/useRowDragReorder";

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 2C7.86739 2 7.74021 2.05268 7.64645 2.14645C7.55268 2.24021 7.5 2.36739 7.5 2.5V7.5H2.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H7.5V13.5C7.5 13.6326 7.55268 13.7598 7.64645 13.8536C7.74021 13.9473 7.86739 14 8 14C8.13261 14 8.25979 13.9473 8.35355 13.8536C8.44732 13.7598 8.5 13.6326 8.5 13.5V8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H8.5V2.5C8.5 2.36739 8.44732 2.24021 8.35355 2.14645C8.25979 2.05268 8.13261 2 8 2Z" />
    </svg>
  );
}

interface GridContentAreaProps {
  effectiveHeaderHeight: number;
  handleCellContextMenu: (e: React.MouseEvent, rowId: string, colId: string) => void;
}

export function GridContentArea({
  effectiveHeaderHeight,
  handleCellContextMenu,
}: GridContentAreaProps) {
  const {
    gridScrollerRef,
    selectionOverlayRef,
    freezeWidth,
    scrollableColumnsWidth,
    frozenColumns,
    scrollableColumns,
    getColWidth,
    getCellValue,
    stableCommit,
    stableCancel,
    handleAddRow,
    canDragRows,
    activeSearchTerm: searchTerm,
    totalCount,
    dataRowHeight: DATA_ROW_HEIGHT,
    virtualItems,
    totalVirtualSize: totalSize,
    mapToActualIndex,
    getRowAtIndex,
    backfillingColumnIds,
    handleReorderRow,
  } = useWorkspace();

  const { dragState, handleRowDragStart } = useRowDragReorder({
    canDragRows,
    gridScrollerRef,
    totalCount,
    DATA_ROW_HEIGHT,
    onReorderRow: handleReorderRow,
  });

  return (
    <div
      ref={gridScrollerRef}
      className={styles.gridContentScroller}
      style={{ top: effectiveHeaderHeight }}
    >
      <div
        className={styles.gridContentScrollerInner}
        style={{
          minWidth: freezeWidth + scrollableColumnsWidth + 93 + 60,
          height: totalSize + DATA_ROW_HEIGHT + 103,
          position: "relative",
        }}
      >
        {virtualItems.map((vi) => {
          const actualIndex = mapToActualIndex(vi.index);
          const row = getRowAtIndex(actualIndex);
          return (
            <div
              key={vi.key}
              data-index={vi.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: vi.size,
                transform: `translateY(${vi.start}px)`,
                contain: "layout style paint",
              }}
            >
              {row ? (
                <GridRow
                  key={row.id}
                  row={row}
                  rowIndex={actualIndex}
                  frozenColumns={frozenColumns}
                  scrollableColumns={scrollableColumns}
                  freezeWidth={freezeWidth}
                  noFrozenColumns={frozenColumns.length === 0}
                  getColWidth={getColWidth}
                  getCellValue={getCellValue}
                  commit={stableCommit}
                  cancel={stableCancel}
                  onCellContextMenu={handleCellContextMenu}
                  isDeleting={false}
                  searchTerm={searchTerm}
                  onRowDragStart={handleRowDragStart}
                  canDragRows={canDragRows}
                  cellHeight={DATA_ROW_HEIGHT}
                  backfillingColumnIds={backfillingColumnIds}
                />
              ) : (
                <GridSkeletonRow
                  actualIndex={actualIndex}
                  frozenColumns={frozenColumns}
                  scrollableColumns={scrollableColumns}
                  getColWidth={getColWidth}
                  cellHeight={DATA_ROW_HEIGHT}
                  freezeWidth={freezeWidth}
                />
              )}
            </div>
          );
        })}

        {dragState && dragState.currentDropIndex !== dragState.fromIndex && (
          <div
            className={styles.gridDropIndicator}
            style={{
              position: "absolute",
              top:
                dragState.currentDropIndex > dragState.fromIndex
                  ? (dragState.currentDropIndex + 1) * DATA_ROW_HEIGHT - 1
                  : dragState.currentDropIndex * DATA_ROW_HEIGHT - 1,
              width: freezeWidth + scrollableColumnsWidth + 1,
            }}
          />
        )}

        <div ref={selectionOverlayRef} className={styles.gridSelectionOverlay}>
          <div className={styles.gridSelectionHandle} />
        </div>

        <div
          className={styles.gridRow}
          style={{
            background: "transparent",
            position: "absolute",
            top: totalSize,
            left: 0,
            width: "100%",
          }}
        >
          <div
            className={styles.gridAddRowFrozen}
            style={{
              width: freezeWidth,
              position: "sticky",
              left: 0,
              zIndex: 2,
              background: "#FFFFFF",
            }}
          >
            <div className={styles.gridAddRowFrozenInner} onClick={handleAddRow}>
              <PlusIcon />
            </div>
          </div>
          <div
            className={styles.gridAddRowScrollable}
            style={{
              width: scrollableColumnsWidth + 1,
              ...(frozenColumns.length === 0
                ? { borderLeftColor: "transparent" }
                : {}),
            }}
          />
        </div>
      </div>
    </div>
  );
}
