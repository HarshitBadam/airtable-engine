import React, { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { VirtualItem } from "@tanstack/react-virtual";
import styles from "./GridContainer.module.css";
import { GridRow, HighlightedText } from "./GridRow";
import type { GridColumnDef } from "./GridRow";
import { useGridStore } from "~/components/grid/grid-store";
import { useShallow } from "zustand/react/shallow";
import { CreateFieldPanel } from "./CreateFieldPanel";
import type { NumberFormatConfig } from "~/shared/numberUtils";
import type { RowItem } from "~/components/grid/useGridRows";

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
  freezeTooltipRef: React.RefObject<HTMLDivElement | null>;
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
  virtualItems: VirtualItem[];
  totalSize: number;
  totalCount: number;
  DATA_ROW_HEIGHT: number;
  /** Map virtual index → actual row index (proportional when totalCount > max virtual rows). */
  mapToActualIndex: (virtualIndex: number) => number;
  getRowAtIndex: (index: number) => RowItem | null;

  // Cell editing
  getCellValue: (cells: unknown, colId: string) => string;
  stableCommit: (args: { rowId: string; columnId: string; columnType: "TEXT" | "NUMBER"; numberConfig?: unknown }) => void;
  stableCancel: () => void;

  // Resize handlers
  handleRowHeightResizeStart: (e: React.MouseEvent) => void;
  handleResizeStart: (e: React.MouseEvent, colId: string) => void;

  // Freeze handlers
  handleFreezeDragStart: (e: React.MouseEvent) => void;
  handleFreezeLineMouseMove: (e: React.MouseEvent) => void;

  // Add row
  onAddRow?: () => void;

  // Record actions (context menu)
  onInsertRecordAbove?: (rowId: string) => void;
  onInsertRecordBelow?: (rowId: string) => void;
  onDuplicateRecord?: (rowId: string) => void;
  onDeleteRecord?: (rowId: string) => void;

  // Column actions (header menu)
  onDeleteField?: (columnId: string) => void;
  onHideField?: (columnId: string) => void;
  onSortByField?: (columnId: string, direction: "asc" | "desc") => void;
  onFilterByField?: (columnId: string) => void;
  onDuplicateField?: (columnId: string, duplicateCells: boolean) => void;

  // Field creation callback (from CreateFieldPanel → FieldConfigPanel)
  onCreateField?: (name: string, type: string, defaultValue: string, numberConfig?: NumberFormatConfig, insertPosition?: { anchorColId: string; side: "left" | "right" }) => void;

  // Field edit callback (rename / update config)
  onEditFieldSave?: (columnId: string, name: string, numberConfig?: NumberFormatConfig) => void;

  // Row IDs currently animating out (slide-up delete)
  deletingRowIds?: Set<string>;

  // Search highlighting — debounced, trimmed search term (empty = no search)
  searchTerm?: string;

  // Row drag-to-reorder
  onReorderRow?: (rowId: string, fromIndex: number, toIndex: number) => void;
  canDragRows?: boolean;

  // Wrap headers toggle — when true, header cell text wraps instead of truncating
  wrapHeaders?: boolean;

  // Bulk add rows (100k)
  onAddBulkRows?: () => void;
  isBulkAdding?: boolean;
  baseColor?: string;
  baseTextColor?: string;
  /** Columns currently being backfilled — cells show grey placeholder text */
  backfillingColumnIds?: ReadonlySet<string>;
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
  freezeTooltipRef,
  selectionOverlayRef,
  freezeWidth,
  rowHeight,
  scrollableColumnsWidth,
  frozenColumns,
  scrollableColumns,
  getColWidth,
  rows,
  virtualItems,
  totalSize,
  totalCount,
  DATA_ROW_HEIGHT,
  mapToActualIndex,
  getRowAtIndex,
  getCellValue,
  stableCommit,
  stableCancel,
  handleRowHeightResizeStart,
  handleResizeStart,
  handleFreezeDragStart,
  handleFreezeLineMouseMove,
  onAddRow,
  onInsertRecordAbove,
  onInsertRecordBelow,
  onDuplicateRecord,
  onDeleteRecord,
  onDeleteField,
  onHideField,
  onSortByField,
  onFilterByField,
  onDuplicateField,
  onCreateField,
  onEditFieldSave,
  deletingRowIds,
  searchTerm,
  onReorderRow,
  canDragRows = false,
  wrapHeaders = false,
  onAddBulkRows,
  isBulkAdding = false,
  baseColor = "#7D37EF",
  baseTextColor = "#FFFFFF",
  backfillingColumnIds,
}: GridContainerProps) {
  // Sorted column IDs — for tinting sorted column headers orange.
  // ONLY for autoSort=true (temporary/reversible sorts). autoSort=false = no orange ever.
  // useShallow prevents infinite re-render loop from .map() creating new array refs.
  const sortedColumnIds = useGridStore(
    useShallow((s) => s.autoSort ? s.sorts.map((sort) => sort.columnId) : []),
  );

  // Filtered column IDs — for tinting filtered column headers green
  const filteredColumnIds = useGridStore(
    useShallow((s) => {
      if (s.filters.length === 0) return [];
      return [...new Set(s.filters.map((f) => f.columnId))];
    }),
  );

  // Current find-match column for the header row (sentinel rowId "__header__")
  const findHeaderMatchColId = useGridStore(
    (s) => (s.findCurrentMatch?.rowId === "__header__" ? s.findCurrentMatch.columnId : null),
  );

  // Pre-compute lowercase search term for header highlighting
  const searchTermLower = searchTerm ? searchTerm.toLowerCase() : "";

  // === WRAP HEADERS: measure actual header height for scroller positioning ===
  // We measure BOTH frozen and scrollable headers and take the max,
  // because the longest column name may live in either pane.
  const frozenHeaderMeasureRef = useRef<HTMLDivElement>(null);
  const [measuredHeaderHeight, setMeasuredHeaderHeight] = useState(rowHeight);
  useEffect(() => {
    if (!wrapHeaders) {
      setMeasuredHeaderHeight(rowHeight);
      return;
    }
    const frozenEl = frozenHeaderMeasureRef.current;
    const scrollEl = scrollableHeaderRef.current;
    if (!frozenEl && !scrollEl) { setMeasuredHeaderHeight(rowHeight); return; }
    const measure = () => {
      const fh = frozenEl?.getBoundingClientRect().height ?? 0;
      const sh = scrollEl?.getBoundingClientRect().height ?? 0;
      const maxH = Math.max(fh, sh, rowHeight);
      setMeasuredHeaderHeight(maxH);
    };
    const ro = new ResizeObserver(measure);
    if (frozenEl) ro.observe(frozenEl);
    if (scrollEl) ro.observe(scrollEl);
    // Initial measurement
    measure();
    return () => ro.disconnect();
  }, [wrapHeaders, rowHeight]);
  const effectiveHeaderHeight = wrapHeaders ? measuredHeaderHeight : rowHeight;

  // === CUSTOM VERTICAL SCROLLBAR (overlay, no layout space) ===
  const vThumbRef = useRef<HTMLDivElement>(null);
  const isDraggingV = useRef(false);
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync thumb position & size with scroller
  useEffect(() => {
    const scroller = gridScrollerRef.current;
    const thumb = vThumbRef.current;
    if (!scroller || !thumb) return;

    const TRACK_PADDING = 3; // top + bottom cushion, matches horizontal scrollbar's border

    const update = () => {
      const { clientHeight, scrollHeight, scrollTop } = scroller;
      if (scrollHeight <= clientHeight) {
        thumb.style.display = "none";
        return;
      }
      thumb.style.display = "block";
      const trackH = clientHeight - TRACK_PADDING * 2;
      const ratio = clientHeight / scrollHeight;
      const thumbH = Math.max(30, ratio * trackH);
      const maxScroll = scrollHeight - clientHeight;
      const top = TRACK_PADDING + (maxScroll > 0 ? (scrollTop / maxScroll) * (trackH - thumbH) : 0);
      thumb.style.height = `${thumbH}px`;
      thumb.style.top = `${top}px`;
    };

    const showThumb = () => {
      thumb.style.opacity = "1";
      clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => {
        if (!isDraggingV.current) thumb.style.opacity = "0";
      }, 1200);
    };

    const onScroll = () => { update(); showThumb(); };

    update();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      ro.disconnect();
      clearTimeout(fadeTimer.current);
    };
  }, [gridScrollerRef]);

  // Thumb drag interaction
  useEffect(() => {
    const thumb = vThumbRef.current;
    const scroller = gridScrollerRef.current;
    if (!thumb || !scroller) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      isDraggingV.current = true;
      dragStartY.current = e.clientY;
      dragStartScrollTop.current = scroller.scrollTop;
      thumb.style.opacity = "1";
      clearTimeout(fadeTimer.current);
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingV.current) return;
      const TRACK_PADDING = 3;
      const { clientHeight, scrollHeight } = scroller;
      const trackH = clientHeight - TRACK_PADDING * 2;
      const thumbH = Math.max(30, (clientHeight / scrollHeight) * trackH);
      const trackSpace = trackH - thumbH;
      const maxScroll = scrollHeight - clientHeight;
      if (trackSpace > 0) {
        const deltaY = e.clientY - dragStartY.current;
        scroller.scrollTop = dragStartScrollTop.current + (deltaY / trackSpace) * maxScroll;
      }
    };

    const onMouseUp = () => {
      if (!isDraggingV.current) return;
      isDraggingV.current = false;
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      fadeTimer.current = setTimeout(() => {
        thumb.style.opacity = "0";
      }, 1200);
    };

    thumb.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      thumb.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [gridScrollerRef]);

  // === RECORD CELL CONTEXT MENU ===
  const [recordMenuRowId, setRecordMenuRowId] = useState<string | null>(null);
  const [recordMenuColId, setRecordMenuColId] = useState<string | null>(null);
  const [recordMenuPosition, setRecordMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const recordMenuRef = useRef<HTMLDivElement>(null);

  const handleCellContextMenu = useCallback((e: React.MouseEvent, rowId: string, colId: string) => {
    e.preventDefault();
    const clickX = e.clientX;
    const clickY = e.clientY;
    const menuW = 240;
    const menuH = 432;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: default rightward (+8px gap), flip leftward if not enough space
    const left = (clickX + 8 + menuW <= vw)
      ? clickX + 8
      : clickX - 8 - menuW;

    // Vertical: default downward (+1px gap), flip upward if not enough space,
    // fallback to bottom-aligned with 8px from viewport bottom if neither fits
    let top: number;
    if (clickY + 1 + menuH <= vh) {
      // Fits downward
      top = clickY + 1;
    } else if (clickY - 1 - menuH >= 0) {
      // Fits upward
      top = clickY - 1 - menuH;
    } else {
      // Neither fits — pin to bottom with 8px gap
      top = vh - menuH - 8;
    }

    setRecordMenuPosition({ top, left });
    setRecordMenuRowId(rowId);
    setRecordMenuColId(colId);
    // Close column header menu if open
    setHeaderMenuColId(null);
    setHeaderMenuPosition(null);
  }, []);

  // Click-outside handler for record context menu
  useEffect(() => {
    if (!recordMenuRowId) return;

    function handleClickOutside(event: MouseEvent) {
      if (recordMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setRecordMenuRowId(null);
      setRecordMenuColId(null);
      setRecordMenuPosition(null);
    }

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [recordMenuRowId]);

  // Escape key to close record context menu
  useEffect(() => {
    if (!recordMenuRowId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRecordMenuRowId(null);
        setRecordMenuColId(null);
        setRecordMenuPosition(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [recordMenuRowId]);

  const closeRecordMenu = useCallback(() => {
    setRecordMenuRowId(null);
    setRecordMenuColId(null);
    setRecordMenuPosition(null);
  }, []);

  // === ROW DRAG-TO-REORDER ===
  const [dragState, setDragState] = useState<{
    rowId: string;
    fromIndex: number;
    currentDropIndex: number;
  } | null>(null);

  const autoScrollRafRef = useRef<number>(0);

  const handleRowDragStart = useCallback(
    (rowIndex: number, rowId: string, e: React.MouseEvent) => {
      if (!canDragRows) return;
      e.preventDefault();

      const scroller = gridScrollerRef.current;
      if (!scroller) return;

      // Find the .gridRow DOM element from the event target (the drag handle SVG)
      const rowEl = (e.target as HTMLElement).closest(`.${styles.gridRow}`);
      if (!rowEl) return;

      // --- Create a ghost clone that follows the cursor ---
      const ghost = rowEl.cloneNode(true) as HTMLElement;
      const rowRect = rowEl.getBoundingClientRect();
      const offsetY = e.clientY - rowRect.top; // mouse offset within the row
      ghost.style.position = "fixed";
      ghost.style.left = `${rowRect.left}px`;
      ghost.style.top = `${e.clientY - offsetY}px`;
      ghost.style.width = `${rowRect.width}px`;
      ghost.style.height = `${rowRect.height}px`;
      ghost.style.pointerEvents = "none";
      ghost.style.opacity = "0.85";
      ghost.style.zIndex = "99999";
      ghost.style.boxShadow = "0 2px 8px rgba(0,0,0,0.18)";
      ghost.style.overflow = "hidden";
      ghost.style.background = "#FFFFFF";
      document.body.appendChild(ghost);

      // Dim the original row while dragging
      (rowEl as HTMLElement).style.opacity = "0.35";

      // Track drop index via a local mutable variable (avoids async React state issues)
      let currentDropIdx = rowIndex;
      setDragState({ rowId, fromIndex: rowIndex, currentDropIndex: rowIndex });
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";

      const handleMove = (ev: MouseEvent) => {
        // Move ghost to follow cursor (horizontal position stays fixed)
        ghost.style.top = `${ev.clientY - offsetY}px`;

        const rect = scroller.getBoundingClientRect();
        const relY = ev.clientY - rect.top + scroller.scrollTop;
        // Use totalCount (not rows.length) — rows only has the infinite-query
        // slice (~1K rows), but the user may be scrolled to position 99K via
        // the jump cache. Without this fix, dropIdx is always clamped to ~999.
        const dropIdx = Math.max(0, Math.min(totalCount - 1, Math.floor(relY / DATA_ROW_HEIGHT)));

        if (dropIdx !== currentDropIdx) {
          currentDropIdx = dropIdx;
          setDragState({ rowId, fromIndex: rowIndex, currentDropIndex: dropIdx });
        }

        // Auto-scroll when mouse is near top/bottom edges
        const EDGE = 40;
        const SPEED = 8;
        cancelAnimationFrame(autoScrollRafRef.current);

        if (ev.clientY < rect.top + EDGE) {
          const tick = () => {
            scroller.scrollTop -= SPEED;
            autoScrollRafRef.current = requestAnimationFrame(tick);
          };
          autoScrollRafRef.current = requestAnimationFrame(tick);
        } else if (ev.clientY > rect.bottom - EDGE) {
          const tick = () => {
            scroller.scrollTop += SPEED;
            autoScrollRafRef.current = requestAnimationFrame(tick);
          };
          autoScrollRafRef.current = requestAnimationFrame(tick);
        }
      };

      const handleUp = () => {
        cancelAnimationFrame(autoScrollRafRef.current);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "";

        // Hide the drop indicator immediately
        setDragState(null);

        if (currentDropIdx !== rowIndex) {
          // --- Smooth animation: slide ghost to the target row position ---
          const scrollerRect = scroller.getBoundingClientRect();
          const targetViewportY =
            currentDropIdx * DATA_ROW_HEIGHT - scroller.scrollTop + scrollerRect.top;

          ghost.style.transition = "top 150ms ease-out, opacity 150ms ease-out";
          ghost.style.top = `${targetViewportY}px`;
          ghost.style.opacity = "0.4";

          const finalDropIdx = currentDropIdx;
          setTimeout(() => {
            ghost.remove();
            if (rowEl.parentElement) (rowEl as HTMLElement).style.opacity = "";
            onReorderRow?.(rowId, rowIndex, finalDropIdx);
          }, 150);
        } else {
          // No movement — just clean up
          ghost.remove();
          if (rowEl.parentElement) (rowEl as HTMLElement).style.opacity = "";
        }
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [canDragRows, gridScrollerRef, totalCount, DATA_ROW_HEIGHT, onReorderRow],
  );

  // === COLUMN HEADER DROPDOWN MENU ===
  const [headerMenuColId, setHeaderMenuColId] = useState<string | null>(null);
  const [headerMenuPosition, setHeaderMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const totalColumnCount = frozenColumns.length + scrollableColumns.length;
  const canModifyField = totalColumnCount > 1;

  // === DUPLICATE FIELD DIALOG ===
  const [dupFieldDialog, setDupFieldDialog] = useState<{ colId: string; colName: string } | null>(null);
  const [dupCells, setDupCells] = useState(true);
  const allColumns = [...frozenColumns, ...scrollableColumns];

  // === BULK ADD ROWS DIALOG ===
  const [showBulkAddDialog, setShowBulkAddDialog] = useState(false);

  const handleHeaderMenuToggle = useCallback((e: React.MouseEvent, colId: string) => {
    if (headerMenuColId === colId) {
      setHeaderMenuColId(null);
      setHeaderMenuPosition(null);
      return;
    }
    const cell = (e.currentTarget as HTMLElement).parentElement;
    if (!cell) return;
    const rect = cell.getBoundingClientRect();
    let left = rect.left;
    // If menu would overflow the right edge, align right edges instead
    if (left + 320 > window.innerWidth - 6) {
      left = rect.right - 320;
    }
    setHeaderMenuPosition({ top: rect.bottom, left });
    setHeaderMenuColId(colId);
  }, [headerMenuColId]);

  // Click-outside handler for header menu
  useEffect(() => {
    if (!headerMenuColId) return;

    function handleClickOutside(event: MouseEvent) {
      if (headerMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setHeaderMenuColId(null);
      setHeaderMenuPosition(null);
    }

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [headerMenuColId]);

  // Escape key to close header menu
  useEffect(() => {
    if (!headerMenuColId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setHeaderMenuColId(null);
        setHeaderMenuPosition(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [headerMenuColId]);

  // Compute max-height for header menu (96px from bottom of viewport)
  const headerMenuMaxHeight = headerMenuPosition
    ? Math.max(200, window.innerHeight - headerMenuPosition.top - 24)
    : undefined;

  // Helper to find column definition by ID from frozen + scrollable columns
  const allVisibleColumns = [...frozenColumns, ...scrollableColumns];
  const getColumnById = useCallback(
    (colId: string) => allVisibleColumns.find((c) => c.id === colId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frozenColumns, scrollableColumns],
  );

  // === INSERT FIELD ANCHOR (for Insert left / Insert right) ===
  const insertFieldAnchorRef = useRef<{ anchorColId: string; side: "left" | "right" } | null>(null);

  // === CREATE FIELD PANEL (+ button dropdown) ===
  const [createFieldPosition, setCreateFieldPosition] = useState<{ top: number; left: number } | null>(null);
  const addColButtonRef = useRef<HTMLDivElement>(null);

  // === EDIT FIELD STATE (when "Edit field" is chosen from header menu) ===
  const [editFieldInfo, setEditFieldInfo] = useState<{ columnId: string; fieldName: string; fieldType: string; numberConfig?: NumberFormatConfig } | null>(null);

  const handleAddColClick = useCallback(() => {
    const btn = addColButtonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    // Align top of panel with bottom of header row, left-aligned to + cell
    let left = rect.left + 4; // 4px inward (right)
    // If panel (400px) would overflow right edge, right-align with + cell
    if (left + 400 > window.innerWidth) {
      left = rect.right - 400 - 4; // 4px inward (left)
    }
    insertFieldAnchorRef.current = null; // Reset anchor when opening from + button
    setEditFieldInfo(null); // Ensure not in edit mode
    setCreateFieldPosition({ top: rect.bottom + 2, left }); // 2px down
  }, []);

  const handleCloseCreateField = useCallback(() => {
    setCreateFieldPosition(null);
    insertFieldAnchorRef.current = null;
    setEditFieldInfo(null);
  }, []);

  // Wrapped onCreateField that passes insert position if set
  const handleCreateFieldWrapped = useCallback(
    (name: string, type: string, defaultValue: string, numberConfig?: NumberFormatConfig) => {
      const anchor = insertFieldAnchorRef.current;
      onCreateField?.(name, type, defaultValue, numberConfig, anchor ?? undefined);
      insertFieldAnchorRef.current = null;
    },
    [onCreateField],
  );

  // Handler for Insert left / Insert right from header menu
  const handleInsertField = useCallback((side: "left" | "right") => {
    if (!headerMenuColId) return;
    // Find the header cell DOM element for positioning
    const headerCell = document.querySelector(`[data-col-header-id="${headerMenuColId}"]`);
    if (headerCell) {
      const rect = headerCell.getBoundingClientRect();
      let left = rect.left;
      if (left + 400 > window.innerWidth) {
        left = rect.right - 400;
      }
      insertFieldAnchorRef.current = { anchorColId: headerMenuColId, side };
      setEditFieldInfo(null); // Ensure not in edit mode
      setCreateFieldPosition({ top: rect.bottom + 2, left });
    }
    // Close the header menu
    setHeaderMenuColId(null);
    setHeaderMenuPosition(null);
  }, [headerMenuColId]);

  // Handler for Edit field from header menu
  const handleEditField = useCallback(() => {
    if (!headerMenuColId) return;
    const col = allColumns.find((c) => c.id === headerMenuColId);
    if (!col) return;
    // Map DB type to UI label
    const uiType = col.type === "NUMBER" ? "Number" : "Single line text";
    // Build number config if applicable
    const numCfg = col.type === "NUMBER" && col.config
      ? (col.config as NumberFormatConfig)
      : undefined;
    // Position the panel below the header cell
    const headerCell = document.querySelector(`[data-col-header-id="${headerMenuColId}"]`);
    if (headerCell) {
      const rect = headerCell.getBoundingClientRect();
      let left = rect.left;
      if (left + 400 > window.innerWidth) {
        left = rect.right - 400;
      }
      setEditFieldInfo({ columnId: headerMenuColId, fieldName: col.name, fieldType: uiType, numberConfig: numCfg });
      setCreateFieldPosition({ top: rect.bottom + 2, left });
    }
    // Close the header menu
    setHeaderMenuColId(null);
    setHeaderMenuPosition(null);
  }, [headerMenuColId, allColumns]);

  return (
    <div className={styles.gridContainer} ref={gridFooterRef}>
      {/* Grid body: header + content panes */}
      <div className={styles.gridBody} ref={gridBodyRef}>
        {/* Frozen header (top-left) */}
        <div
          ref={frozenHeaderMeasureRef}
          className={`${styles.gridHeaderFrozen}${wrapHeaders ? ` ${styles.gridHeaderFrozenWrap}` : ''}`}
          style={{ width: freezeWidth, ...(wrapHeaders ? { minHeight: effectiveHeaderHeight, height: 'auto', overflow: 'visible' } : { height: rowHeight }) }}
        >
          {/* Serial number / checkbox header */}
          <div className={styles.gridHeaderRowNum} style={wrapHeaders ? { minHeight: rowHeight, height: 'auto' } : { height: rowHeight }}>
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
          {frozenColumns.map((col) => {
            const headerHasMatch = searchTermLower.length > 0 && col.name.toLowerCase().includes(searchTermLower);
            const isHeaderCurrent = headerHasMatch && findHeaderMatchColId === col.id;
            const isHeaderFiltered = filteredColumnIds.includes(col.id);
            // Background priority: search highlight > filter green > default
            const headerBg = headerHasMatch
              ? (isHeaderCurrent ? "#FFD66B" : "#FFF3D3")
              : isHeaderFiltered ? "#F9FEF9" : undefined;
            return (
              <div
                key={col.id}
                data-col-header-id={col.id}
                className={`${styles.gridHeaderCell}${wrapHeaders ? ` ${styles.gridHeaderCellWrap}` : ''}${headerMenuColId === col.id ? ` ${styles.gridHeaderCellMenuOpen}` : ''}${sortedColumnIds.includes(col.id) ? ` ${styles.gridHeaderCellSorted}` : ''}`}
                style={{
                  width: getColWidth(col.id),
                  ...(wrapHeaders ? { minHeight: rowHeight, height: 'auto', overflow: 'visible' } : { height: rowHeight }),
                  ...(headerBg ? { backgroundColor: headerBg } : {}),
                }}
              >
                <div
                  className={`${styles.gridHeaderCellMedia}${wrapHeaders ? ` ${styles.gridHeaderCellMediaWrap}` : ''}`}
                  style={wrapHeaders ? { height: 'auto', minHeight: 30 } : undefined}
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
                    className={`${styles.gridHeaderCellName}${wrapHeaders ? ` ${styles.gridHeaderCellNameWrap}` : ''}`}
                    style={wrapHeaders ? { whiteSpace: 'normal', overflow: 'visible', height: 'auto', textOverflow: 'clip', top: 0 } : undefined}
                  >
                    {headerHasMatch ? <HighlightedText text={col.name} query={searchTerm!} /> : col.name}
                  </span>
                </div>
                <span
                  className={styles.gridHeaderCellChevron}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); handleHeaderMenuToggle(e, col.id); }}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="nonzero" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" />
                  </svg>
                </span>
                <div
                  className={styles.gridHeaderCellResizeHandle}
                  onMouseDown={(e) => handleResizeStart(e, col.id)}
                />
                <div
                  className={styles.gridHeaderBottomResizeHandle}
                  onMouseDown={handleRowHeightResizeStart}
                />
              </div>
            );
          })}
        </div>

        {/* Scrollable header (top-right) — scrolls horizontally in sync with content */}
        <div
          ref={scrollableHeaderRef}
          className={`${styles.gridHeaderScrollable}${wrapHeaders ? ` ${styles.gridHeaderScrollableWrap}` : ''}`}
          style={{ left: freezeWidth, ...(wrapHeaders ? { minHeight: effectiveHeaderHeight, height: 'auto', overflow: 'visible' } : { height: rowHeight }) }}
        >
          <div className={styles.gridHeaderScrollableInner} style={wrapHeaders ? { minHeight: effectiveHeaderHeight, height: 'auto', overflow: 'visible' } : { height: rowHeight }}>
            {scrollableColumns.map((col, colIdx) => {
              const headerHasMatch = searchTermLower.length > 0 && col.name.toLowerCase().includes(searchTermLower);
              const isHeaderCurrent = headerHasMatch && findHeaderMatchColId === col.id;
              const isHeaderFiltered = filteredColumnIds.includes(col.id);
              const headerBg = headerHasMatch
                ? (isHeaderCurrent ? "#FFD66B" : "#FFF3D3")
                : isHeaderFiltered ? "#F9FEF9" : undefined;
              return (
                <div
                  key={col.id}
                  data-col-header-id={col.id}
                  className={`${styles.gridHeaderCell}${wrapHeaders ? ` ${styles.gridHeaderCellWrap}` : ''}${headerMenuColId === col.id ? ` ${styles.gridHeaderCellMenuOpen}` : ''}${sortedColumnIds.includes(col.id) ? ` ${styles.gridHeaderCellSorted}` : ''}`}
                  style={{
                    width: getColWidth(col.id),
                    ...(wrapHeaders ? { minHeight: rowHeight, height: 'auto', overflow: 'visible' } : { height: rowHeight }),
                    ...(frozenColumns.length === 0 && colIdx === 0 ? { borderLeftColor: 'transparent' } : {}),
                    ...(headerBg ? { backgroundColor: headerBg } : {}),
                  }}
                >
                  <div
                    className={`${styles.gridHeaderCellMedia}${wrapHeaders ? ` ${styles.gridHeaderCellMediaWrap}` : ''}`}
                    style={wrapHeaders ? { height: 'auto', minHeight: 30 } : undefined}
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
                      className={`${styles.gridHeaderCellName}${wrapHeaders ? ` ${styles.gridHeaderCellNameWrap}` : ''}`}
                      style={wrapHeaders ? { whiteSpace: 'normal', overflow: 'visible', height: 'auto', textOverflow: 'clip', top: 0 } : undefined}
                    >
                      {headerHasMatch ? <HighlightedText text={col.name} query={searchTerm!} /> : col.name}
                    </span>
                  </div>
                  <span
                    className={styles.gridHeaderCellChevron}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); handleHeaderMenuToggle(e, col.id); }}
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" />
                    </svg>
                  </span>
                  <div
                    className={styles.gridHeaderCellResizeHandle}
                    onMouseDown={(e) => handleResizeStart(e, col.id)}
                  />
                  <div
                    className={styles.gridHeaderBottomResizeHandle}
                    onMouseDown={handleRowHeightResizeStart}
                  />
                </div>
              );
            })}
            {/* Add column button */}
            <div
              ref={addColButtonRef}
              className={styles.gridHeaderAddCol}
              style={wrapHeaders ? { minHeight: rowHeight, height: effectiveHeaderHeight } : { height: rowHeight }}
              onClick={handleAddColClick}
            >
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
            {/* TanStack Virtual rows — absolutely positioned for true 1M row virtualization */}
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
                      isDeleting={deletingRowIds?.has(row.id) ?? false}
                      searchTerm={searchTerm}
                      onRowDragStart={handleRowDragStart}
                      canDragRows={canDragRows}
                      cellHeight={DATA_ROW_HEIGHT}
                      backfillingColumnIds={backfillingColumnIds}
                    />
                  ) : (
                    /* Skeleton row — shown while data is being fetched */
                    <div className={styles.gridRow}>
                      <div className={styles.gridRowFrozenGroup} style={{ width: freezeWidth }}>
                        <div className={styles.gridRowNumCell} style={{ height: DATA_ROW_HEIGHT }}>
                          <div className={styles.gridRowNumOuter}>
                            <div className={styles.gridRowNumInner} style={{ color: "#ccc" }}>
                              {actualIndex + 1}
                            </div>
                          </div>
                        </div>
                        {frozenColumns.map((col, colIdx) => (
                          <div
                            key={col.id}
                            className={styles.gridDataCell}
                            style={{ width: getColWidth(col.id), height: DATA_ROW_HEIGHT }}
                          >
                            <div className={styles.gridCellContent}>
                              <div
                                className={styles.skeletonBar}
                                style={{
                                  width: `${40 + ((actualIndex * 7 + colIdx * 13) % 40)}%`,
                                  height: 10,
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {scrollableColumns.map((col, colIdx) => (
                        <div
                          key={col.id}
                          className={styles.gridDataCell}
                          style={{ width: getColWidth(col.id), height: DATA_ROW_HEIGHT }}
                        >
                          <div className={styles.gridCellContent}>
                            <div
                              className={styles.skeletonBar}
                              style={{
                                width: `${40 + ((actualIndex * 11 + colIdx * 17) % 40)}%`,
                                height: 10,
                                borderRadius: 3,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Drop indicator line (visible during row drag) — highlights the grid line where the top of the row will go */}
            {dragState && dragState.currentDropIndex !== dragState.fromIndex && (
              <div
                className={styles.gridDropIndicator}
                style={{
                  position: "absolute",
                  top: dragState.currentDropIndex > dragState.fromIndex
                    ? (dragState.currentDropIndex + 1) * DATA_ROW_HEIGHT - 1
                    : dragState.currentDropIndex * DATA_ROW_HEIGHT - 1,
                  width: freezeWidth + scrollableColumnsWidth + 1,
                }}
              />
            )}

            {/* Selection overlay — inside the scroll content for zero-lag vertical
                scrolling.  Promoted to its own GPU layer via will-change + contain
                so it doesn't pollute the large scroll-content compositing layer. */}
            <div
              ref={selectionOverlayRef}
              className={styles.gridSelectionOverlay}
            >
              <div className={styles.gridSelectionHandle} />
            </div>

            {/* Add row (unified: sticky frozen + button + scrollable slab) */}
            <div
              className={styles.gridRow}
              style={{
                background: 'transparent',
                position: 'absolute',
                top: totalSize,
                left: 0,
                width: '100%',
              }}
            >
              <div className={styles.gridAddRowFrozen} style={{ width: freezeWidth, position: 'sticky', left: 0, zIndex: 2, background: '#FFFFFF' }}>
                <div className={styles.gridAddRowFrozenInner} onClick={onAddRow}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 2C7.86739 2 7.74021 2.05268 7.64645 2.14645C7.55268 2.24021 7.5 2.36739 7.5 2.5V7.5H2.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H7.5V13.5C7.5 13.6326 7.55268 13.7598 7.64645 13.8536C7.74021 13.9473 7.86739 14 8 14C8.13261 14 8.25979 13.9473 8.35355 13.8536C8.44732 13.7598 8.5 13.6326 8.5 13.5V8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H8.5V2.5C8.5 2.36739 8.44732 2.24021 8.35355 2.14645C8.25979 2.05268 8.13261 2 8 2Z" />
                  </svg>
                </div>
              </div>
              {/* Scrollable slab next to + button */}
              <div className={styles.gridAddRowScrollable} style={{ width: scrollableColumnsWidth + 1, ...(frozenColumns.length === 0 ? { borderLeftColor: 'transparent' } : {}) }} />
            </div>
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
            {totalCount.toLocaleString()} record{totalCount !== 1 ? "s" : ""}
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
        <div
          ref={freezeTooltipRef}
          className={styles.gridFreezeTooltip}
        >
          Drag to adjust the number of frozen columns
        </div>
      </div>

      {/* Custom vertical scrollbar — overlays content, no layout space reserved */}
      <div className={styles.customVScrollTrack} style={{ top: effectiveHeaderHeight, bottom: 34 }}>
        <div ref={vThumbRef} className={styles.customVScrollThumb} />
      </div>

      {/* === Record Cell Context Menu (portal) === */}
      {recordMenuRowId && recordMenuPosition && createPortal(
        <div
          ref={recordMenuRef}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            position: 'fixed',
            zIndex: 99999,
            display: 'block',
            top: recordMenuPosition.top,
            left: recordMenuPosition.left,
            padding: 0,
            margin: 0,
            backgroundColor: 'rgb(255, 255, 255)',
            borderRadius: 6,
            boxShadow: 'rgba(0, 0, 0, 0.24) 0px 0px 1px 0px, rgba(0, 0, 0, 0.16) 0px 0px 2px 0px, rgba(0, 0, 0, 0.06) 0px 3px 4px 0px, rgba(0, 0, 0, 0.06) 0px 6px 8px 0px, rgba(0, 0, 0, 0.08) 0px 12px 16px 0px, rgba(0, 0, 0, 0.06) 0px 18px 32px 0px',
          }}
        >
          <ul className={styles.recordContextMenu}>
            {/* Ask Omni */}
            <li className={styles.recordContextMenuItem} onClick={closeRecordMenu}>
              <svg className={styles.recordContextMenuOmniIcon} width="16" height="16" viewBox="0 0 1974 2048" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path transform="translate(1613,1514)" d="m0 0h18l10 4 21 16 9 6 13 10 12 11 13 13 9 13 6 14 4 18-1 13-5 10-8 11-7 10-12 16-9 11-21 21-10 7-10 5-15 4-16 2-14-6-10-6-16-10-10-8-12-11-17-17-9-11-6-9-6-12-1-4v-18l3-13 13-22 10-15 9-10 15-15 8-7 8-8 11-7 16-5z" />
                <path transform="translate(963,1629)" d="m0 0h28l30 2 23 5 14 7 7 7 7 12 5 18 4 22 1 9v22l-1 3-2 33-5 13-6 10-11 12-11 7-11 4-14 2-18 1h-36l-22-2-13-3-12-6-10-9-6-7-6-12-3-14-3-24v-24l3-44 4-12 7-10 8-8 12-7 18-5z" />
                <path transform="translate(713,1776)" d="m0 0h24l33 7 19 5 16 6 26 13 9 8 9 16 2 7v17l-5 27-5 19-4 15-9 25-6 15-9 8-19 10-11 5-8-1-11-3-28-6-11-1-9-4-30-10-15-9-8-8-7-12-5-17v-24l5-21 7-22 5-17 8-16 9-16 9-8 16-7z" />
                <path transform="translate(347,1514)" d="m0 0h15l14 3 2-2h5l18 18 8 7 14 15 10 13 13 17 9 15 5 13 1 10-1 5 1 5-1 12-4 8-34 34-14 11-12 10-11 7-23 11-5 2h-12l-16-5-15-8-12-11-7-7-9-11-12-15-18-24-8-18-1-6 3-25 4-11 8-11 13-12 11-9 17-14 13-9 10-8 15-8z" />
                <path transform="translate(539,261)" d="m0 0h15l18 8 10 7 10 10 26 39 7 11 9 17 6 18v17l-6 15-4 6-9 10-14 11-17 12-19 12-15 11-14 7-6 2h-12l-11-2-7-3-5 1h-7l-5-3-2-5-4-2-10-13-7-12-13-19-7-11-6-10-11-25-1-3v-13l2-6 2-12 7-12 11-12 9-8 15-11 18-11 19-10 6-4 16-5z" />
                <path transform="translate(1654,882)" d="m0 0h20l14 5 11 7 6 7 6 12 6 18 8 38 3 20 1 22-3 16-8 16-7 8-5 4-12 6-21 7-26 5-23 3-20 1-16-2-13-5-13-11-9-14-6-14-5-19-5-30-2-18v-24l2-12 6-12 9-9 14-9 11-5 17-4 21-3z" />
                <path transform="translate(1774,1095)" d="m0 0h21l47 5 18 2 13 4 10 4 9 7 9 10 9 14 3 16v13l-2 15-4 14v26l-8 28-6 10-10 11-8 6-15 9-14 1-8-3h-28l-4-2-11-2-8-2-10-1-11-3-4-2-15-2-8-7-9-11-9-17-3-11v-18l5-20v-23l5-22 5-14 7-13 5-6 13-10 12-5z" />
                <path transform="translate(947,142)" d="m0 0h82l16 4 10 6 10 9 7 11 4 15 4 27 1 8v21l-2 5v34l-5 13-6 10-11 12-12 7-7 2h-20l-5 2-8 1h-35l-27-3-17-4-10-5-12-12-5-8-3-17-1-5-1-15-3-12 1-14 2-11v-33l4-14 7-11 11-11 11-7 9-3z" />
                <path transform="translate(299,882)" d="m0 0h31l37 6 25 6 16 6 11 7 9 10 6 11 3 8 1 8v16l-6 55-4 17-5 13-7 11-9 8-17 9-9 3-6 1h-17l-27-3-29-5-17-4-14-7-10-9-10-14-5-11-1-5v-23l7-49 6-23 7-18 13-13 13-8z" />
                <path transform="translate(188,1093)" d="m0 0 15 4 23 11 8 6 6 10 5 19 8 50 2 32-3 19-6 10-10 10-15 9-16 6-16 4-13 1-10-1-16 4-6 2h-19l-7-2h-8l-9-3-7-7-5-4-8-10-5-10-5-14-7-35-1-7-1-24-1-4v-16l4-12 10-19 8-7 14-7 16-4 24-4 24-3z" />
                <path transform="translate(1244,1775)" d="m0 0h9l10 2 15 9 11 8 8 11 4 8 11 33 7 30 4 22 2 9-1 8-6 10-5 6-8 11-10 7-20 9-35 12-20 4-12 4h-17l-8-4-22-12-5-5-7-10-8-16-6-15-9-39-3-10v-9l-1-5v-8l5-13 9-19 8-9 10-6 10-4 39-9 20-6z" />
                <path transform="translate(1755,622)" d="m0 0h19l13 4h7l6 3 9 8 7 10 12 22 9 21 13 41 1 5v18l-3 5-2 12-6 8-14 10-22 12-23 11-35 14-7 2h-15l-17-6-11-6-8-8-10-15-9-17-8-19-10-25-5-12-1-5v-14l4-14 2-12 9-10 10-8 15-9 24-11 23-7 12-4z" />
                <path transform="translate(1137,345)" d="m0 0h16l17 4 41 12 19 7 16 8 10 7 7 8 7 14 1 3v20l-7 33-6 20-7 19-9 19-9 12-10 9-16 8-3 1h-11l-23-5-33-9-29-10-15-8-9-8-7-11-6-13-1-5v-14l5-25 10-35 7-20 7-14 9-12 8-7 11-5z" />
                <path transform="translate(1334,1514)" d="m0 0h18l16 3 10 5 11 9 10 11 13 18 13 21 11 21 7 18 3 13-1 11-5 12-6 8-9 10-9 8-14 10-14 9-18 10-16 8-21 8-4 1h-7l-13-4-11-6-10-9-10-13-18-27-19-29-7-14-1-6v-9l3-19 5-12 6-8 15-12 17-12 26-17 20-13z" />
                <path transform="translate(409,1238)" d="m0 0h13l13 5 11 8 10 10 10 15 11 21 11 28 9 28 2 13-2 11-7 12-11 12-10 8-20 12-25 12-25 9-21 6h-12l-16-8-10-7-8-8-8-13-15-32-11-28-7-21-1-5v-10l4-13 7-12 7-8 14-9 29-14 28-13 16-6z" />
                <path transform="translate(834,344)" d="m0 0 10 1 8 5 10 9 8 8 8 13 7 15 11 33 7 30 1 5v19l-5 13-9 13-9 7-18 10-23 9-23 6-30 7h-16l-16-6-13-8-7-6-7-11-7-16-12-42-5-23-1-8v-10l2-11 9-16 8-10 11-7 20-9 24-8 45-10z" />
                <path transform="translate(1469,537)" d="m0 0h8l24 4 10 5 13 11 19 19 7 8 11 13 11 15 9 16 4 9 1 4v9l-3 15-6 12-9 12-27 27-8 7-11 10-17 13-14 7-3 1h-9l-18-4-12-5-10-7-10-9-12-13-9-11-14-17-10-14-8-16-2-8v-20l3-12 5-10 8-10 11-9 14-12 12-11 14-11 13-10z" />
                <path transform="translate(1431,261)" d="m0 0h14l16 8 9 6 9 8 14 8 13 8 14 12 10 9 7 11 6 13 2 8-1 13-5 11 3 1-3 8-12 16-8 16-13 16-7 11-3 7-6 9-15 10-12 3h-8l-4 1-9 1-19-10-23-11-17-10-11-9-14-12-11-10-7-10-4-12-1-11-1-3v-11l4-9 1-2h2l2-5 8-18 10-17 10-19 13-13 8-7 9-8 8-4 8-1h7z" />
                <path transform="translate(204,621)" d="m0 0 14 1 19 5 25 12 29 14 17 9 6 5 7 11 5 10 2 9v17l-3 8-3 15-8 20-8 14-8 17-8 16-7 10-13 8-16 6h-15l-28-7-18-8-16-8-33-17-10-9-7-12-4-11-1-6v-11l3-16 5-15 9-20 21-42 9-12 14-8 12-4z" />
                <path transform="translate(615,1513)" d="m0 0h8l15 4 24 11 20 11 21 14 13 10 10 9 6 10 7 18 2 8v7l-3 10-14 29-10 17-13 19-10 14-8 9-21 11-11 4h-10l-17-5-17-9-23-16-17-11-14-11-12-11-5-7-4-12-3-18v-10l4-11 8-15 12-17 19-28 14-15 7-7 11-7z" />
                <path transform="translate(1561,1236)" d="m0 0 5 1 10 5 29 9 21 9 19 10 12 9 8 7 10 13 6 13 2 7v10l-5 21-8 20-8 17-10 19-12 23-5 6-32 12h-14l-17-5-38-18-18-8-13-9-10-8-8-10-7-15-3-12v-8l4-15 9-21 16-33 11-20 7-9 8-7 12-6 17-6z" />
                <path transform="translate(482,537)" d="m0 0h9l15 4 16 8 10 7 10 8 16 13 14 12 10 10 9 12 8 16 2 7v13l-5 17-10 16-11 13-9 11-9 10-9 11-12 12-10 7-15 8-6 2h-12l-13-5-15-8-11-8-14-12-12-11-10-9-14-14-9-13-5-11-2-10v-9l4-16 6-14 10-13 19-19 7-8 12-13 12-11 15-9z" />
              </svg>
              <span className={styles.recordContextMenuItemText}>Ask Omni</span>
            </li>

            {/* --- Separator --- */}
            <li className={styles.recordContextMenuSeparator} />

            {/* Insert record above */}
            <li className={styles.recordContextMenuItem} onClick={() => { if (recordMenuRowId) onInsertRecordAbove?.(recordMenuRowId); closeRecordMenu(); }}>
              <svg className={styles.recordContextMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                <path fillRule="nonzero" d="M7.99999 2C7.86739 2.00002 7.74022 2.05271 7.64647 2.14648L3.14647 6.64648C3.05272 6.74025 3.00006 6.86741 3.00006 7C3.00006 7.13259 3.05272 7.25975 3.14647 7.35352C3.24023 7.44726 3.3674 7.49992 3.49999 7.49992C3.63258 7.49992 3.75974 7.44726 3.8535 7.35352L7.49999 3.70703V13.5C7.49999 13.6326 7.55266 13.7598 7.64643 13.8536C7.7402 13.9473 7.86738 14 7.99999 14C8.13259 14 8.25977 13.9473 8.35354 13.8536C8.44731 13.7598 8.49999 13.6326 8.49999 13.5V3.70703L12.1465 7.35352C12.2402 7.44726 12.3674 7.49992 12.5 7.49992C12.6326 7.49992 12.7597 7.44726 12.8535 7.35352C12.9472 7.25975 12.9999 7.13259 12.9999 7C12.9999 6.86741 12.9472 6.74025 12.8535 6.64648L8.3535 2.14648C8.34865 2.14437 8.34377 2.14234 8.33885 2.14038C8.24776 2.05235 8.12665 2.00218 7.99999 2Z" />
              </svg>
              <span className={styles.recordContextMenuItemText}>Insert record above</span>
            </li>

            {/* Insert record below */}
            <li className={styles.recordContextMenuItem} onClick={() => { if (recordMenuRowId) onInsertRecordBelow?.(recordMenuRowId); closeRecordMenu(); }}>
              <svg className={styles.recordContextMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                <path fillRule="nonzero" d="M7.99999 2C7.86738 2 7.7402 2.05268 7.64643 2.14645C7.55266 2.24021 7.49999 2.36739 7.49999 2.5V12.293L3.8535 8.64648C3.75974 8.55274 3.63258 8.50008 3.49999 8.50008C3.3674 8.50008 3.24023 8.55274 3.14647 8.64648C3.05272 8.74025 3.00006 8.86741 3.00006 9C3.00006 9.13259 3.05272 9.25975 3.14647 9.35352L7.64647 13.8535C7.74022 13.9473 7.86739 14 7.99999 14C8.13259 14 8.25975 13.9473 8.3535 13.8535L12.8535 9.35352C12.9472 9.25975 12.9999 9.13259 12.9999 9C12.9999 8.86741 12.9472 8.74025 12.8535 8.64648C12.7597 8.55274 12.6326 8.50008 12.5 8.50008C12.3674 8.50008 12.2402 8.55274 12.1465 8.64648L8.49999 12.293V2.5C8.49999 2.36739 8.44731 2.24021 8.35354 2.14645C8.25977 2.05268 8.13259 2 7.99999 2Z" />
              </svg>
              <span className={styles.recordContextMenuItemText}>Insert record below</span>
            </li>

            {/* --- Separator --- */}
            <li className={styles.recordContextMenuSeparator} />

            {/* Duplicate record */}
            <li className={styles.recordContextMenuItem} onClick={() => { if (recordMenuRowId) onDuplicateRecord?.(recordMenuRowId); closeRecordMenu(); }}>
              <svg className={styles.recordContextMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                <path fillRule="nonzero" d="M2.5 5C2.3674 5.00001 2.24023 5.0527 2.14646 5.14646C2.0527 5.24023 2.00001 5.3674 2 5.5V13.5C2.00001 13.6326 2.0527 13.7598 2.14646 13.8535C2.24023 13.9473 2.3674 14 2.5 14H10.5C10.6326 14 10.7598 13.9473 10.8535 13.8535C10.9473 13.7598 11 13.6326 11 13.5V5.5C11 5.3674 10.9473 5.24023 10.8535 5.14646C10.7598 5.0527 10.6326 5.00001 10.5 5H2.5ZM3 6H10V13H3V6Z M5.5 2C5.3674 2.00001 5.24023 2.0527 5.14646 2.14646C5.0527 2.24023 5.00001 2.3674 5 2.5V5.5C5 5.63261 5.05268 5.75979 5.14645 5.85355C5.24021 5.94732 5.36739 6 5.5 6C5.63261 6 5.75979 5.94732 5.85355 5.85355C5.94732 5.75979 6 5.63261 6 5.5V3H13V10H10.5C10.3674 10 10.2402 10.0527 10.1464 10.1464C10.0527 10.2402 10 10.3674 10 10.5C10 10.6326 10.0527 10.7598 10.1464 10.8536C10.2402 10.9473 10.3674 11 10.5 11H13.5C13.6326 11 13.7598 10.9473 13.8535 10.8535C13.9473 10.7598 14 10.6326 14 10.5V2.5C14 2.3674 13.9473 2.24023 13.8535 2.14646C13.7598 2.0527 13.6326 2.00001 13.5 2H5.5Z" />
              </svg>
              <span className={styles.recordContextMenuItemText}>Duplicate record</span>
            </li>

            {/* Apply template */}
            <li className={styles.recordContextMenuItem} onClick={closeRecordMenu}>
              <svg className={styles.recordContextMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                <path fillRule="nonzero" d="M2.36878 1.36865C2.30311 1.36863 2.23808 1.38154 2.17741 1.40666C2.11673 1.43177 2.06159 1.46859 2.01515 1.51501C1.96871 1.56144 1.93187 1.61657 1.90674 1.67723C1.88161 1.7379 1.86868 1.80292 1.86868 1.86859C1.86868 1.93426 1.88161 1.99928 1.90674 2.05995C1.93187 2.12062 1.96871 2.17574 2.01515 2.22217L6.21803 6.42505C6.08351 6.67237 6.00001 6.95077 6.00001 7.25C6.00001 8.21058 6.78943 9 7.75001 9C8.71059 9 9.50001 8.21058 9.50001 7.25C9.50001 6.28942 8.71059 5.5 7.75001 5.5C7.45086 5.5 7.17258 5.58356 6.9253 5.71802L2.7223 1.51501C2.62853 1.42129 2.50137 1.36864 2.36878 1.36865ZM7.75001 6.5C8.17018 6.5 8.50001 6.82983 8.50001 7.25C8.50001 7.67017 8.17018 8 7.75001 8C7.32984 8 7.00001 7.67017 7.00001 7.25C7.00001 7.04405 7.08091 6.86114 7.21119 6.72681C7.21491 6.72531 7.21862 6.72376 7.2223 6.72217C7.22618 6.71703 7.22997 6.71183 7.23365 6.70654C7.36745 6.57966 7.54709 6.5 7.75001 6.5Z M14.25 9.75C14.1174 9.75003 13.9902 9.80272 13.8965 9.89648C13.8965 9.89648 13.5499 10.2425 13.209 10.7539C12.868 11.2653 12.5 11.9583 12.5 12.75C12.5 13.7106 13.2894 14.5 14.25 14.5C15.2106 14.5 16 13.7106 16 12.75C16 11.9583 15.632 11.2653 15.291 10.7539C14.9501 10.2425 14.6035 9.89648 14.6035 9.89648C14.5098 9.80272 14.3826 9.75003 14.25 9.75ZM14.25 11.0325C14.3204 11.1233 14.3825 11.1938 14.459 11.3086C14.743 11.7347 15 12.2917 15 12.75C15 13.1701 14.6701 13.5 14.25 13.5C13.8299 13.5 13.5 13.1701 13.5 12.75C13.5 12.2917 13.757 11.7347 14.041 11.3086C14.1176 11.1938 14.1796 11.1233 14.25 11.0325Z M7.21876 0.5C7.08616 0.500026 6.959 0.552716 6.86524 0.646484L0.852671 6.65894C0.851813 6.65979 0.850959 6.66064 0.850108 6.6615C0.276242 7.24384 0.276242 8.19366 0.850108 8.776C0.850959 8.77686 0.851813 8.77771 0.852671 8.77856L6.15895 14.0848C6.15984 14.0857 6.16073 14.0865 6.16163 14.0874C6.74398 14.6612 7.69354 14.6612 8.27589 14.0874C8.27679 14.0865 8.27768 14.0857 8.27858 14.0848L14.291 8.07226C14.3848 7.97849 14.4374 7.85133 14.4374 7.71875C14.4374 7.58616 14.3848 7.459 14.291 7.36523L7.57228 0.646483C7.47852 0.552715 7.35136 0.500025 7.21876 0.5ZM7.21876 1.70703L13.2305 7.71875L7.57374 13.3754C7.37274 13.5731 7.06478 13.5731 6.86378 13.3754L1.56239 8.0741C1.36466 7.87311 1.36441 7.56475 1.56214 7.36376C1.56203 7.36388 1.56225 7.36364 1.56214 7.36376L7.21876 1.70703Z" />
              </svg>
              <span className={styles.recordContextMenuItemText}>Apply template</span>
            </li>

            {/* Expand record */}
            <li className={styles.recordContextMenuItem} onClick={closeRecordMenu}>
              <svg className={styles.recordContextMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                <path fillRule="nonzero" d="M10 2.5C9.86739 2.5 9.74021 2.55268 9.64645 2.64645C9.55268 2.74021 9.5 2.86739 9.5 3C9.5 3.13261 9.55268 3.25979 9.64645 3.35355C9.74021 3.44732 9.86739 3.5 10 3.5H11.793L9.14648 6.14648C9.05274 6.24025 9.00008 6.36741 9.00008 6.5C9.00008 6.63259 9.05274 6.75975 9.14648 6.85352C9.24025 6.94726 9.36741 6.99992 9.5 6.99992C9.63259 6.99992 9.75975 6.94726 9.85352 6.85352L12.5 4.20703V6C12.5 6.13261 12.5527 6.25979 12.6464 6.35355C12.7402 6.44732 12.8674 6.5 13 6.5C13.1326 6.5 13.2598 6.44732 13.3536 6.35355C13.4473 6.25979 13.5 6.13261 13.5 6V3C13.498 2.99504 13.496 2.99012 13.4939 2.98523C13.4917 2.85861 13.4415 2.73755 13.3535 2.64648C13.2598 2.55272 13.1326 2.50003 13 2.5H10Z M6.5 9C6.3674 9.00002 6.24024 9.05271 6.14648 9.14648L3.5 11.793V10C3.5 9.86739 3.44732 9.74021 3.35355 9.64645C3.25979 9.55268 3.13261 9.5 3 9.5C2.86739 9.5 2.74021 9.55268 2.64645 9.64645C2.55268 9.74021 2.5 9.86739 2.5 10V13C2.50002 13.1326 2.55271 13.2598 2.64648 13.3535C2.74024 13.4473 2.8674 13.5 3 13.5H6C6.13261 13.5 6.25979 13.4473 6.35355 13.3536C6.44732 13.2598 6.5 13.1326 6.5 13C6.5 12.8674 6.44732 12.7402 6.35355 12.6464C6.25979 12.5527 6.13261 12.5 6 12.5H4.20703L6.85352 9.85352C6.94726 9.75975 6.99992 9.63259 6.99992 9.5C6.99992 9.36741 6.94726 9.24025 6.85352 9.14648C6.75976 9.05271 6.6326 9.00002 6.5 9Z" />
              </svg>
              <span className={styles.recordContextMenuItemText}>Expand record</span>
            </li>

            {/* --- Separator --- */}
            <li className={styles.recordContextMenuSeparator} />

            {/* Add comment */}
            <li className={styles.recordContextMenuItem} onClick={closeRecordMenu}>
              <svg className={styles.recordContextMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                <path fillRule="nonzero" d="M2.5 3C1.95364 3 1.5 3.45364 1.5 4V13.925C1.5 13.9264 1.5 13.9278 1.5 13.9292C1.50321 14.3138 1.72911 14.665 2.07776 14.8275C2.42665 14.9901 2.84111 14.9369 3.13758 14.6914C3.13819 14.6909 3.1388 14.6903 3.13941 14.6898L5.15821 13.0023C5.15911 13.0015 5.16 13.0008 5.16089 13H13.5C14.0464 13 14.5 12.5464 14.5 12V4C14.5 3.45364 14.0464 3 13.5 3H2.5ZM2.5 4H13.5V12H5.15625C5.15629 12 5.15621 12 5.15625 12C4.91921 12 4.68966 12.0855 4.51038 12.2406L2.5 13.9209V4Z" />
              </svg>
              <span className={styles.recordContextMenuItemText}>Add comment</span>
            </li>

            {/* Copy cell url */}
            <li className={styles.recordContextMenuItem} onClick={closeRecordMenu}>
              <svg className={styles.recordContextMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                <path fillRule="nonzero" d="M6.93749 5.81154C6.07524 5.8115 5.24801 6.15511 4.63952 6.76601L2.87206 8.52712C2.86639 8.53281 2.86085 8.53863 2.85546 8.54458C2.29141 9.16344 1.98729 9.97626 2.0067 10.8134C2.03651 12.0876 2.80961 13.23 3.98144 13.7313C5.15327 14.2327 6.51333 14.003 7.45556 13.1447C7.4613 13.1395 7.46691 13.1341 7.4724 13.1287L8.70983 11.8911C8.75627 11.8447 8.7931 11.7896 8.81823 11.7289C8.84336 11.6683 8.8563 11.6032 8.8563 11.5376C8.8563 11.4719 8.84336 11.4069 8.81823 11.3462C8.7931 11.2855 8.75627 11.2304 8.70983 11.184C8.61606 11.0902 8.4889 11.0376 8.35631 11.0376C8.22372 11.0376 8.09656 11.0902 8.0028 11.184L6.77868 12.4081C6.12438 13.0019 5.18732 13.1596 4.37475 12.8119C3.56087 12.4637 3.02721 11.6752 3.00646 10.7902C2.99307 10.2112 3.20288 9.64994 3.59215 9.22133L5.34667 7.47304C5.34712 7.47259 5.34757 7.47215 5.34801 7.4717C5.76912 7.04892 6.34077 6.81151 6.93749 6.81155C7.53422 6.81155 8.10583 7.04894 8.52697 7.4717C8.57331 7.51823 8.62836 7.55517 8.68898 7.58041C8.7496 7.60566 8.8146 7.61872 8.88027 7.61884C8.94593 7.61897 9.01098 7.60616 9.0717 7.58114C9.13241 7.55612 9.1876 7.51939 9.23412 7.47305C9.32804 7.37946 9.38095 7.2524 9.3812 7.11981C9.38145 6.98722 9.32903 6.85996 9.23547 6.76601C8.62695 6.15516 7.79971 5.81155 6.93749 5.81154Z M10.8133 2.00905C10.0028 1.99035 9.18543 2.27105 8.54442 2.85549C8.53873 2.86069 8.53315 2.86602 8.5277 2.87148L7.29015 4.10891C7.24372 4.15534 7.20688 4.21046 7.18175 4.27113C7.15662 4.33179 7.14368 4.39682 7.14368 4.46248C7.14368 4.52815 7.15662 4.59317 7.18175 4.65384C7.20688 4.71451 7.24372 4.76963 7.29015 4.81606C7.33658 4.8625 7.3917 4.89933 7.45237 4.92446C7.51304 4.9496 7.57806 4.96253 7.64373 4.96253C7.70939 4.96253 7.77442 4.9496 7.83508 4.92446C7.89575 4.89933 7.95087 4.8625 7.9973 4.81606L9.22155 3.59194C10.1163 2.77921 11.4786 2.81129 12.3337 3.6664C13.1889 4.5216 13.2208 5.88409 12.4078 6.77883L10.6533 8.52712C10.6529 8.52757 10.6524 8.52802 10.652 8.52846C10.0089 9.17407 9.04352 9.36659 8.20202 9.01699C8.20206 9.01699 8.20197 9.01699 8.20202 9.01699C7.92924 8.90373 7.68135 8.7377 7.47289 8.52846C7.3793 8.43454 7.25224 8.38164 7.11965 8.38138C6.98706 8.38113 6.8598 8.43355 6.76586 8.52712C6.71933 8.57346 6.68239 8.62851 6.65714 8.68913C6.6319 8.74975 6.61884 8.81475 6.61871 8.88042C6.61859 8.94609 6.6314 9.01113 6.65642 9.07185C6.68143 9.13256 6.71816 9.18776 6.76451 9.23427C7.06587 9.53674 7.42403 9.77671 7.81835 9.94045C9.03169 10.4445 10.4332 10.165 11.3605 9.23415L13.1279 7.47304C13.1336 7.4674 13.1391 7.46162 13.1445 7.45571C14.3134 6.17372 14.2675 4.18601 13.0408 2.95925C12.4274 2.34587 11.6239 2.02776 10.8133 2.00905Z" />
              </svg>
              <span className={styles.recordContextMenuItemText}>Copy cell url</span>
            </li>

            {/* Send record */}
            <li className={styles.recordContextMenuItem} onClick={closeRecordMenu}>
              <svg className={styles.recordContextMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                <path fillRule="nonzero" d="M2.5 4H13.5V12H2.50012L2.5 4Z M2 3C1.8674 3.00001 1.74023 3.0527 1.64646 3.14646C1.5527 3.24023 1.50001 3.3674 1.5 3.5V12C1.50007 12.5463 1.95357 12.9999 2.49988 13C2.49984 13 2.49992 13 2.49988 13H13.5C14.0464 13 14.5 12.5464 14.5 12V3.5C14.5 3.3674 14.4473 3.24023 14.3535 3.14646C14.2598 3.0527 14.1326 3.00001 14 3H2ZM1.97827 3.00049C1.84581 3.00625 1.72107 3.06439 1.63147 3.16211C1.54186 3.25985 1.49475 3.38919 1.50049 3.52167C1.50624 3.65414 1.56437 3.77891 1.66211 3.86853L7.66211 9.36853C7.75433 9.45307 7.87489 9.49996 8 9.49996C8.12511 9.49996 8.24567 9.45307 8.33789 9.36853L14.3379 3.86853C14.4356 3.77891 14.4938 3.65414 14.4995 3.52167C14.5053 3.38919 14.4581 3.25985 14.3685 3.16211C14.2789 3.06437 14.1541 3.00624 14.0217 3.00049C13.8892 2.99475 13.7599 3.04186 13.6621 3.13147L8 8.32166L2.33789 3.13147C2.28949 3.08709 2.23281 3.05268 2.17111 3.03021C2.10941 3.00773 2.04388 2.99764 1.97827 3.00049Z" />
              </svg>
              <span className={styles.recordContextMenuItemText}>Send record</span>
            </li>

            {/* --- Separator --- */}
            <li className={styles.recordContextMenuSeparator} />

            {/* Delete record */}
            <li className={styles.recordContextMenuItem} onClick={() => { if (recordMenuRowId) onDeleteRecord?.(recordMenuRowId); closeRecordMenu(); }}>
              <svg className={styles.recordContextMenuDeleteIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                <path fillRule="nonzero" d="M6.5 6C6.36739 6 6.24021 6.05268 6.14645 6.14645C6.05268 6.24021 6 6.36739 6 6.5V10.5C6 10.6326 6.05268 10.7598 6.14645 10.8536C6.24021 10.9473 6.36739 11 6.5 11C6.63261 11 6.75979 10.9473 6.85355 10.8536C6.94732 10.7598 7 10.6326 7 10.5V6.5C7 6.36739 6.94732 6.24021 6.85355 6.14645C6.75979 6.05268 6.63261 6 6.5 6Z M9.5 6C9.36739 6 9.24021 6.05268 9.14645 6.14645C9.05268 6.24021 9 6.36739 9 6.5V10.5C9 10.6326 9.05268 10.7598 9.14645 10.8536C9.24021 10.9473 9.36739 11 9.5 11C9.63261 11 9.75979 10.9473 9.85355 10.8536C9.94732 10.7598 10 10.6326 10 10.5V6.5C10 6.36739 9.94732 6.24021 9.85355 6.14645C9.75979 6.05268 9.63261 6 9.5 6Z M6.5 1C5.6775 1 5 1.6775 5 2.5V3H2.5C2.36739 3 2.24021 3.05268 2.14645 3.14645C2.05268 3.24021 2 3.36739 2 3.5C2 3.63261 2.05268 3.75979 2.14645 3.85355C2.24021 3.94732 2.36739 4 2.5 4H3V13C3.00007 13.5463 3.45357 13.9999 3.99988 14H12C12.5464 14 13 13.5464 13 13V4H13.5C13.6326 4 13.7598 3.94732 13.8536 3.85355C13.9473 3.75979 14 3.63261 14 3.5C14 3.36739 13.9473 3.24021 13.8536 3.14645C13.7598 3.05268 13.6326 3 13.5 3H11V2.5C10.9999 1.67757 10.3226 1.0001 9.50012 1H6.5ZM6.5 2H9.5C9.78202 2.0001 9.99996 2.21808 10 2.50012V3H6V2.5C6 2.21794 6.21794 2 6.5 2ZM4 4H12V13H4.00012L4 4Z" />
              </svg>
              <span className={styles.recordContextMenuDeleteText}>Delete record</span>
            </li>
          </ul>
        </div>,
        document.body,
      )}

      {/* === Column Header Dropdown Menu (portal) === */}
      {headerMenuColId && headerMenuPosition && createPortal(
        <div
          ref={headerMenuRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            zIndex: 99999,
            display: 'block',
            width: 320,
            maxHeight: headerMenuMaxHeight,
            top: headerMenuPosition.top,
            left: headerMenuPosition.left,
            padding: 0,
            margin: 0,
            backgroundColor: 'rgb(255, 255, 255)',
            borderRadius: 6,
            boxShadow: 'rgba(0, 0, 0, 0.24) 0px 0px 1px 0px, rgba(0, 0, 0, 0.16) 0px 0px 2px 0px, rgba(0, 0, 0, 0.06) 0px 3px 4px 0px, rgba(0, 0, 0, 0.06) 0px 6px 8px 0px, rgba(0, 0, 0, 0.08) 0px 12px 16px 0px, rgba(0, 0, 0, 0.06) 0px 18px 32px 0px',
            overflowY: 'auto',
          }}
        >
        <ul className={styles.colHeaderMenu}>
          {/* Edit field */}
          <li className={styles.colHeaderMenuItem} onClick={handleEditField}>
            <svg className={styles.colHeaderMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
              <path fillRule="nonzero" d="M10.5 1.71045C10.2406 1.71045 9.9813 1.80867 9.7876 2.00525L2.29017 9.50269L2.28931 9.50354C2.10332 9.69048 1.9991 9.94419 2.00001 10.2079V12.9999C2.00007 13.5462 2.45358 13.9998 2.99988 13.9999H5.79212C6.05578 14.0008 6.30942 13.8966 6.49635 13.7107L6.49732 13.7097L13.9948 6.21228C14.3878 5.82489 14.3878 5.17499 13.9948 4.7876L11.2124 2.00525C11.0187 1.80867 10.7594 1.71045 10.5 1.71045ZM10.4999 2.70715C10.4955 2.70269 10.5043 2.70269 10.4999 2.70715L10.5027 2.70972L13.2902 5.49719L13.2927 5.49976C13.2972 5.49534 13.2972 5.50418 13.2927 5.49976L13.2902 5.50269L12 6.79297L9.20704 4L10.4973 2.70972L10.4999 2.70715ZM8.50001 4.70703L11.293 7.5L5.79297 12.9999H3.00013L3.00001 10.207L8.50001 4.70703Z" />
            </svg>
            <span className={styles.colHeaderMenuItemText}>Edit field</span>
          </li>

          {/* --- Separator --- */}
          <li className={styles.colHeaderMenuSeparator} />

          {/* Duplicate field */}
          <li className={styles.colHeaderMenuItem} onClick={() => {
            if (headerMenuColId) {
              const col = allColumns.find((c) => c.id === headerMenuColId);
              setDupFieldDialog({ colId: headerMenuColId, colName: col?.name ?? "field" });
              setDupCells(true);
              setHeaderMenuColId(null);
              setHeaderMenuPosition(null);
            }
          }}>
            <svg className={styles.colHeaderMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
              <path fillRule="nonzero" d="M2.5 5C2.3674 5.00001 2.24023 5.0527 2.14646 5.14646C2.0527 5.24023 2.00001 5.3674 2 5.5V13.5C2.00001 13.6326 2.0527 13.7598 2.14646 13.8535C2.24023 13.9473 2.3674 14 2.5 14H10.5C10.6326 14 10.7598 13.9473 10.8535 13.8535C10.9473 13.7598 11 13.6326 11 13.5V5.5C11 5.3674 10.9473 5.24023 10.8535 5.14646C10.7598 5.0527 10.6326 5.00001 10.5 5H2.5ZM3 6H10V13H3V6Z M5.5 2C5.3674 2.00001 5.24023 2.0527 5.14646 2.14646C5.0527 2.24023 5.00001 2.3674 5 2.5V5.5C5 5.63261 5.05268 5.75979 5.14645 5.85355C5.24021 5.94732 5.36739 6 5.5 6C5.63261 6 5.75979 5.94732 5.85355 5.85355C5.94732 5.75979 6 5.63261 6 5.5V3H13V10H10.5C10.3674 10 10.2402 10.0527 10.1464 10.1464C10.0527 10.2402 10 10.3674 10 10.5C10 10.6326 10.0527 10.7598 10.1464 10.8536C10.2402 10.9473 10.3674 11 10.5 11H13.5C13.6326 11 13.7598 10.9473 13.8535 10.8535C13.9473 10.7598 14 10.6326 14 10.5V2.5C14 2.3674 13.9473 2.24023 13.8535 2.14646C13.7598 2.0527 13.6326 2.00001 13.5 2H5.5Z" />
            </svg>
            <span className={styles.colHeaderMenuItemText}>Duplicate field</span>
          </li>

          {/* Insert left */}
          <li className={styles.colHeaderMenuItem} onClick={() => handleInsertField("left")}>
            <svg className={styles.colHeaderMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
              <path fillRule="nonzero" d="M7 3C6.8674 3.00002 6.74024 3.05271 6.64648 3.14648L2.14648 7.64648C2.05271 7.74024 2.00002 7.8674 2 8C2.00002 8.1326 2.05271 8.25976 2.14648 8.35352L6.64648 12.8535C6.74025 12.9473 6.86741 12.9999 7 12.9999C7.13259 12.9999 7.25975 12.9473 7.35352 12.8535C7.44726 12.7598 7.49992 12.6326 7.49992 12.5C7.49992 12.3674 7.44726 12.2402 7.35352 12.1465L3.70703 8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H3.70703L7.35352 3.85352C7.44726 3.75975 7.49992 3.63259 7.49992 3.5C7.49992 3.36741 7.44726 3.24025 7.35352 3.14648C7.25976 3.05271 7.1326 3.00002 7 3Z" />
            </svg>
            <span className={styles.colHeaderMenuItemText}>Insert left</span>
          </li>

          {/* Insert right */}
          <li className={styles.colHeaderMenuItem} onClick={() => handleInsertField("right")}>
            <svg className={styles.colHeaderMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
              <path fillRule="nonzero" d="M9 3C8.8674 3.00002 8.74024 3.05271 8.64648 3.14648C8.55274 3.24025 8.50008 3.36741 8.50008 3.5C8.50008 3.63259 8.55274 3.75975 8.64648 3.85352L12.293 7.5H2.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H12.293L8.64648 12.1465C8.55274 12.2402 8.50008 12.3674 8.50008 12.5C8.50008 12.6326 8.55274 12.7598 8.64648 12.8535C8.74025 12.9473 8.86741 12.9999 9 12.9999C9.13259 12.9999 9.25975 12.9473 9.35352 12.8535L13.8535 8.35352C13.9414 8.26249 13.9915 8.14153 13.9938 8.01501C13.9959 8.01004 13.998 8.00504 14 8C13.9985 7.98678 13.9964 7.97363 13.9938 7.96057C13.9917 7.93512 13.9877 7.90985 13.9818 7.88501C13.9757 7.85934 13.9675 7.8342 13.9574 7.80981C13.9476 7.78622 13.936 7.7634 13.9227 7.74158C13.9089 7.7191 13.8934 7.69776 13.8762 7.67773C13.8691 7.66703 13.8615 7.6566 13.8535 7.64648L9.35352 3.14648C9.25976 3.05271 9.1326 3.00002 9 3Z" />
            </svg>
            <span className={styles.colHeaderMenuItemText}>Insert right</span>
          </li>

          {/* --- Separator --- */}
          <li className={styles.colHeaderMenuSeparator} />

          {/* Summarize field */}
          <li className={styles.colHeaderMenuItem}>
            <svg className={styles.colHeaderMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
              <path fillRule="evenodd" d="M6.04 7c.336 0 .505 0 .633.065a.6.6 0 0 1 .262.262C7 7.455 7 7.624 7 7.96v.08c0 .336 0 .505-.065.633a.6.6 0 0 1-.262.262C6.545 9 6.376 9 6.04 9h-.08c-.336 0-.505 0-.633-.065a.6.6 0 0 1-.262-.262C5 8.545 5 8.376 5 8.04v-.08c0-.336 0-.505.065-.633a.6.6 0 0 1 .262-.262C5.455 7 5.624 7 5.96 7zm4 0c.336 0 .505 0 .633.065a.6.6 0 0 1 .262.262c.065.128.065.297.065.633v.08c0 .336 0 .505-.065.633a.6.6 0 0 1-.262.262C10.545 9 10.376 9 10.04 9h-.08c-.336 0-.505 0-.633-.065a.6.6 0 0 1-.262-.262C9 8.545 9 8.376 9 8.04v-.08c0-.336 0-.505.065-.633a.6.6 0 0 1 .262-.262C9.455 7 9.624 7 9.96 7z" />
              <path fillRule="nonzero" d="M8.24 2c2.016 0 3.024 0 3.794.393a3.6 3.6 0 0 1 1.573 1.573C14 4.736 14 5.744 14 7.76v.48c0 2.016 0 3.024-.393 3.794a3.6 3.6 0 0 1-1.573 1.573C11.264 14 10.256 14 8.24 14h-.48c-2.016 0-3.024 0-3.794-.393a3.6 3.6 0 0 1-1.573-1.573C2 11.264 2 10.256 2 8.24v-.48c0-2.016 0-3.024.393-3.794a3.6 3.6 0 0 1 1.573-1.573C4.736 2 5.744 2 7.76 2zm-.48 1c-1.024 0-1.732 0-2.282.046-.539.044-.837.125-1.058.237-.49.25-.888.648-1.137 1.137-.112.22-.193.52-.237 1.058C3 6.028 3 6.736 3 7.76v.48c0 1.024 0 1.733.046 2.282.044.539.125.837.237 1.058.25.49.648.887 1.137 1.137.22.112.52.193 1.058.237C6.028 13 6.736 13 7.76 13h.48c1.024 0 1.733 0 2.282-.046.539-.044.837-.125 1.058-.237.49-.25.887-.648 1.137-1.137.112-.22.193-.52.237-1.058.023-.274.034-.589.04-.962L13 8.24v-.48c0-1.024 0-1.732-.046-2.282-.044-.539-.125-.837-.237-1.058a2.6 2.6 0 0 0-1.137-1.137c-.22-.112-.52-.193-1.058-.237a15 15 0 0 0-.962-.04L8.24 3z" />
            </svg>
            <span className={styles.colHeaderMenuItemText}>Summarize field</span>
          </li>

          {/* Write headline for field */}
          <li className={styles.colHeaderMenuItem}>
            <svg className={styles.colHeaderMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
              <path fillRule="evenodd" d="M6.04 7c.336 0 .505 0 .633.065a.6.6 0 0 1 .262.262C7 7.455 7 7.624 7 7.96v.08c0 .336 0 .505-.065.633a.6.6 0 0 1-.262.262C6.545 9 6.376 9 6.04 9h-.08c-.336 0-.505 0-.633-.065a.6.6 0 0 1-.262-.262C5 8.545 5 8.376 5 8.04v-.08c0-.336 0-.505.065-.633a.6.6 0 0 1 .262-.262C5.455 7 5.624 7 5.96 7zm4 0c.336 0 .505 0 .633.065a.6.6 0 0 1 .262.262c.065.128.065.297.065.633v.08c0 .336 0 .505-.065.633a.6.6 0 0 1-.262.262C10.545 9 10.376 9 10.04 9h-.08c-.336 0-.505 0-.633-.065a.6.6 0 0 1-.262-.262C9 8.545 9 8.376 9 8.04v-.08c0-.336 0-.505.065-.633a.6.6 0 0 1 .262-.262C9.455 7 9.624 7 9.96 7z" />
              <path fillRule="nonzero" d="M8.24 2c2.016 0 3.024 0 3.794.393a3.6 3.6 0 0 1 1.573 1.573C14 4.736 14 5.744 14 7.76v.48c0 2.016 0 3.024-.393 3.794a3.6 3.6 0 0 1-1.573 1.573C11.264 14 10.256 14 8.24 14h-.48c-2.016 0-3.024 0-3.794-.393a3.6 3.6 0 0 1-1.573-1.573C2 11.264 2 10.256 2 8.24v-.48c0-2.016 0-3.024.393-3.794a3.6 3.6 0 0 1 1.573-1.573C4.736 2 5.744 2 7.76 2zm-.48 1c-1.024 0-1.732 0-2.282.046-.539.044-.837.125-1.058.237-.49.25-.888.648-1.137 1.137-.112.22-.193.52-.237 1.058C3 6.028 3 6.736 3 7.76v.48c0 1.024 0 1.733.046 2.282.044.539.125.837.237 1.058.25.49.648.887 1.137 1.137.22.112.52.193 1.058.237C6.028 13 6.736 13 7.76 13h.48c1.024 0 1.733 0 2.282-.046.539-.044.837-.125 1.058-.237.49-.25.887-.648 1.137-1.137.112-.22.193-.52.237-1.058.023-.274.034-.589.04-.962L13 8.24v-.48c0-1.024 0-1.732-.046-2.282-.044-.539-.125-.837-.237-1.058a2.6 2.6 0 0 0-1.137-1.137c-.22-.112-.52-.193-1.058-.237a15 15 0 0 0-.962-.04L8.24 3z" />
            </svg>
            <span className={styles.colHeaderMenuItemText}>Write headline for field</span>
          </li>

          {/* --- Separator --- */}
          <li className={styles.colHeaderMenuSeparator} />

          {/* Copy field URL */}
          <li className={styles.colHeaderMenuItem}>
            <svg className={styles.colHeaderMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
              <path fillRule="nonzero" d="M6.93749 5.81154C6.07524 5.8115 5.24801 6.15511 4.63952 6.76601L2.87206 8.52712C2.86639 8.53281 2.86085 8.53863 2.85546 8.54458C2.29141 9.16344 1.98729 9.97626 2.0067 10.8134C2.03651 12.0876 2.80961 13.23 3.98144 13.7313C5.15327 14.2327 6.51333 14.003 7.45556 13.1447C7.4613 13.1395 7.46691 13.1341 7.4724 13.1287L8.70983 11.8911C8.75627 11.8447 8.7931 11.7896 8.81823 11.7289C8.84336 11.6683 8.8563 11.6032 8.8563 11.5376C8.8563 11.4719 8.84336 11.4069 8.81823 11.3462C8.7931 11.2855 8.75627 11.2304 8.70983 11.184C8.61606 11.0902 8.4889 11.0376 8.35631 11.0376C8.22372 11.0376 8.09656 11.0902 8.0028 11.184L6.77868 12.4081C6.12438 13.0019 5.18732 13.1596 4.37475 12.8119C3.56087 12.4637 3.02721 11.6752 3.00646 10.7902C2.99307 10.2112 3.20288 9.64994 3.59215 9.22133L5.34667 7.47304C5.34712 7.47259 5.34757 7.47215 5.34801 7.4717C5.76912 7.04892 6.34077 6.81151 6.93749 6.81155C7.53422 6.81155 8.10583 7.04894 8.52697 7.4717C8.57331 7.51823 8.62836 7.55517 8.68898 7.58041C8.7496 7.60566 8.8146 7.61872 8.88027 7.61884C8.94593 7.61897 9.01098 7.60616 9.0717 7.58114C9.13241 7.55612 9.1876 7.51939 9.23412 7.47305C9.32804 7.37946 9.38095 7.2524 9.3812 7.11981C9.38145 6.98722 9.32903 6.85996 9.23547 6.76601C8.62695 6.15516 7.79971 5.81155 6.93749 5.81154Z M10.8133 2.00905C10.0028 1.99035 9.18543 2.27105 8.54442 2.85549C8.53873 2.86069 8.53315 2.86602 8.5277 2.87148L7.29015 4.10891C7.24372 4.15534 7.20688 4.21046 7.18175 4.27113C7.15662 4.33179 7.14368 4.39682 7.14368 4.46248C7.14368 4.52815 7.15662 4.59317 7.18175 4.65384C7.20688 4.71451 7.24372 4.76963 7.29015 4.81606C7.33658 4.8625 7.3917 4.89933 7.45237 4.92446C7.51304 4.9496 7.57806 4.96253 7.64373 4.96253C7.70939 4.96253 7.77442 4.9496 7.83508 4.92446C7.89575 4.89933 7.95087 4.8625 7.9973 4.81606L9.22155 3.59194C10.1163 2.77921 11.4786 2.81129 12.3337 3.6664C13.1889 4.5216 13.2208 5.88409 12.4078 6.77883L10.6533 8.52712C10.6529 8.52757 10.6524 8.52802 10.652 8.52846C10.0089 9.17407 9.04352 9.36659 8.20202 9.01699C8.20206 9.01699 8.20197 9.01699 8.20202 9.01699C7.92924 8.90373 7.68135 8.7377 7.47289 8.52846C7.3793 8.43454 7.25224 8.38164 7.11965 8.38138C6.98706 8.38113 6.8598 8.43355 6.76586 8.52712C6.71933 8.57346 6.68239 8.62851 6.65714 8.68913C6.6319 8.74975 6.61884 8.81475 6.61871 8.88042C6.61859 8.94609 6.6314 9.01113 6.65642 9.07185C6.68143 9.13256 6.71816 9.18776 6.76451 9.23427C7.06587 9.53674 7.42403 9.77671 7.81835 9.94045C9.03169 10.4445 10.4332 10.165 11.3605 9.23415L13.1279 7.47304C13.1336 7.4674 13.1391 7.46162 13.1445 7.45571C14.3134 6.17372 14.2675 4.18601 13.0408 2.95925C12.4274 2.34587 11.6239 2.02776 10.8133 2.00905Z" />
            </svg>
            <span className={styles.colHeaderMenuItemText}>Copy field URL</span>
          </li>

          {/* Edit field description */}
          <li className={styles.colHeaderMenuItem}>
            <svg className={styles.colHeaderMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
              <path fillRule="nonzero" d="M7.875 6C8.28919 6 8.625 5.66419 8.625 5.25C8.625 4.83581 8.28919 4.5 7.875 4.5C7.46081 4.5 7.125 4.83581 7.125 5.25C7.125 5.66419 7.46081 6 7.875 6Z M7.5 7C7.36739 7 7.24021 7.05268 7.14645 7.14645C7.05268 7.24021 7 7.36739 7 7.5C7 7.63261 7.05268 7.75979 7.14645 7.85355C7.24021 7.94732 7.36739 8 7.5 8V11C7.50001 11.1326 7.5527 11.2598 7.64646 11.3535C7.74023 11.4473 7.8674 11.5 8 11.5H8.5C8.63261 11.5 8.75979 11.4473 8.85355 11.3536C8.94732 11.2598 9 11.1326 9 11C9 10.8674 8.94732 10.7402 8.85355 10.6464C8.75979 10.5527 8.63261 10.5 8.5 10.5V7.5C8.49999 7.3674 8.4473 7.24023 8.35354 7.14646C8.25977 7.0527 8.1326 7.00001 8 7H7.5Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
            </svg>
            <span className={styles.colHeaderMenuItemText}>Edit field description</span>
          </li>

          {/* Edit field permissions (with Team badge) */}
          <li className={styles.colHeaderMenuItem}>
            <svg className={styles.colHeaderMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
              <path fillRule="nonzero" d="M8 10.25C8.41419 10.25 8.75 9.91419 8.75 9.5C8.75 9.08581 8.41419 8.75 8 8.75C7.58581 8.75 7.25 9.08581 7.25 9.5C7.25 9.91419 7.58581 10.25 8 10.25Z M8 0.5C6.48714 0.5 5.25 1.73714 5.25 3.25V5H3C2.45364 5 2 5.45364 2 6V13C2 13.5464 2.45364 14 3 14H13C13.5464 14 14 13.5464 14 13V6C14 5.45364 13.5464 5 13 5H10.75V3.25C10.75 1.73714 9.51286 0.5 8 0.5ZM8 1.5C8.97242 1.5 9.75 2.27758 9.75 3.25V5H6.25V3.25C6.25 2.27758 7.02758 1.5 8 1.5ZM3 6H13V13H3V6Z" />
            </svg>
            <div className={styles.colHeaderMenuItemContent}>
              <span className={styles.colHeaderMenuItemText}>Edit field permissions</span>
              <span className={styles.colHeaderMenuTeamBadge}>
                <svg className={styles.colHeaderMenuBadgeIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                </svg>
                Team
              </span>
            </div>
          </li>

          {/* --- Separator --- */}
          <li className={styles.colHeaderMenuSeparator} />

          {/* Sort A → Z (or 1 → 9 for NUMBER columns) */}
          <li className={styles.colHeaderMenuItem} onClick={() => {
            if (headerMenuColId) {
              onSortByField?.(headerMenuColId, "asc");
              setHeaderMenuColId(null);
              setHeaderMenuPosition(null);
            }
          }}>
            <svg className={styles.colHeaderMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
              <path fillRule="nonzero" d="M3 11.5C2.86739 11.5 2.74021 11.5527 2.64645 11.6464C2.55268 11.7402 2.5 11.8674 2.5 12C2.5 12.1326 2.55268 12.2598 2.64645 12.3536C2.74021 12.4473 2.86739 12.5 3 12.5H6.5C6.63261 12.5 6.75979 12.4473 6.85355 12.3536C6.94732 12.2598 7 12.1326 7 12C7 11.8674 6.94732 11.7402 6.85355 11.6464C6.75979 11.5527 6.63261 11.5 6.5 11.5H3Z M3 3.5C2.86739 3.5 2.74021 3.55268 2.64645 3.64645C2.55268 3.74021 2.5 3.86739 2.5 4C2.5 4.13261 2.55268 4.25979 2.64645 4.35355C2.74021 4.44732 2.86739 4.5 3 4.5H11.5C11.6326 4.5 11.7598 4.44732 11.8536 4.35355C11.9473 4.25979 12 4.13261 12 4C12 3.86739 11.9473 3.74021 11.8536 3.64645C11.7598 3.55268 11.6326 3.5 11.5 3.5H3Z M3 7.5C2.86739 7.5 2.74021 7.55268 2.64645 7.64645C2.55268 7.74021 2.5 7.86739 2.5 8C2.5 8.13261 2.55268 8.25979 2.64645 8.35355C2.74021 8.44732 2.86739 8.5 3 8.5H7.5C7.63261 8.5 7.75979 8.44732 7.85355 8.35355C7.94732 8.25979 8 8.13261 8 8C8 7.86739 7.94732 7.74021 7.85355 7.64645C7.75979 7.55268 7.63261 7.5 7.5 7.5H3Z M11.5 6.5C11.3674 6.5 11.2402 6.55268 11.1464 6.64645C11.0527 6.74021 11 6.86739 11 7V11.793L9.35352 10.1465C9.25975 10.0527 9.13259 10.0001 9 10.0001C8.86741 10.0001 8.74025 10.0527 8.64648 10.1465C8.55274 10.2402 8.50008 10.3674 8.50008 10.5C8.50008 10.6326 8.55274 10.7598 8.64648 10.8535L11.1465 13.3535C11.2403 13.4472 11.3674 13.4999 11.5 13.4999C11.6326 13.4999 11.7597 13.4472 11.8535 13.3535L14.3535 10.8535C14.4473 10.7598 14.4999 10.6326 14.4999 10.5C14.4999 10.3674 14.4473 10.2402 14.3535 10.1465C14.2598 10.0527 14.1326 10.0001 14 10.0001C13.8674 10.0001 13.7402 10.0527 13.6465 10.1465L12 11.793V7C12 6.86739 11.9473 6.74021 11.8536 6.64645C11.7598 6.55268 11.6326 6.5 11.5 6.5Z" />
            </svg>
            <span className={styles.colHeaderMenuItemText}>{headerMenuColId && getColumnById(headerMenuColId)?.type === "NUMBER" ? "1 → 9" : "A → Z"}</span>
          </li>

          {/* Sort Z → A (or 9 → 1 for NUMBER columns) */}
          <li className={styles.colHeaderMenuItem} onClick={() => {
            if (headerMenuColId) {
              onSortByField?.(headerMenuColId, "desc");
              setHeaderMenuColId(null);
              setHeaderMenuPosition(null);
            }
          }}>
            <svg className={styles.colHeaderMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
              <path fillRule="nonzero" d="M3 11.5C2.86739 11.5 2.74021 11.5527 2.64645 11.6464C2.55268 11.7402 2.5 11.8674 2.5 12C2.5 12.1326 2.55268 12.2598 2.64645 12.3536C2.74021 12.4473 2.86739 12.5 3 12.5H11.5C11.6326 12.5 11.7598 12.4473 11.8536 12.3536C11.9473 12.2598 12 12.1326 12 12C12 11.8674 11.9473 11.7402 11.8536 11.6464C11.7598 11.5527 11.6326 11.5 11.5 11.5H3Z M3 3.5C2.86739 3.5 2.74021 3.55268 2.64645 3.64645C2.55268 3.74021 2.5 3.86739 2.5 4C2.5 4.13261 2.55268 4.25979 2.64645 4.35355C2.74021 4.44732 2.86739 4.5 3 4.5H6.5C6.63261 4.5 6.75979 4.44732 6.85355 4.35355C6.94732 4.25979 7 4.13261 7 4C7 3.86739 6.94732 3.74021 6.85355 3.64645C6.75979 3.55268 6.63261 3.5 6.5 3.5H3Z M3 7.5C2.86739 7.5 2.74021 7.55268 2.64645 7.64645C2.55268 7.74021 2.5 7.86739 2.5 8C2.5 8.13261 2.55268 8.25979 2.64645 8.35355C2.74021 8.44732 2.86739 8.5 3 8.5H7.5C7.63261 8.5 7.75979 8.44732 7.85355 8.35355C7.94732 8.25979 8 8.13261 8 8C8 7.86739 7.94732 7.74021 7.85355 7.64645C7.75979 7.55268 7.63261 7.5 7.5 7.5H3Z M11.5 2.5C11.3674 2.50003 11.2402 2.55272 11.1465 2.64648L8.64648 5.14648C8.55274 5.24025 8.50008 5.36741 8.50008 5.5C8.50008 5.63259 8.55274 5.75975 8.64648 5.85352C8.74025 5.94726 8.86741 5.99992 9 5.99992C9.13259 5.99992 9.25975 5.94726 9.35352 5.85352L11 4.20703V9C11 9.13261 11.0527 9.25979 11.1464 9.35355C11.2402 9.44732 11.3674 9.5 11.5 9.5C11.6326 9.5 11.7598 9.44732 11.8536 9.35355C11.9473 9.25979 12 9.13261 12 9V4.20703L13.6465 5.85352C13.7402 5.94726 13.8674 5.99992 14 5.99992C14.1326 5.99992 14.2598 5.94726 14.3535 5.85352C14.4473 5.75975 14.4999 5.63259 14.4999 5.5C14.4999 5.36741 14.4473 5.24025 14.3535 5.14648L11.8535 2.64648C11.8487 2.64437 11.8438 2.64234 11.8389 2.64038C11.7478 2.55235 11.6267 2.50218 11.5 2.5Z" />
            </svg>
            <span className={styles.colHeaderMenuItemText}>{headerMenuColId && getColumnById(headerMenuColId)?.type === "NUMBER" ? "9 → 1" : "Z → A"}</span>
          </li>

          {/* --- Separator --- */}
          <li className={styles.colHeaderMenuSeparator} />

          {/* Filter by this field */}
          <li className={styles.colHeaderMenuItem} onClick={() => {
            if (headerMenuColId) {
              onFilterByField?.(headerMenuColId);
              setHeaderMenuColId(null);
              setHeaderMenuPosition(null);
            }
          }}>
            <svg className={styles.colHeaderMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
              <path fillRule="nonzero" d="M6.5 10.5C6.36739 10.5 6.24021 10.5527 6.14645 10.6464C6.05268 10.7402 6 10.8674 6 11C6 11.1326 6.05268 11.2598 6.14645 11.3536C6.24021 11.4473 6.36739 11.5 6.5 11.5H9.5C9.63261 11.5 9.75979 11.4473 9.85355 11.3536C9.94732 11.2598 10 11.1326 10 11C10 10.8674 9.94732 10.7402 9.85355 10.6464C9.75979 10.5527 9.63261 10.5 9.5 10.5H6.5Z M1.5 4.5C1.36739 4.5 1.24021 4.55268 1.14645 4.64645C1.05268 4.74021 1 4.86739 1 5C1 5.13261 1.05268 5.25979 1.14645 5.35355C1.24021 5.44732 1.36739 5.5 1.5 5.5H14.5C14.6326 5.5 14.7598 5.44732 14.8536 5.35355C14.9473 5.25979 15 5.13261 15 5C15 4.86739 14.9473 4.74021 14.8536 4.64645C14.7598 4.55268 14.6326 4.5 14.5 4.5H1.5Z M4 7.5C3.86739 7.5 3.74021 7.55268 3.64645 7.64645C3.55268 7.74021 3.5 7.86739 3.5 8C3.5 8.13261 3.55268 8.25979 3.64645 8.35355C3.74021 8.44732 3.86739 8.5 4 8.5H12C12.1326 8.5 12.2598 8.44732 12.3536 8.35355C12.4473 8.25979 12.5 8.13261 12.5 8C12.5 7.86739 12.4473 7.74021 12.3536 7.64645C12.2598 7.55268 12.1326 7.5 12 7.5H4Z" />
            </svg>
            <span className={styles.colHeaderMenuItemText}>Filter by this field</span>
          </li>

          {/* Group by this field */}
          <li className={styles.colHeaderMenuItem}>
            <svg className={styles.colHeaderMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
              <path fillRule="nonzero" d="M6 6.5C6 6.91421 5.66421 7.25 5.25 7.25C4.83579 7.25 4.5 6.91421 4.5 6.5C4.5 6.08579 4.83579 5.75 5.25 5.75C5.66421 5.75 6 6.08579 6 6.5Z M7 6.5C7 6.22386 7.22386 6 7.5 6H11C11.2761 6 11.5 6.22386 11.5 6.5C11.5 6.77614 11.2761 7 11 7H7.5C7.22386 7 7 6.77614 7 6.5Z M7.5 9C7.22386 9 7 9.22386 7 9.5C7 9.77614 7.22386 10 7.5 10H11C11.2761 10 11.5 9.77614 11.5 9.5C11.5 9.22386 11.2761 9 11 9H7.5Z M6 9.5C6 9.91421 5.66421 10.25 5.25 10.25C4.83579 10.25 4.5 9.91421 4.5 9.5C4.5 9.08579 4.83579 8.75 5.25 8.75C5.66421 8.75 6 9.08579 6 9.5Z M2.54545 2.5C2.0573 2.5 1.5 2.84588 1.5 3.45455V12.5455C1.5 13.1541 2.0573 13.5 2.54545 13.5H13.4545C13.9427 13.5 14.5 13.1541 14.5 12.5455V3.45455C14.5 2.84588 13.9427 2.5 13.4545 2.5H2.54545ZM2.5 12.4929V3.50706C2.51085 3.50329 2.52597 3.5 2.54545 3.5H13.4545C13.474 3.5 13.4891 3.50329 13.5 3.50706V12.4929C13.4891 12.4967 13.474 12.5 13.4545 12.5H2.54545C2.52597 12.5 2.51085 12.4967 2.5 12.4929Z" />
            </svg>
            <span className={styles.colHeaderMenuItemText}>Group by this field</span>
          </li>

          {/* --- Separator --- */}
          <li className={styles.colHeaderMenuSeparator} />

          {/* Hide field (disabled when single field) */}
          <li
            className={`${styles.colHeaderMenuItem}${!canModifyField ? ` ${styles.colHeaderMenuItemDisabled}` : ''}`}
            style={canModifyField ? { cursor: 'pointer' } : { opacity: 0.5, cursor: 'default' }}
            onClick={() => {
              if (canModifyField && headerMenuColId) {
                onHideField?.(headerMenuColId);
                setHeaderMenuColId(null);
                setHeaderMenuPosition(null);
              }
            }}
          >
            <svg className={styles.colHeaderMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
              <path fillRule="nonzero" d="M8.00013 2.99999C7.53899 2.99917 7.07864 3.03701 6.62379 3.11315C6.55902 3.12398 6.49703 3.14747 6.44134 3.18226C6.38565 3.21706 6.33736 3.26248 6.29923 3.31594C6.2611 3.3694 6.23387 3.42984 6.2191 3.49382C6.20433 3.5578 6.2023 3.62407 6.21314 3.68883C6.23505 3.81961 6.30801 3.93632 6.41597 4.01331C6.52393 4.0903 6.65805 4.12125 6.78883 4.09935C7.18869 4.03242 7.59357 3.99923 7.99915 3.99999C7.99882 3.99999 7.99948 3.99999 7.99915 3.99999C12.083 3.99999 14.0065 7.16727 14.4415 7.99926C14.2327 8.39403 13.6815 9.3219 12.7042 10.196C12.6553 10.2398 12.6154 10.2928 12.587 10.352C12.5585 10.4112 12.542 10.4754 12.5383 10.5409C12.5347 10.6065 12.544 10.6721 12.5657 10.7341C12.5874 10.7961 12.6211 10.8531 12.6649 10.9021C12.7533 11.0009 12.8774 11.0606 13.0097 11.0679C13.1421 11.0753 13.272 11.0298 13.3709 10.9414C14.8157 9.64896 15.4569 8.20311 15.4569 8.20311C15.4853 8.13917 15.5 8.06997 15.5 7.99999C15.5 7.93001 15.4853 7.86081 15.4569 7.79686C15.4569 7.79686 13.2994 3.00052 8.00013 2.99999Z M8.56177 5.05248C8.4315 5.02783 8.29677 5.05593 8.18721 5.1306C8.07765 5.20527 8.00223 5.3204 7.97755 5.45067C7.96532 5.51519 7.96592 5.58148 7.97932 5.64576C7.99271 5.71004 8.01864 5.77106 8.05562 5.82532C8.09259 5.87958 8.13989 5.92603 8.19482 5.96201C8.24975 5.99799 8.31122 6.0228 8.37574 6.03502C9.25118 6.20086 9.90696 6.92166 9.98963 7.80883C9.99573 7.87421 10.0146 7.93775 10.0453 7.99582C10.076 8.05389 10.1177 8.10536 10.1683 8.14727C10.2188 8.18919 10.2771 8.22074 10.3399 8.24013C10.4026 8.25951 10.4686 8.26635 10.5339 8.26024C10.666 8.24793 10.7877 8.18368 10.8723 8.08163C10.957 7.97958 10.9976 7.84808 10.9854 7.71605C10.8617 6.38949 9.8708 5.30045 8.56177 5.05248Z M3.02381 2.0006C2.89137 1.99428 2.76183 2.04082 2.6637 2.12999C2.56557 2.21919 2.5069 2.34371 2.50058 2.47617C2.49426 2.60862 2.54082 2.73816 2.63001 2.83629L5.64234 6.14989C4.99783 6.97182 4.81667 8.0854 5.20167 9.08153C5.64782 10.2359 6.7614 10.9994 7.99891 10.9997C8.57697 11.0018 9.13723 10.8317 9.61744 10.5226L12.63 13.8363C12.7192 13.9344 12.8437 13.9931 12.9762 13.9994C13.1086 14.0057 13.2382 13.9592 13.3363 13.87C13.4344 13.7808 13.4931 13.6563 13.4994 13.5238C13.5058 13.3914 13.4592 13.2618 13.37 13.1637L6.6908 5.81652C6.69016 5.81554 6.68951 5.81456 6.68885 5.81359C6.6884 5.81338 6.68796 5.81318 6.68751 5.81298L3.37 2.16369C3.2808 2.06557 3.15627 2.0069 3.02381 2.0006ZM4.78126 3.81261C4.65529 3.7712 4.51803 3.78151 4.39966 3.8413C1.67465 5.21716 0.542853 7.79748 0.542853 7.79748C0.514536 7.86137 0.499927 7.93049 0.49997 8.00038C0.500012 8.07027 0.514704 8.13938 0.543098 8.20324C0.543098 8.20324 2.69954 12.9988 7.99805 13C9.24842 13.0098 10.4832 12.7217 11.6 12.1592C11.6586 12.1296 11.7109 12.0888 11.7537 12.0391C11.7966 11.9893 11.8293 11.9317 11.8498 11.8693C11.8704 11.8069 11.8785 11.7411 11.8736 11.6757C11.8688 11.6102 11.8511 11.5463 11.8215 11.4877C11.792 11.429 11.7512 11.3768 11.7015 11.3339C11.6517 11.291 11.594 11.2584 11.5317 11.2378C11.4693 11.2172 11.4035 11.2091 11.338 11.214C11.2726 11.2189 11.2087 11.2366 11.15 11.2661C10.1746 11.7574 9.09616 12.009 8.00403 12.0001C8.00269 12.0001 8.00135 12.0001 8.00001 12.0001C3.9214 12.0001 1.99934 8.84205 1.56104 8.00512C1.80002 7.53467 2.78966 5.77445 4.85035 4.734C4.90897 4.7044 4.96118 4.66355 5.00401 4.61377C5.04684 4.56399 5.07944 4.50626 5.09996 4.44389C5.12048 4.38151 5.12851 4.3157 5.12359 4.25021C5.11867 4.18473 5.1009 4.12086 5.0713 4.06225C5.01154 3.94387 4.90721 3.85407 4.78126 3.81261ZM6.3307 6.90709L8.92811 9.76427C8.64391 9.91434 8.32855 10.0011 8.00196 9.99987C8.00131 9.99987 8.00066 9.99987 8.00001 9.99987C7.17209 9.99993 6.43288 9.49318 6.13441 8.72094C5.89804 8.10936 5.98275 7.43768 6.3307 6.90709Z" />
            </svg>
            <span className={styles.colHeaderMenuItemText}>Hide field</span>
          </li>

          {/* Delete field (red, disabled when single field) */}
          <li
            className={`${styles.colHeaderMenuItem}${!canModifyField ? ` ${styles.colHeaderMenuItemDisabled}` : ''}`}
            style={canModifyField ? { cursor: 'pointer' } : { opacity: 0.5, cursor: 'default' }}
            onClick={() => {
              if (canModifyField && headerMenuColId) {
                onDeleteField?.(headerMenuColId);
                setHeaderMenuColId(null);
                setHeaderMenuPosition(null);
              }
            }}
          >
            <svg className={styles.colHeaderMenuDeleteIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
              <path fillRule="nonzero" d="M6.5 6C6.36739 6 6.24021 6.05268 6.14645 6.14645C6.05268 6.24021 6 6.36739 6 6.5V10.5C6 10.6326 6.05268 10.7598 6.14645 10.8536C6.24021 10.9473 6.36739 11 6.5 11C6.63261 11 6.75979 10.9473 6.85355 10.8536C6.94732 10.7598 7 10.6326 7 10.5V6.5C7 6.36739 6.94732 6.24021 6.85355 6.14645C6.75979 6.05268 6.63261 6 6.5 6Z M9.5 6C9.36739 6 9.24021 6.05268 9.14645 6.14645C9.05268 6.24021 9 6.36739 9 6.5V10.5C9 10.6326 9.05268 10.7598 9.14645 10.8536C9.24021 10.9473 9.36739 11 9.5 11C9.63261 11 9.75979 10.9473 9.85355 10.8536C9.94732 10.7598 10 10.6326 10 10.5V6.5C10 6.36739 9.94732 6.24021 9.85355 6.14645C9.75979 6.05268 9.63261 6 9.5 6Z M6.5 1C5.6775 1 5 1.6775 5 2.5V3H2.5C2.36739 3 2.24021 3.05268 2.14645 3.14645C2.05268 3.24021 2 3.36739 2 3.5C2 3.63261 2.05268 3.75979 2.14645 3.85355C2.24021 3.94732 2.36739 4 2.5 4H3V13C3.00007 13.5463 3.45357 13.9999 3.99988 14H12C12.5464 14 13 13.5464 13 13V4H13.5C13.6326 4 13.7598 3.94732 13.8536 3.85355C13.9473 3.75979 14 3.63261 14 3.5C14 3.36739 13.9473 3.24021 13.8536 3.14645C13.7598 3.05268 13.6326 3 13.5 3H11V2.5C10.9999 1.67757 10.3226 1.0001 9.50012 1H6.5ZM6.5 2H9.5C9.78202 2.0001 9.99996 2.21808 10 2.50012V3H6V2.5C6 2.21794 6.21794 2 6.5 2ZM4 4H12V13H4.00012L4 4Z" />
            </svg>
            <span className={styles.colHeaderMenuDeleteText}>Delete field</span>
          </li>
        </ul>
        </div>,
        document.body,
      )}

      {/* === Create Field Panel (+ button dropdown) / Edit Field === */}
      {createFieldPosition && (
        <CreateFieldPanel
          position={createFieldPosition}
          onClose={handleCloseCreateField}
          onCreateField={handleCreateFieldWrapped}
          editField={editFieldInfo ?? undefined}
          onEditFieldSave={editFieldInfo ? (name, numCfg) => {
            onEditFieldSave?.(editFieldInfo.columnId, name, numCfg);
          } : undefined}
          existingFieldNames={allVisibleColumns.map(c => c.name)}
          baseColor={baseColor}
        />
      )}

      {/* === Duplicate Field Dialog (portal overlay) === */}
      {dupFieldDialog && createPortal(
        <div
          className={styles.dupFieldOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDupFieldDialog(null);
          }}
        >
          <div className={styles.dupFieldDialog}>
            <div className={styles.dupFieldCloseBtn} onClick={() => setDupFieldDialog(null)}>
              <svg viewBox="0 0 16 16" fill="currentColor" className={styles.dupFieldCloseIcon} style={{ shapeRendering: "geometricPrecision" }}>
                <path fillRule="nonzero" d="M12.3536 3.64645C12.1583 3.45118 11.8417 3.45118 11.6464 3.64645L8 7.29289L4.35355 3.64645C4.15829 3.45118 3.84171 3.45118 3.64645 3.64645C3.45118 3.84171 3.45118 4.15829 3.64645 4.35355L7.29289 8L3.64645 11.6464C3.45118 11.8417 3.45118 12.1583 3.64645 12.3536C3.84171 12.5488 4.15829 12.5488 4.35355 12.3536L8 8.70711L11.6464 12.3536C11.8417 12.5488 12.1583 12.5488 12.3536 12.3536C12.5488 12.1583 12.5488 11.8417 12.3536 11.6464L8.70711 8L12.3536 4.35355C12.5488 4.15829 12.5488 3.84171 12.3536 3.64645Z" />
              </svg>
            </div>
            <p className={styles.dupFieldTitle}>Duplicate {dupFieldDialog.colName}</p>
            <div className={styles.dupFieldToggleRow}>
              <div
                className={styles.dupFieldTogglePill}
                style={{
                  backgroundColor: dupCells ? "rgb(4, 138, 14)" : "rgba(0, 0, 0, 0.1)",
                  justifyContent: dupCells ? "flex-end" : "flex-start",
                }}
                onClick={() => setDupCells((v) => !v)}
              >
                <div className={styles.dupFieldToggleCircle} />
              </div>
              <span className={styles.dupFieldToggleLabel}>Duplicate cells</span>
            </div>
            <div className={styles.dupFieldActions}>
              <button
                type="button"
                className={styles.dupFieldCancelBtn}
                onClick={() => setDupFieldDialog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.dupFieldConfirmBtn}
                onClick={() => {
                  onDuplicateField?.(dupFieldDialog.colId, dupCells);
                  setDupFieldDialog(null);
                }}
              >
                Duplicate field
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* === BULK ADD ROWS — Floating Footer Pill === */}
      <div
        className={`${styles.bulkAddPill}${isBulkAdding ? ` ${styles.bulkAddPillLoading}` : ""}`}
        style={{ '--pill-base-color': baseColor } as React.CSSProperties}
        onClick={isBulkAdding ? undefined : () => setShowBulkAddDialog(true)}
      >
        {isBulkAdding ? (
          <>
            <svg className={styles.bulkAddSpinner} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="8" cy="8" r="6" opacity="0.25" />
              <path d="M14 8a6 6 0 0 0-6-6" strokeLinecap="round" />
            </svg>
            <span className={styles.bulkAddPulseText}>Adding records…</span>
          </>
        ) : (
          <>
            {/* + icon — grey by default, base color on hover (via CSS) */}
            <svg className={styles.bulkAddPillIcon} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
            <span className={styles.bulkAddPillDivider} />
            <span>100,000 rows</span>
            {/* Tooltip */}
            <span className={styles.bulkAddTooltip}>Generate 100,000 rows of sample data</span>
          </>
        )}
      </div>

      {/* === BULK ADD ROWS — Confirmation Dialog (portal) === */}
      {showBulkAddDialog && createPortal(
        <div
          className={styles.bulkAddOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowBulkAddDialog(false);
          }}
        >
          <div className={styles.bulkAddDialog}>
            {/* Close X */}
            <button
              type="button"
              className={styles.bulkAddCloseBtn}
              onClick={() => setShowBulkAddDialog(false)}
            >
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="nonzero" d="M12.3536 3.64645C12.1583 3.45118 11.8417 3.45118 11.6464 3.64645L8 7.29289L4.35355 3.64645C4.15829 3.45118 3.84171 3.45118 3.64645 3.64645C3.45118 3.84171 3.45118 4.15829 3.64645 4.35355L7.29289 8L3.64645 11.6464C3.45118 11.8417 3.45118 12.1583 3.64645 12.3536C3.84171 12.5488 4.15829 12.5488 4.35355 12.3536L8 8.70711L11.6464 12.3536C11.8417 12.5488 12.1583 12.5488 12.3536 12.3536C12.5488 12.1583 12.5488 11.8417 12.3536 11.6464L8.70711 8L12.3536 4.35355C12.5488 4.15829 12.5488 3.84171 12.3536 3.64645Z" />
              </svg>
            </button>

            {/* Title */}
            <h2 className={styles.bulkAddTitle}>Add 100,000 records</h2>

            {/* Description */}
            <p className={styles.bulkAddDescription}>
              This will generate{" "}
              <span
                className={styles.bulkAddCountBadge}
                style={{ backgroundColor: `${baseColor}14`, color: baseColor }}
              >
                100,000 rows
              </span>{" "}
              of records populated with sample data in this table. This may take a moment depending on table size.
            </p>

            {/* Action buttons */}
            <div className={styles.bulkAddActions}>
              <button
                type="button"
                className={styles.bulkAddCancelBtn}
                onClick={() => setShowBulkAddDialog(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.bulkAddConfirmBtn}
                style={{ backgroundColor: baseColor, color: baseTextColor }}
                onClick={() => {
                  setShowBulkAddDialog(false);
                  onAddBulkRows?.();
                }}
              >
                Add records
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
