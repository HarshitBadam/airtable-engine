import type React from "react";
import { useWorkspace } from "~/components/grid/ui/GridWorkspaceContext";

export interface GridTableState {
  baseId: string;
  hasOverflow: boolean;
  scrollProgress: number;
  scrollToEnd: (direction: "left" | "right") => void;
  tabsScrollRef: React.RefObject<HTMLDivElement | null>;
  tables: Array<{ id: string; name: string }>;
  activeTableId: string;
  navigateToTable: (id: string) => void;
  isTableTitleDropdownOpen: boolean;
  setIsTableTitleDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tableTitleDropdownPosition: { top: number; left: number } | null;
  setTableTitleDropdownPosition: React.Dispatch<
    React.SetStateAction<{ top: number; left: number } | null>
  >;
  tableTitleDropdownButtonRef: React.RefObject<HTMLButtonElement | null>;
  tableTitleDropdownRef: React.RefObject<HTMLUListElement | null>;
  isRenamePopupOpen: boolean;
  renamePopupPosition: { top: number; left: number } | null;
  renamePopupRef: React.RefObject<HTMLDivElement | null>;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  renameTableName: string;
  setRenameTableName: React.Dispatch<React.SetStateAction<string>>;
  renameRecordName: string;
  showDuplicateTooltip: boolean;
  handleOpenRenamePopup: () => void;
  handleSaveRename: () => void;
  handleCancelRename: () => void;
  isTableDropdownOpen: boolean;
  setIsTableDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tableDropdownAlignRight: boolean;
  tableSearchQuery: string;
  setTableSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  hoveredTableId: string | null;
  setHoveredTableId: React.Dispatch<React.SetStateAction<string | null>>;
  filteredTables: Array<{ id: string; name: string }>;
  handleTableSelect: (id: string) => void;
  tableDropdownButtonRef: React.RefObject<HTMLButtonElement | null>;
  tableDropdownRef: React.RefObject<HTMLDivElement | null>;
  addTableSectionRef: React.RefObject<HTMLDivElement | null>;
  isAddOrImportDropdownOpen: boolean;
  setIsAddOrImportDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  addOrImportDropdownPosition: {
    top?: number;
    left?: number;
    right?: number;
    openLeft?: boolean;
  } | null;
  setAddOrImportOpenedFromTableDropdown: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  addOrImportButtonRef: React.RefObject<HTMLButtonElement | null>;
  addOrImportDropdownRef: React.RefObject<HTMLUListElement | null>;
  handleAddTable: () => void;
  handleOpenClearDataModal: () => void;
  handleOpenDeleteTablePopup: (event: React.MouseEvent<HTMLLIElement>) => void;
}

export function useGridTableState(): GridTableState {
  const {
    baseId,
    hasOverflow,
    scrollProgress,
    scrollToEnd,
    tabsScrollRef,
    tables,
    activeTableId,
    navigateToTable,
    isTableTitleDropdownOpen,
    setIsTableTitleDropdownOpen,
    tableTitleDropdownPosition,
    setTableTitleDropdownPosition,
    tableTitleDropdownButtonRef,
    tableTitleDropdownRef,
    isRenamePopupOpen,
    renamePopupPosition,
    renamePopupRef,
    renameInputRef,
    renameTableName,
    setRenameTableName,
    renameRecordName,
    showDuplicateTooltip,
    handleOpenRenamePopup,
    handleSaveRename,
    handleCancelRename,
    isTableDropdownOpen,
    setIsTableDropdownOpen,
    tableDropdownAlignRight,
    tableSearchQuery,
    setTableSearchQuery,
    hoveredTableId,
    setHoveredTableId,
    filteredTables,
    handleTableSelect,
    tableDropdownButtonRef,
    tableDropdownRef,
    addTableSectionRef,
    isAddOrImportDropdownOpen,
    setIsAddOrImportDropdownOpen,
    addOrImportDropdownPosition,
    setAddOrImportOpenedFromTableDropdown,
    addOrImportButtonRef,
    addOrImportDropdownRef,
    handleAddTable,
    handleOpenClearDataModal,
    handleOpenDeleteTablePopup,
  } = useWorkspace();

  return {
    baseId,
    hasOverflow,
    scrollProgress,
    scrollToEnd,
    tabsScrollRef,
    tables,
    activeTableId,
    navigateToTable,
    isTableTitleDropdownOpen,
    setIsTableTitleDropdownOpen,
    tableTitleDropdownPosition,
    setTableTitleDropdownPosition,
    tableTitleDropdownButtonRef,
    tableTitleDropdownRef,
    isRenamePopupOpen,
    renamePopupPosition,
    renamePopupRef,
    renameInputRef,
    renameTableName,
    setRenameTableName,
    renameRecordName,
    showDuplicateTooltip,
    handleOpenRenamePopup,
    handleSaveRename,
    handleCancelRename,
    isTableDropdownOpen,
    setIsTableDropdownOpen,
    tableDropdownAlignRight,
    tableSearchQuery,
    setTableSearchQuery,
    hoveredTableId,
    setHoveredTableId,
    filteredTables,
    handleTableSelect,
    tableDropdownButtonRef,
    tableDropdownRef,
    addTableSectionRef,
    isAddOrImportDropdownOpen,
    setIsAddOrImportDropdownOpen,
    addOrImportDropdownPosition,
    setAddOrImportOpenedFromTableDropdown,
    addOrImportButtonRef,
    addOrImportDropdownRef,
    handleAddTable,
    handleOpenClearDataModal,
    handleOpenDeleteTablePopup,
  };
}
