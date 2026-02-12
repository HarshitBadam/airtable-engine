"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
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
import type { NumberFormatConfig } from "~/shared/numberUtils";

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
import type { GridBarHandle } from "./GridBar";
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

// Type for table items (from DB)
interface TableItem {
  id: string;
  name: string;
}

export function GridWorkspace({ baseId, tableId }: GridWorkspaceProps) {
  const router = useRouter();
  const utils = api.useUtils();

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
  
  // DB-backed table list
  const tablesQuery = api.table.listByBase.useQuery(
    { baseId },
    { staleTime: 30_000 },
  );
  const tables: TableItem[] = useMemo(
    () => (tablesQuery.data ?? []).map((t) => ({ id: t.id, name: t.name })),
    [tablesQuery.data],
  );
  const activeTableId = tableId; // always driven by the URL
  
  // Table rename popup state
  const [isRenamePopupOpen, setIsRenamePopupOpen] = useState(false);
  const [renamePopupPosition, setRenamePopupPosition] = useState<{ top: number; left: number } | null>(null);
  const [renameTableName, setRenameTableName] = useState('');
  const [renameRecordName, setRenameRecordName] = useState('Record');
  
  // Clear data modal state
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);

  // Freeze column divider state
  const [frozenColCount, setFrozenColCount] = useState(1); // number of frozen data columns (default: freeze first field)
  const isDraggingFreezeRef = useRef(false);
  const freezeDragStartX = useRef(0);
  const freezeDragStartWidth = useRef(0);
  const gridFooterRef = useRef<HTMLDivElement>(null);
  const gridBodyRef = useRef<HTMLDivElement>(null);
  const freezePillRef = useRef<HTMLDivElement>(null);
  const freezeTooltipRef = useRef<HTMLDivElement>(null);
  const freezeLineRef = useRef<HTMLDivElement>(null);
  const gridScrollerRef = useRef<HTMLDivElement>(null);
  const scrollShadowRef = useRef<HTMLDivElement>(null);
  const scrollableHeaderRef = useRef<HTMLDivElement>(null);
  const hScrollRef = useRef<HTMLDivElement>(null);
  const freezeSnapPreviewRef = useRef<HTMLDivElement>(null);
  const freezeDragStartIdx = useRef(0);
  const selectionOverlayRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<GridColumnDef[]>([]);
  const visibleColumnsRef = useRef<GridColumnDef[]>([]);
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

  // Ref for GridBar imperative handle (to open filter/sort panels programmatically)
  const gridBarRef = useRef<GridBarHandle>(null);

  // --- tRPC mutations for table management ---
  const createTableMut = api.table.create.useMutation({
    onSuccess: async (result) => {
      await utils.table.listByBase.invalidate({ baseId });
      const newId = result.table.id;
      router.push(`/bases/${baseId}/tables/${newId}`);
      // Open rename popup after navigation settles
      setTimeout(() => {
        const newTabButton = document.querySelector(`[data-table-id="${newId}"]`);
        if (newTabButton) {
          const tabRect = newTabButton.getBoundingClientRect();
          const transformOffset = 71;
          const minLeftMargin = 8;
          const minLeft = minLeftMargin + transformOffset;
          const left = Math.max(tabRect.left, minLeft);
          setRenamePopupPosition({ top: tabRect.bottom + 8, left });
          setRenameTableName(result.table.name);
          setRenameRecordName('Record');
          setIsRenamePopupOpen(true);
        }
      }, 150);
    },
  });

  const renameTableMut = api.table.rename.useMutation({
    onSuccess: () => utils.table.listByBase.invalidate({ baseId }),
  });

  const deleteTableMut = api.table.delete.useMutation({
    onSuccess: async (_, variables) => {
      await utils.table.listByBase.invalidate({ baseId });
      // Navigate to first remaining table
      const remaining = tables.filter((t) => t.id !== variables.id);
      if (remaining.length > 0) {
        router.push(`/bases/${baseId}/tables/${remaining[0]!.id}`);
      }
    },
  });

  // Add a new table via DB and navigate to it
  const handleAddTable = () => {
    const newName = `Table ${tables.length + 1}`;
    createTableMut.mutate({ baseId, name: newName });
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
  
  // Handle save rename — persist to DB
  const handleSaveRename = () => {
    const trimmed = renameTableName.trim();
    if (trimmed) {
      renameTableMut.mutate({ id: activeTableId, name: trimmed });
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
  
  // Handle confirming delete table — persist to DB
  const handleDeleteTable = () => {
    if (tables.length <= 1) return;
    deleteTableMut.mutate({ id: activeTableId, baseId });
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
  // Stable ref so async callbacks (e.g. insert above/below onSuccess) always read the latest input
  const rowQueryInputRef = useRef(rowQueryInput);
  rowQueryInputRef.current = rowQueryInput;
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
  const rowOrderIdsForSave = useGridStore((s) => s.rowOrderIds);
  const setRowOrderIdsTop = useGridStore((s) => s.setRowOrderIds);
  const filterConditions = useGridStore((s) => s.filterConditions);
  const setFilterConditions = useGridStore((s) => s.setFilterConditions);
  const setColumnOrderIds = useGridStore((s) => s.setColumnOrderIds);

  // Ref so mutation callbacks (which close over stale renders) always read the latest rowOrderIds
  const rowOrderIdsRef = useRef(rowOrderIdsForSave);
  rowOrderIdsRef.current = rowOrderIdsForSave;

  // Stable refs for callbacks passed to memoized GridRow (avoids breaking memo on every render)
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const stableCommit = useCallback(
    (args: { rowId: string; columnId: string; columnType: "TEXT" | "NUMBER"; numberConfig?: unknown }) => commitRef.current(args),
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
  visibleColumnsRef.current = visibleColumns;

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

  // === SORT PERSISTENCE ===
  const autoSort = useGridStore((s) => s.autoSort);
  const setAutoSort = useGridStore((s) => s.setAutoSort);
  const permanentSorts = useGridStore((s) => s.permanentSorts);
  const setPermanentSorts = useGridStore((s) => s.setPermanentSorts);
  const markSortsSaved = useGridStore((s) => s.markSortsSaved);
  const markSaved = useGridStore((s) => s.markSaved);
  const searchForSave = useGridStore((s) => s.search);
  const filtersForSave = useGridStore((s) => s.filters);
  const filterConjunctionForSave = useGridStore((s) => s.filterConjunction);
  const markFiltersSaved = useGridStore((s) => s.markFiltersSaved);
  const activeViewIdFromStore = useGridStore((s) => s.activeViewId);

  // Visual indicators: ONLY when autoSort=true AND there are live sorts
  const effectiveSortCount = autoSort ? currentSorts.length : 0;
  const hasTemporarySorts = autoSort && currentSorts.length > 0;

  // Generic mutation for all sort-related saves
  const sortSaveMut = api.view.update.useMutation({
    onSuccess: () => {
      markSaved();
      void utils.view.list.invalidate({ tableId });
    },
  });

  // Toggle autoSort — persists the toggle + current state immediately
  const handleToggleAutoSort = useCallback(() => {
    const newAutoSort = !autoSort;
    setAutoSort(newAutoSort);

    // Persist immediately so the toggle state survives refresh
    if (activeViewIdFromStore) {
      sortSaveMut.mutate({
        viewId: activeViewIdFromStore,
        config: {
          search: searchForSave,
          filters: filtersForSave,
          filterConjunction: filterConjunctionForSave,
          // When switching to autoSort=false, clear saved temp sorts
          // When switching to autoSort=true, save current entries as temp sorts
          sorts: newAutoSort ? currentSorts : [],
          permanentSorts,
          autoSort: newAutoSort,
          hiddenColumnIds,
          columnOrderIds,
          rowOrderIds: rowOrderIdsForSave,
        },
      });
    }
  }, [autoSort, setAutoSort, activeViewIdFromStore, sortSaveMut, searchForSave, filtersForSave, filterConjunctionForSave, currentSorts, permanentSorts, hiddenColumnIds, columnOrderIds, rowOrderIdsForSave]);

  // "Sort" button (autoSort=false): apply staged entries as permanent sorts
  const handleSaveSorts = useCallback(() => {
    if (!activeViewIdFromStore) return;
    const newPermanentSorts = currentSorts;
    setPermanentSorts(newPermanentSorts);
    // Entries stay visible in panel — only removed via X
    sortSaveMut.mutate({
      viewId: activeViewIdFromStore,
      config: {
        search: searchForSave,
        filters: filtersForSave,
        filterConjunction: filterConjunctionForSave,
        sorts: [],
        permanentSorts: newPermanentSorts,
        autoSort: false,
        hiddenColumnIds,
        columnOrderIds,
        rowOrderIds: rowOrderIdsForSave,
      },
    });
  }, [activeViewIdFromStore, currentSorts, searchForSave, filtersForSave, filterConjunctionForSave, hiddenColumnIds, columnOrderIds, rowOrderIdsForSave, setPermanentSorts, sortSaveMut]);

  // "Cancel" button (autoSort=false): revert staged entries to permanentSorts
  const handleCancelSorts = useCallback(() => {
    setSorts(permanentSorts);
  }, [setSorts, permanentSorts]);

  // === AUTO-SAVE LAYOUT CHANGES (column order + visibility) ===
  // In Airtable, column reorder and hide/show changes are persisted immediately.
  // We debounce-save whenever columnOrderIds or hiddenColumnIds change.
  const layoutAutoSaveMut = api.view.update.useMutation({
    onSuccess: () => {
      markSaved();
      void utils.view.list.invalidate({ tableId });
    },
  });

  // Ref keeps the latest full config so debounced auto-saves never use stale values.
  // autoSort=true  → sorts = currentSorts (persist temp sorts for refresh)
  // autoSort=false → sorts = []           (staging only, not persisted)
  const sortsForConfig = autoSort ? currentSorts : [];
  const latestConfigRef = useRef({
    search: searchForSave,
    filters: filtersForSave,
    filterConjunction: filterConjunctionForSave,
    sorts: sortsForConfig,
    permanentSorts,
    autoSort,
    hiddenColumnIds,
    columnOrderIds,
    rowOrderIds: rowOrderIdsForSave,
  });
  latestConfigRef.current = {
    search: searchForSave,
    filters: filtersForSave,
    filterConjunction: filterConjunctionForSave,
    sorts: sortsForConfig,
    permanentSorts,
    autoSort,
    hiddenColumnIds,
    columnOrderIds,
    rowOrderIds: rowOrderIdsForSave,
  };

  // Per-view baseline to distinguish "view loaded" from "user changed layout"
  const layoutBaselineRef = useRef<string>("");
  const layoutTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!activeViewIdFromStore) return;

    const layoutKey = `${activeViewIdFromStore}|${columnOrderIds.join(",")}|${hiddenColumnIds.join(",")}|${rowOrderIdsForSave.join(",")}`;

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
      // Skip if a column creation is in-flight (columnOrderIds contains temp IDs)
      if (isCreatingColumnRef.current) return;
      layoutBaselineRef.current = layoutKey;
      layoutAutoSaveMut.mutate({
        viewId: activeViewIdFromStore,
        config: latestConfigRef.current,
      });
    }, 400);

    return () => clearTimeout(layoutTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnOrderIds, hiddenColumnIds, rowOrderIdsForSave, activeViewIdFromStore]);

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

  // === AUTO-SAVE SORT CHANGES (autoSort=true only) ===
  // When autoSort is ON, sorts persist across sessions (like filters).
  // When autoSort is OFF, sorts are staged — only persisted via "Sort" button.
  const sortAutoSaveMut = api.view.update.useMutation({
    onSuccess: () => {
      markSortsSaved();
      void utils.view.list.invalidate({ tableId });
    },
  });

  const sortBaselineRef = useRef<string>("");
  const sortTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Key includes autoSort so toggling back to true triggers a save of current entries
  const sortKey = `${activeViewIdFromStore}|${autoSort}|${JSON.stringify(currentSorts)}`;

  useEffect(() => {
    if (!activeViewIdFromStore) return;

    // autoSort=false → sorts are staged, never auto-saved. Just track baseline.
    if (!autoSort) {
      sortBaselineRef.current = sortKey;
      return;
    }

    // On view switch (or first render), record baseline and skip
    if (!sortBaselineRef.current.startsWith(activeViewIdFromStore + "|")) {
      sortBaselineRef.current = sortKey;
      return;
    }

    // Nothing changed
    if (sortKey === sortBaselineRef.current) return;

    // Debounce 400ms then save
    clearTimeout(sortTimerRef.current);
    sortTimerRef.current = setTimeout(() => {
      if (!activeViewIdFromStore) return;
      sortBaselineRef.current = sortKey;
      sortAutoSaveMut.mutate({
        viewId: activeViewIdFromStore,
        config: latestConfigRef.current,
      });
    }, 400);

    return () => clearTimeout(sortTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, activeViewIdFromStore, autoSort]);

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

    // Use visibleColumns (view-ordered, hidden-filtered) so overlay position
    // matches the actual rendered grid layout — NOT the raw DB-ordered column list.
    const cols = visibleColumnsRef.current;
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

    const cols = visibleColumnsRef.current;
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
    const tooltip = freezeTooltipRef.current;
    if (!body || !pill) return;
    const rect = body.getBoundingClientRect();
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    pill.style.top = `${y}px`;
    if (tooltip) {
      tooltip.style.top = `${y}px`;
    }
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
      // Optimistically add the new view to the cache so the guard effect
      // (which snaps to views[0] when activeViewId isn't found) doesn't
      // reset us before the invalidation resolves.
      utils.view.list.setData({ tableId }, (old) => {
        if (!old) return undefined;
        if (old.some((v) => v.id === newView.id)) return old;
        return [...old, { ...newView, createdAt: new Date(), updatedAt: new Date() }];
      });
      setActiveViewId(newView.id);
      setIsCreateViewBoxOpen(false);
      // Then refetch to get the authoritative server state
      void utils.view.list.invalidate({ tableId });
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

  // (Insert above/below uses addRowMut + insertRowAndPosition helper below)

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

      // Pass the source rowId through context so onSuccess can update rowOrderIds
      return { prev, sourceRowId: vars.rowId };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) {
        utils.row.infinite.setInfiniteData(rowQueryInput, ctx.prev);
      }
    },
    onSuccess: (data, _vars, ctx) => {
      // If the view has a custom rowOrderIds, insert the duplicate right after the source row
      const currentOrder = rowOrderIdsRef.current;
      if (ctx?.sourceRowId && currentOrder.length > 0) {
        const order = [...currentOrder];
        const sourceIdx = order.indexOf(ctx.sourceRowId);
        if (sourceIdx !== -1) {
          order.splice(sourceIdx + 1, 0, data.id);
          setRowOrderIdsTop(order);
        }
      }
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

  // Row reordering is view-scoped: we rearrange the view's rowOrderIds
  // instead of modifying the global rowIndex in the database.
  // rowOrderIdsForSave and setRowOrderIdsTop are already declared at the top of the component.

  // Determine whether drag-to-reorder should be active:
  // Only when there are no active sorts (autoSort=true with sorts) and no active filters.
  const canDragRows = !hasTemporarySorts && filtersForSave.length === 0;

  const handleReorderRow = useCallback(
    (rowId: string, fromVisualIdx: number, toVisualIdx: number) => {
      if (fromVisualIdx === toVisualIdx) return;

      // Build the current display-order row IDs.
      // If rowOrderIds is empty (no custom order yet), lazy-initialize from loaded rows.
      let currentOrder = rowOrderIdsForSave.length > 0
        ? [...rowOrderIdsForSave]
        : rows.map((r) => r.id);

      // Ensure the dragged row exists in the order
      const fromIdx = currentOrder.indexOf(rowId);
      if (fromIdx === -1) return;

      // Remove from old position and insert at new position
      currentOrder.splice(fromIdx, 1);
      const insertAt = Math.min(toVisualIdx, currentOrder.length);
      currentOrder.splice(insertAt, 0, rowId);

      // Update the store (triggers auto-save via the layout effect).
      // useGridRows applies rowOrderIds client-side, so the grid re-renders immediately.
      // IMPORTANT: We do NOT modify the TanStack Query cache here because
      // the cache is shared across views (keyed by tableId + filters + sorts,
      // not by viewId). Modifying it would make row reordering leak into other views.
      setRowOrderIdsTop(currentOrder);
    },
    [rows, rowOrderIdsForSave, setRowOrderIdsTop],
  );

  // === COLUMN MUTATIONS ===

  // Refs for latest Zustand state (avoids stale closures in mutation callbacks)
  const columnOrderIdsRef = useRef(columnOrderIds);
  columnOrderIdsRef.current = columnOrderIds;
  const hiddenColumnIdsRef = useRef(hiddenColumnIds);
  hiddenColumnIdsRef.current = hiddenColumnIds;
  const currentSortsRef = useRef(currentSorts);
  currentSortsRef.current = currentSorts;
  const filtersRef = useRef(filtersForSave);
  filtersRef.current = filtersForSave;

  const setFilters = useGridStore((s) => s.setFilters);

  // Counter for generating unique temp IDs for optimistic column creation
  const tempColCounter = useRef(0);

  // Guard: suppress layout auto-save while a column creation is in-flight
  // (the optimistic columnOrderIds contains a temp ID that must NOT leak to the server).
  const isCreatingColumnRef = useRef(false);

  // Create column — optimistic: add a placeholder column INSTANTLY, then reconcile with server
  const createColumnMut = api.column.create.useMutation({
    onMutate: async (vars) => {
      // Suppress layout auto-save while temp IDs are in columnOrderIds
      isCreatingColumnRef.current = true;

      // Generate a deterministic temporary ID
      const tempId = `__temp_col_${++tempColCounter.current}_${Date.now()}`;

      // Cancel in-flight queries so our optimistic data isn't overwritten
      await utils.column.list.cancel({ tableId });

      // Snapshot previous state for rollback
      const prevCols = utils.column.list.getData({ tableId });
      const prevOrderIds = columnOrderIdsRef.current;
      const prevRows = utils.row.infinite.getInfiniteData(rowQueryInput);

      // Optimistically add the temp column to the column list cache
      const tempCol = {
        id: tempId,
        name: vars.name,
        type: vars.type,
        order: 999999,
        defaultValue: vars.defaultValue ?? null,
        config: vars.numberConfig ? (vars.numberConfig as unknown as object) : null,
      };
      utils.column.list.setData({ tableId }, (old) => {
        if (!old) return [tempCol];
        return [...old, tempCol];
      });

      // Append the temp column to the Zustand store's columnOrderIds
      // (or insert it at the correct position if insert-field target is set)
      const currentOrder = columnOrderIdsRef.current;
      if (currentOrder.length > 0) {
        const target = insertFieldTargetRef.current;
        if (target) {
          const anchorIdx = currentOrder.indexOf(target.anchorColId);
          if (anchorIdx !== -1) {
            const insertIdx = target.side === "right" ? anchorIdx + 1 : anchorIdx;
            const newOrder = [...currentOrder];
            newOrder.splice(insertIdx, 0, tempId);
            setColumnOrderIds(newOrder);
          } else {
            setColumnOrderIds([...currentOrder, tempId]);
          }
          insertFieldTargetRef.current = null;
        } else {
          setColumnOrderIds([...currentOrder, tempId]);
        }
      }

      // If a default value is provided, stamp it into every cached row
      if (vars.defaultValue && vars.defaultValue.trim() !== "") {
        // For NUMBER columns, store the value as an actual number if possible
        const cellValue: string | number =
          vars.type === "NUMBER" && !isNaN(Number(vars.defaultValue))
            ? Number(vars.defaultValue)
            : vars.defaultValue;

        utils.row.infinite.setInfiniteData(rowQueryInput, (old): RowInfiniteData | undefined => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((r) => {
                const cells = (r.cells ?? {}) as Record<string, unknown>;
                return { ...r, cells: { ...cells, [tempId]: cellValue } };
              }),
            })),
          };
        });
      }

      // If duplicating a field, optimistically copy cell values from the source column
      if (vars.sourceColumnId) {
        utils.row.infinite.setInfiniteData(rowQueryInput, (old): RowInfiniteData | undefined => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((r) => {
                const cells = (r.cells ?? {}) as Record<string, unknown>;
                const srcVal = cells[vars.sourceColumnId!];
                if (srcVal === undefined) return r;
                return { ...r, cells: { ...cells, [tempId]: srcVal } };
              }),
            })),
          };
        });
      }

      return { tempId, prevCols, prevOrderIds, prevRows };
    },
    onSuccess: (newCol, _vars, ctx) => {
      if (!ctx) return;
      const { tempId } = ctx;

      // Replace the temp column with the real one in the column list cache
      utils.column.list.setData({ tableId }, (old) => {
        if (!old) return old;
        return old.map((c) =>
          c.id === tempId
            ? { id: newCol.id, name: newCol.name, type: newCol.type, order: newCol.order, defaultValue: newCol.defaultValue, config: newCol.config }
            : c,
        );
      });

      // Replace the temp ID with the real ID in the Zustand store's columnOrderIds
      const currentOrder = columnOrderIdsRef.current;
      const idx = currentOrder.indexOf(tempId);
      if (idx !== -1) {
        const updated = [...currentOrder];
        updated[idx] = newCol.id;
        setColumnOrderIds(updated);
      }

      // Remap temp column ID → real column ID in cached row data (avoids
      // a full refetch which would flash default values out then back in).
      utils.row.infinite.setInfiniteData(rowQueryInput, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((r) => {
              const cells = (r.cells ?? {}) as Record<string, unknown>;
              if (!(tempId in cells)) return r;
              const { [tempId]: val, ...rest } = cells;
              return { ...r, cells: { ...rest, [newCol.id]: val } };
            }),
          })),
        };
      });

      // Also update the activeCell if it was referencing the temp column
      const ac = activeCellRef.current;
      if (ac && ac.columnId === tempId) {
        setActiveCell({ rowId: ac.rowId, columnId: newCol.id });
      }

      // Temp → real swap is complete; allow layout auto-save again
      isCreatingColumnRef.current = false;

      // Re-fetch views so the persisted columnOrderIds are in sync
      void utils.view.list.invalidate({ tableId });
    },
    onError: (_err, _vars, ctx) => {
      // Column creation failed; allow layout auto-save again
      isCreatingColumnRef.current = false;
      if (!ctx) return;
      // Rollback column cache
      if (ctx.prevCols) utils.column.list.setData({ tableId }, ctx.prevCols);
      // Rollback Zustand store
      setColumnOrderIds(ctx.prevOrderIds);
      // Rollback row cache
      if (ctx.prevRows) utils.row.infinite.setInfiniteData(rowQueryInput, ctx.prevRows);
    },
  });

  // Delete column (PERMANENT, table-level) — removes the column from the table
  // and all views' configs. This is the correct "Delete field" action since
  // field creation/deletion is table-level and affects ALL views.
  const deleteColumnMut = api.column.delete.useMutation({
    onMutate: async (vars) => {
      // Cancel both queries
      await Promise.all([
        utils.column.list.cancel({ tableId }),
        utils.row.infinite.cancel(rowQueryInput),
      ]);

      const prevCols = utils.column.list.getData({ tableId });
      const prevRows = utils.row.infinite.getInfiniteData(rowQueryInput);

      // Snapshot Zustand state for rollback
      const prevOrderIds = columnOrderIdsRef.current;
      const prevHiddenIds = hiddenColumnIdsRef.current;
      const prevSorts = currentSortsRef.current;
      const prevFilters = filtersRef.current;

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

      // Optimistically update Zustand store: remove from columnOrderIds & hiddenColumnIds
      setColumnOrderIds(prevOrderIds.filter((id: string) => id !== vars.columnId));
      setHiddenColumnIds(prevHiddenIds.filter((id: string) => id !== vars.columnId));

      // Clean sorts/filters referencing this column
      const newSorts = prevSorts.filter((s) => s.columnId !== vars.columnId);
      if (newSorts.length !== prevSorts.length) setSorts(newSorts);
      const newFilters = prevFilters.filter((f) => f.columnId !== vars.columnId);
      if (newFilters.length !== prevFilters.length) setFilters(newFilters);

      return { prevCols, prevRows, prevOrderIds, prevHiddenIds, prevSorts, prevFilters };
    },
    onError: (_e, _v, ctx) => {
      if (!ctx) return;
      if (ctx.prevCols) {
        utils.column.list.setData({ tableId }, ctx.prevCols);
      }
      if (ctx.prevRows) {
        utils.row.infinite.setInfiniteData(rowQueryInput, ctx.prevRows);
      }
      // Rollback Zustand store
      setColumnOrderIds(ctx.prevOrderIds);
      setHiddenColumnIds(ctx.prevHiddenIds);
      setSorts(ctx.prevSorts);
      setFilters(ctx.prevFilters);
    },
    onSuccess: () => {
      // Re-sync with server (column list, rows, and views since server cleans all view configs)
      void utils.column.list.invalidate({ tableId });
      void utils.row.infinite.invalidate(rowQueryInput);
      void utils.view.list.invalidate({ tableId });
    },
  });

  // Update column (rename / change number config)
  const updateColumnMut = api.column.update.useMutation({
    onMutate: async (vars) => {
      // Cancel column list query and optimistically update
      await utils.column.list.cancel({ tableId });
      const prevCols = utils.column.list.getData({ tableId });
      if (prevCols) {
        utils.column.list.setData({ tableId }, prevCols.map((c) =>
          c.id === vars.columnId
            ? { ...c, ...(vars.name !== undefined ? { name: vars.name } : {}), ...(vars.numberConfig !== undefined ? { config: vars.numberConfig } : {}) }
            : c,
        ));
      }
      return { prevCols };
    },
    onError: (_err, _vars, ctx) => {
      // Rollback
      if (ctx?.prevCols) utils.column.list.setData({ tableId }, ctx.prevCols);
    },
    onSuccess: () => {
      void utils.column.list.invalidate({ tableId });
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

  // Helper: after addMany creates a row at the end of the table, refetch the data,
  // then update rowOrderIds to position it correctly in the current view.
  // Other views naturally show it at the end (highest rowIndex, not in their rowOrderIds).
  const insertRowAndPosition = useCallback(
    async (targetRowId: string, direction: "above" | "below", newRowIndex: number) => {
      // Wait for server data to be refetched
      await utils.row.infinite.invalidate({ tableId });

      // Read the fresh data directly from the TanStack Query cache
      const freshData = utils.row.infinite.getInfiniteData(rowQueryInputRef.current);
      if (!freshData) return;

      const flat = freshData.pages.flatMap((p) => p.items);
      const newRow = flat.find((r) => r.rowIndex === newRowIndex);
      if (!newRow) return;

      // Build rowOrderIds, placing the new row at the correct position.
      // If rowOrderIds is empty (no custom order), lazy-init from current rows.
      const currentOrder = rowOrderIdsRef.current;
      const baseOrder =
        currentOrder.length > 0
          ? [...currentOrder]
          : flat.filter((r) => r.id !== newRow.id).map((r) => r.id);

      // Remove the new row if already present (safety)
      const cleaned = baseOrder.filter((id) => id !== newRow.id);

      // Insert adjacent to the target row
      const targetIdx = cleaned.indexOf(targetRowId);
      if (targetIdx !== -1) {
        const insertAt = direction === "above" ? targetIdx : targetIdx + 1;
        cleaned.splice(insertAt, 0, newRow.id);
      } else {
        // Target not found (edge case) — append at end
        cleaned.push(newRow.id);
      }

      setRowOrderIdsTop(cleaned);

      // Auto-edit: focus the first visible cell of the NEW row.
      // Use requestAnimationFrame so React renders the repositioned row first.
      const firstCol = visibleColumnsRef.current[0];
      if (firstCol) {
        requestAnimationFrame(() => {
          setActiveCell({ rowId: newRow.id, columnId: firstCol.id });
          startEditing({ rowId: newRow.id, columnId: firstCol.id }, '');
        });
      }
    },
    [tableId, utils, setRowOrderIdsTop, setActiveCell, startEditing],
  );

  // === INSERT RECORD ABOVE ===
  const handleInsertRecordAbove = useCallback((rowId: string) => {
    if (!isValidTable) return;
    addRowMut.mutate({ tableId, count: 1 }, {
      onSuccess: (data) => {
        void insertRowAndPosition(rowId, "above", data.startRowIndex);
      },
    });
  }, [isValidTable, tableId, addRowMut, insertRowAndPosition]);

  // === INSERT RECORD BELOW ===
  const handleInsertRecordBelow = useCallback((rowId: string) => {
    if (!isValidTable) return;
    addRowMut.mutate({ tableId, count: 1 }, {
      onSuccess: (data) => {
        void insertRowAndPosition(rowId, "below", data.startRowIndex);
      },
    });
  }, [isValidTable, tableId, addRowMut, insertRowAndPosition]);

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

    // 2) Remove the deleted row from the per-view rowOrderIds (if custom order exists)
    const currentOrder = rowOrderIdsRef.current;
    if (currentOrder.length > 0 && currentOrder.includes(rowId)) {
      setRowOrderIdsTop(currentOrder.filter((id) => id !== rowId));
    }

    // 3) After animation completes, remove from cache and fire the server mutation
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
  }, [isValidTable, tableId, activeCell, clearSelection, deleteRowMut, utils, rowQueryInput, setRowOrderIdsTop]);

  // === DELETE FIELD (table-level — removes column from the table and all views) ===
  const handleDeleteField = useCallback((columnId: string) => {
    if (!isValidTable) return;
    if (activeCell?.columnId === columnId) clearSelection();
    deleteColumnMut.mutate({ tableId, columnId });
  }, [isValidTable, tableId, activeCell, clearSelection, deleteColumnMut]);

  // === CREATE FIELD (table-level — adds column to table + ALL views' columnOrderIds) ===
  // Track insert-field target for Insert left/right (used in onMutate to reorder)
  const insertFieldTargetRef = useRef<{ anchorColId: string; side: "left" | "right" } | null>(null);

  const handleCreateField = useCallback((name: string, type: string, defaultValue: string, numberConfig?: NumberFormatConfig, insertPosition?: { anchorColId: string; side: "left" | "right" }) => {
    if (!isValidTable) return;
    // Store insert position for the optimistic handler (current view only)
    insertFieldTargetRef.current = insertPosition ?? null;
    // Map UI type label to DB column type
    const dbType: "TEXT" | "NUMBER" = type === "Number" ? "NUMBER" : "TEXT";
    const fieldName = name.trim() || (dbType === "NUMBER" ? "Number" : "Field");
    createColumnMut.mutate({
      tableId,
      name: fieldName,
      type: dbType,
      defaultValue: defaultValue.trim() || undefined,
      numberConfig: numberConfig ?? undefined,
      viewId: activeViewIdFromStore ?? undefined,
      // Pass insert position to the server so ALL views insert relative to the anchor
      anchorColumnId: insertPosition?.anchorColId ?? undefined,
      insertSide: insertPosition?.side ?? undefined,
    });
  }, [isValidTable, tableId, activeViewIdFromStore, createColumnMut]);

  // === EDIT FIELD (rename / update config via header dropdown → Edit field) ===
  const handleEditFieldSave = useCallback((columnId: string, name: string, numberConfig?: NumberFormatConfig) => {
    if (!isValidTable) return;
    const fieldName = name.trim();
    updateColumnMut.mutate({
      tableId,
      columnId,
      name: fieldName || undefined,
      numberConfig: numberConfig ?? undefined,
    });
  }, [isValidTable, tableId, updateColumnMut]);

  // === HIDE FIELD (from column header dropdown menu) ===
  const handleHideField = useCallback((columnId: string) => {
    toggleHiddenColumn(columnId);
  }, [toggleHiddenColumn]);

  // === FILTER BY FIELD (from column header dropdown menu) ===
  const handleFilterByField = useCallback((columnId: string) => {
    const col = orderedColumns.find((c) => c.id === columnId);
    if (!col) return;
    const colType = col.type;
    const defaultOp = colType === "NUMBER" ? "equals" : "contains";
    // Add a new filter condition for this column
    const existingConditions = filterConditions ?? [];
    const newCondition = {
      id: crypto.randomUUID(),
      columnId,
      operator: defaultOp,
      value: "",
      conjunction: "and" as const,
    };
    setFilterConditions([...existingConditions, newCondition]);
    // Open the filter panel via the GridBar imperative handle
    gridBarRef.current?.openFilterPanel();
  }, [orderedColumns, filterConditions, setFilterConditions]);

  // === SORT BY FIELD (from column header dropdown menu) ===
  const handleSortByField = useCallback((columnId: string, direction: "asc" | "desc") => {
    const col = orderedColumns.find((c) => c.id === columnId);
    if (!col) return;
    const colType: "TEXT" | "NUMBER" = col.type === "NUMBER" ? "NUMBER" : "TEXT";
    // Check if there's already a sort for this column and update it, otherwise add
    const existing = currentSorts.findIndex((s) => s.columnId === columnId);
    let newSorts;
    if (existing !== -1) {
      newSorts = currentSorts.map((s, i) => i === existing ? { ...s, direction } : s);
    } else {
      newSorts = [...currentSorts, { columnId, direction, type: colType }];
    }
    setSorts(newSorts);
    // Open the sort panel via the GridBar imperative handle
    gridBarRef.current?.openSortPanel();
  }, [orderedColumns, currentSorts, setSorts]);

  // === DUPLICATE FIELD (from column header dropdown menu) ===
  const handleDuplicateField = useCallback((columnId: string, duplicateCells: boolean) => {
    if (!isValidTable) return;
    const col = orderedColumns.find((c) => c.id === columnId);
    if (!col) return;
    const dbType: "TEXT" | "NUMBER" = col.type === "NUMBER" ? "NUMBER" : "TEXT";
    const copyName = `${col.name} copy`;
    // Store insert position so the optimistic handler places it next to the original
    insertFieldTargetRef.current = { anchorColId: columnId, side: "right" };
    createColumnMut.mutate({
      tableId,
      name: copyName,
      type: dbType,
      numberConfig: col.config ? (col.config as { decimalPlaces: number; thousandsSep: string; showThousands: boolean; largeNumAbbrev: string | null; allowNegative: boolean }) : undefined,
      viewId: activeViewIdFromStore ?? undefined,
      sourceColumnId: duplicateCells ? columnId : undefined,
    });
  }, [isValidTable, orderedColumns, tableId, activeViewIdFromStore, createColumnMut]);

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

  // Handle table selection from dropdown — navigate to the table's URL
  const handleTableSelect = (selectedTableId: string) => {
    router.push(`/bases/${baseId}/tables/${selectedTableId}`);
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
            setActiveTableId={(id: string) => router.push(`/bases/${baseId}/tables/${id}`)}
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
            ref={gridBarRef}
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
              freezeTooltipRef={freezeTooltipRef}
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
              onHideField={handleHideField}
              onSortByField={handleSortByField}
              onFilterByField={handleFilterByField}
              onDuplicateField={handleDuplicateField}
              onCreateField={handleCreateField}
              onEditFieldSave={handleEditFieldSave}
              deletingRowIds={deletingRowIds}
              searchTerm={activeSearchTerm}
              onReorderRow={handleReorderRow}
              canDragRows={canDragRows}
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

