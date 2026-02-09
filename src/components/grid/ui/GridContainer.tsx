import React from "react";
import styles from "./GridContainer.module.css";
import { GridRow } from "./GridRow";
import type { GridColumnDef } from "./GridRow";

interface GridContainerProps {
  // Refs passed from parent
  gridFooterRef: React.RefObject<HTMLDivElement | null>;
  gridBodyRef: React.RefObject<HTMLDivElement | null>;
  scrollableHeaderRef: React.RefObject<HTMLDivElement | null>;
  gridScrollerRef: React.RefObject<HTMLDivElement | null>;
  hScrollRef: React.RefObject<HTMLDivElement | null>;
  scrollShadowRef: React.RefObject<HTMLDivElement | null>;
  freezeSnapPreviewRef: React.RefObject<HTMLDivElement | null>;
  freezeLineRef: React.RefObject<HTMLDivElement | null>;
  freezePillRef: React.RefObject<HTMLDivElement | null>;
  selectionOverlayRef: React.RefObject<HTMLDivElement | null>;

  // Grid dimensions
  freezeWidth: number;
  rowHeight: number;
  scrollableColumnsWidth: number;

  // Column data
  frozenColumns: GridColumnDef[];
  scrollableColumns: GridColumnDef[];
  getColWidth: (colId: string) => number;

  // Row data
  rows: { id: string; cells: unknown }[];
  virtualRange: { start: number; end: number };
  totalCount: number;
  DATA_ROW_HEIGHT: number;

  // Cell editing
  getCellValue: (cells: unknown, colId: string) => string;
  stableCommit: (args: { rowId: string; columnId: string; columnType: "TEXT" | "NUMBER" }) => void;
  stableCancel: () => void;

  // Resize handlers
  handleRowHeightResizeStart: (e: React.MouseEvent) => void;
  handleResizeStart: (e: React.MouseEvent, colId: string) => void;

  // Freeze handlers
  handleFreezeDragStart: (e: React.MouseEvent) => void;
  handleFreezeLineMouseMove: (e: React.MouseEvent) => void;
}

export function GridContainer({
  gridFooterRef,
  gridBodyRef,
  scrollableHeaderRef,
  gridScrollerRef,
  hScrollRef,
  scrollShadowRef,
  freezeSnapPreviewRef,
  freezeLineRef,
  freezePillRef,
  selectionOverlayRef,
  freezeWidth,
  rowHeight,
  scrollableColumnsWidth,
  frozenColumns,
  scrollableColumns,
  getColWidth,
  rows,
  virtualRange,
  totalCount,
  DATA_ROW_HEIGHT,
  getCellValue,
  stableCommit,
  stableCancel,
  handleRowHeightResizeStart,
  handleResizeStart,
  handleFreezeDragStart,
  handleFreezeLineMouseMove,
}: GridContainerProps) {
  return (
    <div className={styles.gridContainer} ref={gridFooterRef}>
      {/* Grid body: header + content panes */}
      <div className={styles.gridBody} ref={gridBodyRef}>
        {/* Frozen header (top-left) */}
        <div
          className={styles.gridHeaderFrozen}
          style={{ width: freezeWidth, height: rowHeight }}
        >
          {/* Serial number / checkbox header */}
          <div className={styles.gridHeaderRowNum} style={{ height: rowHeight }}>
            <div className={styles.gridHeaderRowNumInner}>
              <div className={styles.gridHeaderCheckbox} />
            </div>
            {/* Bottom resize handle (row height) */}
            <div
              className={styles.gridHeaderBottomResizeHandle}
              onMouseDown={handleRowHeightResizeStart}
            />
          </div>
          {/* Frozen column headers */}
          {frozenColumns.map((col) => (
            <div
              key={col.id}
              className={styles.gridHeaderCell}
              style={{ width: getColWidth(col.id), height: rowHeight }}
            >
              <div className={styles.gridHeaderCellMedia}>
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
                <span className={styles.gridHeaderCellName}>{col.name}</span>
              </div>
              <div
                className={styles.gridHeaderCellResizeHandle}
                onMouseDown={(e) => handleResizeStart(e, col.id)}
              />
              <div
                className={styles.gridHeaderBottomResizeHandle}
                onMouseDown={handleRowHeightResizeStart}
              />
            </div>
          ))}
        </div>

        {/* Scrollable header (top-right) — scrolls horizontally in sync with content */}
        <div
          ref={scrollableHeaderRef}
          className={styles.gridHeaderScrollable}
          style={{ left: freezeWidth, height: rowHeight }}
        >
          <div className={styles.gridHeaderScrollableInner} style={{ height: rowHeight }}>
            {scrollableColumns.map((col) => (
              <div
                key={col.id}
                className={styles.gridHeaderCell}
                style={{ width: getColWidth(col.id), height: rowHeight }}
              >
                <div className={styles.gridHeaderCellMedia}>
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
                  <span className={styles.gridHeaderCellName}>{col.name}</span>
                </div>
                <div
                  className={styles.gridHeaderCellResizeHandle}
                  onMouseDown={(e) => handleResizeStart(e, col.id)}
                />
                <div
                  className={styles.gridHeaderBottomResizeHandle}
                  onMouseDown={handleRowHeightResizeStart}
                />
              </div>
            ))}
            {/* Add column button */}
            <div className={styles.gridHeaderAddCol} style={{ height: rowHeight }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="nonzero" d="M8 2C7.86739 2 7.74021 2.05268 7.64645 2.14645C7.55268 2.24021 7.5 2.36739 7.5 2.5V7.5H2.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H7.5V13.5C7.5 13.6326 7.55268 13.7598 7.64645 13.8536C7.74021 13.9473 7.86739 14 8 14C8.13261 14 8.25979 13.9473 8.35355 13.8536C8.44732 13.7598 8.5 13.6326 8.5 13.5V8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H8.5V2.5C8.5 2.36739 8.44732 2.24021 8.35355 2.14645C8.25979 2.05268 8.13261 2 8 2Z" />
              </svg>
              {/* Bottom resize handle (row height) */}
              <div
                className={styles.gridHeaderBottomResizeHandle}
                onMouseDown={handleRowHeightResizeStart}
              />
            </div>
            {/* Right spacer */}
            <div className={styles.gridHeaderSpacer} />
          </div>
        </div>

        {/* Unified content scroller — single container, zero-lag vertical scroll */}
        <div
          ref={gridScrollerRef}
          className={styles.gridContentScroller}
          style={{ top: rowHeight }}
        >
          <div
            className={styles.gridContentScrollerInner}
            style={{ minWidth: freezeWidth + scrollableColumnsWidth + 93 + 60 }}
          >
            {/* Virtual scroll spacer — top */}
            {virtualRange.start > 0 && (
              <div style={{ height: virtualRange.start * DATA_ROW_HEIGHT, flexShrink: 0 }} aria-hidden />
            )}

            {/* Visible rows (virtualized + memoized) */}
            {rows.slice(virtualRange.start, virtualRange.end).map((row, i) => (
              <GridRow
                key={row.id}
                row={row}
                rowIndex={virtualRange.start + i}
                frozenColumns={frozenColumns}
                scrollableColumns={scrollableColumns}
                freezeWidth={freezeWidth}
                getColWidth={getColWidth}
                getCellValue={getCellValue}
                commit={stableCommit}
                cancel={stableCancel}
              />
            ))}

            {/* Virtual scroll spacer — bottom */}
            {virtualRange.end < rows.length && (
              <div style={{ height: (rows.length - virtualRange.end) * DATA_ROW_HEIGHT, flexShrink: 0 }} aria-hidden />
            )}

            {/* Add row (unified: sticky frozen + button + scrollable slab) */}
            <div className={styles.gridRow} style={{ background: 'transparent' }}>
              <div className={styles.gridAddRowFrozen} style={{ width: freezeWidth, position: 'sticky', left: 0, zIndex: 2, background: '#FFFFFF' }}>
                <div className={styles.gridAddRowFrozenInner}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 2C7.86739 2 7.74021 2.05268 7.64645 2.14645C7.55268 2.24021 7.5 2.36739 7.5 2.5V7.5H2.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H7.5V13.5C7.5 13.6326 7.55268 13.7598 7.64645 13.8536C7.74021 13.9473 7.86739 14 8 14C8.13261 14 8.25979 13.9473 8.35355 13.8536C8.44732 13.7598 8.5 13.6326 8.5 13.5V8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H8.5V2.5C8.5 2.36739 8.44732 2.24021 8.35355 2.14645C8.25979 2.05268 8.13261 2 8 2Z" />
                  </svg>
                </div>
              </div>
              {/* Scrollable slab next to + button */}
              <div className={styles.gridAddRowScrollable} style={{ width: scrollableColumnsWidth }} />
            </div>

            {/* Bottom spacer (distance between add-row and footer) */}
            <div style={{ height: 103, flexShrink: 0 }} />
          </div>
        </div>

      </div>

      {/* Horizontal scrollbar (between content and footer) */}
      <div ref={hScrollRef} className={styles.gridHorizontalScrollbar}>
        <div
          className={styles.gridHorizontalScrollbarInner}
          style={{ width: freezeWidth + scrollableColumnsWidth + 93 + 60 }}
        />
      </div>

      {/* Footer bar (always at the very bottom) */}
      <div className={styles.gridFooter}>
        {/* Frozen left pane */}
        <div
          className={styles.gridFooterFrozen}
          style={{ width: freezeWidth }}
        >
          <span className={styles.gridFooterRecordCount}>
            {totalCount} record{totalCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Scrollable right pane */}
        <div className={styles.gridFooterScrollable}>
          {/* Future: field summaries, aggregations */}
        </div>
      </div>

      {/* --- Overlays spanning full container height (header + content + footer) --- */}

      {/* Scroll shadow strip at freeze line */}
      <div
        ref={scrollShadowRef}
        className={styles.freezeScrollShadow}
        style={{ left: freezeWidth }}
      />

      {/* Blue snap preview line (shown during freeze drag) */}
      <div
        ref={freezeSnapPreviewRef}
        className={styles.gridFreezeSnapPreview}
      />

      {/* Freeze divider line (draggable, spans full height incl. footer) */}
      <div
        ref={freezeLineRef}
        className={styles.gridFreezeLine}
        style={{ left: freezeWidth - 3 }}
        onMouseDown={handleFreezeDragStart}
        onMouseMove={handleFreezeLineMouseMove}
      >
        <div
          ref={freezePillRef}
          className={styles.gridFreezeLinePill}
        />
      </div>

      {/* Selection overlay — lives at .gridBody level so it paints above
          the freeze line, frozen groups, and all cells. Positioned via JS. */}
      <div
        ref={selectionOverlayRef}
        className={styles.gridSelectionOverlay}
      >
        <div className={styles.gridSelectionHandle} />
      </div>
    </div>
  );
}
