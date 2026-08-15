import React from "react";
import styles from "./GridHeaderArea.module.css";
import { ColumnHeaderCell } from "./ColumnHeader";
import { useWorkspace } from "./GridWorkspaceContext";
import { useGridStore } from "~/components/grid/GridStore";
import { useShallow } from "zustand/react/shallow";

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 2C7.86739 2 7.74021 2.05268 7.64645 2.14645C7.55268 2.24021 7.5 2.36739 7.5 2.5V7.5H2.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H7.5V13.5C7.5 13.6326 7.55268 13.7598 7.64645 13.8536C7.74021 13.9473 7.86739 14 8 14C8.13261 14 8.25979 13.9473 8.35355 13.8536C8.44732 13.7598 8.5 13.6326 8.5 13.5V8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H8.5V2.5C8.5 2.36739 8.44732 2.24021 8.35355 2.14645C8.25979 2.05268 8.13261 2 8 2Z" />
    </svg>
  );
}

interface GridHeaderAreaProps {
  frozenHeaderMeasureRef: React.RefObject<HTMLDivElement | null>;
  effectiveHeaderHeight: number;
  headerMenuColId: string | null;
  handleHeaderMenuToggle: (e: React.MouseEvent, colId: string) => void;
  addColButtonRef: React.RefObject<HTMLDivElement | null>;
  handleAddColClick: () => void;
}

export function GridHeaderArea({
  frozenHeaderMeasureRef,
  effectiveHeaderHeight,
  headerMenuColId,
  handleHeaderMenuToggle,
  addColButtonRef,
  handleAddColClick,
}: GridHeaderAreaProps) {
  const {
    wrapHeaders,
    freezeWidth,
    rowHeight,
    frozenColumns,
    scrollableColumns,
    getColWidth,
    handleRowHeightResizeStart,
    handleResizeStart,
    scrollableHeaderRef,
    activeSearchTerm: searchTerm,
  } = useWorkspace();

  const sortedColumnIds = useGridStore(
    useShallow((s) => (s.autoSort ? s.sorts.map((sort) => sort.columnId) : [])),
  );

  const filteredColumnIds = useGridStore(
    useShallow((s) => {
      if (s.filters.length === 0) return [];
      return [...new Set(s.filters.map((f) => f.columnId))];
    }),
  );

  const findHeaderMatchColId = useGridStore(
    (s) =>
      s.findCurrentMatch?.rowId === "__header__"
        ? s.findCurrentMatch.columnId
        : null,
  );

  const searchTermLower = searchTerm ? searchTerm.toLowerCase() : "";

  return (
    <>
      <div
        ref={frozenHeaderMeasureRef}
        role="row"
        aria-rowindex={1}
        className={`${styles.gridHeaderFrozen}${wrapHeaders ? ` ${styles.gridHeaderFrozenWrap}` : ""}`}
        style={{
          width: freezeWidth,
          ...(wrapHeaders
            ? {
                minHeight: effectiveHeaderHeight,
                height: "auto",
                overflow: "visible",
              }
            : { height: rowHeight }),
        }}
      >
        <div
          className={styles.gridHeaderRowNum}
          style={
            wrapHeaders
              ? { minHeight: rowHeight, height: "auto" }
              : { height: rowHeight }
          }
        >
          <div className={styles.gridHeaderRowNumInner}>
            <div className={styles.gridHeaderCheckbox} />
          </div>
          <div
            className={styles.gridHeaderBottomResizeHandle}
            onMouseDown={handleRowHeightResizeStart}
          />
        </div>
        {frozenColumns.map((col, colIdx) => (
          <ColumnHeaderCell
            key={col.id}
            col={col}
            colIndex={colIdx + 2}
            getColWidth={getColWidth}
            rowHeight={rowHeight}
            wrapHeaders={wrapHeaders}
            isMenuOpen={headerMenuColId === col.id}
            isSorted={sortedColumnIds.includes(col.id)}
            isFiltered={filteredColumnIds.includes(col.id)}
            searchTermLower={searchTermLower}
            searchTerm={searchTerm}
            findHeaderMatchColId={findHeaderMatchColId}
            onMenuToggle={handleHeaderMenuToggle}
            onResizeStart={handleResizeStart}
            onRowHeightResizeStart={handleRowHeightResizeStart}
          />
        ))}
      </div>

      <div
        ref={scrollableHeaderRef}
        className={`${styles.gridHeaderScrollable}${wrapHeaders ? ` ${styles.gridHeaderScrollableWrap}` : ""}`}
        style={{
          left: freezeWidth,
          ...(wrapHeaders
            ? {
                minHeight: effectiveHeaderHeight,
                height: "auto",
                overflow: "visible",
              }
            : { height: rowHeight }),
        }}
      >
        <div
          className={styles.gridHeaderScrollableInner}
          style={
            wrapHeaders
              ? {
                  minHeight: effectiveHeaderHeight,
                  height: "auto",
                  overflow: "visible",
                }
              : { height: rowHeight }
          }
        >
          {scrollableColumns.map((col, colIdx) => (
            <ColumnHeaderCell
              key={col.id}
              col={col}
              colIndex={frozenColumns.length + colIdx + 2}
              isFirstScrollable={frozenColumns.length === 0 && colIdx === 0}
              getColWidth={getColWidth}
              rowHeight={rowHeight}
              wrapHeaders={wrapHeaders}
              isMenuOpen={headerMenuColId === col.id}
              isSorted={sortedColumnIds.includes(col.id)}
              isFiltered={filteredColumnIds.includes(col.id)}
              searchTermLower={searchTermLower}
              searchTerm={searchTerm}
              findHeaderMatchColId={findHeaderMatchColId}
              onMenuToggle={handleHeaderMenuToggle}
              onResizeStart={handleResizeStart}
              onRowHeightResizeStart={handleRowHeightResizeStart}
            />
          ))}
          <div
            ref={addColButtonRef}
            className={styles.gridHeaderAddCol}
            style={
              wrapHeaders
                ? { minHeight: rowHeight, height: effectiveHeaderHeight }
                : { height: rowHeight }
            }
            onClick={handleAddColClick}
          >
            <PlusIcon />
            <div
              className={styles.gridHeaderBottomResizeHandle}
              onMouseDown={handleRowHeightResizeStart}
            />
          </div>
          <div className={styles.gridHeaderSpacer} />
        </div>
      </div>
    </>
  );
}
