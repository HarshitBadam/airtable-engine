"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { signOut, useSession } from "next-auth/react";
import { skipToken } from "@tanstack/react-query";
import styles from "./GridWorkspace.module.css";
import { api } from "~/trpc/react";
import { getBaseColor, getBaseBorderColor, getBaseTextColor, getBaseToolbarColor } from "~/components/bases/useBases";
import {
  UserIcon,
  UsersIcon,
  AirtablePlusFillIcon,
  BellIcon,
  TranslateIcon,
  PaletteIcon,
  EnvelopeSimpleIcon,
  UpsellStarIcon,
  LinkIcon,
  WrenchIcon,
  TrashIcon,
  SignOutIcon,
  ChevronDownIcon,
} from "~/components/home/Icons";
import { useGridRows } from "~/components/grid/useGridRows";
import { useCellEditing } from "~/components/grid/useCellEditing";
import { useGridStore } from "~/components/grid/grid-store";
import { normalizeViewConfig } from "~/shared/grid";

import {
  AirtableLogoMonochrome,
  IconBackArrow,
  IconOmni,
  IconHelp,
  IconBell,
  IconGrid,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconMagnifyingGlass,
  IconDotsSixVertical,
  IconCheck,
  IconEyeSlash,
  IconHide,
  IconFilter,
  IconSort,
  IconGroup,
  IconSearch,
  IconText,
  IconNumber,
  IconTable,
  IconBaseLogo,
  IconChevronDown,
  IconSidebarPlay,
  IconClockCounterClockwise,
} from "./icons";
import { GridRow } from "./GridRow";
import type { GridColumnDef } from "./GridRow";
import { TopBar } from "./TopBar";
import { ClearDataModal, DeleteTablePopup } from "./TableModals";
import { Rail } from "./Rail";
import { GridBar } from "./GridBar";
import { TableToolbar } from "./TableToolbar";
import { ViewsSidebar } from "./ViewsSidebar";
import { GridContainer } from "./GridContainer";

// ============================================
// GRID DIMENSION CONSTANTS
// ============================================
const ROW_NUM_WIDTH = 83;   // 44px cell + 39px margin-right
const COLUMN_WIDTH = 180;   // each column header total width (border-box)
const DATA_ROW_HEIGHT = 33; // matches CSS .gridRowNumCell/.gridDataCell height
const OVERSCAN_COUNT = 15;  // extra rows rendered above/below viewport

// GridRow & types imported from GridRow.tsx

// ============================================
// MAIN COMPONENT
// ============================================

interface GridWorkspaceProps {
  baseId: string;
  tableId: string;
}

// Type for UI-only table management
interface TableItem {
  id: string;
  name: string;
}

export function GridWorkspace({ baseId, tableId }: GridWorkspaceProps) {
  // === LOCAL STATE ===
  const [isTableDropdownOpen, setIsTableDropdownOpen] = useState(false);
  const [isAddOrImportDropdownOpen, setIsAddOrImportDropdownOpen] = useState(false);
  const [isTableTitleDropdownOpen, setIsTableTitleDropdownOpen] = useState(false);
  const [tableTitleDropdownPosition, setTableTitleDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [addOrImportDropdownPosition, setAddOrImportDropdownPosition] = useState<{
    top?: number;
    left?: number;
    right?: number;
    openLeft?: boolean;
  } | null>(null);
  const [addOrImportOpenedFromTableDropdown, setAddOrImportOpenedFromTableDropdown] = useState(false);
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [tableDropdownAlignRight, setTableDropdownAlignRight] = useState(false);
  
  // UI-only table management state
  const [tables, setTables] = useState<TableItem[]>([
    { id: '1', name: 'Table 1' }
  ]);
  const [activeTableId, setActiveTableId] = useState('1');
  const [tableCounter, setTableCounter] = useState(1);
  
  // Table rename popup state
  const [isRenamePopupOpen, setIsRenamePopupOpen] = useState(false);
  const [renamePopupPosition, setRenamePopupPosition] = useState<{ top: number; left: number } | null>(null);
  const [renameTableName, setRenameTableName] = useState('');
  const [renameRecordName, setRenameRecordName] = useState('Record');
  
  // Clear data modal state
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);

  // Freeze column divider state
  const [frozenColCount, setFrozenColCount] = useState(0); // number of frozen data columns
  const isDraggingFreezeRef = useRef(false);
  const freezeDragStartX = useRef(0);
  const freezeDragStartWidth = useRef(0);
  const gridFooterRef = useRef<HTMLDivElement>(null);
  const gridBodyRef = useRef<HTMLDivElement>(null);
  const freezePillRef = useRef<HTMLDivElement>(null);
  const freezeLineRef = useRef<HTMLDivElement>(null);
  const gridScrollerRef = useRef<HTMLDivElement>(null);
  const scrollShadowRef = useRef<HTMLDivElement>(null);
  const scrollableHeaderRef = useRef<HTMLDivElement>(null);
  const hScrollRef = useRef<HTMLDivElement>(null);
  const freezeSnapPreviewRef = useRef<HTMLDivElement>(null);
  const freezeDragStartIdx = useRef(0);
  const selectionOverlayRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<GridColumnDef[]>([]);
  const rowsRef = useRef<{ id: string; cells: unknown }[]>([]);
  const frozenColumnCountRef = useRef(0);
  const freezeWidthRef = useRef(0);

  // Column widths state (columnId -> px width, default COLUMN_WIDTH)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const columnWidthsRef = useRef<Record<string, number>>({});
  columnWidthsRef.current = columnWidths;
  const getColWidth = useCallback((colId: string) => columnWidths[colId] ?? COLUMN_WIDTH, [columnWidths]);

  // Row height state (header height controls default row height)
  const [rowHeight, setRowHeight] = useState(32);
  const rowHeightRef = useRef(32);
  rowHeightRef.current = rowHeight;
  
  // Delete table popup state
  const [isDeleteTablePopupOpen, setIsDeleteTablePopupOpen] = useState(false);
  const [deleteTablePopupPosition, setDeleteTablePopupPosition] = useState<{ top: number; left: number } | null>(null);

  // View dropdown menu state (Grid view chevron dropdown)
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);

  // Add a new table and open rename popup
  const handleAddTable = () => {
    const newId = String(tableCounter + 1);
    const newName = `Table ${tableCounter + 1}`;
    setTables(prev => [...prev, { id: newId, name: newName }]);
    setActiveTableId(newId);
    setTableCounter(prev => prev + 1);
    
    // Open rename popup after a short delay to allow DOM to update
    setTimeout(() => {
      const newTabButton = document.querySelector(`[data-table-id="${newId}"]`);
      if (newTabButton) {
        const tabRect = newTabButton.getBoundingClientRect();
        const transformOffset = 71; // CSS transform: translateX(-72px)
        const minLeftMargin = 8; // Minimum distance from left edge of viewport
        
        // Calculate left position, ensuring popup stays at least 12px from left edge
        // Since transform shifts -70px, we need left >= 82 to maintain 12px margin
        const minLeft = minLeftMargin + transformOffset;
        const left = Math.max(tabRect.left, minLeft);
        
        setRenamePopupPosition({
          top: tabRect.bottom + 8,
          left: left,
        });
        setRenameTableName(newName);
        setRenameRecordName('Record');
        setIsRenamePopupOpen(true);
      }
    }, 50);
  };
  
  // Handle opening rename popup from dropdown menu
  const handleOpenRenamePopup = () => {
    const activeTable = tables.find(t => t.id === activeTableId);
    if (activeTable && tableTitleDropdownButtonRef.current) {
      const parentTab = tableTitleDropdownButtonRef.current.closest('[data-table-tab]');
      if (parentTab) {
        const tabRect = parentTab.getBoundingClientRect();
        const transformOffset = 72; // CSS transform: translateX(-72px)
        const minLeftMargin = 8; // Minimum distance from left edge of viewport
        
        // Calculate left position, ensuring popup stays at least 12px from left edge
        // Since transform shifts -70px, we need left >= 82 to maintain 12px margin
        const minLeft = minLeftMargin + transformOffset;
        const left = Math.max(tabRect.left, minLeft);
        
        setRenamePopupPosition({
          top: tabRect.bottom + 8,
          left: left,
        });
        setRenameTableName(activeTable.name);
        setRenameRecordName('Record');
        setIsRenamePopupOpen(true);
        setIsTableTitleDropdownOpen(false);
      }
    }
  };
  
  // Handle save rename
  const handleSaveRename = () => {
    if (renameTableName.trim()) {
      setTables(prev => prev.map(t => 
        t.id === activeTableId ? { ...t, name: renameTableName.trim() } : t
      ));
    }
    setIsRenamePopupOpen(false);
    setRenamePopupPosition(null);
  };
  
  // Handle cancel rename
  const handleCancelRename = () => {
    setIsRenamePopupOpen(false);
    setRenamePopupPosition(null);
  };
  
  // Handle opening clear data modal
  const handleOpenClearDataModal = () => {
    setIsTableTitleDropdownOpen(false);
    setIsClearDataModalOpen(true);
  };
  
  // Handle closing clear data modal
  const handleCloseClearDataModal = () => {
    setIsClearDataModalOpen(false);
  };
  
  // Handle confirming clear data
  const handleClearData = () => {
    // TODO: Implement actual data clearing logic
    // For now, just close the modal
    setIsClearDataModalOpen(false);
  };
  
  // Handle opening delete table popup
  const handleOpenDeleteTablePopup = (event: React.MouseEvent<HTMLLIElement>) => {
    // Only allow if more than 1 table exists
    if (tables.length <= 1) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    setDeleteTablePopupPosition({
      top: rect.bottom + 8 - 439,
      left: rect.left - 12,
    });
    setIsTableTitleDropdownOpen(false);
    setIsDeleteTablePopupOpen(true);
  };
  
  // Handle closing delete table popup
  const handleCloseDeleteTablePopup = () => {
    setIsDeleteTablePopupOpen(false);
    setDeleteTablePopupPosition(null);
  };
  
  // Handle confirming delete table
  const handleDeleteTable = () => {
    if (tables.length <= 1) return;
    
    // Remove the active table
    const newTables = tables.filter(t => t.id !== activeTableId);
    setTables(newTables);
    
    // Set active to the first remaining table
    if (newTables.length > 0) {
      setActiveTableId(newTables[0]!.id);
    }
    
    setIsDeleteTablePopupOpen(false);
    setDeleteTablePopupPosition(null);
  };

  // Fetch base data
  const { data: base } = api.base.getById.useQuery(
    { id: baseId },
    { staleTime: 60_000 }
  );
  
  // Get base colors based on ID
  const baseColor = getBaseColor(baseId);
  const baseBorderColor = getBaseBorderColor(baseId);
  const baseTextColor = getBaseTextColor(baseId);
  const baseName = base?.name ?? "Loading...";

  // Dynamic browser tab title & favicon
  const activeTableName = tables.find(t => t.id === activeTableId)?.name ?? "Table";
  useEffect(() => {
    // Set document title: "{base name}: {table name} - Airtable"
    if (baseName && baseName !== "Loading...") {
      document.title = `${baseName}: ${activeTableName} - Airtable`;
    } else {
      document.title = `${activeTableName} - Airtable`;
    }
  }, [baseName, activeTableName]);

  useEffect(() => {
    // Generate a dynamic favicon with base initials on the base color
    if (!baseName || baseName === "Loading...") return;

    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw rounded rectangle background with base color
    const radius = 14;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fillStyle = baseColor;
    ctx.fill();

    // Draw initials (first 2 chars of base name)
    const initials = baseName.slice(0, 2);
    ctx.fillStyle = baseTextColor;
    ctx.font = "500 46px -apple-system, system-ui, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, size / 2, size / 2 + 4);

    // Set the favicon
    const dataUrl = canvas.toDataURL("image/png");
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/png";
    link.href = dataUrl;
  }, [baseName, baseColor, baseTextColor]);

  // === COLUMN DATA & FREEZE SNAP POSITIONS ===
  const isValidTable = tableId !== "default";
  const colsQ = api.column.list.useQuery(
    isValidTable ? { tableId } : skipToken,
    { staleTime: 60_000 },
  );
  const columns = colsQ.data ?? [];
  columnsRef.current = columns;

  // === ROW DATA ===
  const { rows, totalCount, q: rowsQ, input: rowQueryInput } = useGridRows(tableId);
  rowsRef.current = rows;
  const { commit, cancel } = useCellEditing(tableId, rowQueryInput);
  const hiddenColumnIds = useGridStore((s) => s.hiddenColumnIds);

  // Stable refs for callbacks passed to memoized GridRow (avoids breaking memo on every render)
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const stableCommit = useCallback(
    (args: { rowId: string; columnId: string; columnType: "TEXT" | "NUMBER" }) => commitRef.current(args),
    [],
  );
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  const stableCancel = useCallback(() => cancelRef.current(), []);

  // Ref for infinite scroll trigger (avoids stale closures in scroll handler)
  const rowsQRef = useRef(rowsQ);
  rowsQRef.current = rowsQ;

  // Visible columns (excluding hidden)
  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenColumnIds.includes(c.id)),
    [columns, hiddenColumnIds],
  );

  // Helper to get cell value as string
  const getCellValue = useCallback(
    (cells: unknown, columnId: string): string => {
      if (!cells || typeof cells !== "object") return "";
      const record = cells as Record<string, unknown>;
      const val = record[columnId];
      if (val === null || val === undefined) return "";
      return String(val);
    },
    [],
  );

  // === KEYBOARD NAVIGATION & SELECTION OVERLAY ===
  const activeCell = useGridStore((s) => s.activeCell);
  const editingCell = useGridStore((s) => s.editingCell);
  const setActiveCell = useGridStore((s) => s.setActiveCell);
  const startEditing = useGridStore((s) => s.startEditing);
  const clearSelection = useGridStore((s) => s.clearSelection);

  // Keep refs in sync for imperative overlay positioning (avoids stale closures)
  const activeCellRef = useRef(activeCell);
  activeCellRef.current = activeCell;
  const editingCellRef = useRef(editingCell);
  editingCellRef.current = editingCell;

  // === SELECTION OVERLAY — imperatively positioned at .gridBody level ===

  /** Compute cell position and update the overlay div's inline styles. */
  const updateSelectionOverlay = useCallback(() => {
    const overlay = selectionOverlayRef.current;
    if (!overlay) return;

    const ac = activeCellRef.current;
    const ec = editingCellRef.current;
    if (!ac || ec) {
      overlay.style.display = "none";
      return;
    }

    const cols = columnsRef.current;
    const rws = rowsRef.current;
    const frozenCount = frozenColumnCountRef.current;

    const colIdx = cols.findIndex((c) => c.id === ac.columnId);
    const rowIdx = rws.findIndex((r) => r.id === ac.rowId);
    if (colIdx === -1 || rowIdx === -1) {
      overlay.style.display = "none";
      return;
    }

    const scroller = gridScrollerRef.current;
    const hScroll = hScrollRef.current;
    if (!scroller) return;

    const scrollLeft = hScroll?.scrollLeft ?? 0;
    const scrollTop = scroller.scrollTop;
    const headerH = rowHeightRef.current;
    const widths = columnWidthsRef.current;
    const colWidth = widths[ac.columnId] ?? COLUMN_WIDTH;
    const isFrozen = colIdx < frozenCount;

    // Cell X in viewport coords (relative to .gridBody)
    let cellX = ROW_NUM_WIDTH;
    for (let i = 0; i < colIdx; i++) {
      cellX += widths[cols[i]!.id] ?? COLUMN_WIDTH;
    }
    if (!isFrozen) {
      cellX -= scrollLeft;
    }

    // Cell Y relative to .gridBody
    const cellY = headerH + rowIdx * DATA_ROW_HEIGHT - scrollTop;

    // Overlay extends 1px outside cell on all sides → 2px border centered on grid lines
    overlay.style.display = "block";
    overlay.style.top = `${cellY - 2}px`;
    overlay.style.left = `${cellX - 1}px`;
    overlay.style.width = `${colWidth + 2}px`;
    overlay.style.height = `${DATA_ROW_HEIGHT + 3}px`;
  }, []);

  /** Scroll horizontally/vertically so a cell is fully visible. */
  const scrollCellIntoView = useCallback((colIdx: number, rowIdx: number) => {
    const scroller = gridScrollerRef.current;
    const hScroll = hScrollRef.current;
    if (!scroller) return;

    const cols = columnsRef.current;
    const widths = columnWidthsRef.current;
    const frozenCount = frozenColumnCountRef.current;
    const fw = freezeWidthRef.current;

    // --- Vertical ---
    const cellTop = rowIdx * DATA_ROW_HEIGHT;
    const cellBottom = cellTop + DATA_ROW_HEIGHT;
    if (cellTop < scroller.scrollTop) {
      scroller.scrollTop = cellTop;
    } else if (cellBottom > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = cellBottom - scroller.clientHeight;
    }

    // --- Horizontal (only for scrollable columns) ---
    if (colIdx >= frozenCount && hScroll) {
      // Cell's left edge in the scroller's content coordinates
      let contentX = ROW_NUM_WIDTH;
      for (let i = 0; i < colIdx; i++) {
        contentX += widths[cols[i]!.id] ?? COLUMN_WIDTH;
      }
      const colWidth = widths[cols[colIdx]!.id] ?? COLUMN_WIDTH;
      const contentRight = contentX + colWidth;

      // Visible scrollable area in content coords:
      //   left edge = scrollLeft + freezeWidth   (frozen cols cover the first freezeWidth pixels)
      //   right edge = scrollLeft + scroller.clientWidth
      const viewLeft = hScroll.scrollLeft + fw;
      const viewRight = hScroll.scrollLeft + scroller.clientWidth;

      if (contentX < viewLeft) {
        hScroll.scrollLeft = contentX - fw;
      } else if (contentRight > viewRight) {
        hScroll.scrollLeft = contentRight - scroller.clientWidth;
      }
    }
  }, []);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeCell) return;
      if (editingCell) return; // editing — let the input handle keys

      const { rowId, columnId } = activeCell;

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.key)) {
        e.preventDefault();
        const rowIdx = rows.findIndex((r) => r.id === rowId);
        const colIdx = columns.findIndex((c) => c.id === columnId);
        if (rowIdx === -1 || colIdx === -1) return;

        let newRowIdx = rowIdx;
        let newColIdx = colIdx;

        switch (e.key) {
          case "ArrowUp": newRowIdx = Math.max(0, rowIdx - 1); break;
          case "ArrowDown": newRowIdx = Math.min(rows.length - 1, rowIdx + 1); break;
          case "ArrowLeft": newColIdx = Math.max(0, colIdx - 1); break;
          case "ArrowRight": newColIdx = Math.min(columns.length - 1, colIdx + 1); break;
          case "Tab":
            if (e.shiftKey) {
              newColIdx = Math.max(0, colIdx - 1);
            } else {
              newColIdx = Math.min(columns.length - 1, colIdx + 1);
            }
            break;
        }

        const newRow = rows[newRowIdx];
        const newCol = columns[newColIdx];
        if (newRow && newCol) {
          setActiveCell({ rowId: newRow.id, columnId: newCol.id });
          scrollCellIntoView(newColIdx, newRowIdx);
        }
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const row = rows.find((r) => r.id === rowId);
        const col = columns.find((c) => c.id === columnId);
        if (row && col) {
          const value = getCellValue(row.cells, col.id);
          startEditing({ rowId, columnId }, value);
        }
      }

      if (e.key === "Escape") {
        clearSelection();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeCell, editingCell, rows, columns, setActiveCell, startEditing, clearSelection, getCellValue, scrollCellIntoView]);

  // Hook overlay to scroll events
  useEffect(() => {
    const scroller = gridScrollerRef.current;
    const hScroll = hScrollRef.current;
    const onScroll = () => updateSelectionOverlay();
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    hScroll?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller?.removeEventListener("scroll", onScroll);
      hScroll?.removeEventListener("scroll", onScroll);
    };
  }, [updateSelectionOverlay]);

  // Re-position overlay when activeCell, editingCell, column widths, or freeze config change
  useEffect(() => {
    updateSelectionOverlay();
  }, [activeCell, editingCell, columnWidths, frozenColCount, columns, rows, updateSelectionOverlay]);

  // Compute freeze snap positions (one per column boundary, using actual widths)
  // Freeze bar can go from right edge of row-num col to the left edge of the
  // last column or the 4th data column — whichever comes first.
  const snapPositions = useMemo(() => {
    const positions = [ROW_NUM_WIDTH]; // snap 0: right edge of serial # col
    const maxFrozen = Math.min(4, Math.max(0, columns.length - 1));
    let x = ROW_NUM_WIDTH;
    for (let i = 0; i < maxFrozen; i++) {
      x += columnWidths[columns[i]!.id] ?? COLUMN_WIDTH;
      positions.push(x);
    }
    return positions;
  }, [columns, columnWidths]);

  // Derive freeze width from frozenColCount + actual column widths
  const frozenColumnCount = Math.min(frozenColCount, columns.length);
  frozenColumnCountRef.current = frozenColumnCount;
  const freezeWidth = useMemo(() => {
    let w = ROW_NUM_WIDTH;
    for (let i = 0; i < frozenColumnCount && i < columns.length; i++) {
      w += columnWidths[columns[i]!.id] ?? COLUMN_WIDTH;
    }
    return w;
  }, [frozenColumnCount, columns, columnWidths]);
  freezeWidthRef.current = freezeWidth;
  const frozenColumns = useMemo(() => columns.slice(0, frozenColumnCount), [columns, frozenColumnCount]);
  const scrollableColumns = useMemo(() => columns.slice(frozenColumnCount), [columns, frozenColumnCount]);

  // Total width of all scrollable column headers (for add-row slab sizing)
  const scrollableColumnsWidth = useMemo(() => {
    let w = 0;
    for (let i = frozenColumnCount; i < columns.length; i++) {
      w += columnWidths[columns[i]!.id] ?? COLUMN_WIDTH;
    }
    return w;
  }, [frozenColumnCount, columns, columnWidths]);

  // === FREEZE DIVIDER DRAG HANDLERS ===
  // Move pill via direct DOM manipulation (no re-render) for buttery-smooth tracking
  // Only used on hover — pill stays fixed during drag
  const movePill = useCallback((clientY: number) => {
    const body = gridBodyRef.current;
    const pill = freezePillRef.current;
    if (!body || !pill) return;
    const rect = body.getBoundingClientRect();
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    pill.style.top = `${y}px`;
  }, []);

  const handleFreezeDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingFreezeRef.current = true;
    freezeDragStartX.current = e.clientX;
    freezeDragStartWidth.current = freezeWidth;
    freezeDragStartIdx.current = frozenColCount;

    // Apply visual drag state via direct DOM (no React re-render)
    freezeLineRef.current?.classList.add("freeze-dragging");
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    // Capture snap positions at drag start (stable throughout drag)
    const snaps = [...snapPositions];

    const findNearestSnap = (pos: number) => {
      let idx = 0;
      let dist = Infinity;
      for (let i = 0; i < snaps.length; i++) {
        const d = Math.abs(snaps[i]! - pos);
        if (d < dist) { dist = d; idx = i; }
      }
      return idx;
    };

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - freezeDragStartX.current;
      const rawWidth = freezeDragStartWidth.current + delta;
      const minW = snaps[0]!;
      const maxW = snaps[snaps.length - 1]!;
      const clamped = Math.max(minW, Math.min(rawWidth, maxW));

      if (freezeLineRef.current) {
        freezeLineRef.current.style.left = `${clamped - 3}px`;
      }

      const preview = freezeSnapPreviewRef.current;
      if (preview) {
        const nearIdx = findNearestSnap(clamped);
        if (nearIdx !== freezeDragStartIdx.current) {
          const snapX = snaps[nearIdx]!;
          preview.style.left = `${snapX - 1}px`;
          preview.style.opacity = "1";
        } else {
          preview.style.opacity = "0";
        }
      }
    };

    const handleMouseUp = () => {
      const line = freezeLineRef.current;
      const currentPos = line ? parseFloat(line.style.left) + 3 : freezeWidth;
      const nearestIdx = findNearestSnap(currentPos);

      if (line) {
        const snapWidth = snaps[nearestIdx]!;
        line.style.left = `${snapWidth - 3}px`;
      }
      if (freezeSnapPreviewRef.current) {
        freezeSnapPreviewRef.current.style.opacity = "0";
      }

      // Remove visual drag state
      freezeLineRef.current?.classList.remove("freeze-dragging");
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      isDraggingFreezeRef.current = false;

      // Only NOW trigger a React re-render (to reflow columns)
      setFrozenColCount(nearestIdx);

      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [freezeWidth, frozenColCount, snapPositions]);

  const handleFreezeLineMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingFreezeRef.current) {
      movePill(e.clientY);
    }
  }, [movePill]);

  // === COLUMN RESIZE HANDLER (imperative — zero re-renders during drag) ===
  const handleResizeStart = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidthsRef.current[colId] ?? COLUMN_WIDTH;

    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    let rafId = 0;
    let finalWidth = startWidth;

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      finalWidth = Math.max(60, startWidth + delta);
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setColumnWidths((prev) => ({ ...prev, [colId]: finalWidth }));
      });
    };

    const handleMouseUp = () => {
      cancelAnimationFrame(rafId);
      setColumnWidths((prev) => ({ ...prev, [colId]: finalWidth }));
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  // === ROW HEIGHT RESIZE HANDLER (imperative — zero re-renders during drag) ===
  const handleRowHeightResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = rowHeightRef.current;

    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    let rafId = 0;
    let finalHeight = startH;

    const handleMouseMove = (ev: MouseEvent) => {
      finalHeight = Math.max(24, Math.min(140, startH + (ev.clientY - startY)));
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setRowHeight(finalHeight);
      });
    };

    const handleMouseUp = () => {
      cancelAnimationFrame(rafId);
      setRowHeight(finalHeight);
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  // === SCROLL SYNC BETWEEN FROZEN & SCROLLABLE PANES ===
  // Both panes use overflow-y: auto (frozen has hidden scrollbar).
  // Scroll sync — single-container architecture.
  // Vertical: 100% native (overflow-y: auto). Zero JS, zero lag.
  // Horizontal: overflow-x: hidden on scroller — no native horizontal scroll.
  //   hScrollbar is the sole driver of horizontal position.
  //   Wheel deltaX on the scroller is forwarded to hScrollbar (passive, doesn't block vertical).
  //   hScrollbar scroll event → sets scroller.scrollLeft + header.scrollLeft.
  useEffect(() => {
    const scroller = gridScrollerRef.current;
    const header = scrollableHeaderRef.current;
    const shadow = scrollShadowRef.current;
    const hScroll = hScrollRef.current;
    if (!scroller) return;

    // hScrollbar is the single source of truth for horizontal position.
    // Sets scroller (programmatic scrollLeft works even with overflow-x: hidden),
    // header, and scroll shadow.
    const handleHScroll = () => {
      if (!hScroll) return;
      scroller.scrollLeft = hScroll.scrollLeft;
      if (header) header.scrollLeft = hScroll.scrollLeft;
      if (shadow) shadow.style.opacity = hScroll.scrollLeft > 0 ? "1" : "0";
    };

    // Forward horizontal wheel/trackpad to hScrollbar.
    // Must preventDefault on horizontal delta to stop browser back/forward navigation.
    // Vertical-only events (deltaX === 0) are left untouched for native smooth scroll.
    const handleScrollerWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0) {
        e.preventDefault();
        if (hScroll) hScroll.scrollLeft += e.deltaX;
        // Manual vertical since we prevented default
        scroller.scrollTop += e.deltaY;
      }
    };

    if (hScroll) hScroll.addEventListener("scroll", handleHScroll);
    scroller.addEventListener("wheel", handleScrollerWheel, { passive: false });
    return () => {
      if (hScroll) hScroll.removeEventListener("scroll", handleHScroll);
      scroller.removeEventListener("wheel", handleScrollerWheel);
    };
  }, []);

  // === ROW VIRTUALIZATION ===
  // Only renders visible rows + overscan buffer. Spacer divs maintain correct scroll height.
  const [virtualRange, setVirtualRange] = useState({ start: 0, end: 50 });

  useEffect(() => {
    const scroller = gridScrollerRef.current;
    if (!scroller) return;

    let rafId = 0;
    const calcRange = () => {
      const st = scroller.scrollTop;
      const vh = scroller.clientHeight;
      const start = Math.max(0, Math.floor(st / DATA_ROW_HEIGHT) - OVERSCAN_COUNT);
      const end = Math.min(rows.length, Math.ceil((st + vh) / DATA_ROW_HEIGHT) + OVERSCAN_COUNT);
      setVirtualRange((prev) =>
        prev.start === start && prev.end === end ? prev : { start, end },
      );
      // Infinite scroll: fetch next page when near bottom
      const q = rowsQRef.current;
      if (st + vh >= scroller.scrollHeight - 500 && q.hasNextPage && !q.isFetchingNextPage) {
        void q.fetchNextPage();
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(calcRange);
    };

    calcRange(); // initial measurement

    scroller.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(scroller);

    return () => {
      cancelAnimationFrame(rafId);
      scroller.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [rows.length]);

  // Fetch views for this table (skip if tableId is the "default" sentinel)
  const utils = api.useUtils();
  const viewsQ = api.view.list.useQuery(
    isValidTable ? { tableId } : skipToken,
    { staleTime: 60_000 },
  );
  const views = viewsQ.data ?? [];

  // Active view tracking
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  useEffect(() => {
    if (views.length === 0) return;
    const activeExists = activeViewId && views.some(v => v.id === activeViewId);
    if (!activeExists) {
      setActiveViewId(views[0]!.id);
    }
  }, [views, activeViewId]);

  const activeView = views.find(v => v.id === activeViewId);
  const activeViewName = activeView?.name ?? 'Grid view';
  const canDeleteView = views.length > 1;

  // Initialize grid store from first view config
  const storeInitialized = useGridStore((s) => s.initialized);
  const initializeFromView = useGridStore((s) => s.initializeFromView);

  useEffect(() => {
    if (storeInitialized) return;
    const firstView = views[0];
    if (!firstView) return;
    initializeFromView(firstView.id, normalizeViewConfig(firstView.config));
  }, [storeInitialized, views, initializeFromView]);

  // Compute default name for next grid view
  const computeNextViewName = () => {
    const existingNames = new Set(views.map(v => v.name));
    let num = 2;
    while (existingNames.has(`Grid ${num}`)) num++;
    return `Grid ${num}`;
  };

  // Create view mutation
  const createViewMut = api.view.create.useMutation({
    onSuccess: (newView) => {
      void utils.view.list.invalidate({ tableId });
      setActiveViewId(newView.id);
      setIsCreateViewBoxOpen(false);
    },
  });

  // Delete view mutation
  const deleteViewMut = api.view.delete.useMutation({
    onSuccess: () => {
      void utils.view.list.invalidate({ tableId });
      setIsViewDropdownOpen(false);
      setContextMenuViewId(null);
    },
  });

  // Rename view mutation
  const renameViewMut = api.view.update.useMutation({
    onSuccess: () => {
      void utils.view.list.invalidate({ tableId });
    },
  });

  // Refs
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const tableDropdownRef = useRef<HTMLDivElement>(null);
  const tableDropdownButtonRef = useRef<HTMLButtonElement>(null);
  const addOrImportDropdownRef = useRef<HTMLUListElement>(null);
  const addOrImportButtonRef = useRef<HTMLButtonElement>(null);
  const addTableSectionRef = useRef<HTMLDivElement>(null);
  const tableTitleDropdownRef = useRef<HTMLUListElement>(null);
  const tableTitleDropdownButtonRef = useRef<HTMLButtonElement>(null);
  const renamePopupRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const viewDropdownRef = useRef<HTMLUListElement>(null);
  const viewDropdownButtonRef = useRef<HTMLDivElement>(null);

  // Scroll state for proportional indicator reveal
  const [scrollProgress, setScrollProgress] = useState(0); // 0 to 1
  const [hasOverflow, setHasOverflow] = useState(false); // Whether tabs overflow at all

  // Views sidebar state
  const [isViewsSidebarOpen, setIsViewsSidebarOpen] = useState(false);
  const [isViewsSidebarPinned, setIsViewsSidebarPinned] = useState(false);
  const [viewSearchQuery, setViewSearchQuery] = useState('');
  const [favoritedViews, setFavoritedViews] = useState<Set<string>>(new Set());
  const [isCreateNewDropdownOpen, setIsCreateNewDropdownOpen] = useState(false);
  const [isCreateViewBoxOpen, setIsCreateViewBoxOpen] = useState(false);
  const [createViewName, setCreateViewName] = useState('Grid 2');
  const viewsSidebarCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contextMenuViewId, setContextMenuViewId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ top: number; left: number } | null>(null);

  // Rename view state
  const [isRenamingView, setIsRenamingView] = useState(false);
  const [renameViewValue, setRenameViewValue] = useState('');
  const renameViewInputRef = useRef<HTMLInputElement>(null);

  // Check scroll progress for proportional reveal
  const checkScrollProgress = () => {
    const el = tabsScrollRef.current;
    if (!el) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    
    // Check if there's any overflow
    setHasOverflow(maxScroll > 1);
    
    if (maxScroll <= 0) {
      setScrollProgress(0);
    } else {
      // Clamp between 0 and 1
      setScrollProgress(Math.min(1, Math.max(0, scrollLeft / maxScroll)));
    }
  };

  // Scroll to start (left) or end (right)
  const scrollToEnd = (direction: 'left' | 'right') => {
    const el = tabsScrollRef.current;
    if (!el) return;
    
    el.scrollTo({
      left: direction === 'left' ? 0 : el.scrollWidth,
      behavior: 'smooth'
    });
  };

  // Set up scroll listener and check on mount/tables change
  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;

    checkScrollProgress();
    el.addEventListener('scroll', checkScrollProgress);
    
    // Also check on resize
    const resizeObserver = new ResizeObserver(checkScrollProgress);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', checkScrollProgress);
      resizeObserver.disconnect();
    };
  }, [tables]);

  // === TABLE DROPDOWN CLICK OUTSIDE ===
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Don't close if clicking inside the table dropdown
      if (tableDropdownRef.current && tableDropdownRef.current.contains(event.target as Node)) {
        return;
      }
      // Don't close if clicking the table dropdown button
      if (tableDropdownButtonRef.current && tableDropdownButtonRef.current.contains(event.target as Node)) {
        return;
      }
      // Don't close if clicking inside the Add or Import dropdown
      if (addOrImportDropdownRef.current && addOrImportDropdownRef.current.contains(event.target as Node)) {
        return;
      }
      setIsTableDropdownOpen(false);
      setTableSearchQuery('');
    }
    if (isTableDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isTableDropdownOpen]);

  // === ADD OR IMPORT DROPDOWN CLICK OUTSIDE ===
  useEffect(() => {
    if (!isAddOrImportDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      // Don't close if clicking inside the Add or Import dropdown
      if (addOrImportDropdownRef.current && addOrImportDropdownRef.current.contains(event.target as Node)) {
        return;
      }
      // Don't close if clicking the Add or Import button
      if (addOrImportButtonRef.current && addOrImportButtonRef.current.contains(event.target as Node)) {
        return;
      }
      // Don't close if clicking inside the table dropdown
      if (tableDropdownRef.current && tableDropdownRef.current.contains(event.target as Node)) {
        return;
      }
      setIsAddOrImportDropdownOpen(false);
      setAddOrImportOpenedFromTableDropdown(false);
    }
    
    // Add a small delay before attaching the listener to prevent
    // the current click from immediately closing the dropdown
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAddOrImportDropdownOpen]);

  // === TABLE TITLE DROPDOWN CLICK OUTSIDE ===
  useEffect(() => {
    if (!isTableTitleDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      // Don't close if clicking inside the table title dropdown
      if (tableTitleDropdownRef.current && tableTitleDropdownRef.current.contains(event.target as Node)) {
        return;
      }
      // Don't close if clicking the table title dropdown button
      if (tableTitleDropdownButtonRef.current && tableTitleDropdownButtonRef.current.contains(event.target as Node)) {
        return;
      }
      setIsTableTitleDropdownOpen(false);
    }
    
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTableTitleDropdownOpen]);

  // === VIEW DROPDOWN CLICK OUTSIDE ===
  useEffect(() => {
    if (!isViewDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      // Don't close if clicking inside the view dropdown
      if (viewDropdownRef.current && viewDropdownRef.current.contains(event.target as Node)) {
        return;
      }
      // Don't close if clicking the view dropdown button
      if (viewDropdownButtonRef.current && viewDropdownButtonRef.current.contains(event.target as Node)) {
        return;
      }
      setIsViewDropdownOpen(false);
    }

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isViewDropdownOpen]);

  // === RENAME POPUP CLICK OUTSIDE ===
  useEffect(() => {
    if (!isRenamePopupOpen) return;

    function handleClickOutside(event: MouseEvent) {
      // Don't close if clicking inside the rename popup
      if (renamePopupRef.current && renamePopupRef.current.contains(event.target as Node)) {
        return;
      }
      handleCancelRename();
    }
    
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isRenamePopupOpen]);

  // === AUTO-FOCUS RENAME INPUT ===
  useEffect(() => {
    if (isRenamePopupOpen && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenamePopupOpen]);

  // === AUTO-FOCUS RENAME VIEW INPUT ===
  useEffect(() => {
    if (isRenamingView && renameViewInputRef.current) {
      renameViewInputRef.current.focus();
      renameViewInputRef.current.select();
    }
  }, [isRenamingView]);

  // === ADD OR IMPORT DROPDOWN POSITIONING ===
  useEffect(() => {
    if (!isAddOrImportDropdownOpen) {
      setAddOrImportDropdownPosition(null);
      return;
    }

    const dropdownWidth = 280;
    const dropdownHeight = 495.5;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rightGap = 6;
    const bottomGap = 24;

    if (addOrImportOpenedFromTableDropdown && addTableSectionRef.current) {
      // === OPENED FROM TABLE DROPDOWN → "+ Add table" ===
      const addTableRect = addTableSectionRef.current.getBoundingClientRect();
      
      // Calculate top position - aligned with the "+ Add table" button
      let top = addTableRect.top;
      
      // Check if dropdown would exceed bottom bounds (24px minimum gap)
      const maxTop = viewportHeight - dropdownHeight - bottomGap;
      if (top > maxTop) {
        top = maxTop;
      }
      
      // Calculate horizontal position - try right side first
      let left = addTableRect.right + 4; // 4px gap from the table dropdown
      let openLeft = false;
      
      // Check if there's enough space on the right
      if (left + dropdownWidth > viewportWidth - rightGap) {
        // Not enough space on right - open on left side
        openLeft = true;
        left = addTableRect.left - dropdownWidth - 10; // 10px gap, aligned to left border
      }
      
      setAddOrImportDropdownPosition({ top, left, openLeft });
    } else if (addOrImportButtonRef.current) {
      // === OPENED FROM "+ Add or Import" BUTTON ===
      const buttonRect = addOrImportButtonRef.current.getBoundingClientRect();
      
      // Position below the button (10px gap)
      const top = buttonRect.bottom + 10;
      
      // Default: left-align with the button
      let left = buttonRect.left;
      
      // Check if dropdown would overflow the right edge
      if (left + dropdownWidth > viewportWidth - rightGap) {
        // Not enough space - shift so it's 6px from right edge
        left = viewportWidth - dropdownWidth - rightGap;
      }
      
      setAddOrImportDropdownPosition({ top, left, openLeft: false });
    }
  }, [isAddOrImportDropdownOpen, addOrImportOpenedFromTableDropdown]);

  // === TABLE DROPDOWN POSITIONING ===
  useEffect(() => {
    if (isTableDropdownOpen && tableDropdownButtonRef.current) {
      const buttonRect = tableDropdownButtonRef.current.getBoundingClientRect();
      const dropdownWidth = 456; // Width of the dropdown
      const viewportWidth = window.innerWidth;
      
      // Check if there's enough space on the right for left-aligned dropdown
      const spaceOnRight = viewportWidth - buttonRect.left;
      
      // If not enough space on right, align to the right
      setTableDropdownAlignRight(spaceOnRight < dropdownWidth);
    }
  }, [isTableDropdownOpen]);

  // === CLOSE TABLE TITLE DROPDOWN ON TABLE CHANGE ===
  useEffect(() => {
    setIsTableTitleDropdownOpen(false);
    setTableTitleDropdownPosition(null);
  }, [activeTableId]);

  // Filter tables based on search query
  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(tableSearchQuery.toLowerCase())
  );

  // Handle table selection from dropdown
  const handleTableSelect = (tableId: string) => {
    setActiveTableId(tableId);
    setIsTableDropdownOpen(false);
    setTableSearchQuery('');
  };


  // Views sidebar handlers
  const clearSidebarCollapseTimer = () => {
    if (viewsSidebarCollapseTimerRef.current) {
      clearTimeout(viewsSidebarCollapseTimerRef.current);
      viewsSidebarCollapseTimerRef.current = null;
    }
  };

  const startSidebarCollapseTimer = () => {
    // Only auto-collapse if the sidebar was opened by hover (not pinned)
    if (isViewsSidebarPinned) return;
    // Don't collapse if any popup menus are open
    if (isCreateNewDropdownOpen || isCreateViewBoxOpen || contextMenuViewId) return;
    clearSidebarCollapseTimer();
    viewsSidebarCollapseTimerRef.current = setTimeout(() => {
      setIsViewsSidebarOpen(false);
    }, 500);
  };

  // Click toggles pinned state
  const handleToggleViewsSidebar = () => {
    clearSidebarCollapseTimer();
    if (isViewsSidebarOpen && isViewsSidebarPinned) {
      // Sidebar is pinned open — close and unpin it
      setIsViewsSidebarOpen(false);
      setIsViewsSidebarPinned(false);
    } else if (isViewsSidebarOpen && !isViewsSidebarPinned) {
      // Sidebar was opened by hover (unpinned) — pin it so it stays open
      setIsViewsSidebarPinned(true);
    } else {
      // Sidebar is closed — open and pin it
      setIsViewsSidebarOpen(true);
      setIsViewsSidebarPinned(true);
    }
  };

  // Hover opens (unpinned) when sidebar is closed
  const handleListButtonMouseEnter = () => {
    if (!isViewsSidebarOpen) {
      clearSidebarCollapseTimer();
      setIsViewsSidebarOpen(true);
      // Don't pin — this was a hover-open
      setIsViewsSidebarPinned(false);
    } else {
      // Cursor moved back to button, cancel any pending collapse
      clearSidebarCollapseTimer();
    }
  };

  const handleListButtonMouseLeave = () => {
    startSidebarCollapseTimer();
  };

  const handleSidebarMouseEnter = () => {
    clearSidebarCollapseTimer();
  };

  const handleSidebarMouseLeave = () => {
    startSidebarCollapseTimer();
  };

  const handleToggleViewFavorite = (viewId: string) => {
    setFavoritedViews(prev => {
      const next = new Set(prev);
      if (next.has(viewId)) {
        next.delete(viewId);
      } else {
        next.add(viewId);
      }
      return next;
    });
  };

  // === RENAME VIEW HELPERS ===
  const startRenamingView = () => {
    setRenameViewValue(activeViewName);
    setIsRenamingView(true);
    setIsViewDropdownOpen(false);
    setIsCreateNewDropdownOpen(false);
    setContextMenuViewId(null);
    setContextMenuPosition(null);
  };

  const commitRenameView = () => {
    const trimmed = renameViewValue.trim();
    if (trimmed && trimmed !== activeViewName && activeViewId) {
      renameViewMut.mutate({ viewId: activeViewId, name: trimmed });
    }
    setIsRenamingView(false);
  };

  const cancelRenameView = () => {
    setIsRenamingView(false);
  };

  // === RENDER ===
  return (
    <div className={styles.workspace}>
      {/* =============================================
          RAIL (Narrow vertical sidebar - 56px wide)
          ============================================= */}
      <Rail />

      {/* =============================================
          MAIN CONTENT AREA (right of rail)
          ============================================= */}
      <div className={styles.mainArea}>
        {/* === TOP BAR (base name) === */}
        <TopBar
          baseName={baseName}
          baseColor={baseColor}
          baseBorderColor={baseBorderColor}
          baseTextColor={baseTextColor}
        />

        {/* === CONTENT AREA === */}
        <div className={styles.contentArea}>
          <TableToolbar
            baseId={baseId}
            getBaseToolbarColor={getBaseToolbarColor}
            hasOverflow={hasOverflow}
            scrollProgress={scrollProgress}
            scrollToEnd={scrollToEnd}
            tabsScrollRef={tabsScrollRef}
            tables={tables}
            activeTableId={activeTableId}
            setActiveTableId={setActiveTableId}
            isTableTitleDropdownOpen={isTableTitleDropdownOpen}
            setIsTableTitleDropdownOpen={setIsTableTitleDropdownOpen}
            tableTitleDropdownPosition={tableTitleDropdownPosition}
            setTableTitleDropdownPosition={setTableTitleDropdownPosition}
            tableTitleDropdownButtonRef={tableTitleDropdownButtonRef}
            tableTitleDropdownRef={tableTitleDropdownRef}
            isRenamePopupOpen={isRenamePopupOpen}
            renamePopupPosition={renamePopupPosition}
            renamePopupRef={renamePopupRef}
            renameInputRef={renameInputRef}
            renameTableName={renameTableName}
            setRenameTableName={setRenameTableName}
            renameRecordName={renameRecordName}
            handleOpenRenamePopup={handleOpenRenamePopup}
            handleSaveRename={handleSaveRename}
            handleCancelRename={handleCancelRename}
            isTableDropdownOpen={isTableDropdownOpen}
            setIsTableDropdownOpen={setIsTableDropdownOpen}
            tableDropdownAlignRight={tableDropdownAlignRight}
            tableSearchQuery={tableSearchQuery}
            setTableSearchQuery={setTableSearchQuery}
            hoveredTableId={hoveredTableId}
            setHoveredTableId={setHoveredTableId}
            filteredTables={filteredTables}
            handleTableSelect={handleTableSelect}
            tableDropdownButtonRef={tableDropdownButtonRef}
            tableDropdownRef={tableDropdownRef}
            addTableSectionRef={addTableSectionRef}
            isAddOrImportDropdownOpen={isAddOrImportDropdownOpen}
            setIsAddOrImportDropdownOpen={setIsAddOrImportDropdownOpen}
            addOrImportDropdownPosition={addOrImportDropdownPosition}
            setAddOrImportOpenedFromTableDropdown={setAddOrImportOpenedFromTableDropdown}
            addOrImportButtonRef={addOrImportButtonRef}
            addOrImportDropdownRef={addOrImportDropdownRef}
            handleAddTable={handleAddTable}
            handleOpenClearDataModal={handleOpenClearDataModal}
            handleOpenDeleteTablePopup={handleOpenDeleteTablePopup}
          />

          <GridBar
            isViewsSidebarOpen={isViewsSidebarOpen}
            handleToggleViewsSidebar={handleToggleViewsSidebar}
            handleListButtonMouseEnter={handleListButtonMouseEnter}
            handleListButtonMouseLeave={handleListButtonMouseLeave}
            viewDropdownButtonRef={viewDropdownButtonRef}
            isRenamingView={isRenamingView}
            renameViewInputRef={renameViewInputRef}
            renameViewValue={renameViewValue}
            setRenameViewValue={setRenameViewValue}
            startRenamingView={startRenamingView}
            commitRenameView={commitRenameView}
            cancelRenameView={cancelRenameView}
            isViewDropdownOpen={isViewDropdownOpen}
            setIsViewDropdownOpen={setIsViewDropdownOpen}
            setIsCreateNewDropdownOpen={setIsCreateNewDropdownOpen}
            viewDropdownRef={viewDropdownRef}
            activeViewName={activeViewName}
            activeViewId={activeViewId}
            canDeleteView={canDeleteView}
            deleteViewMut={deleteViewMut}
          />

          {/* === GRID AREA (views sidebar + grid content) === */}
          <div className={styles.gridArea}>
            <ViewsSidebar
              isViewsSidebarOpen={isViewsSidebarOpen}
              handleSidebarMouseEnter={handleSidebarMouseEnter}
              handleSidebarMouseLeave={handleSidebarMouseLeave}
              views={views}
              activeViewId={activeViewId}
              setActiveViewId={setActiveViewId}
              favoritedViews={favoritedViews}
              handleToggleViewFavorite={handleToggleViewFavorite}
              viewSearchQuery={viewSearchQuery}
              setViewSearchQuery={setViewSearchQuery}
              canDeleteView={canDeleteView}
              isCreateNewDropdownOpen={isCreateNewDropdownOpen}
              setIsCreateNewDropdownOpen={setIsCreateNewDropdownOpen}
              isCreateViewBoxOpen={isCreateViewBoxOpen}
              setIsCreateViewBoxOpen={setIsCreateViewBoxOpen}
              createViewName={createViewName}
              setCreateViewName={setCreateViewName}
              computeNextViewName={computeNextViewName}
              createViewMut={createViewMut}
              tableId={tableId}
              contextMenuViewId={contextMenuViewId}
              setContextMenuViewId={setContextMenuViewId}
              contextMenuPosition={contextMenuPosition}
              setContextMenuPosition={setContextMenuPosition}
              setRenameViewValue={setRenameViewValue}
              setIsRenamingView={setIsRenamingView}
              setIsViewDropdownOpen={setIsViewDropdownOpen}
              deleteViewMut={deleteViewMut}
            />

            <GridContainer
              gridFooterRef={gridFooterRef}
              gridBodyRef={gridBodyRef}
              scrollableHeaderRef={scrollableHeaderRef}
              gridScrollerRef={gridScrollerRef}
              hScrollRef={hScrollRef}
              scrollShadowRef={scrollShadowRef}
              freezeSnapPreviewRef={freezeSnapPreviewRef}
              freezeLineRef={freezeLineRef}
              freezePillRef={freezePillRef}
              selectionOverlayRef={selectionOverlayRef}
              freezeWidth={freezeWidth}
              rowHeight={rowHeight}
              scrollableColumnsWidth={scrollableColumnsWidth}
              frozenColumns={frozenColumns}
              scrollableColumns={scrollableColumns}
              getColWidth={getColWidth}
              rows={rows}
              virtualRange={virtualRange}
              totalCount={totalCount}
              DATA_ROW_HEIGHT={DATA_ROW_HEIGHT}
              getCellValue={getCellValue}
              stableCommit={stableCommit}
              stableCancel={stableCancel}
              handleRowHeightResizeStart={handleRowHeightResizeStart}
              handleResizeStart={handleResizeStart}
              handleFreezeDragStart={handleFreezeDragStart}
              handleFreezeLineMouseMove={handleFreezeLineMouseMove}
            />
          </div>
        </div>
    </div>

    {/* Clear Data Warning Modal */}
    <ClearDataModal
      isOpen={isClearDataModalOpen}
      tableName={tables.find(t => t.id === activeTableId)?.name ?? 'this table'}
      onClose={handleCloseClearDataModal}
      onConfirm={handleClearData}
    />

    {/* Delete Table Popup */}
    <DeleteTablePopup
      isOpen={isDeleteTablePopupOpen}
      position={deleteTablePopupPosition}
      onClose={handleCloseDeleteTablePopup}
      onConfirm={handleDeleteTable}
    />
  </div>
  );
}

