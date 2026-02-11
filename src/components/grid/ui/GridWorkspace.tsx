"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { signOut, useSession } from "next-auth/react";
import { skipToken } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import type { inferProcedureOutput } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";
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
import { reconcileColumnOrder } from "~/components/grid/useGridMeta";

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
// TYPE ALIASES (for optimistic cache updates)
// ============================================
type RowInfinitePage = inferProcedureOutput<AppRouter["row"]["infinite"]>;
type RowInfiniteCursor = RowInfinitePage["nextCursor"];
type RowInfiniteData = InfiniteData<RowInfinitePage, RowInfiniteCursor>;

// ============================================
// GRID DIMENSION CONSTANTS
// ============================================
const ROW_NUM_WIDTH = 83;   // 44px cell + 39px margin-right
const COLUMN_WIDTH = 180;   // each column header total width (border-box)
const DATA_ROW_HEIGHT = 32; // matches CSS .gridRowNumCell/.gridDataCell height
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
  const { rows, totalCount, q: rowsQ, input: rowQueryInput, debouncedSearch } = useGridRows(tableId);
  rowsRef.current = rows;
  const { commit, cancel } = useCellEditing(tableId, rowQueryInput);

  // Search state for FindBar wiring
  const search = useGridStore((s) => s.search);
  const setFindCurrentMatch = useGridStore((s) => s.setFindCurrentMatch);
  /** true while debounce timer is pending OR the network query is in-flight */
  const isSearchPending = search !== debouncedSearch || rowsQ.isFetching;

  const hiddenColumnIds = useGridStore((s) => s.hiddenColumnIds);
  const toggleHiddenColumn = useGridStore((s) => s.toggleHiddenColumn);
  const setHiddenColumnIds = useGridStore((s) => s.setHiddenColumnIds);
  const columnOrderIds = useGridStore((s) => s.columnOrderIds);
  const setColumnOrderIds = useGridStore((s) => s.setColumnOrderIds);

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

  // All columns ordered by view-level columnOrderIds (for HideFieldsPanel)
  const orderedColumns = useMemo(() => {
    if (columnOrderIds.length === 0) return columns;
    const byId = new Map(columns.map((c) => [c.id, c]));
    return columnOrderIds
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => c != null);
  }, [columns, columnOrderIds]);

  // Visible columns: ordered then hidden filtered out (used by the grid)
  const visibleColumns = useMemo(
    () => orderedColumns.filter((c) => !hiddenColumnIds.includes(c.id)),
    [orderedColumns, hiddenColumnIds],
  );

  // ================================================================
  // FIND-IN-VIEW: client-side match list + navigation
  // ================================================================
  type FindMatch = { rowId: string; columnId: string };

  const activeSearchTerm = debouncedSearch.trim();

  /** Sentinel rowId used for header-cell matches (column names). */
  const HEADER_ROW_ID = "__header__";

  /** Flat ordered list of matching cells: header row first, then data rows top→bottom, columns left→right. */
  const findMatches: FindMatch[] = useMemo(() => {
    if (!activeSearchTerm) return [];
    const termLower = activeSearchTerm.toLowerCase();
    const result: FindMatch[] = [];

    // Header row — match against column names
    for (const col of visibleColumns) {
      if (col.name.toLowerCase().includes(termLower)) {
        result.push({ rowId: HEADER_ROW_ID, columnId: col.id });
      }
    }

    // Data rows
    for (const row of rows) {
      const cells = (row.cells ?? {}) as Record<string, unknown>;
      for (const col of visibleColumns) {
        const val = cells[col.id];
        if (val != null && String(val).toLowerCase().includes(termLower)) {
          result.push({ rowId: row.id, columnId: col.id });
        }
      }
    }
    return result;
  }, [rows, visibleColumns, activeSearchTerm]);

  /** 0-based index into findMatches for the "current" highlighted match. */
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Reset to first match when the search term changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [activeSearchTerm]);

  // Clamp index if it goes out of bounds (e.g. rows unloaded while navigating)
  useEffect(() => {
    if (findMatches.length > 0) {
      setCurrentMatchIndex((prev) => (prev >= findMatches.length ? 0 : prev));
    }
  }, [findMatches.length]);

  // Track the last match cell we synced / scrolled to, so we skip duplicate work
  // when the effect re-fires due to referential (but not semantic) dependency changes.
  const prevMatchKeyRef = useRef<string | null>(null);

  // Sync the current match into the Zustand store + scroll into view.
  // The ref guard ensures we only perform side-effects when the *actual* match cell changes,
  // preventing spurious scrolls on unrelated re-renders.
  useEffect(() => {
    const match = findMatches[currentMatchIndex] ?? null;
    const matchKey = match ? `${match.rowId}:${match.columnId}` : null;

    if (matchKey === prevMatchKeyRef.current) return;
    prevMatchKeyRef.current = matchKey;

    // Update store (for per-row GridRow highlighting)
    setFindCurrentMatch(match);

    // Scroll into view
    if (match) {
      const colIdx = visibleColumns.findIndex((c) => c.id === match.columnId);
      if (match.rowId === HEADER_ROW_ID) {
        // Header is sticky — just scroll the column into view horizontally (rowIdx 0)
        if (colIdx !== -1) scrollCellIntoView(colIdx, 0);
      } else {
        const rowIdx = rows.findIndex((r) => r.id === match.rowId);
        if (rowIdx !== -1 && colIdx !== -1) {
          scrollCellIntoView(colIdx, rowIdx);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatchIndex, findMatches, rows, visibleColumns, setFindCurrentMatch]);

  const handleNextMatch = useCallback(() => {
    if (findMatches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % findMatches.length);
  }, [findMatches.length]);

  const handlePrevMatch = useCallback(() => {
    if (findMatches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + findMatches.length) % findMatches.length);
  }, [findMatches.length]);

  // Hide-all / Show-all callbacks for the Hide Fields panel
  const handleHideAllColumns = useCallback(() => {
    setHiddenColumnIds(orderedColumns.map((c) => c.id));
  }, [orderedColumns, setHiddenColumnIds]);

  const handleShowAllColumns = useCallback(() => {
    setHiddenColumnIds([]);
  }, [setHiddenColumnIds]);

  // Reorder columns callback for the Hide Fields panel drag-and-drop
  const handleReorderColumns = useCallback(
    (fromIndex: number, toIndex: number) => {
      const ids = orderedColumns.map((c) => c.id);
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, moved!);
      setColumnOrderIds(ids);
    },
    [orderedColumns, setColumnOrderIds],
  );

  // Sort state from store (array of Sort objects)
  const currentSorts = useGridStore((s) => s.sorts);
  const setSorts = useGridStore((s) => s.setSorts);

  // Handle picking the first sort field from the FieldPicker (no active sort yet)
  const handlePickSort = useCallback(
    (columnId: string, columnType: "TEXT" | "NUMBER") => {
      setSorts([{ columnId, direction: "asc", type: columnType }]);
    },
    [setSorts],
  );

  // Handle adding another sort
  const handleAddSort = useCallback(
    (columnId: string, columnType: "TEXT" | "NUMBER") => {
      setSorts([...currentSorts, { columnId, direction: "asc", type: columnType }]);
    },
    [currentSorts, setSorts],
  );

  // Handle changing the field of a sort at a given index
  const handleChangeSortField = useCallback(
    (index: number, columnId: string, columnType: "TEXT" | "NUMBER") => {
      const next = currentSorts.map((s, i) =>
        i === index ? { columnId, direction: s.direction, type: columnType } : s,
      );
      setSorts(next);
    },
    [currentSorts, setSorts],
  );

  // Handle changing sort direction at a given index
  const handleChangeDirection = useCallback(
    (index: number, direction: "asc" | "desc") => {
      const next = currentSorts.map((s, i) =>
        i === index ? { ...s, direction } : s,
      );
      setSorts(next);
    },
    [currentSorts, setSorts],
  );

  // Handle removing a sort at a given index
  const handleRemoveSort = useCallback(
    (index: number) => {
      setSorts(currentSorts.filter((_, i) => i !== index));
    },
    [currentSorts, setSorts],
  );

  // === AUTO-SORT + VIEW-LEVEL SORT PERSISTENCE ===
  const autoSort = useGridStore((s) => s.autoSort);
  const setAutoSort = useGridStore((s) => s.setAutoSort);
  const savedSorts = useGridStore((s) => s.savedSorts);
  const revertSorts = useGridStore((s) => s.revertSorts);

  // Effective sorts: autoSort=true → live preview of current sorts
  //                  autoSort=false → only persisted (saved) sorts
  const effectiveSortCount = autoSort ? currentSorts.length : savedSorts.length;
  // Whether there are active sorts (for orange badge styling on the Sort button)
  const hasTemporarySorts = currentSorts.length > 0;
  const markSortsSaved = useGridStore((s) => s.markSortsSaved);
  const markSaved = useGridStore((s) => s.markSaved);
  const searchForSave = useGridStore((s) => s.search);
  const filtersForSave = useGridStore((s) => s.filters);
  const filterConjunctionForSave = useGridStore((s) => s.filterConjunction);
  const markFiltersSaved = useGridStore((s) => s.markFiltersSaved);

  const handleToggleAutoSort = useCallback(() => {
    setAutoSort(!autoSort);
  }, [autoSort, setAutoSort]);

  // Save sorts to view config (autoSort=false "Sort" button)
  const viewSortSaveMut = api.view.update.useMutation({
    onSuccess: async () => {
      markSortsSaved();
      markSaved();
      await utils.view.list.invalidate({ tableId });
    },
  });

  const activeViewIdFromStore = useGridStore((s) => s.activeViewId);

  const handleSaveSorts = useCallback(() => {
    if (!activeViewIdFromStore) return;
    viewSortSaveMut.mutate({
      viewId: activeViewIdFromStore,
      config: { search: searchForSave, filters: filtersForSave, filterConjunction: filterConjunctionForSave, sorts: currentSorts, hiddenColumnIds, columnOrderIds },
    });
  }, [activeViewIdFromStore, searchForSave, filtersForSave, filterConjunctionForSave, currentSorts, hiddenColumnIds, columnOrderIds, viewSortSaveMut]);

  // Cancel sorts: revert to savedSorts (autoSort=false "Cancel" button)
  const handleCancelSorts = useCallback(() => {
    revertSorts();
  }, [revertSorts]);

  // === AUTO-SAVE LAYOUT CHANGES (column order + visibility) ===
  // In Airtable, column reorder and hide/show changes are persisted immediately.
  // We debounce-save whenever columnOrderIds or hiddenColumnIds change.
  const layoutAutoSaveMut = api.view.update.useMutation({
    onSuccess: () => {
      markSaved();
      void utils.view.list.invalidate({ tableId });
    },
  });

  // Ref keeps the latest full config so the debounced save never uses stale values
  const latestConfigRef = useRef({
    search: searchForSave,
    filters: filtersForSave,
    filterConjunction: filterConjunctionForSave,
    sorts: currentSorts,
    hiddenColumnIds,
    columnOrderIds,
  });
  latestConfigRef.current = {
    search: searchForSave,
    filters: filtersForSave,
    filterConjunction: filterConjunctionForSave,
    sorts: currentSorts,
    hiddenColumnIds,
    columnOrderIds,
  };

  // Per-view baseline to distinguish "view loaded" from "user changed layout"
  const layoutBaselineRef = useRef<string>("");
  const layoutTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!activeViewIdFromStore) return;

    const layoutKey = `${activeViewIdFromStore}|${columnOrderIds.join(",")}|${hiddenColumnIds.join(",")}`;

    // On view switch (or first render), record the baseline and skip
    if (!layoutBaselineRef.current.startsWith(activeViewIdFromStore + "|")) {
      layoutBaselineRef.current = layoutKey;
      return;
    }

    // If layout hasn't actually changed, skip
    if (layoutKey === layoutBaselineRef.current) return;

    // Debounce: wait for rapid drag-and-drop sequences to settle
    clearTimeout(layoutTimerRef.current);
    layoutTimerRef.current = setTimeout(() => {
      if (!activeViewIdFromStore) return;
      layoutBaselineRef.current = layoutKey;
      layoutAutoSaveMut.mutate({
        viewId: activeViewIdFromStore,
        config: latestConfigRef.current,
      });
    }, 400);

    return () => clearTimeout(layoutTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnOrderIds, hiddenColumnIds, activeViewIdFromStore]);

  // === AUTO-SAVE FILTER CHANGES ===
  // Filters are "temporary" (reversible) but persist across sessions — auto-save
  // whenever the user changes filter conditions, debounced to avoid rapid-fire saves.
  const filterAutoSaveMut = api.view.update.useMutation({
    onSuccess: () => {
      markFiltersSaved();
      void utils.view.list.invalidate({ tableId });
    },
  });

  const filterBaselineRef = useRef<string>("");
  const filterTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Serialise current filters + conjunction into a stable key for change detection
  const filterKey = `${activeViewIdFromStore}|${JSON.stringify(filtersForSave)}|${filterConjunctionForSave}`;

  useEffect(() => {
    if (!activeViewIdFromStore) return;

    // On view switch (or first render), record the baseline and skip
    if (!filterBaselineRef.current.startsWith(activeViewIdFromStore + "|")) {
      filterBaselineRef.current = filterKey;
      return;
    }

    // If filters haven't actually changed, skip
    if (filterKey === filterBaselineRef.current) return;

    // Debounce: wait for the user to finish building their filter
    clearTimeout(filterTimerRef.current);
    filterTimerRef.current = setTimeout(() => {
      if (!activeViewIdFromStore) return;
      filterBaselineRef.current = filterKey;
      filterAutoSaveMut.mutate({
        viewId: activeViewIdFromStore,
        config: latestConfigRef.current,
      });
    }, 600);

    return () => clearTimeout(filterTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, activeViewIdFromStore]);

  // === AUTO-SAVE SORT CHANGES ===
  // Sorts (like filters) are reversible but persist across sessions.
  const sortAutoSaveMut = api.view.update.useMutation({
    onSuccess: () => {
      markSortsSaved();
      void utils.view.list.invalidate({ tableId });
    },
  });

  const sortBaselineRef = useRef<string>("");
  const sortTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const sortKey = `${activeViewIdFromStore}|${JSON.stringify(currentSorts)}`;

  useEffect(() => {
    if (!activeViewIdFromStore) return;

    // On view switch (or first render), record the baseline and skip
    if (!sortBaselineRef.current.startsWith(activeViewIdFromStore + "|")) {
      sortBaselineRef.current = sortKey;
      return;
    }

    // If sorts haven't actually changed, skip
    if (sortKey === sortBaselineRef.current) return;

    // Debounce: wait for the user to finish adjusting sorts
    clearTimeout(sortTimerRef.current);
    sortTimerRef.current = setTimeout(() => {
      if (!activeViewIdFromStore) return;
      sortBaselineRef.current = sortKey;
      sortAutoSaveMut.mutate({
        viewId: activeViewIdFromStore,
        config: latestConfigRef.current,
      });
    }, 600);

    return () => clearTimeout(sortTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, activeViewIdFromStore]);

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

    // Use editing cell if present, otherwise active cell
    const targetCell = ec ?? ac;
    if (!targetCell) {
      overlay.style.display = "none";
      return;
    }

    const cols = columnsRef.current;
    const rws = rowsRef.current;
    const frozenCount = frozenColumnCountRef.current;

    const colIdx = cols.findIndex((c) => c.id === targetCell.columnId);
    const rowIdx = rws.findIndex((r) => r.id === targetCell.rowId);
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
    const colWidth = widths[targetCell.columnId] ?? COLUMN_WIDTH;
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

    // Fill handle — first child of overlay
    const handle = overlay.firstElementChild as HTMLElement | null;

    overlay.style.display = "block";

    let overlayTop: number;
    let overlayHeight: number;

    if (ec) {
      // --- Editing mode: hide fill handle, 3px border, expand outward ---
      if (handle) handle.style.display = "none";
      overlay.style.borderWidth = "3px";

      const col = cols[colIdx];
      const isNumber = col?.type === "NUMBER";

      if (isNumber) {
        // NUMBER: top/left/right outward, bottom flush with cell bottom
        // so the 3px border eats inward (upward).
        overlayTop = cellY - 3;
        overlay.style.left = `${cellX - 3}px`;
        overlay.style.width = `${colWidth + 6}px`;
        overlayHeight = DATA_ROW_HEIGHT + 3;
      } else {
        // TEXT: all sides outward including bottom (downward).
        overlayTop = cellY - 3;
        overlay.style.left = `${cellX - 3}px`;
        overlay.style.width = `${colWidth + 6}px`;
        overlayHeight = DATA_ROW_HEIGHT + 6;
      }
    } else {
      // --- Active (non-editing) mode: show fill handle, 2px border ---
      if (handle) handle.style.display = "";
      overlay.style.borderWidth = "2px";

      overlayTop = cellY - 2;
      overlay.style.left = `${cellX - 1}px`;
      overlay.style.width = `${colWidth + 2}px`;
      overlayHeight = DATA_ROW_HEIGHT + 3;
    }

    overlay.style.top = `${overlayTop}px`;
    overlay.style.height = `${overlayHeight}px`;

    // Clip overlay so it doesn't paint above the column headers.
    // Allow the border to extend slightly above the header (Airtable behavior
    // for the first row) — only clip when the cell body itself is behind the header.
    // Use negative insets for bottom/right so the fill handle is never clipped.
    const borderW = ec ? 3 : 2;
    if (overlayTop + borderW < headerH) {
      const clipTop = headerH - overlayTop;
      overlay.style.clipPath = `inset(${clipTop}px -10px -10px 0)`;
    } else {
      overlay.style.clipPath = "";
    }
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
        const colIdx = visibleColumns.findIndex((c) => c.id === columnId);
        if (rowIdx === -1 || colIdx === -1) return;

        let newRowIdx = rowIdx;
        let newColIdx = colIdx;

        switch (e.key) {
          case "ArrowUp": newRowIdx = Math.max(0, rowIdx - 1); break;
          case "ArrowDown": newRowIdx = Math.min(rows.length - 1, rowIdx + 1); break;
          case "ArrowLeft": newColIdx = Math.max(0, colIdx - 1); break;
          case "ArrowRight": newColIdx = Math.min(visibleColumns.length - 1, colIdx + 1); break;
          case "Tab":
            if (e.shiftKey) {
              newColIdx = Math.max(0, colIdx - 1);
            } else {
              newColIdx = Math.min(visibleColumns.length - 1, colIdx + 1);
            }
            break;
        }

        const newRow = rows[newRowIdx];
        const newCol = visibleColumns[newColIdx];
        if (newRow && newCol) {
          setActiveCell({ rowId: newRow.id, columnId: newCol.id });
          scrollCellIntoView(newColIdx, newRowIdx);
        }
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const row = rows.find((r) => r.id === rowId);
        const col = visibleColumns.find((c) => c.id === columnId);
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
  }, [activeCell, editingCell, rows, visibleColumns, setActiveCell, startEditing, clearSelection, getCellValue, scrollCellIntoView]);

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
  }, [activeCell, editingCell, columnWidths, frozenColCount, visibleColumns, rows, updateSelectionOverlay]);

  // Compute freeze snap positions (one per column boundary, using actual widths)
  // Freeze bar can go from right edge of row-num col to the left edge of the
  // last column or the 4th data column — whichever comes first.
  const snapPositions = useMemo(() => {
    const positions = [ROW_NUM_WIDTH]; // snap 0: right edge of serial # col
    const maxFrozen = Math.min(4, Math.max(0, visibleColumns.length - 1));
    let x = ROW_NUM_WIDTH;
    for (let i = 0; i < maxFrozen; i++) {
      x += columnWidths[visibleColumns[i]!.id] ?? COLUMN_WIDTH;
      positions.push(x);
    }
    return positions;
  }, [visibleColumns, columnWidths]);

  // Derive freeze width from frozenColCount + actual column widths
  const frozenColumnCount = Math.min(frozenColCount, visibleColumns.length);
  frozenColumnCountRef.current = frozenColumnCount;
  const freezeWidth = useMemo(() => {
    let w = ROW_NUM_WIDTH;
    for (let i = 0; i < frozenColumnCount && i < visibleColumns.length; i++) {
      w += columnWidths[visibleColumns[i]!.id] ?? COLUMN_WIDTH;
    }
    return w;
  }, [frozenColumnCount, visibleColumns, columnWidths]);
  freezeWidthRef.current = freezeWidth;
  const frozenColumns = useMemo(() => visibleColumns.slice(0, frozenColumnCount), [visibleColumns, frozenColumnCount]);
  const scrollableColumns = useMemo(() => visibleColumns.slice(frozenColumnCount), [visibleColumns, frozenColumnCount]);

  // Total width of all scrollable column headers (for add-row slab sizing)
  const scrollableColumnsWidth = useMemo(() => {
    let w = 0;
    for (let i = frozenColumnCount; i < visibleColumns.length; i++) {
      w += columnWidths[visibleColumns[i]!.id] ?? COLUMN_WIDTH;
    }
    return w;
  }, [frozenColumnCount, visibleColumns, columnWidths]);

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

  // Initialize / switch grid store when active view changes
  const storeActiveViewId = useGridStore((s) => s.activeViewId);
  const initializeFromView = useGridStore((s) => s.initializeFromView);

  useEffect(() => {
    if (!activeViewId || views.length === 0) return;
    // Only reinitialize if the store is tracking a different view (or not yet initialized)
    if (storeActiveViewId === activeViewId) return;
    const view = views.find(v => v.id === activeViewId);
    if (!view) return;
    const config = normalizeViewConfig(view.config);
    // Reconcile column order with actual table columns (handles added/removed columns)
    const tableColumnIds = columns.map((c) => c.id);
    const reconciledConfig = tableColumnIds.length > 0
      ? reconcileColumnOrder(config, tableColumnIds)
      : config;
    initializeFromView(activeViewId, reconciledConfig);
  }, [activeViewId, views, columns, storeActiveViewId, initializeFromView]);

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

  // Rename view state (GridBar inline rename)
  const [isRenamingView, setIsRenamingView] = useState(false);
  const [renameViewValue, setRenameViewValue] = useState('');
  const renameViewInputRef = useRef<HTMLInputElement>(null);

  // Sidebar inline rename state
  const [renamingSidebarViewId, setRenamingSidebarViewId] = useState<string | null>(null);
  const [sidebarRenameValue, setSidebarRenameValue] = useState('');

  // === ROW MUTATIONS ===
  const addRowMut = api.row.addMany.useMutation();

  // Ref to track the ID of a just-inserted row so the auto-edit effect can find it
  const newRowEditIdRef = useRef<string | null>(null);
  // Maps temp optimistic IDs to real server IDs after mutation succeeds
  const tempToRealIdRef = useRef<{ tempId: string; realId: string } | null>(null);

  // Insert row — optimistic: inject a placeholder row into cache immediately
  const insertRowMut = api.row.insertAt.useMutation({
    onMutate: async (vars) => {
      await utils.row.infinite.cancel(rowQueryInput);
      const prev = utils.row.infinite.getInfiniteData(rowQueryInput);

      const tempId = `__temp_${Date.now()}`;

      // Build a placeholder row matching the shape from row.infinite
      const tempRow = {
        id: tempId,
        rowIndex: vars.atIndex,
        cells: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      utils.row.infinite.setInfiniteData(rowQueryInput, (old): RowInfiniteData | undefined => {
        if (!old) return old;

        let inserted = false;
        return {
          ...old,
          pages: old.pages.map((page, pageIdx) => {
            const newItems: typeof page.items = [];

            for (const r of page.items) {
              // Insert the temp row right before the first row at or above atIndex
              if (!inserted && r.rowIndex >= vars.atIndex) {
                newItems.push(tempRow as typeof r);
                inserted = true;
              }
              // Shift existing rows at or above atIndex up by 1
              newItems.push(
                r.rowIndex >= vars.atIndex
                  ? { ...r, rowIndex: r.rowIndex + 1 }
                  : r,
              );
            }

            // If not inserted yet (all rows have lower indices), append at end
            if (!inserted && pageIdx === old.pages.length - 1) {
              newItems.push(tempRow as typeof page.items[0]);
              inserted = true;
            }

            return {
              ...page,
              items: newItems,
              totalCount: pageIdx === 0 ? page.totalCount + 1 : page.totalCount,
            };
          }),
        };
      });

      // Immediately schedule auto-edit for the temp row
      newRowEditIdRef.current = tempId;

      return { prev, tempId };
    },
    onError: (_e, _v, ctx) => {
      newRowEditIdRef.current = null;
      if (ctx?.prev) {
        utils.row.infinite.setInfiniteData(rowQueryInput, ctx.prev);
      }
    },
    onSuccess: (data, _vars, ctx) => {
      // Map temp → real ID so the auto-edit effect (and any active editing state) uses the real ID
      if (ctx?.tempId) {
        tempToRealIdRef.current = { tempId: ctx.tempId, realId: data.id };
      }
      // Re-sync with server for accurate data
      void utils.row.infinite.invalidate(rowQueryInput);
    },
  });

  // Duplicate row — optimistic: clone the row right below the source
  const duplicateRowMut = api.row.duplicateAt.useMutation({
    onMutate: async (vars) => {
      await utils.row.infinite.cancel(rowQueryInput);
      const prev = utils.row.infinite.getInfiniteData(rowQueryInput);

      // Find the source row in cache so we can clone its cells
      let sourceRow: RowInfinitePage["items"][number] | undefined;
      if (prev) {
        for (const page of prev.pages) {
          sourceRow = page.items.find((r) => r.id === vars.rowId);
          if (sourceRow) break;
        }
      }

      const atIndex = sourceRow ? sourceRow.rowIndex + 1 : 0;
      const tempId = `__temp_dup_${Date.now()}`;
      const tempRow = {
        id: tempId,
        rowIndex: atIndex,
        cells: sourceRow ? sourceRow.cells : {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      utils.row.infinite.setInfiniteData(rowQueryInput, (old): RowInfiniteData | undefined => {
        if (!old) return old;
        let inserted = false;
        return {
          ...old,
          pages: old.pages.map((page, pageIdx) => {
            const newItems: typeof page.items = [];
            for (const r of page.items) {
              newItems.push(
                r.rowIndex >= atIndex
                  ? { ...r, rowIndex: r.rowIndex + 1 }
                  : r,
              );
              // Insert the duplicate right after the source row
              if (!inserted && r.id === vars.rowId) {
                newItems.push(tempRow as typeof r);
                inserted = true;
              }
            }
            if (!inserted && pageIdx === old.pages.length - 1) {
              newItems.push(tempRow as typeof page.items[0]);
              inserted = true;
            }
            return {
              ...page,
              items: newItems,
              totalCount: pageIdx === 0 ? page.totalCount + 1 : page.totalCount,
            };
          }),
        };
      });

      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) {
        utils.row.infinite.setInfiniteData(rowQueryInput, ctx.prev);
      }
    },
    onSuccess: () => {
      void utils.row.infinite.invalidate(rowQueryInput);
    },
  });

  // Set of row IDs currently animating out (slide-up before removal)
  const [deletingRowIds, setDeletingRowIds] = useState<Set<string>>(new Set());

  // Delete row — animated: mark as deleting → animate → remove from cache
  const deleteRowMut = api.row.delete.useMutation({
    onSuccess: () => {
      // Re-sync with server to get accurate data after animation + removal
      void utils.row.infinite.invalidate(rowQueryInput);
    },
    onError: (_e, vars) => {
      // If the server fails, un-mark the row so it reappears
      setDeletingRowIds((prev) => {
        const next = new Set(prev);
        next.delete(vars.rowId);
        return next;
      });
    },
  });

  // === COLUMN MUTATIONS ===
  // Delete column — optimistic: remove from column list + strip from row cells immediately
  const deleteColumnMut = api.column.delete.useMutation({
    onMutate: async (vars) => {
      // Cancel both queries
      await Promise.all([
        utils.column.list.cancel({ tableId }),
        utils.row.infinite.cancel(rowQueryInput),
      ]);

      const prevCols = utils.column.list.getData({ tableId });
      const prevRows = utils.row.infinite.getInfiniteData(rowQueryInput);

      // Remove column from column list cache
      utils.column.list.setData({ tableId }, (old) => {
        if (!old) return old;
        return old.filter((c) => c.id !== vars.columnId);
      });

      // Strip the column key from all rows' cells
      utils.row.infinite.setInfiniteData(rowQueryInput, (old): RowInfiniteData | undefined => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((r) => {
              const cells = r.cells as Record<string, unknown> | null;
              if (!cells || !(vars.columnId in cells)) return r;
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { [vars.columnId]: _removed, ...rest } = cells;
              return { ...r, cells: rest };
            }),
          })),
        };
      });

      return { prevCols, prevRows };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevCols) {
        utils.column.list.setData({ tableId }, ctx.prevCols);
      }
      if (ctx?.prevRows) {
        utils.row.infinite.setInfiniteData(rowQueryInput, ctx.prevRows);
      }
    },
    onSuccess: () => {
      // Re-sync with server
      void utils.column.list.invalidate({ tableId });
      void utils.row.infinite.invalidate(rowQueryInput);
    },
  });

  // Stores the rowIndex of the newly created row so we can identify it after refetch
  const newRowTargetIndexRef = useRef<number | null>(null);

  const handleAddRow = useCallback(() => {
    if (!isValidTable) return;
    addRowMut.mutate({ tableId, count: 1 }, {
      onSuccess: (data) => {
        // data.startRowIndex is the rowIndex of the newly inserted row
        newRowTargetIndexRef.current = data.startRowIndex;
        void utils.row.infinite.invalidate({ tableId });
      },
    });
  }, [isValidTable, tableId, addRowMut, utils]);

  // When rows update after adding (+ button), find the new row by rowIndex and start editing
  useEffect(() => {
    if (newRowTargetIndexRef.current === null) return;
    if (rows.length === 0 || visibleColumns.length === 0) return;

    const targetIdx = newRowTargetIndexRef.current;
    const newRow = (rows as Array<{ id: string; rowIndex: number; cells: unknown }>).find(
      (r) => r.rowIndex === targetIdx,
    );
    if (!newRow) return; // Row hasn't appeared yet — wait for next rows update

    newRowTargetIndexRef.current = null;

    const firstCol = visibleColumns[0];
    if (firstCol) {
      const scroller = gridScrollerRef.current;
      if (scroller) {
        scroller.scrollTop = scroller.scrollHeight;
      }
      requestAnimationFrame(() => {
        setActiveCell({ rowId: newRow.id, columnId: firstCol.id });
        startEditing({ rowId: newRow.id, columnId: firstCol.id }, '');
      });
    }
  }, [rows, visibleColumns, setActiveCell, startEditing]);

  // When rows update after insert above/below, find the new row by ID and start editing.
  // Also swaps temp → real ID when the server data arrives.
  useEffect(() => {
    if (!newRowEditIdRef.current) return;
    if (rows.length === 0 || visibleColumns.length === 0) return;

    let targetId = newRowEditIdRef.current;

    // If the server has responded with a real ID mapping, apply it
    const mapping = tempToRealIdRef.current;
    if (mapping && targetId === mapping.tempId) {
      targetId = mapping.realId;
    }

    const typedRows = rows as Array<{ id: string; rowIndex: number; cells: unknown }>;
    let newRow = typedRows.find((r) => r.id === targetId);

    // Also try the temp ID in case the optimistic row is still in cache
    if (!newRow && targetId !== newRowEditIdRef.current) {
      newRow = typedRows.find((r) => r.id === newRowEditIdRef.current);
    }

    if (!newRow) return; // Row hasn't appeared yet

    newRowEditIdRef.current = null;
    tempToRealIdRef.current = null;

    const firstCol = visibleColumns[0];
    if (firstCol) {
      requestAnimationFrame(() => {
        setActiveCell({ rowId: newRow.id, columnId: firstCol.id });
        startEditing({ rowId: newRow.id, columnId: firstCol.id }, '');
      });
    }
  }, [rows, visibleColumns, setActiveCell, startEditing]);

  // === INSERT RECORD ABOVE (optimistic — row appears instantly) ===
  const handleInsertRecordAbove = useCallback((rowId: string) => {
    if (!isValidTable) return;
    const row = (rows as Array<{ id: string; rowIndex: number; cells: unknown }>).find(r => r.id === rowId);
    if (!row) return;
    insertRowMut.mutate({ tableId, atIndex: row.rowIndex });
  }, [isValidTable, tableId, rows, insertRowMut]);

  // === INSERT RECORD BELOW (optimistic — row appears instantly) ===
  const handleInsertRecordBelow = useCallback((rowId: string) => {
    if (!isValidTable) return;
    const row = (rows as Array<{ id: string; rowIndex: number; cells: unknown }>).find(r => r.id === rowId);
    if (!row) return;
    insertRowMut.mutate({ tableId, atIndex: row.rowIndex + 1 });
  }, [isValidTable, tableId, rows, insertRowMut]);

  // === DUPLICATE RECORD (optimistic — clone appears instantly below) ===
  const handleDuplicateRecord = useCallback((rowId: string) => {
    if (!isValidTable) return;
    duplicateRowMut.mutate({ tableId, rowId });
  }, [isValidTable, tableId, duplicateRowMut]);

  // === DELETE RECORD (optimistic — row disappears instantly) ===
  // Animation duration for row deletion slide-up (ms)
  const DELETE_ANIM_MS = 200;

  const handleDeleteRecord = useCallback((rowId: string) => {
    if (!isValidTable) return;
    if (activeCell?.rowId === rowId) clearSelection();

    // 1) Mark the row as "deleting" → triggers CSS slide-up animation
    setDeletingRowIds((prev) => new Set(prev).add(rowId));

    // 2) After animation completes, remove from cache and fire the server mutation
    setTimeout(() => {
      // Remove from cache optimistically
      utils.row.infinite.setInfiniteData(rowQueryInput, (old): RowInfiniteData | undefined => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page, i) => ({
            ...page,
            items: page.items.filter((r) => r.id !== rowId),
            totalCount: i === 0 ? Math.max(0, page.totalCount - 1) : page.totalCount,
          })),
        };
      });
      setDeletingRowIds((prev) => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
      // Fire the actual server deletion
      deleteRowMut.mutate({ tableId, rowId });
    }, DELETE_ANIM_MS);
  }, [isValidTable, tableId, activeCell, clearSelection, deleteRowMut, utils, rowQueryInput]);

  // === DELETE FIELD (optimistic — column disappears instantly) ===
  const handleDeleteField = useCallback((columnId: string) => {
    if (!isValidTable) return;
    if (activeCell?.columnId === columnId) clearSelection();
    deleteColumnMut.mutate({ tableId, columnId });
  }, [isValidTable, tableId, activeCell, clearSelection, deleteColumnMut]);

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

  // === SIDEBAR INLINE RENAME HELPERS ===
  const startSidebarRename = useCallback((viewId: string) => {
    const view = views.find(v => v.id === viewId);
    if (view) {
      setRenamingSidebarViewId(viewId);
      setSidebarRenameValue(view.name);
      setContextMenuViewId(null);
      setContextMenuPosition(null);
      setIsCreateNewDropdownOpen(false);
    }
  }, [views]);

  const commitSidebarRename = useCallback(() => {
    const trimmed = sidebarRenameValue.trim();
    if (trimmed && renamingSidebarViewId) {
      const view = views.find(v => v.id === renamingSidebarViewId);
      if (view && trimmed !== view.name) {
        renameViewMut.mutate({ viewId: renamingSidebarViewId, name: trimmed });
      }
    }
    setRenamingSidebarViewId(null);
  }, [sidebarRenameValue, renamingSidebarViewId, views, renameViewMut]);

  const cancelSidebarRename = useCallback(() => {
    setRenamingSidebarViewId(null);
  }, []);

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
            columns={orderedColumns}
            hiddenColumnIds={hiddenColumnIds}
            onToggleColumn={toggleHiddenColumn}
            onHideAll={handleHideAllColumns}
            onShowAll={handleShowAllColumns}
            onReorderColumns={handleReorderColumns}
            baseColor={baseColor}
            sortColumns={orderedColumns}
            currentSorts={currentSorts}
            effectiveSortCount={effectiveSortCount}
            hasTemporarySorts={hasTemporarySorts}
            onPickSort={handlePickSort}
            onAddSort={handleAddSort}
            onChangeSortField={handleChangeSortField}
            onChangeDirection={handleChangeDirection}
            onRemoveSort={handleRemoveSort}
            autoSort={autoSort}
            onToggleAutoSort={handleToggleAutoSort}
            onSaveSorts={handleSaveSorts}
            onCancelSorts={handleCancelSorts}
            findMatchCount={findMatches.length}
            findCurrentIndex={currentMatchIndex}
            isSearchPending={isSearchPending}
            onPrevMatch={handlePrevMatch}
            onNextMatch={handleNextMatch}
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
              renamingSidebarViewId={renamingSidebarViewId}
              sidebarRenameValue={sidebarRenameValue}
              setSidebarRenameValue={setSidebarRenameValue}
              startSidebarRename={startSidebarRename}
              commitSidebarRename={commitSidebarRename}
              cancelSidebarRename={cancelSidebarRename}
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
              onAddRow={handleAddRow}
              onInsertRecordAbove={handleInsertRecordAbove}
              onInsertRecordBelow={handleInsertRecordBelow}
              onDuplicateRecord={handleDuplicateRecord}
              onDeleteRecord={handleDeleteRecord}
              onDeleteField={handleDeleteField}
              deletingRowIds={deletingRowIds}
              searchTerm={activeSearchTerm}
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

