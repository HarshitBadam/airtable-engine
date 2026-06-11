"use client";

import { createContext, useContext } from "react";
import type { GridColumnDef } from "./GridRow";
import type { RowItem } from "~/components/grid/hooks/useGridRows";
import type { VirtualItem } from "@tanstack/react-virtual";
import type { GridScrollController } from "~/components/grid/hooks/layout/useGridVirtualizer";
import type { NumberFormatConfig } from "~/shared/numberUtils";
import type { RowHeightPreset, ViewConfigInput } from "~/shared/grid";

export interface GridBarHandle {
  openFilterPanel: () => void;
  openSortPanel: () => void;
}

// GridWorkspaceState is composed from these domain slices.
// useWorkspace() returns the flat union — consuming components need not change.

export interface BaseInfoState {
  baseId: string;
  baseColor: string;
  baseBorderColor: string;
  baseTextColor: string;
  baseName: string;
}

export interface TableChromeState {
  tables: Array<{ id: string; name: string }>;
  activeTableId: string;
  filteredTables: Array<{ id: string; name: string }>;
  isTableDropdownOpen: boolean;
  setIsTableDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAddOrImportDropdownOpen: boolean;
  setIsAddOrImportDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  addOrImportOpenedFromTableDropdown: boolean;
  setAddOrImportOpenedFromTableDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  isTableTitleDropdownOpen: boolean;
  setIsTableTitleDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tableTitleDropdownPosition: { top: number; left: number } | null;
  setTableTitleDropdownPosition: React.Dispatch<React.SetStateAction<{ top: number; left: number } | null>>;
  addOrImportDropdownPosition: { top?: number; left?: number; right?: number; openLeft?: boolean } | null;
  tableSearchQuery: string;
  setTableSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  hoveredTableId: string | null;
  setHoveredTableId: React.Dispatch<React.SetStateAction<string | null>>;
  tableDropdownAlignRight: boolean;
  isRenamePopupOpen: boolean;
  renamePopupPosition: { top: number; left: number } | null;
  renameTableName: string;
  setRenameTableName: React.Dispatch<React.SetStateAction<string>>;
  renameRecordName: string;
  showDuplicateTooltip: boolean;
  isClearDataModalOpen: boolean;
  isDeleteTablePopupOpen: boolean;
  deleteTablePopupPosition: { top: number; left: number } | null;
  scrollProgress: number;
  hasOverflow: boolean;
  tabsScrollRef: React.RefObject<HTMLDivElement | null>;
  tableDropdownRef: React.RefObject<HTMLDivElement | null>;
  tableDropdownButtonRef: React.RefObject<HTMLButtonElement | null>;
  addOrImportDropdownRef: React.RefObject<HTMLUListElement | null>;
  addOrImportButtonRef: React.RefObject<HTMLButtonElement | null>;
  addTableSectionRef: React.RefObject<HTMLDivElement | null>;
  tableTitleDropdownRef: React.RefObject<HTMLUListElement | null>;
  tableTitleDropdownButtonRef: React.RefObject<HTMLButtonElement | null>;
  renamePopupRef: React.RefObject<HTMLDivElement | null>;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  handleAddTable: () => void;
  handleOpenRenamePopup: () => void;
  handleSaveRename: () => void;
  handleCancelRename: () => void;
  handleOpenClearDataModal: () => void;
  handleCloseClearDataModal: () => void;
  handleClearData: () => void;
  handleOpenDeleteTablePopup: (event: React.MouseEvent<HTMLLIElement>) => void;
  handleCloseDeleteTablePopup: () => void;
  handleDeleteTable: () => void;
  handleTableSelect: (id: string) => void;
  scrollToEnd: (direction: "left" | "right") => void;
  navigateToTable: (id: string) => void;
}

export interface ViewsState {
  views: { id: string; name: string }[];
  activeViewId: string | null;
  setActiveViewId: (id: string) => void;
  activeViewName: string;
  canDeleteView: boolean;
  isCreateViewBoxOpen: boolean;
  setIsCreateViewBoxOpen: React.Dispatch<React.SetStateAction<boolean>>;
  createViewName: string;
  setCreateViewName: React.Dispatch<React.SetStateAction<string>>;
  computeNextViewName: () => string;
  createViewMut: { isPending: boolean; mutate: (args: { tableId: string; name: string; config: ViewConfigInput }) => void };
  showViewLoadingSpinner: boolean;
  deleteViewMut: { mutate: (input: { viewId: string }) => void };
  duplicateViewMut: { mutate: (input: { viewId: string }) => void };
  renameViewMut: { mutate: (input: { viewId: string; name?: string; config?: ViewConfigInput }) => void };
  isViewDropdownOpen: boolean;
  setIsViewDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  viewDropdownRef: React.RefObject<HTMLUListElement | null>;
  viewDropdownButtonRef: React.RefObject<HTMLDivElement | null>;
  isViewsSidebarOpen: boolean;
  viewSearchQuery: string;
  setViewSearchQuery: (q: string) => void;
  favoritedViews: Set<string>;
  isCreateNewDropdownOpen: boolean;
  setIsCreateNewDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  contextMenuViewId: string | null;
  setContextMenuViewId: React.Dispatch<React.SetStateAction<string | null>>;
  contextMenuPosition: { top: number; left: number } | null;
  setContextMenuPosition: React.Dispatch<React.SetStateAction<{ top: number; left: number } | null>>;
  handleToggleViewsSidebar: () => void;
  handleListButtonMouseEnter: () => void;
  handleListButtonMouseLeave: () => void;
  handleSidebarMouseEnter: () => void;
  handleSidebarMouseLeave: () => void;
  handleToggleViewFavorite: (viewId: string) => void;
  isRenamingView: boolean;
  setIsRenamingView: (val: boolean) => void;
  renameViewValue: string;
  setRenameViewValue: React.Dispatch<React.SetStateAction<string>>;
  renameViewInputRef: React.RefObject<HTMLInputElement | null>;
  startRenamingView: () => void;
  commitRenameView: () => void;
  cancelRenameView: () => void;
  showDuplicateViewTooltip: boolean;
  renamingSidebarViewId: string | null;
  sidebarRenameValue: string;
  setSidebarRenameValue: (val: string) => void;
  startSidebarRename: (viewId: string) => void;
  commitSidebarRename: () => void;
  cancelSidebarRename: () => void;
}

export interface ColumnsState {
  orderedColumns: GridColumnDef[];
  visibleColumns: GridColumnDef[];
  hiddenColumnIds: string[];
  toggleHiddenColumn: (columnId: string) => void;
  handleHideAllColumns: () => void;
  handleShowAllColumns: () => void;
  handleReorderColumns: (fromIndex: number, toIndex: number) => void;
  currentSorts: Array<{ columnId: string; direction: "asc" | "desc"; type: "TEXT" | "NUMBER" }>;
  sortHandlers: {
    pickSort: (columnId: string, columnType: "TEXT" | "NUMBER") => void;
    addSort: (columnId: string, columnType: "TEXT" | "NUMBER") => void;
    changeSortField: (index: number, columnId: string, columnType: "TEXT" | "NUMBER") => void;
    changeSortDirection: (index: number, direction: "asc" | "desc") => void;
    removeSort: (index: number) => void;
  };
  autoSort: boolean;
  effectiveSortCount: number;
  hasTemporarySorts: boolean;
  handleToggleAutoSort: () => void;
  handleSaveSorts: () => void;
  handleCancelSorts: () => void;
  handleDeleteField: (columnId: string) => void;
  handleCreateField: (
    name: string,
    type: string,
    defaultValue: string,
    numberConfig?: NumberFormatConfig,
    insertPosition?: { anchorColId: string; side: "left" | "right" },
  ) => void;
  handleEditFieldSave: (columnId: string, name: string, numberConfig?: NumberFormatConfig) => void;
  handleHideField: (columnId: string) => void;
  handleFilterByField: (columnId: string) => void;
  handleSortByField: (columnId: string, direction: "asc" | "desc") => void;
  handleDuplicateField: (columnId: string, duplicateCells: boolean) => void;
  backfillingColumnIds: ReadonlySet<string>;
}

export interface GridLayoutState {
  gridBarRef: React.RefObject<GridBarHandle | null>;
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
  freezeWidth: number;
  rowHeight: number;
  scrollableColumnsWidth: number;
  frozenColumns: GridColumnDef[];
  scrollableColumns: GridColumnDef[];
  getColWidth: (colId: string) => number;
  handleResizeStart: (e: React.MouseEvent, colId: string) => void;
  handleRowHeightResizeStart: (e: React.MouseEvent) => void;
  handleFreezeDragStart: (e: React.MouseEvent) => void;
  handleFreezeLineMouseMove: (e: React.MouseEvent) => void;
}

export interface GridDataState {
  rows: { id: string; cells: unknown }[];
  virtualItems: VirtualItem[];
  totalVirtualSize: number;
  totalCount: number;
  dataRowHeight: number;
  /** Current JS-driven vertical scroll offset (replaces native scrollTop). */
  scrollOffset: number;
  /** Imperative vertical scroll controller (replaces scroller.scrollTop). */
  scroll: GridScrollController;
  mapToActualIndex: (virtualIndex: number) => number;
  getRowAtIndex: (index: number) => RowItem | null;
  getCellValue: (cells: unknown, colId: string) => string;
  stableCommit: (args: {
    rowId: string;
    columnId: string;
    columnType: "TEXT" | "NUMBER";
    numberConfig?: unknown;
  }) => void;
  stableCancel: () => void;
}

export interface RowMutationsState {
  handleAddRow: () => void;
  handleAddBulkRows: (populate?: boolean) => void;
  handleInsertRecordAbove: (rowId: string) => void;
  handleInsertRecordBelow: (rowId: string) => void;
  handleDuplicateRecord: (rowId: string) => void;
  handleDeleteRecord: (rowId: string) => void;
  handleReorderRow: (rowId: string, fromIndex: number, toIndex: number) => void;
  isBulkAdding: boolean;
  canDragRows: boolean;
}

export interface SearchState {
  search: string;
  activeSearchTerm: string;
  displayMatchCount: number;
  currentMatchIdx: number;
  isSearchPending: boolean;
  handleNextMatch: () => void;
  handlePrevMatch: () => void;
}

export interface DisplayState {
  rowHeightPreset: RowHeightPreset;
  setRowHeightPreset: (preset: RowHeightPreset) => void;
  wrapHeaders: boolean;
  setWrapHeaders: (val: boolean) => void;
}

// The flat union is intentional: useWorkspace() consumers destructure directly.
// Each domain interface above is the authoritative source for its slice.

export type GridWorkspaceState =
  & BaseInfoState
  & TableChromeState
  & ViewsState
  & ColumnsState
  & GridLayoutState
  & GridDataState
  & RowMutationsState
  & SearchState
  & DisplayState;

const GridWorkspaceContext = createContext<GridWorkspaceState | null>(null);

export function GridWorkspaceProvider({
  value,
  children,
}: {
  value: GridWorkspaceState;
  children: React.ReactNode;
}) {
  return (
    <GridWorkspaceContext.Provider value={value}>
      {children}
    </GridWorkspaceContext.Provider>
  );
}

export function useWorkspace(): GridWorkspaceState {
  const ctx = useContext(GridWorkspaceContext);
  if (!ctx)
    throw new Error("useWorkspace must be used within GridWorkspaceProvider");
  return ctx;
}
