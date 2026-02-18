"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { skipToken } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import type { inferProcedureOutput } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import type { RowItem } from "~/components/grid/useGridRows";
import { useCellEditing } from "~/components/grid/useCellEditing";
import { useGridStore, useGridStoreApi } from "~/components/grid/grid-store";
import { useGridTable } from "~/components/grid/useGridTable";
import { normalizeViewConfig } from "~/shared/grid";
import { reconcileColumnOrder } from "~/components/grid/useGridMeta";
import type { NumberFormatConfig } from "~/shared/numberUtils";
import { reorderRowInCache } from "~/components/grid/sortReorder";

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

type RowInfinitePage = inferProcedureOutput<AppRouter["row"]["infinite"]>;
type RowInfiniteCursor = RowInfinitePage["nextCursor"];
type RowInfiniteData = InfiniteData<RowInfinitePage, RowInfiniteCursor>;

const ROW_NUM_WIDTH = 83;   // 44px cell + 39px margin-right
const COLUMN_WIDTH = 180;   // each column header total width (border-box)
const OVERSCAN_COUNT = 15;  // extra rows rendered above/below viewport

/** Row height presets matching Airtable's "Select a row height" dropdown. */
// Type re-exported from shared/grid.ts for convenience
export type { RowHeightPreset } from "~/shared/grid";
import type { RowHeightPreset } from "~/shared/grid";
const ROW_HEIGHT_VALUES: Record<RowHeightPreset, number> = {
  short: 32,
  medium: 56,
  tall: 88,
  extraTall: 128,
};

interface GridWorkspaceProps {
  baseId: string;
  tableId: string;
}

interface TableItem {
  id: string;
  name: string;
}

// Module-level flag so the pending-rename survives component remounts
// caused by router.push navigation.
let _pendingRenameTableId: string | null = null;

export function GridWorkspace({ baseId, tableId }: GridWorkspaceProps) {
  const router = useRouter();
  const utils = api.useUtils();

  // Persist last-visited table for this base
  useEffect(() => {
    localStorage.setItem(`base-lastTable-${baseId}`, tableId);
  }, [baseId, tableId]);

  // Save scroll position on unmount so it persists when navigating away.
  // We track the current viewId in a ref so the cleanup closure reads the latest value.
  const unmountViewIdRef = useRef<string | null>(null);

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
  
  const tablesQuery = api.table.listByBase.useQuery(
    { baseId },
    { staleTime: 30_000 },
  );
  const tables: TableItem[] = useMemo(
    () => (tablesQuery.data ?? []).map((t) => ({ id: t.id, name: t.name })),
    [tablesQuery.data],
  );
  const activeTableId = tableId;
  const gridStoreApi = useGridStoreApi();
  
  const [isRenamePopupOpen, setIsRenamePopupOpen] = useState(false);
  const [renamePopupPosition, setRenamePopupPosition] = useState<{ top: number; left: number } | null>(null);
  const [renameTableName, setRenameTableName] = useState('');
  const [renameRecordName, setRenameRecordName] = useState('Record');
  
  const [showDuplicateTooltip, setShowDuplicateTooltip] = useState(false);
  const duplicateTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);

  const [frozenColCount, setFrozenColCount] = useState(1);
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

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const columnWidthsRef = useRef<Record<string, number>>({});
  columnWidthsRef.current = columnWidths;
  const getColWidth = useCallback((colId: string) => columnWidths[colId] ?? COLUMN_WIDTH, [columnWidths]);

  const [rowHeight, setRowHeight] = useState(32);
  const rowHeightRef = useRef(32);
  rowHeightRef.current = rowHeight;

  const rowHeightPreset = useGridStore((s) => s.rowHeightPreset);
  const setRowHeightPreset = useGridStore((s) => s.setRowHeightPreset);
  const dataRowHeight = ROW_HEIGHT_VALUES[rowHeightPreset];
  const dataRowHeightRef = useRef(dataRowHeight);
  dataRowHeightRef.current = dataRowHeight;

  const wrapHeaders = useGridStore((s) => s.wrapHeaders);
  const setWrapHeaders = useGridStore((s) => s.setWrapHeaders);

  const [isDeleteTablePopupOpen, setIsDeleteTablePopupOpen] = useState(false);
  const [deleteTablePopupPosition, setDeleteTablePopupPosition] = useState<{ top: number; left: number } | null>(null);

  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);

  const gridBarRef = useRef<GridBarHandle>(null);

  const createTableMut = api.table.create.useMutation({
    onSuccess: async (result) => {
      await utils.table.listByBase.invalidate({ baseId });
      _pendingRenameTableId = result.table.id;
      router.push(`/bases/${baseId}/tables/${result.table.id}`);
    },
  });

  const renameTableMut = api.table.rename.useMutation({
    onSuccess: () => utils.table.listByBase.invalidate({ baseId }),
  });

  const deleteTableMut = api.table.delete.useMutation({
    onSuccess: async (_, variables) => {
      await utils.table.listByBase.invalidate({ baseId });
      const remaining = tables.filter((t) => t.id !== variables.id);
      if (remaining.length > 0) {
        router.push(`/bases/${baseId}/tables/${remaining[0]!.id}`);
      }
    },
  });

  // Create a new table and navigate to it; rename popup opens via useEffect below
  const handleAddTable = () => {
    const existingNames = new Set(tables.map(t => t.name));
    let num = tables.length + 1;
    let newName = `Table ${num}`;
    while (existingNames.has(newName)) {
      num++;
      newName = `Table ${num}`;
    }
    createTableMut.mutate({ baseId, name: newName });
  };
  
  const handleOpenRenamePopup = () => {
    const activeTable = tables.find(t => t.id === activeTableId);
    if (activeTable && tableTitleDropdownButtonRef.current) {
      const parentTab = tableTitleDropdownButtonRef.current.closest('[data-table-tab]');
      if (parentTab) {
        const tabRect = parentTab.getBoundingClientRect();
        const transformOffset = 72;
        const minLeftMargin = 12;
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
  
  const handleSaveRename = () => {
    const trimmed = renameTableName.trim();
    if (!trimmed) return;

    const isDuplicate = tables.some(t => t.id !== activeTableId && t.name === trimmed);
    if (isDuplicate) {
      setShowDuplicateTooltip(true);
      if (duplicateTooltipTimerRef.current) clearTimeout(duplicateTooltipTimerRef.current);
      duplicateTooltipTimerRef.current = setTimeout(() => setShowDuplicateTooltip(false), 10000);
      return;
    }

    setShowDuplicateTooltip(false);
    if (duplicateTooltipTimerRef.current) clearTimeout(duplicateTooltipTimerRef.current);
    renameTableMut.mutate({ id: activeTableId, name: trimmed });
    setIsRenamePopupOpen(false);
    setRenamePopupPosition(null);
  };
  
  const handleCancelRename = () => {
    setIsRenamePopupOpen(false);
    setRenamePopupPosition(null);
    setShowDuplicateTooltip(false);
    if (duplicateTooltipTimerRef.current) clearTimeout(duplicateTooltipTimerRef.current);
  };
  
  const handleOpenClearDataModal = () => {
    setIsTableTitleDropdownOpen(false);
    setIsClearDataModalOpen(true);
  };
  
  const handleCloseClearDataModal = () => {
    setIsClearDataModalOpen(false);
  };
  
  const handleClearData = () => {
    setIsClearDataModalOpen(false);
  };
  
  const handleOpenDeleteTablePopup = (event: React.MouseEvent<HTMLLIElement>) => {
    if (tables.length <= 1) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    setDeleteTablePopupPosition({
      top: rect.bottom + 8 - 439,
      left: rect.left - 12,
    });
    setIsTableTitleDropdownOpen(false);
    setIsDeleteTablePopupOpen(true);
  };
  
  const handleCloseDeleteTablePopup = () => {
    setIsDeleteTablePopupOpen(false);
    setDeleteTablePopupPosition(null);
  };
  
  const handleDeleteTable = () => {
    if (tables.length <= 1) return;
    deleteTableMut.mutate({ id: activeTableId, baseId });
    setIsDeleteTablePopupOpen(false);
    setDeleteTablePopupPosition(null);
  };

  const { data: base } = api.base.getById.useQuery(
    { id: baseId },
    { staleTime: 60_000 }
  );
  
  const baseColor = getBaseColor(baseId);
  const baseBorderColor = getBaseBorderColor(baseId);
  const baseTextColor = getBaseTextColor(baseId);
  const baseName = base?.name ?? "Loading...";

  const activeTableName = tables.find(t => t.id === activeTableId)?.name ?? "Table";
  useEffect(() => {
    if (baseName && baseName !== "Loading...") {
      document.title = `${baseName}: ${activeTableName} - Airtable`;
    } else {
      document.title = `${activeTableName} - Airtable`;
    }
  }, [baseName, activeTableName]);

  useEffect(() => {
    if (!baseName || baseName === "Loading...") return;

    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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

    const initials = baseName.slice(0, 2);
    ctx.fillStyle = baseTextColor;
    ctx.font = "500 46px -apple-system, system-ui, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, size / 2, size / 2 + 4);

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

  const isValidTable = tableId !== "default";
  const colsQ = api.column.list.useQuery(
    isValidTable ? { tableId } : skipToken,
    { staleTime: 60_000 },
  );
  const columns = colsQ.data ?? [];
  columnsRef.current = columns;

  const {
    rows, totalCount, q: rowsQ, input: rowQueryInput, debouncedSearch,
    getRowAtIndex, getRowById, triggerJumpFetch,
    clearJumpCache, updateJumpCacheRow, addToJumpCache, insertIntoJumpCache,
    removeFromJumpCache, reorderJumpCacheRow,
    addProtectedRowId, removeProtectedRowId, isRowProtected,
    jumpCacheRef, jumpCache,
  } = useGridRows(tableId);
  rowsRef.current = rows;

  // Truncate to page 0 then invalidate — avoids refetching all cached pages.
  // Jump cache is NOT cleared (preserves optimistic rows; stale entries get overwritten).
  const refreshRows = useCallback((rowCountDelta = 0) => {
    utils.row.infinite.setInfiniteData(rowQueryInput, (old) => {
      if (!old?.pages?.length) return old;
      return {
        pages: old.pages.slice(0, 1).map((page) => ({
          ...page,
          totalCount: page.totalCount + rowCountDelta,
        })),
        pageParams: old.pageParams.slice(0, 1),
      } as typeof old;
    });
    void utils.row.infinite.invalidate();

    // If the user is scrolled beyond the first page (e.g. at row 99K),
    // trigger a forced windowFetch for the current scroll position so the
    // visible data is refreshed from the server. force=true bypasses the
    // "already cached" guard so stale jump cache entries get overwritten.
    requestAnimationFrame(() => {
      const scroller = gridScrollerRef.current;
      if (!scroller) return;
      const approxOffset = Math.floor(scroller.scrollTop / dataRowHeightRef.current);
      if (approxOffset > 0) {
        triggerJumpFetch(approxOffset, true);
      }
    });
  }, [utils, rowQueryInput, triggerJumpFetch]);

  // After a cell edit, reorder the row client-side (infinite pages or jump cache)
  // then fire a background invalidate for server confirmation.
  const handleCellMembershipChange = useCallback((rowId: string, columnId: string, value: string | number | null) => {
    const store = gridStoreApi.getState();
    const effectiveSorts = (store.autoSort && store.sorts.length > 0)
      ? store.sorts
      : store.permanentSorts;

    // Protected rows stay pinned until the user commits on a sort/filter column.
    if (isRowProtected(rowId)) {
      const conditionedCols = new Set<string>();
      for (const s of effectiveSorts) conditionedCols.add(s.columnId);
      for (const f of store.filters) conditionedCols.add(f.columnId);
      if (store.filterTree) {
        const collectFilterTreeCols = (items: { kind?: string; columnId?: string; items?: unknown[] }[]) => {
          for (const item of items) {
            if (item.kind === "condition" && item.columnId) {
              conditionedCols.add(item.columnId);
            } else if (item.kind === "group" && Array.isArray(item.items)) {
              collectFilterTreeCols(item.items as typeof items);
            }
          }
        };
        collectFilterTreeCols(store.filterTree.items as { kind?: string; columnId?: string; items?: unknown[] }[]);
      }

      if (!conditionedCols.has(columnId)) {
        return;
      }
    }

    if (effectiveSorts.length === 0) {
      removeProtectedRowId(rowId);
      void utils.row.infinite.invalidate(rowQueryInput);
      return;
    }

    const colTypes = new Map(
      columnsRef.current.map((c) => [c.id, c.type as "TEXT" | "NUMBER"]),
    );
    const sorts = effectiveSorts.map((s: { columnId: string; direction: "asc" | "desc" }) => ({
      columnId: s.columnId,
      direction: s.direction,
    }));

    // Clear this row's optimistic protection — it has been committed on a
    // conditioned column and the reorder will place it at its correct position.
    removeProtectedRowId(rowId);

    // ── Tier 1A: Client-side reorder within loaded infinite pages ──
    utils.row.infinite.setInfiniteData(rowQueryInput, (old) => {
      if (!old) return old;
      const { data: reordered } = reorderRowInCache(old, rowId, sorts, colTypes);
      return reordered as typeof old;
    });

    // ── Tier 1B: Client-side reorder within jump cache ──
    const jumpResult = reorderJumpCacheRow(rowId, sorts, colTypes);

    // ── Tier 2: Server confirmation — always for infinite pages ──
    void utils.row.infinite.invalidate(rowQueryInput);

    // Only re-fetch the jump window from server when the row wasn't
    // successfully repositioned client-side (evicted or not in cache).
    if (jumpResult !== "moved") {
      const scroller = gridScrollerRef.current;
      if (scroller) {
        const approxOffset = Math.floor(scroller.scrollTop / dataRowHeightRef.current);
        if (approxOffset > 0) {
          triggerJumpFetch(approxOffset, true);
        }
      }
    }
  }, [gridStoreApi, utils, rowQueryInput, triggerJumpFetch, reorderJumpCacheRow, removeProtectedRowId, isRowProtected]);

  const search = useGridStore((s) => s.search);
  const setFindCurrentMatch = useGridStore((s) => s.setFindCurrentMatch);
  const addFindCountDelta = useGridStore((s) => s.addFindCountDelta);
  const resetFindCountDelta = useGridStore((s) => s.resetFindCountDelta);

  /** Count non-overlapping occurrences of `term` in `text` (case-insensitive). */
  const countOccurrences = useCallback((text: string, term: string): number => {
    if (!term) return 0;
    const lower = text.toLowerCase();
    const tLower = term.toLowerCase();
    let count = 0;
    let pos = 0;
    while (pos <= lower.length - tLower.length) {
      const idx = lower.indexOf(tLower, pos);
      if (idx === -1) break;
      count++;
      pos = idx + tLower.length;
    }
    return count;
  }, []);

  /** When a cell value changes, adjust the find count delta so "X of Y" updates instantly. */
  const handleCellValueChange = useCallback((
    _rowId: string,
    _columnId: string,
    oldValue: string | number | null,
    newValue: string | number | null,
  ) => {
    const term = gridStoreApi.getState().search.trim();
    if (!term) return;
    const oldStr = oldValue != null ? String(oldValue) : "";
    const newStr = newValue != null ? String(newValue) : "";
    const delta = countOccurrences(newStr, term) - countOccurrences(oldStr, term);
    if (delta !== 0) addFindCountDelta(delta);
  }, [gridStoreApi, countOccurrences, addFindCountDelta]);

  const { commit, cancel } = useCellEditing(tableId, rowQueryInput, updateJumpCacheRow, getRowById, handleCellMembershipChange, handleCellValueChange);

  // Backend query: count total substring matches across all rows in the table.
  // Only fires when there's an active (debounced) search term.
  const activeSearchTermForCount = debouncedSearch.trim();
  const searchCountQ = api.row.searchMatchCount.useQuery(
    activeSearchTermForCount
      ? {
          tableId,
          search: activeSearchTermForCount,
          filters: rowQueryInput.filters,
          conjunction: rowQueryInput.conjunction,
          filterTree: rowQueryInput.filterTree,
        }
      : skipToken,
    { staleTime: 10_000, refetchOnWindowFocus: false },
  );
  /** Total substring match count across the entire table (from backend). */
  const serverMatchCount: number = searchCountQ.data?.count ?? 0;
  const findCountDelta = useGridStore((s) => s.findCountDelta);

  // Reset the client-side delta whenever the server count refreshes (it now
  // incorporates any edits that happened since the last fetch).
  const searchCountUpdatedAt = searchCountQ.dataUpdatedAt;
  useEffect(() => {
    if (searchCountUpdatedAt) resetFindCountDelta();
  }, [searchCountUpdatedAt, resetFindCountDelta]);

  /** Displayed match count = server count + accumulated client-side delta. */
  const displayMatchCount: number = Math.max(0, serverMatchCount + findCountDelta);

  /** true while debounce timer is pending OR the match-count query is in-flight */
  const isSearchPending = search !== debouncedSearch || searchCountQ.isFetching;

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
  const visibleColumns = useMemo(() => {
    const hiddenSet = new Set(hiddenColumnIds);
    return orderedColumns.filter((c) => !hiddenSet.has(c.id));
  }, [orderedColumns, hiddenColumnIds]);
  visibleColumnsRef.current = visibleColumns;

  const _table = useGridTable(columns, rows as RowItem[]);

  // Client-side find: scan loaded rows for matches, server provides total count.
  const activeSearchTerm = debouncedSearch.trim();

  /** Build a flat list of match positions from currently loaded rows.
   *  Each entry is { rowPos, colId, occurrenceIndex } — one per non-overlapping
   *  substring occurrence.  This makes the list consistent with the server-side
   *  searchMatchCount (which also counts individual occurrences, not cells).
   *  Sorted by (rowPos, column order, occurrenceIndex) for deterministic navigation. */
  const localMatches = useMemo(() => {
    if (!activeSearchTerm) return [];
    const termLower = activeSearchTerm.toLowerCase();
    const matches: Array<{ rowPos: number; colId: string; occurrenceIndex: number }> = [];

    /** Scan a single row's visible cells, pushing one entry per non-overlapping occurrence. */
    const scanRow = (rowPos: number, cells: Record<string, unknown>) => {
      for (const col of visibleColumns) {
        const val = cells[col.id];
        if (val == null) continue;
        const strVal =
          typeof val === "object" && val !== null
            ? JSON.stringify(val)
            : String(val as string | number | boolean);
        const strLower = strVal.toLowerCase();
        let searchPos = 0;
        let occ = 0;
        while (searchPos <= strLower.length - termLower.length) {
          const idx = strLower.indexOf(termLower, searchPos);
          if (idx === -1) break;
          matches.push({ rowPos, colId: col.id, occurrenceIndex: occ });
          searchPos = idx + termLower.length;
          occ++;
        }
      }
    };

    // 1. Scan infinite-query rows (sequential pages)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as RowItem;
      if (!row) continue;
      scanRow(i, (row.cells ?? {}) as Record<string, unknown>);
    }

    // 2. Scan jump cache (rows beyond infinite-query range)
    const sortedJumpEntries = [...jumpCache.entries()].sort(([a], [b]) => a - b);
    for (const [pos, row] of sortedJumpEntries) {
      if (pos < rows.length) continue; // already covered above
      scanRow(pos, (row.cells ?? {}) as Record<string, unknown>);
    }

    return matches;
  }, [activeSearchTerm, rows, jumpCache, visibleColumns]);

  /** 0-based index into `localMatches`. */
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  // Reset when search term changes
  useEffect(() => {
    setCurrentMatchIdx(0);
  }, [activeSearchTerm]);

  // Clamp if local matches shrink (e.g. after a cell edit removes a match)
  useEffect(() => {
    if (localMatches.length > 0) {
      setCurrentMatchIdx((prev) => (prev >= localMatches.length ? 0 : prev));
    }
  }, [localMatches.length]);

  // Track the last match cell we synced / scrolled to, so we skip duplicate work
  // when the effect re-fires due to referential (but not semantic) dependency changes.
  const prevMatchKeyRef = useRef<string | null>(null);

  // Pending wrap-around navigation: set when the user wraps past the first/last
  // loaded match and we need to fetch a distant page from the backend.
  const pendingWrapNavRef = useRef<{
    rowId: string;
    absolutePosition: number;
    direction: "first" | "last";
  } | null>(null);

  // Sync current match index → store highlight + scroll into view
  useEffect(() => {
    if (!activeSearchTerm || localMatches.length === 0) {
      if (prevMatchKeyRef.current !== null) {
        prevMatchKeyRef.current = null;
        setFindCurrentMatch(null);
      }
      return;
    }

    const match = localMatches[currentMatchIdx];
    if (!match) return;

    const matchKey = `${match.rowPos}:${match.colId}:${match.occurrenceIndex}`;
    if (matchKey === prevMatchKeyRef.current) return;
    prevMatchKeyRef.current = matchKey;

    const row = getRowAtIndex(match.rowPos);
    if (row) {
      setFindCurrentMatch({ rowId: row.id, columnId: match.colId, occurrenceIndex: match.occurrenceIndex });
      const colIdx = visibleColumns.findIndex((c) => c.id === match.colId);
      if (colIdx !== -1) scrollCellIntoView(colIdx, match.rowPos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatchIdx, activeSearchTerm, localMatches, visibleColumns, getRowAtIndex, setFindCurrentMatch]);

  // Resolve pending wrap-around navigation once the target row appears in
  // localMatches (i.e. the windowFetch loaded the page containing it).
  useEffect(() => {
    const pending = pendingWrapNavRef.current;
    if (!pending) return;

    // Scan localMatches for the target rowId.
    // "first" → use the first localMatch entry for that row.
    // "last"  → use the last localMatch entry for that row.
    let targetIdx: number | null = null;
    for (let i = 0; i < localMatches.length; i++) {
      const m = localMatches[i];
      if (!m) continue;
      const row = getRowAtIndex(m.rowPos);
      if (row && row.id === pending.rowId) {
        if (pending.direction === "first") {
          targetIdx = i;
          break;
        }
        targetIdx = i; // keep updating — last wins
      }
    }

    if (targetIdx !== null) {
      setCurrentMatchIdx(targetIdx);
      pendingWrapNavRef.current = null;
    }
  }, [localMatches, jumpCache, getRowAtIndex]);

  /** Fire the async wrap-around navigation (shared by next/prev). */
  const doWrapNavigation = useCallback(
    (direction: "first" | "last") => {
      if (pendingWrapNavRef.current) return; // already in-flight
      void (async () => {
        try {
          const result = await utils.row.findEdgeMatch.fetch({
            tableId,
            search: activeSearchTerm!,
            edge: direction,
            filters: rowQueryInput.filters,
            conjunction: rowQueryInput.conjunction,
            filterTree: rowQueryInput.filterTree,
            sorts: rowQueryInput.sorts,
            viewId: rowQueryInput.viewId,
            totalCount: totalCount ?? undefined,
          });
          if (!result.rowId || result.absolutePosition == null) return;

          // Check if the target is already in localMatches
          const scanStart = direction === "first" ? 0 : localMatches.length - 1;
          const scanEnd = direction === "first" ? localMatches.length : -1;
          const scanStep = direction === "first" ? 1 : -1;
          for (let i = scanStart; i !== scanEnd; i += scanStep) {
            const m = localMatches[i];
            if (!m) continue;
            const row = getRowAtIndex(m.rowPos);
            if (row && row.id === result.rowId) {
              setCurrentMatchIdx(i);
              return;
            }
          }

          // Not loaded yet — trigger fetch and set pending ref for the effect.
          pendingWrapNavRef.current = {
            rowId: result.rowId,
            absolutePosition: result.absolutePosition,
            direction,
          };
          triggerJumpFetch(result.absolutePosition, true);
        } catch {
          // Silently fail — user can retry
        }
      })();
    },
    [utils, tableId, activeSearchTerm, rowQueryInput, totalCount, localMatches, getRowAtIndex, triggerJumpFetch],
  );

  // Ref to detect wrap-around: updated on every render so handlers can
  // check boundary conditions without stale closures.
  const currentMatchIdxRef = useRef(currentMatchIdx);
  currentMatchIdxRef.current = currentMatchIdx;

  const handleNextMatch = useCallback(() => {
    if (!activeSearchTerm || localMatches.length === 0) return;

    // Functional updater ensures correctness with rapid clicks / batching.
    setCurrentMatchIdx((prev) => {
      if (prev < localMatches.length - 1) return prev + 1;
      if (displayMatchCount <= localMatches.length) return 0;
      return prev; // hold position — async wrap will resolve
    });

    // Fire wrap navigation outside the updater (no side effects in updaters).
    // Ref check is correct for single-click scenarios (one click per render).
    if (currentMatchIdxRef.current >= localMatches.length - 1 && displayMatchCount > localMatches.length) {
      doWrapNavigation("first");
    }
  }, [activeSearchTerm, localMatches, displayMatchCount, doWrapNavigation]);

  const handlePrevMatch = useCallback(() => {
    if (!activeSearchTerm || localMatches.length === 0) return;

    setCurrentMatchIdx((prev) => {
      if (prev > 0) return prev - 1;
      if (displayMatchCount <= localMatches.length) return localMatches.length - 1;
      return prev; // hold position — async wrap will resolve
    });

    if (currentMatchIdxRef.current <= 0 && displayMatchCount > localMatches.length) {
      doWrapNavigation("last");
    }
  }, [activeSearchTerm, localMatches, displayMatchCount, doWrapNavigation]);

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

  const handlePickSort = useCallback(
    (columnId: string, columnType: "TEXT" | "NUMBER") => {
      setSorts([{ columnId, direction: "asc", type: columnType }]);
    },
    [setSorts],
  );

  const handleAddSort = useCallback(
    (columnId: string, columnType: "TEXT" | "NUMBER") => {
      setSorts([...currentSorts, { columnId, direction: "asc", type: columnType }]);
    },
    [currentSorts, setSorts],
  );

  const handleChangeSortField = useCallback(
    (index: number, columnId: string, columnType: "TEXT" | "NUMBER") => {
      const next = currentSorts.map((s, i) =>
        i === index ? { columnId, direction: s.direction, type: columnType } : s,
      );
      setSorts(next);
    },
    [currentSorts, setSorts],
  );

  const handleChangeDirection = useCallback(
    (index: number, direction: "asc" | "desc") => {
      const next = currentSorts.map((s, i) =>
        i === index ? { ...s, direction } : s,
      );
      setSorts(next);
    },
    [currentSorts, setSorts],
  );

  const handleRemoveSort = useCallback(
    (index: number) => {
      setSorts(currentSorts.filter((_, i) => i !== index));
    },
    [currentSorts, setSorts],
  );

  const autoSort = useGridStore((s) => s.autoSort);
  const setAutoSort = useGridStore((s) => s.setAutoSort);
  const permanentSorts = useGridStore((s) => s.permanentSorts);
  const setPermanentSorts = useGridStore((s) => s.setPermanentSorts);
  const setRanksComputing = useGridStore((s) => s.setRanksComputing);
  const markSortsSaved = useGridStore((s) => s.markSortsSaved);
  const markSaved = useGridStore((s) => s.markSaved);
  const filtersForSave = useGridStore((s) => s.filters);
  const filterConjunctionForSave = useGridStore((s) => s.filterConjunction);
  const filterTreeForSave = useGridStore((s) => s.filterTree);
  const markFiltersSaved = useGridStore((s) => s.markFiltersSaved);
  const activeViewIdFromStore = useGridStore((s) => s.activeViewId);

  // When switching views, invalidate all row caches so the new view
  // always loads fresh data (picks up rows/columns added in other views).
  const prevViewIdRef = useRef(activeViewIdFromStore);
  useEffect(() => {
    if (prevViewIdRef.current !== activeViewIdFromStore) {
      const scroller = gridScrollerRef.current;
      if (scroller && prevViewIdRef.current) {
        localStorage.setItem(`view-scrollTop-${prevViewIdRef.current}`, String(scroller.scrollTop));
      }
      prevViewIdRef.current = activeViewIdFromStore;
      void utils.row.infinite.invalidate();
      clearJumpCache();
      if (scroller && activeViewIdFromStore) {
        const saved = localStorage.getItem(`view-scrollTop-${activeViewIdFromStore}`);
        const scrollTop = saved ? Number(saved) : 0;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scroller.scrollTop = scrollTop;
          });
        });
      }
    }
  }, [activeViewIdFromStore, utils, clearJumpCache]);

  // Keep unmount ref in sync so cleanup reads the latest view ID
  unmountViewIdRef.current = activeViewIdFromStore ?? null;
  useEffect(() => {
    return () => {
      const viewId = unmountViewIdRef.current;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const scroller = gridScrollerRef.current;
      if (viewId && scroller) {
        localStorage.setItem(`view-scrollTop-${viewId}`, String(scroller.scrollTop));
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to top on sort/filter change (but not on view switch).
  const prevInputKeyRef = useRef<string>("");
  const prevInputViewIdRef = useRef<string | undefined>(rowQueryInput.viewId);
  useEffect(() => {
    const key = JSON.stringify(rowQueryInput);
    const currentViewId = rowQueryInput.viewId;

    if (!prevInputKeyRef.current) {
      prevInputKeyRef.current = key;
      prevInputViewIdRef.current = currentViewId;
      return;
    }
    if (key === prevInputKeyRef.current) return;

    const isViewSwitch = currentViewId !== prevInputViewIdRef.current;
    prevInputKeyRef.current = key;
    prevInputViewIdRef.current = currentViewId;

    if (isViewSwitch) return;

    const scroller = gridScrollerRef.current;
    if (scroller) {
      requestAnimationFrame(() => {
        scroller.scrollTop = 0;
      });
    }
  }, [rowQueryInput]);

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

  // Toggle autoSort — persists the toggle + current state immediately.
  const handleToggleAutoSort = useCallback(() => {
    const newAutoSort = !autoSort;
    setAutoSort(newAutoSort);

    if (activeViewIdFromStore) {
      sortSaveMut.mutate({
        viewId: activeViewIdFromStore,
        config: {
          search: "",  // Search is ephemeral — never persisted
          filters: filtersForSave,
          filterConjunction: filterConjunctionForSave,
          filterTree: filterTreeForSave,
          sorts: newAutoSort ? currentSorts : [],
          permanentSorts,
          autoSort: newAutoSort,
          hiddenColumnIds,
          columnOrderIds,
          rowOrderIds: rowOrderIdsForSave,
        },
      });
    }
  }, [autoSort, setAutoSort, activeViewIdFromStore, sortSaveMut, filtersForSave, filterConjunctionForSave, filterTreeForSave, currentSorts, permanentSorts, hiddenColumnIds, columnOrderIds, rowOrderIdsForSave]);

  // Background rank materialization — enables fast O(log N) jumps later.
  const computeRanksMut = api.row.computeViewRanks.useMutation({
    onSuccess: () => {
      setRanksComputing(false);
      refreshRows();
    },
    onError: () => {
      setRanksComputing(false);
    },
  });

  const handleSaveSorts = useCallback(() => {
    if (!activeViewIdFromStore || currentSorts.length === 0) return;

    setPermanentSorts(currentSorts);
    setRanksComputing(true);
    clearJumpCache();

    computeRanksMut.mutate({
      tableId,
      viewId: activeViewIdFromStore,
      sorts: currentSorts,
    });

    sortSaveMut.mutate({
      viewId: activeViewIdFromStore,
      config: {
        search: "",  // Search is ephemeral — never persisted
        filters: filtersForSave,
        filterConjunction: filterConjunctionForSave,
        filterTree: filterTreeForSave,
        sorts: [],
        permanentSorts: currentSorts,
        autoSort: false,
        hiddenColumnIds,
        columnOrderIds,
        rowOrderIds: rowOrderIdsForSave,
      },
    });
  }, [activeViewIdFromStore, currentSorts, tableId, filtersForSave, filterConjunctionForSave, filterTreeForSave, hiddenColumnIds, columnOrderIds, rowOrderIdsForSave, setRanksComputing, computeRanksMut, sortSaveMut]);

  // "Cancel" button (autoSort=false): revert staged entries to permanentSorts
  const handleCancelSorts = useCallback(() => {
    setSorts(permanentSorts);
  }, [setSorts, permanentSorts]);

  // Auto-save layout changes (column order + visibility), debounced.
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
    search: "",  // Search is ephemeral — never persisted to the view config
    filters: filtersForSave,
    filterConjunction: filterConjunctionForSave,
    filterTree: filterTreeForSave,
    sorts: sortsForConfig,
    permanentSorts,
    autoSort,
    hiddenColumnIds,
    columnOrderIds,
    rowOrderIds: rowOrderIdsForSave,
    rowHeightPreset,
    wrapHeaders,
  });
  latestConfigRef.current = {
    search: "",  // Search is ephemeral — never persisted to the view config
    filters: filtersForSave,
    filterConjunction: filterConjunctionForSave,
    filterTree: filterTreeForSave,
    sorts: sortsForConfig,
    permanentSorts,
    autoSort,
    hiddenColumnIds,
    columnOrderIds,
    rowOrderIds: rowOrderIdsForSave,
    rowHeightPreset,
    wrapHeaders,
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

  // Auto-save row height / wrap headers (per-view, immediate).
  const rowHeightAutoSaveMut = api.view.update.useMutation({
    onSuccess: () => {
      void utils.view.list.invalidate({ tableId });
    },
  });
  const rhBaselineRef = useRef<string>("");
  useEffect(() => {
    if (!activeViewIdFromStore) return;
    const key = `${activeViewIdFromStore}|${rowHeightPreset}|${wrapHeaders}`;
    // First render / view switch → record baseline, skip save
    if (!rhBaselineRef.current.startsWith(activeViewIdFromStore + "|")) {
      rhBaselineRef.current = key;
      return;
    }
    if (key === rhBaselineRef.current) return;
    rhBaselineRef.current = key;
    rowHeightAutoSaveMut.mutate({
      viewId: activeViewIdFromStore,
      config: latestConfigRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowHeightPreset, wrapHeaders, activeViewIdFromStore]);

  // Auto-save filter changes, debounced.
  const filterAutoSaveMut = api.view.update.useMutation({
    onSuccess: () => {
      markFiltersSaved();
      void utils.view.list.invalidate({ tableId });
    },
  });

  const filterBaselineRef = useRef<string>("");
  const filterTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Serialise current filters + conjunction + tree into a stable key for change detection
  const filterKey = `${activeViewIdFromStore}|${JSON.stringify(filtersForSave)}|${filterConjunctionForSave}|${JSON.stringify(filterTreeForSave)}`;

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

  // Auto-save sort changes (autoSort=true only), debounced.
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

  // Get cell value as string. Falls back to sourceColumnId / defaultValue
  // when key is missing (unwritten), but NOT when key is present-but-null (user cleared).
  const getCellValue = useCallback(
    (cells: unknown, columnId: string): string => {
      if (!cells || typeof cells !== "object") return "";
      const record = cells as Record<string, unknown>;
      const val = record[columnId];
      if (val !== null && val !== undefined) {
        if (typeof val === "object") return JSON.stringify(val);
        return typeof val === "string" ? val : String(val as number | boolean | bigint | symbol);
      }

      // Key exists but value is null — cell was explicitly written (user edit
      // or backfill set it). Don't fall back to source/default; the user's
      // intent was to clear this cell.
      const hasKey = Object.prototype.hasOwnProperty.call(record, columnId);
      if (hasKey) return "";

      // Key doesn't exist at all — check if this column has a fallback:
      const col = orderedColumns.find((c) => c.id === columnId);

      // 1. Duplication: show source column's value (sourceColumnId is stored in DB)
      if (col?.sourceColumnId) {
        const srcVal = record[col.sourceColumnId];
        if (srcVal !== null && srcVal !== undefined) {
          if (typeof srcVal === "object") return JSON.stringify(srcVal);
          return typeof srcVal === "string" ? srcVal : String(srcVal as number | boolean | bigint | symbol);
        }
      }

      // 2. Default value: show column's defaultValue
      if (col?.defaultValue) return col.defaultValue;

      return "";
    },
    [orderedColumns],
  );

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

  // Selection overlay — lives inside scroll content for compositor-speed scrolling.
  // Frozen columns need JS correction on horizontal scroll + clip-path for non-frozen cells.
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
    // Search infinite-query pages first, then jump cache for the actual data position
    let rowIdx = rws.findIndex((r) => r.id === targetCell.rowId);
    if (rowIdx === -1) {
      // Row is not in infinite pages — check jump cache (keys = actual data positions)
      for (const [pos, item] of jumpCacheRef.current.entries()) {
        if (item.id === targetCell.rowId) { rowIdx = pos; break; }
      }
    }
    if (colIdx === -1 || rowIdx === -1) {
      overlay.style.display = "none";
      return;
    }

    const hScroll = hScrollRef.current;
    const scrollLeft = hScroll?.scrollLeft ?? 0;
    const widths = columnWidthsRef.current;
    const colWidth = widths[targetCell.columnId] ?? COLUMN_WIDTH;
    const isFrozen = colIdx < frozenCount;

    // Cell X — content-relative.  The overlay is inside gridContentScrollerInner
    // whose scrollLeft is synced to the horizontal scrollbar, so the overlay
    // naturally scrolls with the content (just like Y scrolls with the rows).
    // Frozen cells use position:sticky and do NOT scroll, so we must compensate
    // by adding scrollLeft for frozen columns to keep the overlay aligned.
    let cellX = ROW_NUM_WIDTH;
    for (let i = 0; i < colIdx; i++) {
      cellX += widths[cols[i]!.id] ?? COLUMN_WIDTH;
    }
    if (isFrozen) {
      cellX += scrollLeft;
    }

    // Cell Y — content-relative (overlay is inside the scroll content,
    // so it moves with the rows at compositor speed — no scrollTop needed).
    const drh = dataRowHeightRef.current;
    const virtualRowIdxForOverlay = mapToVirtualIndexRef.current(rowIdx);
    const cellY = virtualRowIdxForOverlay * drh;

    // Fill handle — first child of overlay
    const handle = overlay.firstElementChild as HTMLElement | null;

    overlay.style.display = "block";

    let overlayTop: number;
    let overlayHeight: number;
    let overlayLeft: number;
    let overlayWidth: number;

    if (ec) {
      // --- Editing mode: hide fill handle, 3px border, expand outward ---
      if (handle) handle.style.display = "none";
      overlay.style.borderWidth = "3px";

      overlayTop = cellY - 3;
      overlayLeft = cellX - 3;
      overlayWidth = colWidth + 6;
      overlayHeight = drh + 6;
    } else {
      // --- Active (non-editing) mode: show fill handle, 2px border ---
      if (handle) handle.style.display = "";
      overlay.style.borderWidth = "2px";

      overlayTop = cellY - 2;
      overlayLeft = cellX - 1;
      overlayWidth = colWidth + 2;
      overlayHeight = drh + 3;
    }

    // Use transform for GPU-accelerated positioning.  The overlay lives inside
    // the scroll content so both X and Y scroll naturally with the compositor.
    overlay.style.transform = `translate(${overlayLeft}px, ${overlayTop}px)`;
    overlay.style.width = `${overlayWidth}px`;
    overlay.style.height = `${overlayHeight}px`;

    // Clip the overlay at the freeze bar for non-frozen cells so it doesn't
    // paint over the frozen columns when scrolled partially behind them.
    if (!isFrozen && frozenCount > 0) {
      const fw = freezeWidthRef.current;
      const freezeEdgeContent = scrollLeft + fw;
      const clipLeft = freezeEdgeContent - overlayLeft;
      if (clipLeft >= overlayWidth) {
        overlay.style.display = "none";
      } else if (clipLeft > 0) {
        overlay.style.clipPath = `inset(0 0 0 ${clipLeft}px)`;
      } else {
        overlay.style.clipPath = "";
      }
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

    // --- Vertical --- (use virtual index when scroll is scaled)
    const drhScroll = dataRowHeightRef.current;
    const virtualRowIdx = mapToVirtualIndexRef.current(rowIdx);
    const cellTop = virtualRowIdx * drhScroll;
    const cellBottom = cellTop + drhScroll;
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

  // Helper: find a row's actual data position (works for both infinite pages and jump cache)
  const findRowPosition = useCallback((rowId: string): number => {
    // 1. Search infinite query pages (index within array = actual data position)
    const idx = rows.findIndex((r) => r.id === rowId);
    if (idx !== -1) return idx;
    // 2. Search jump cache (map key = actual data position)
    for (const [pos, item] of jumpCacheRef.current.entries()) {
      if (item.id === rowId) return pos;
    }
    return -1;
  }, [rows, jumpCacheRef]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeCell) return;
      if (editingCell) return; // editing — let the input handle keys

      const { rowId, columnId } = activeCell;

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.key)) {
        e.preventDefault();
        const rowPos = findRowPosition(rowId);
        const colIdx = visibleColumns.findIndex((c) => c.id === columnId);
        if (rowPos === -1 || colIdx === -1) return;

        let newRowPos = rowPos;
        let newColIdx = colIdx;

        switch (e.key) {
          case "ArrowUp": newRowPos = Math.max(0, rowPos - 1); break;
          case "ArrowDown": newRowPos = Math.min(totalCount - 1, rowPos + 1); break;
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

        // getRowAtIndex works for both infinite pages and jump cache
        const newRow = getRowAtIndex(newRowPos);
        const newCol = visibleColumns[newColIdx];
        if (newRow && newCol) {
          setActiveCell({ rowId: newRow.id, columnId: newCol.id });
          scrollCellIntoView(newColIdx, newRowPos);
        }
      }

      if (e.key === "Enter") {
        e.preventDefault();
        // Find the row in either infinite pages or jump cache
        const rowPos = findRowPosition(rowId);
        const row = rowPos !== -1 ? getRowAtIndex(rowPos) : null;
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
  }, [activeCell, editingCell, rows, totalCount, visibleColumns, setActiveCell, startEditing, clearSelection, getCellValue, scrollCellIntoView, findRowPosition, getRowAtIndex]);

  // Overlay is inside the scroll content, so it scrolls naturally with both
  // vertical and horizontal movement.  The hScroll listener is still needed to
  // update frozen-column offsets and the clip-path for non-frozen cells.
  useEffect(() => {
    const hScroll = hScrollRef.current;
    const onHScroll = () => updateSelectionOverlay();
    hScroll?.addEventListener("scroll", onHScroll, { passive: true });
    return () => {
      hScroll?.removeEventListener("scroll", onHScroll);
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

  // Scroll sync: hScrollbar drives horizontal position; wheel deltaX is forwarded.
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

  // Row virtualization with proportional index mapping for large datasets (browser scroll height limit).
  const MAX_SCROLL_HEIGHT = 15_000_000; // conservative cross-browser limit
  const maxVirtualRows = Math.floor(MAX_SCROLL_HEIGHT / dataRowHeight);
  const virtualCount = Math.min(totalCount, maxVirtualRows);
  const isScaled = totalCount > maxVirtualRows;

  /** Map a virtual index (0..virtualCount-1) to an actual row index (0..totalCount-1). */
  const mapToActualIndex = useCallback((virtualIndex: number): number => {
    if (!isScaled || virtualCount <= 1) return virtualIndex;
    return Math.round(virtualIndex * (totalCount - 1) / (virtualCount - 1));
  }, [isScaled, totalCount, virtualCount]);

  /** Inverse: map an actual row index to the nearest virtual index. */
  const mapToVirtualIndex = useCallback((actualIndex: number): number => {
    if (!isScaled || totalCount <= 1) return actualIndex;
    return Math.round(actualIndex * (virtualCount - 1) / (totalCount - 1));
  }, [isScaled, totalCount, virtualCount]);

  // Ref so scrollCellIntoView (which is created before the virtualizer) can
  // convert actual → virtual row index for scroll-position math.
  const mapToVirtualIndexRef = useRef(mapToVirtualIndex);
  mapToVirtualIndexRef.current = mapToVirtualIndex;

  const rowVirtualizer = useVirtualizer({
    count: virtualCount,
    getScrollElement: () => gridScrollerRef.current,
    estimateSize: () => dataRowHeight,
    overscan: OVERSCAN_COUNT,
  });

  // Re-measure when row height changes, and adjust scrollTop so the user
  // stays at approximately the same row.
  const prevDataRowHeightRef = useRef(dataRowHeight);
  useEffect(() => {
    const prevH = prevDataRowHeightRef.current;
    if (prevH !== dataRowHeight && prevH > 0) {
      const scroller = gridScrollerRef.current;
      if (scroller) {
        // Preserve the row the user was looking at
        const ratio = scroller.scrollTop / prevH;
        scroller.scrollTop = ratio * dataRowHeight;
      }
    }
    prevDataRowHeightRef.current = dataRowHeight;
    rowVirtualizer.measure();
  }, [dataRowHeight, rowVirtualizer]);

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Infinite scroll: fetch next page when approaching end of loaded data
  useEffect(() => {
    if (virtualItems.length === 0) return;
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    // Map virtual indices → actual row indices (identity when not scaled)
    const lastActual = mapToActualIndex(lastItem.index);

    // If the last visible virtual item is close to the end of loaded pages, fetch more.
    // The gap guard (lastActual < rows.length + 5000) prevents a runaway cascade:
    // after mutations that truncate to page 0, rows.length drops to ~1000 while the
    // user may be at position 100K.  Without the guard, fetchNextPage fires in a
    // loop reloading all 100 pages (30+ seconds).  Distant positions are served by
    // the jump cache instead — that's what the two-layer virtualization is for.
    if (
      lastActual >= rows.length - 50 &&
      lastActual < rows.length + 5000 &&
      rowsQ.hasNextPage &&
      !rowsQ.isFetchingNextPage
    ) {
      void rowsQ.fetchNextPage();
    }

    // Jump detection: trigger windowFetch for visible skeleton rows AND
    // pre-fetch when approaching the edge of a cached block.
    if (totalCount > rows.length) {
      const firstVis = virtualItems[0];
      const lastVis = virtualItems[virtualItems.length - 1];
      if (firstVis && lastVis) {
        const firstActual = mapToActualIndex(firstVis.index);
        const lastActualVis = mapToActualIndex(lastVis.index);

        // 1. Direct skeleton detection: find ANY visible item that is a skeleton
        for (const vItem of virtualItems) {
          const actualIdx = mapToActualIndex(vItem.index);
          if (actualIdx >= rows.length && !getRowAtIndex(actualIdx)) {
            triggerJumpFetch(actualIdx);
            break;
          }
        }

        // 2. Pre-fetch: approaching the edge of a cached region
        const PREFETCH_DIST = 40;
        if (firstActual >= rows.length) {
          const topIdx = firstActual;
          const hasAbove = getRowAtIndex(topIdx - PREFETCH_DIST);
          if (!hasAbove && topIdx - PREFETCH_DIST >= rows.length) {
            triggerJumpFetch(topIdx - PREFETCH_DIST);
          }
        }
        if (lastActualVis >= rows.length) {
          const botIdx = lastActualVis;
          const hasBelow = getRowAtIndex(botIdx + PREFETCH_DIST);
          if (!hasBelow && botIdx + PREFETCH_DIST < totalCount) {
            triggerJumpFetch(botIdx + PREFETCH_DIST);
          }
        }
      }
    }
  }, [virtualItems, rows.length, rowsQ.hasNextPage, rowsQ.isFetchingNextPage, totalCount, triggerJumpFetch, getRowAtIndex, mapToActualIndex]);

  const viewsQ = api.view.list.useQuery(
    isValidTable ? { tableId } : skipToken,
    { staleTime: 60_000 },
  );
  const views = viewsQ.data ?? [];

  const [activeViewId, setActiveViewIdRaw] = useState<string | null>(null);

  const setActiveViewId = useCallback((id: string | null) => {
    setActiveViewIdRaw(id);
    if (id) {
      localStorage.setItem(`table-lastView-${tableId}`, id);
    }
  }, [tableId]);

  useEffect(() => {
    if (views.length === 0) return;
    const activeExists = activeViewId && views.some(v => v.id === activeViewId);
    if (!activeExists) {
      // Check localStorage for last-visited view
      const lastViewId = localStorage.getItem(`table-lastView-${tableId}`);
      const preferred = lastViewId && views.some(v => v.id === lastViewId) ? lastViewId : views[0]!.id;
      setActiveViewIdRaw(preferred);
    }
  }, [views, activeViewId, tableId]);

  const activeView = views.find(v => v.id === activeViewId);
  const activeViewName = activeView?.name ?? 'Grid view';
  const canDeleteView = views.length > 1;

  const storeActiveViewId = useGridStore((s) => s.activeViewId);
  const initializeFromView = useGridStore((s) => s.initializeFromView);

  useEffect(() => {
    if (!activeViewId || views.length === 0) return;
    // Only reinitialize if the store is tracking a different view (or not yet initialized)
    if (storeActiveViewId === activeViewId) return;
    const view = views.find(v => v.id === activeViewId);
    if (!view) return;
    const config = normalizeViewConfig(view.config);
    const tableColumnIds = columns.map((c) => c.id);
    const reconciledConfig = tableColumnIds.length > 0
      ? reconcileColumnOrder(config, tableColumnIds)
      : config;
    initializeFromView(activeViewId, reconciledConfig);
  }, [activeViewId, views, columns, storeActiveViewId, initializeFromView]);

  const computeNextViewName = () => {
    const existingNames = new Set(views.map(v => v.name));
    let num = 2;
    while (existingNames.has(`Grid ${num}`)) num++;
    return `Grid ${num}`;
  };

  const createViewMut = api.view.create.useMutation({
    onSuccess: (newView) => {
      utils.view.list.setData({ tableId }, (old) => {
        if (!old) return undefined;
        if (old.some((v) => v.id === newView.id)) return old;
        return [...old, { ...newView, createdAt: new Date(), updatedAt: new Date(), ranksStale: true }];
      });
      setActiveViewId(newView.id);
      setIsCreateViewBoxOpen(false);
      void utils.view.list.invalidate({ tableId });
    },
  });

  const [showViewLoadingSpinner, setShowViewLoadingSpinner] = useState(false);
  useEffect(() => {
    if (createViewMut.isPending) {
      const timer = setTimeout(() => setShowViewLoadingSpinner(true), 500);
      return () => clearTimeout(timer);
    } else {
      setShowViewLoadingSpinner(false);
    }
  }, [createViewMut.isPending]);

  const deleteViewMut = api.view.delete.useMutation({
    onSuccess: () => {
      void utils.view.list.invalidate({ tableId });
      setIsViewDropdownOpen(false);
      setContextMenuViewId(null);
    },
  });

  const renameViewMut = api.view.update.useMutation({
    onSuccess: () => {
      void utils.view.list.invalidate({ tableId });
    },
  });

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

  const [scrollProgress, setScrollProgress] = useState(0); // 0 to 1
  const [hasOverflow, setHasOverflow] = useState(false); // Whether tabs overflow at all

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

  const [isRenamingView, setIsRenamingView] = useState(false);
  const [renameViewValue, setRenameViewValue] = useState('');
  const renameViewInputRef = useRef<HTMLInputElement>(null);

  const [renamingSidebarViewId, setRenamingSidebarViewId] = useState<string | null>(null);
  const [sidebarRenameValue, setSidebarRenameValue] = useState('');

  const [showDuplicateViewTooltip, setShowDuplicateViewTooltip] = useState(false);
  const duplicateViewTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addRowMut = api.row.addMany.useMutation();

  const duplicateRowMut = api.row.duplicateAt.useMutation({
    onSuccess: (data, vars) => {
      const currentOrder = rowOrderIdsRef.current;
      if (currentOrder.length > 0) {
        const sourceIdx = currentOrder.indexOf(vars.rowId);
        if (sourceIdx !== -1) {
          const order = [...currentOrder];
          order.splice(sourceIdx + 1, 0, data.id);
          setRowOrderIdsTop(order);
        }
      }

      const term = gridStoreApi.getState().search.trim();
      if (term) {
        const sourceRow = getRowById(vars.rowId);
        if (sourceRow) {
          const cells = (sourceRow.cells ?? {}) as Record<string, unknown>;
          let delta = 0;
          for (const val of Object.values(cells)) {
            if (val != null) delta += countOccurrences(String(val), term);
          }
          if (delta > 0) addFindCountDelta(delta);
        }
      }

      refreshRows(1); // +1 row from duplicate
    },
  });

  const [deletingRowIds, setDeletingRowIds] = useState<Set<string>>(new Set());

  const deleteRowMut = api.row.delete.useMutation({
    onSuccess: (_data, vars) => {
      removeFromJumpCache(vars.rowId);

      setDeletingRowIds((prev) => {
        const next = new Set(prev);
        next.delete(vars.rowId);
        return next;
      });
    },
    onError: (_e, vars) => {
      setDeletingRowIds((prev) => {
        const next = new Set(prev);
        next.delete(vars.rowId);
        return next;
      });
      refreshRows();
    },
  });

  const canDragRows = !hasTemporarySorts && filtersForSave.length === 0;

  const reorderMut = api.row.reorder.useMutation({
    onSuccess: () => {
      refreshRows();
    },
  });

  const handleReorderRow = useCallback(
    (rowId: string, fromVisualIdx: number, toVisualIdx: number) => {
      if (fromVisualIdx === toVisualIdx) return;
      if (!isValidTable) return;

      const sourceRow = getRowById(rowId);
      const targetRow = getRowAtIndex(toVisualIdx);

      if (!sourceRow || !targetRow) return;

      reorderMut.mutate({
        tableId,
        rowId,
        fromIndex: sourceRow.rowIndex,
        toIndex: targetRow.rowIndex,
      });
    },
    [isValidTable, tableId, getRowById, getRowAtIndex, reorderMut],
  );

  // Refs for latest Zustand state (avoids stale closures in mutation callbacks)
  const columnOrderIdsRef = useRef(columnOrderIds);
  columnOrderIdsRef.current = columnOrderIds;
  const hiddenColumnIdsRef = useRef(hiddenColumnIds);
  hiddenColumnIdsRef.current = hiddenColumnIds;
  const currentSortsRef = useRef(currentSorts);
  currentSortsRef.current = currentSorts;
  const filtersRef = useRef(filtersForSave);
  filtersRef.current = filtersForSave;
  const filterTreeRef = useRef(filterTreeForSave);
  filterTreeRef.current = filterTreeForSave;

  const setFilters = useGridStore((s) => s.setFilters);
  const setFilterTree = useGridStore((s) => s.setFilterTree);

  const tempColCounter = useRef(0);

  // Suppress layout auto-save during column creation (temp IDs in columnOrderIds).
  const isCreatingColumnRef = useRef(false);
  const [backfillingColumnIds, setBackfillingColumnIds] = useState<ReadonlySet<string>>(new Set());


  const backfillMut = api.column.backfill.useMutation({
    onSuccess: (_data, vars) => {
      setBackfillingColumnIds((prev) => {
        const next = new Set(prev);
        next.delete(vars.columnId);
        return next;
      });
      refreshRows();
      void utils.view.list.invalidate({ tableId });
    },
    onError: (err, vars) => {
      console.error("[backfill] failed for column", vars.columnId, err);
      setBackfillingColumnIds((prev) => {
        const next = new Set(prev);
        next.delete(vars.columnId);
        return next;
      });
    },
  });

  const createColumnMut = api.column.create.useMutation({
    onMutate: async (vars) => {
      isCreatingColumnRef.current = true;
      const tempId = `__temp_col_${++tempColCounter.current}_${Date.now()}`;

      await utils.column.list.cancel({ tableId });
      const prevCols = utils.column.list.getData({ tableId });
      const prevOrderIds = columnOrderIdsRef.current;

      const tempCol = {
        id: tempId,
        name: vars.name,
        type: vars.type,
        order: 999999,
        defaultValue: vars.defaultValue ?? null,
        config: vars.numberConfig ? (vars.numberConfig as unknown as object) : null,
        sourceColumnId: vars.sourceColumnId ?? null,
      };
      utils.column.list.setData({ tableId }, (old) => {
        if (!old) return [tempCol];
        return [...old, tempCol];
      });

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

      return { tempId, prevCols, prevOrderIds };
    },
    onSuccess: (newCol, vars, ctx) => {
      if (!ctx) return;
      const { tempId } = ctx;

      utils.column.list.setData({ tableId }, (old) => {
        if (!old) return old;
        return old.map((c) =>
          c.id === tempId
            ? { id: newCol.id, name: newCol.name, type: newCol.type, order: newCol.order, defaultValue: newCol.defaultValue, config: newCol.config, sourceColumnId: newCol.sourceColumnId }
            : c,
        );
      });

      const currentOrder = columnOrderIdsRef.current;
      const idx = currentOrder.indexOf(tempId);
      if (idx !== -1) {
        const updated = [...currentOrder];
        updated[idx] = newCol.id;
        setColumnOrderIds(updated);
      }

      const ac = activeCellRef.current;
      if (ac?.columnId === tempId) {
        setActiveCell({ rowId: ac.rowId, columnId: newCol.id });
      }

      isCreatingColumnRef.current = false;

      void utils.view.list.invalidate({ tableId });

      if (vars.sourceColumnId) {
        setBackfillingColumnIds((prev) => new Set(prev).add(newCol.id));
        backfillMut.mutate({
          tableId,
          columnId: newCol.id,
          sourceColumnId: vars.sourceColumnId,
        });
      }
    },
    onError: (_err, _vars, ctx) => {
      isCreatingColumnRef.current = false;
      if (!ctx) return;
      if (ctx.prevCols) utils.column.list.setData({ tableId }, ctx.prevCols);
      setColumnOrderIds(ctx.prevOrderIds);
    },
  });

  const deleteColumnMut = api.column.delete.useMutation({
    onMutate: async (vars) => {
      await utils.column.list.cancel({ tableId });
      const prevCols = utils.column.list.getData({ tableId });

      const prevOrderIds = columnOrderIdsRef.current;
      const prevHiddenIds = hiddenColumnIdsRef.current;
      const prevSorts = currentSortsRef.current;
      const prevFilters = filtersRef.current;
      const prevFilterTree = filterTreeRef.current;

      utils.column.list.setData({ tableId }, (old) => {
        if (!old) return old;
        return old.filter((c) => c.id !== vars.columnId);
      });

      setColumnOrderIds(prevOrderIds.filter((id: string) => id !== vars.columnId));
      setHiddenColumnIds(prevHiddenIds.filter((id: string) => id !== vars.columnId));

      const newSorts = prevSorts.filter((s) => s.columnId !== vars.columnId);
      if (newSorts.length !== prevSorts.length) setSorts(newSorts);
      const newFilters = prevFilters.filter((f) => f.columnId !== vars.columnId);
      if (newFilters.length !== prevFilters.length) setFilters(newFilters);

      if (prevFilterTree) {
        type TreeItem = { kind?: string; columnId?: string; items?: TreeItem[]; [k: string]: unknown };
        const cleanTreeItems = (items: TreeItem[]): TreeItem[] =>
          items
            .filter((it) => !(it.kind === "condition" && it.columnId === vars.columnId))
            .map((it) =>
              it.kind === "group" && Array.isArray(it.items)
                ? { ...it, items: cleanTreeItems(it.items) }
                : it,
            );
        const cleaned = {
          ...prevFilterTree,
          items: cleanTreeItems(prevFilterTree.items as TreeItem[]),
        };
        setFilterTree(cleaned as typeof prevFilterTree);
      }

      return { prevCols, prevOrderIds, prevHiddenIds, prevSorts, prevFilters, prevFilterTree };
    },
    onError: (_e, _v, ctx) => {
      if (!ctx) return;
      if (ctx.prevCols) utils.column.list.setData({ tableId }, ctx.prevCols);
      setColumnOrderIds(ctx.prevOrderIds);
      setHiddenColumnIds(ctx.prevHiddenIds);
      setSorts(ctx.prevSorts);
      setFilters(ctx.prevFilters);
      setFilterTree(ctx.prevFilterTree);
    },
    onSuccess: () => {
      refreshRows();
      void utils.column.list.invalidate({ tableId });
      void utils.view.list.invalidate({ tableId });
    },
  });

  const updateColumnMut = api.column.update.useMutation({
    onMutate: async (vars) => {
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
      if (ctx?.prevCols) utils.column.list.setData({ tableId }, ctx.prevCols);
    },
    onSuccess: () => {
      void utils.column.list.invalidate({ tableId });
    },
  });

  const newRowTargetIndexRef = useRef<number | null>(null);

  const insertAtMut = api.row.insertAt.useMutation();

  const handleAddRow = useCallback(() => {
    if (!isValidTable) return;
    // Server atomically claims nextRowIndex for position "end",
    // so atIndex is just a hint (ignored). No stale-count risk, no race conditions.
    insertAtMut.mutate({ tableId, atIndex: 0, position: "end" }, {
      onSuccess: (newRow) => {
        const cachedData = utils.row.infinite.getInfiniteData(rowQueryInput);
        const currentTotal = cachedData?.pages?.[0]?.totalCount ?? totalCount;

        addToJumpCache(currentTotal, newRow as RowItem);

        utils.row.infinite.setInfiniteData(rowQueryInput, (old) => {
          if (!old?.pages?.length) return old;
          return {
            pages: old.pages.slice(0, 1).map((page) => ({
              ...page,
              totalCount: page.totalCount + 1,
            })),
            pageParams: old.pageParams.slice(0, 1),
          } as typeof old;
        });

        addProtectedRowId(newRow.id);

        void utils.row.infinite.invalidate();

        requestAnimationFrame(() => {
          const scroller = gridScrollerRef.current;
          if (scroller) scroller.scrollTop = scroller.scrollHeight;
        });

        const firstCol = visibleColumnsRef.current[0];
        if (firstCol) {
          requestAnimationFrame(() => {
            setActiveCell({ rowId: newRow.id, columnId: firstCol.id });
            startEditing({ rowId: newRow.id, columnId: firstCol.id }, '');
          });
        }
      },
      onError: (err) => {
        console.error("[handleAddRow] insertAt failed:", err.message);
      },
    });
  }, [isValidTable, tableId, insertAtMut, utils, rowQueryInput, totalCount, addToJumpCache, addProtectedRowId, setActiveCell, startEditing]);

  const [isBulkAdding, setIsBulkAdding] = useState(false);

  const handleAddBulkRows = useCallback(() => {
    if (!isValidTable || isBulkAdding) return;
    setIsBulkAdding(true);
    addRowMut.mutate({ tableId, count: 100_000 }, {
      onSuccess: (data) => {
        clearJumpCache(); // bulk add changes everything — clear stale entries
        refreshRows(data.count); // optimistically set totalCount += 100K
        setIsBulkAdding(false);
      },
      onError: () => {
        setIsBulkAdding(false);
      },
    });
  }, [isValidTable, isBulkAdding, tableId, addRowMut, refreshRows, clearJumpCache]);

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

  // Insert row above/below: splice directly into local cache to avoid skeleton flash.
  const handleInsertAt = useCallback((rowId: string, position: "above" | "below") => {
    if (!isValidTable) return;
    const targetRow = getRowById(rowId);
    if (!targetRow) return;

    insertAtMut.mutate({ tableId, atIndex: targetRow.rowIndex, position }, {
      onSuccess: (newRow) => {
        const isTargetInPages = rowsRef.current.some(
          (r) => (r as RowItem).id === rowId,
        );

        if (isTargetInPages) {
          // Target is in the sequential infinite-pages region — splice the new
          // row into the correct page at the correct position.
          utils.row.infinite.setInfiniteData(rowQueryInput, (old): RowInfiniteData | undefined => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page, pageIdx) => {
                const itemIdx = page.items.findIndex((r) => r.id === rowId);
                if (itemIdx >= 0) {
                  const insertIdx = position === "above" ? itemIdx : itemIdx + 1;
                  const newItems = [...page.items];
                  newItems.splice(insertIdx, 0, newRow as (typeof newItems)[number]);
                  return {
                    ...page,
                    items: newItems,
                    totalCount: pageIdx === 0 ? page.totalCount + 1 : page.totalCount,
                  };
                }
                return pageIdx === 0
                  ? { ...page, totalCount: page.totalCount + 1 }
                  : page;
              }),
            };
          });
        } else {
          // Target is in the jump-cache region — insert + shift there, and
          // separately bump totalCount in the infinite-query cache.
          insertIntoJumpCache(rowId, newRow as RowItem, position);
          utils.row.infinite.setInfiniteData(rowQueryInput, (old): RowInfiniteData | undefined => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page, i) =>
                i === 0 ? { ...page, totalCount: page.totalCount + 1 } : page,
              ),
            };
          });
        }

        addProtectedRowId(newRow.id);

        const firstCol = visibleColumnsRef.current[0];
        if (firstCol) {
          requestAnimationFrame(() => {
            setActiveCell({ rowId: newRow.id, columnId: firstCol.id });
            startEditing({ rowId: newRow.id, columnId: firstCol.id }, '');
          });
        }

      },
    });
  }, [isValidTable, tableId, insertAtMut, setActiveCell, startEditing, getRowById, utils, rowQueryInput, insertIntoJumpCache, addProtectedRowId]);

  const handleInsertRecordAbove = useCallback(
    (rowId: string) => handleInsertAt(rowId, "above"),
    [handleInsertAt],
  );

  const handleInsertRecordBelow = useCallback(
    (rowId: string) => handleInsertAt(rowId, "below"),
    [handleInsertAt],
  );

  const handleDuplicateRecord = useCallback((rowId: string) => {
    if (!isValidTable) return;
    duplicateRowMut.mutate({ tableId, rowId });
  }, [isValidTable, tableId, duplicateRowMut]);

  const handleDeleteRecord = useCallback((rowId: string) => {
    if (!isValidTable) return;
    if (deletingRowIds.has(rowId)) return;
    if (activeCell?.rowId === rowId) clearSelection();

    const term = gridStoreApi.getState().search.trim();
    if (term) {
      const row = getRowById(rowId);
      if (row) {
        const cells = (row.cells ?? {}) as Record<string, unknown>;
        let delta = 0;
        for (const val of Object.values(cells)) {
          if (val != null) delta += countOccurrences(String(val), term);
        }
        if (delta > 0) addFindCountDelta(-delta);
      }
    }

    setDeletingRowIds((prev) => new Set(prev).add(rowId));

    const currentOrder = rowOrderIdsRef.current;
    if (currentOrder.length > 0 && currentOrder.includes(rowId)) {
      setRowOrderIdsTop(currentOrder.filter((id) => id !== rowId));
    }

    const isInInfinitePages = rowsRef.current.some(
      (r) => (r as RowItem).id === rowId,
    );
    utils.row.infinite.setInfiniteData(rowQueryInput, (old): RowInfiniteData | undefined => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page, i) => ({
          ...page,
          items: isInInfinitePages
            ? page.items.filter((r) => r.id !== rowId)
            : page.items,
          totalCount: i === 0 ? Math.max(0, page.totalCount - 1) : page.totalCount,
        })),
      };
    });

    if (!isInInfinitePages) {
      removeFromJumpCache(rowId);
    }

    deleteRowMut.mutate({ tableId, rowId });
  }, [isValidTable, tableId, activeCell, clearSelection, deletingRowIds, deleteRowMut, utils, rowQueryInput, setRowOrderIdsTop]);

  const handleDeleteField = useCallback((columnId: string) => {
    if (!isValidTable) return;
    if (activeCell?.columnId === columnId) clearSelection();
    deleteColumnMut.mutate({ tableId, columnId });
  }, [isValidTable, tableId, activeCell, clearSelection, deleteColumnMut]);

  const insertFieldTargetRef = useRef<{ anchorColId: string; side: "left" | "right" } | null>(null);

  const handleCreateField = useCallback((name: string, type: string, defaultValue: string, numberConfig?: NumberFormatConfig, insertPosition?: { anchorColId: string; side: "left" | "right" }) => {
    if (!isValidTable) return;
    insertFieldTargetRef.current = insertPosition ?? null;
    const dbType: "TEXT" | "NUMBER" = type === "Number" ? "NUMBER" : "TEXT";
    const baseName = name.trim() || (dbType === "NUMBER" ? "Number" : "Label");
    const existingNames = new Set(orderedColumns.map((c) => c.name));
    let fieldName = baseName;
    if (existingNames.has(fieldName)) {
      let i = 2;
      while (existingNames.has(`${baseName} ${i}`)) i++;
      fieldName = `${baseName} ${i}`;
    }
    createColumnMut.mutate({
      tableId,
      name: fieldName,
      type: dbType,
      defaultValue: defaultValue.trim() || undefined,
      numberConfig: numberConfig ?? undefined,
      viewId: activeViewIdFromStore ?? undefined,
      anchorColumnId: insertPosition?.anchorColId ?? undefined,
      insertSide: insertPosition?.side ?? undefined,
    });
  }, [isValidTable, tableId, activeViewIdFromStore, createColumnMut, orderedColumns]);

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

  const handleHideField = useCallback((columnId: string) => {
    toggleHiddenColumn(columnId);
  }, [toggleHiddenColumn]);

  const handleFilterByField = useCallback((columnId: string) => {
    const col = orderedColumns.find((c) => c.id === columnId);
    if (!col) return;
    const colType = col.type;
    const defaultOp = colType === "NUMBER" ? "equals" : "contains";
    const existingConditions = filterConditions ?? [];
    const newCondition = {
      id: crypto.randomUUID(),
      columnId,
      operator: defaultOp,
      value: "",
      conjunction: "and" as const,
    };
    setFilterConditions([...existingConditions, newCondition]);
    gridBarRef.current?.openFilterPanel();
  }, [orderedColumns, filterConditions, setFilterConditions]);

  const handleSortByField = useCallback((columnId: string, direction: "asc" | "desc") => {
    const col = orderedColumns.find((c) => c.id === columnId);
    if (!col) return;
    const colType: "TEXT" | "NUMBER" = col.type === "NUMBER" ? "NUMBER" : "TEXT";
    const existing = currentSorts.findIndex((s) => s.columnId === columnId);
    let newSorts;
    if (existing !== -1) {
      newSorts = currentSorts.map((s, i) => i === existing ? { ...s, direction } : s);
    } else {
      newSorts = [...currentSorts, { columnId, direction, type: colType }];
    }
    setSorts(newSorts);
    gridBarRef.current?.openSortPanel();
  }, [orderedColumns, currentSorts, setSorts]);

  const handleDuplicateField = useCallback((columnId: string, duplicateCells: boolean) => {
    if (!isValidTable) return;
    const col = orderedColumns.find((c) => c.id === columnId);
    if (!col) return;
    const dbType: "TEXT" | "NUMBER" = col.type === "NUMBER" ? "NUMBER" : "TEXT";
    const baseCopyName = `${col.name} copy`;
    const existingNames = new Set(orderedColumns.map((c) => c.name));
    let copyName = baseCopyName;
    if (existingNames.has(copyName)) {
      let i = 2;
      while (existingNames.has(`${baseCopyName} ${i}`)) i++;
      copyName = `${baseCopyName} ${i}`;
    }
    insertFieldTargetRef.current = { anchorColId: columnId, side: "right" };
    createColumnMut.mutate({
      tableId,
      name: copyName,
      type: dbType,
      defaultValue: col.defaultValue ?? undefined,
      numberConfig: col.config ? (col.config as { decimalPlaces: number; thousandsSep: string; showThousands: boolean; largeNumAbbrev: string | null; allowNegative: boolean }) : undefined,
      viewId: activeViewIdFromStore ?? undefined,
      sourceColumnId: duplicateCells ? columnId : undefined,
    });
  }, [isValidTable, orderedColumns, tableId, activeViewIdFromStore, createColumnMut]);

  const checkScrollProgress = () => {
    const el = tabsScrollRef.current;
    if (!el) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    
    setHasOverflow(maxScroll > 1);
    
    if (maxScroll <= 0) {
      setScrollProgress(0);
    } else {
      setScrollProgress(Math.min(1, Math.max(0, scrollLeft / maxScroll)));
    }
  };

  const scrollToEnd = (direction: 'left' | 'right') => {
    const el = tabsScrollRef.current;
    if (!el) return;
    
    el.scrollTo({
      left: direction === 'left' ? 0 : el.scrollWidth,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;

    checkScrollProgress();
    el.addEventListener('scroll', checkScrollProgress);
    
    const resizeObserver = new ResizeObserver(checkScrollProgress);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', checkScrollProgress);
      resizeObserver.disconnect();
    };
  }, [tables]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tableDropdownRef.current?.contains(event.target as Node)) {
        return;
      }
      if (tableDropdownButtonRef.current?.contains(event.target as Node)) {
        return;
      }
      if (addOrImportDropdownRef.current?.contains(event.target as Node)) {
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

  useEffect(() => {
    if (!isAddOrImportDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (addOrImportDropdownRef.current?.contains(event.target as Node)) {
        return;
      }
      if (addOrImportButtonRef.current?.contains(event.target as Node)) {
        return;
      }
      if (tableDropdownRef.current?.contains(event.target as Node)) {
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

  useEffect(() => {
    if (!isTableTitleDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (tableTitleDropdownRef.current?.contains(event.target as Node)) {
        return;
      }
      if (tableTitleDropdownButtonRef.current?.contains(event.target as Node)) {
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

  useEffect(() => {
    if (!isViewDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (viewDropdownRef.current?.contains(event.target as Node)) {
        return;
      }
      if (viewDropdownButtonRef.current?.contains(event.target as Node)) {
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

  useEffect(() => {
    if (!isRenamePopupOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (renamePopupRef.current?.contains(event.target as Node)) {
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

  useEffect(() => {
    if (isRenamePopupOpen && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenamePopupOpen]);

  useEffect(() => {
    if (!_pendingRenameTableId) return;
    if (tableId !== _pendingRenameTableId) return;
    const newTable = tables.find(t => t.id === _pendingRenameTableId);
    if (!newTable) return;

    const pendingId = _pendingRenameTableId;
    _pendingRenameTableId = null;

    // Poll until the new tab element is in the DOM
    const tryOpen = (attempts = 0) => {
      const tab = document.querySelector(`[data-table-id="${pendingId}"]`) as HTMLElement | null;
      if (tab) {
        const tabRect = tab.getBoundingClientRect();
        const transformOffset = 71;
        const minLeftMargin = 12;
        const minLeft = minLeftMargin + transformOffset;
        const left = Math.max(tabRect.left, minLeft);
        setRenamePopupPosition({ top: tabRect.bottom + 8, left });
        setRenameTableName(newTable.name);
        setRenameRecordName('Record');
        setIsRenamePopupOpen(true);
      } else if (attempts < 20) {
        requestAnimationFrame(() => tryOpen(attempts + 1));
      }
    };
    requestAnimationFrame(() => tryOpen());
  }, [tableId, tables]);

  useEffect(() => {
    if (isRenamingView && renameViewInputRef.current) {
      renameViewInputRef.current.focus();
      renameViewInputRef.current.select();
    }
  }, [isRenamingView]);

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
      const addTableRect = addTableSectionRef.current.getBoundingClientRect();
      
      let top = addTableRect.top;
      const maxTop = viewportHeight - dropdownHeight - bottomGap;
      if (top > maxTop) {
        top = maxTop;
      }
      
      let left = addTableRect.right + 4;
      let openLeft = false;
      
      if (left + dropdownWidth > viewportWidth - rightGap) {
        openLeft = true;
        left = addTableRect.left - dropdownWidth - 10;
      }
      
      setAddOrImportDropdownPosition({ top, left, openLeft });
    } else if (addOrImportButtonRef.current) {
      const buttonRect = addOrImportButtonRef.current.getBoundingClientRect();
      const top = buttonRect.bottom + 10;
      let left = buttonRect.left;
      
      if (left + dropdownWidth > viewportWidth - rightGap) {
        left = viewportWidth - dropdownWidth - rightGap;
      }
      
      setAddOrImportDropdownPosition({ top, left, openLeft: false });
    }
  }, [isAddOrImportDropdownOpen, addOrImportOpenedFromTableDropdown]);

  useEffect(() => {
    if (isTableDropdownOpen && tableDropdownButtonRef.current) {
      const buttonRect = tableDropdownButtonRef.current.getBoundingClientRect();
      const dropdownWidth = 456;
      const viewportWidth = window.innerWidth;
      const spaceOnRight = viewportWidth - buttonRect.left;
      setTableDropdownAlignRight(spaceOnRight < dropdownWidth);
    }
  }, [isTableDropdownOpen]);

  useEffect(() => {
    setIsTableTitleDropdownOpen(false);
    setTableTitleDropdownPosition(null);
  }, [activeTableId]);

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(tableSearchQuery.toLowerCase())
  );

  const handleTableSelect = (selectedTableId: string) => {
    router.push(`/bases/${baseId}/tables/${selectedTableId}`);
    setIsTableDropdownOpen(false);
    setTableSearchQuery('');
  };


  const clearSidebarCollapseTimer = () => {
    if (viewsSidebarCollapseTimerRef.current) {
      clearTimeout(viewsSidebarCollapseTimerRef.current);
      viewsSidebarCollapseTimerRef.current = null;
    }
  };

  const startSidebarCollapseTimer = () => {
    if (isViewsSidebarPinned) return;
    if (isCreateNewDropdownOpen || isCreateViewBoxOpen || contextMenuViewId) return;
    clearSidebarCollapseTimer();
    viewsSidebarCollapseTimerRef.current = setTimeout(() => {
      setIsViewsSidebarOpen(false);
    }, 500);
  };

  const handleToggleViewsSidebar = () => {
    clearSidebarCollapseTimer();
    if (isViewsSidebarOpen && isViewsSidebarPinned) {
      setIsViewsSidebarOpen(false);
      setIsViewsSidebarPinned(false);
    } else if (isViewsSidebarOpen && !isViewsSidebarPinned) {
      setIsViewsSidebarPinned(true);
    } else {
      setIsViewsSidebarOpen(true);
      setIsViewsSidebarPinned(true);
    }
  };

  const handleListButtonMouseEnter = () => {
    if (!isViewsSidebarOpen) {
      clearSidebarCollapseTimer();
      setIsViewsSidebarOpen(true);
      setIsViewsSidebarPinned(false);
    } else {
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
    if (!trimmed || !activeViewId) { setIsRenamingView(false); return; }
    if (trimmed === activeViewName) { setIsRenamingView(false); setShowDuplicateViewTooltip(false); return; }

    const isDuplicate = views.some(v => v.id !== activeViewId && v.name === trimmed);
    if (isDuplicate) {
      setShowDuplicateViewTooltip(true);
      if (duplicateViewTooltipTimerRef.current) clearTimeout(duplicateViewTooltipTimerRef.current);
      duplicateViewTooltipTimerRef.current = setTimeout(() => setShowDuplicateViewTooltip(false), 10000);
      return;
    }

    setShowDuplicateViewTooltip(false);
    if (duplicateViewTooltipTimerRef.current) clearTimeout(duplicateViewTooltipTimerRef.current);
    renameViewMut.mutate({ viewId: activeViewId, name: trimmed });
    setIsRenamingView(false);
  };

  const cancelRenameView = () => {
    setIsRenamingView(false);
    setShowDuplicateViewTooltip(false);
    if (duplicateViewTooltipTimerRef.current) clearTimeout(duplicateViewTooltipTimerRef.current);
  };

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
    if (!trimmed || !renamingSidebarViewId) { setRenamingSidebarViewId(null); return; }

    const view = views.find(v => v.id === renamingSidebarViewId);
    if (view && trimmed === view.name) { setRenamingSidebarViewId(null); setShowDuplicateViewTooltip(false); return; }

    const isDuplicate = views.some(v => v.id !== renamingSidebarViewId && v.name === trimmed);
    if (isDuplicate) {
      setShowDuplicateViewTooltip(true);
      if (duplicateViewTooltipTimerRef.current) clearTimeout(duplicateViewTooltipTimerRef.current);
      duplicateViewTooltipTimerRef.current = setTimeout(() => setShowDuplicateViewTooltip(false), 10000);
      return;
    }

    setShowDuplicateViewTooltip(false);
    if (duplicateViewTooltipTimerRef.current) clearTimeout(duplicateViewTooltipTimerRef.current);
    renameViewMut.mutate({ viewId: renamingSidebarViewId, name: trimmed });
    setRenamingSidebarViewId(null);
  }, [sidebarRenameValue, renamingSidebarViewId, views, renameViewMut]);

  const cancelSidebarRename = useCallback(() => {
    setRenamingSidebarViewId(null);
    setShowDuplicateViewTooltip(false);
    if (duplicateViewTooltipTimerRef.current) clearTimeout(duplicateViewTooltipTimerRef.current);
  }, []);

  return (
    <div className={styles.workspace}>
      <Rail />

      <div className={styles.mainArea}>
        <TopBar
          baseName={baseName}
          baseColor={baseColor}
          baseBorderColor={baseBorderColor}
          baseTextColor={baseTextColor}
        />

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
            showDuplicateTooltip={showDuplicateTooltip}
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
            showDuplicateViewTooltip={showDuplicateViewTooltip}
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
            findMatchCount={activeSearchTerm ? displayMatchCount : 0}
            findCurrentIndex={currentMatchIdx}
            isSearchPending={isSearchPending}
            onPrevMatch={handlePrevMatch}
            onNextMatch={handleNextMatch}
            rowHeightPreset={rowHeightPreset}
            onRowHeightPresetChange={setRowHeightPreset}
            wrapHeaders={wrapHeaders}
            onToggleWrapHeaders={() => setWrapHeaders(!wrapHeaders)}
            viewLoading={createViewMut.isPending}
          />

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
              showDuplicateViewTooltip={showDuplicateViewTooltip}
            />

            {/* Grid content wrapper — scopes the view-loading overlay to
                the grid portion only (sidebar stays visible & interactive) */}
            <div className={styles.gridContentWrapper}>
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
                virtualItems={virtualItems}
                totalSize={rowVirtualizer.getTotalSize()}
                totalCount={totalCount}
                DATA_ROW_HEIGHT={dataRowHeight}
                mapToActualIndex={mapToActualIndex}
                getRowAtIndex={getRowAtIndex}
                wrapHeaders={wrapHeaders}
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
                deletingRowIds={undefined} /* disabled — CSS max-height animation is incompatible with virtualized absolute positioning */
                searchTerm={activeSearchTerm}
                onReorderRow={handleReorderRow}
                canDragRows={canDragRows}
                onAddBulkRows={handleAddBulkRows}
                isBulkAdding={isBulkAdding}
                baseColor={baseColor}
                baseTextColor={baseTextColor}
                backfillingColumnIds={backfillingColumnIds}
              />

              {/* View loading overlay (new view creation)
                  Phase 1 (immediate): blank area covers grid
                  Phase 2 (after 500ms): spinner + progress bar fades in */}
              {createViewMut.isPending && (
                <div className={styles.viewLoadingOverlay}>
                  {showViewLoadingSpinner && (
                    <>
                      <div className={styles.viewLoadingProgressBar} style={{ '--base-color': baseColor } as React.CSSProperties} />
                      <div className={styles.viewLoadingContent}>
                        <svg className={styles.viewLoadingSpinner} viewBox="0 0 54 54" style={{ shapeRendering: 'geometricPrecision' }}>
                          <g>
                            <path d="M10.9,48.6c-1.6-1.3-2-3.6-0.7-5.3c1.3-1.6,3.6-2.1,5.3-0.8c0.8,0.5,1.5,1.1,2.4,1.5c7.5,4.1,16.8,2.7,22.8-3.4c1.5-1.5,3.8-1.5,5.3,0c1.4,1.5,1.4,3.9,0,5.3c-8.4,8.5-21.4,10.6-31.8,4.8C13,50.1,11.9,49.3,10.9,48.6z" fill="currentColor" />
                            <path d="M53.6,31.4c-0.3,2.1-2.3,3.5-4.4,3.2c-2.1-0.3-3.4-2.3-3.1-4.4c0.2-1.1,0.2-2.2,0.2-3.3c0-8.7-5.7-16.2-13.7-18.5c-2-0.5-3.2-2.7-2.6-4.7s2.6-3.2,4.7-2.6C46,4.4,53.9,14.9,53.9,27C53.9,28.5,53.8,30,53.6,31.4z" fill="currentColor" />
                            <path d="M16.7,1.9c1.9-0.8,4.1,0.2,4.8,2.2s-0.2,4.2-2.1,5c-7.2,2.9-12,10-12,18.1c0,1.6,0.2,3.2,0.6,4.7c0.5,2-0.7,4.1-2.7,4.6c-2,0.5-4-0.7-4.5-2.8C0.3,31.5,0,29.3,0,27.1C0,15.8,6.7,5.9,16.7,1.9z" fill="currentColor" />
                          </g>
                        </svg>
                        <div className={styles.viewLoadingText}>Loading this view...</div>
                        <div className={styles.viewLoadingSpacer}>&nbsp;</div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
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

