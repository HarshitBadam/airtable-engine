import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import styles from "./GridBar.module.css";
import { HideFieldsPanel } from "./HideFieldsPanel";
import type { HideFieldColumn } from "./HideFieldsPanel";
import { SortPanel } from "./SortPanel";
import type { SortFieldColumn, ActiveSort } from "./SortPanel";
import { FindBar } from "./FindBar";
import { FilterPanel } from "./FilterPanel";
import { useGridStore } from "~/components/grid/grid-store";
import type { RowHeightPreset } from "~/shared/grid";

export interface GridBarHandle {
  openFilterPanel: () => void;
  openSortPanel: () => void;
}

interface GridBarProps {
  // Views sidebar
  isViewsSidebarOpen: boolean;
  handleToggleViewsSidebar: () => void;
  handleListButtonMouseEnter: () => void;
  handleListButtonMouseLeave: () => void;

  // View dropdown button ref
  viewDropdownButtonRef: React.RefObject<HTMLDivElement | null>;

  // Rename view
  isRenamingView: boolean;
  renameViewInputRef: React.RefObject<HTMLInputElement | null>;
  renameViewValue: string;
  setRenameViewValue: React.Dispatch<React.SetStateAction<string>>;
  startRenamingView: () => void;
  commitRenameView: () => void;
  cancelRenameView: () => void;
  showDuplicateViewTooltip: boolean;

  // View dropdown
  isViewDropdownOpen: boolean;
  setIsViewDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsCreateNewDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // View dropdown menu
  viewDropdownRef: React.RefObject<HTMLUListElement | null>;
  activeViewName: string;
  activeViewId: string | null;
  canDeleteView: boolean;
  deleteViewMut: { mutate: (input: { viewId: string }) => void };

  // Hide fields
  columns: HideFieldColumn[];
  hiddenColumnIds: string[];
  onToggleColumn: (columnId: string) => void;
  onHideAll: () => void;
  onShowAll: () => void;
  onReorderColumns?: (fromIndex: number, toIndex: number) => void;

  // Sort
  sortColumns: SortFieldColumn[];
  currentSorts: ActiveSort[];
  effectiveSortCount: number;
  hasTemporarySorts: boolean;
  autoSort: boolean;
  onPickSort: (columnId: string, columnType: "TEXT" | "NUMBER") => void;
  onAddSort: (columnId: string, columnType: "TEXT" | "NUMBER") => void;
  onChangeSortField: (index: number, columnId: string, columnType: "TEXT" | "NUMBER") => void;
  onChangeDirection: (index: number, direction: "asc" | "desc") => void;
  onRemoveSort: (index: number) => void;
  onToggleAutoSort: () => void;
  onSaveSorts: () => void;
  onCancelSorts: () => void;

  // Filter panel
  baseColor?: string;

  // Search / Find — passed from GridWorkspace (client-side match data)
  findMatchCount: number;
  findCurrentIndex: number;
  isSearchPending: boolean;
  onPrevMatch: () => void;
  onNextMatch: () => void;

  // Row height preset
  rowHeightPreset: RowHeightPreset;
  onRowHeightPresetChange: (preset: RowHeightPreset) => void;
  wrapHeaders: boolean;
  onToggleWrapHeaders: () => void;

  // View loading state (shows skeleton pills instead of tools)
  viewLoading?: boolean;
}

export const GridBar = forwardRef<GridBarHandle, GridBarProps>(function GridBar({
  isViewsSidebarOpen: _isViewsSidebarOpen,
  handleToggleViewsSidebar,
  handleListButtonMouseEnter,
  handleListButtonMouseLeave,
  viewDropdownButtonRef,
  isRenamingView,
  renameViewInputRef,
  renameViewValue,
  setRenameViewValue,
  startRenamingView,
  commitRenameView,
  cancelRenameView,
  showDuplicateViewTooltip,
  isViewDropdownOpen,
  setIsViewDropdownOpen,
  setIsCreateNewDropdownOpen,
  viewDropdownRef,
  activeViewName,
  activeViewId,
  canDeleteView,
  deleteViewMut,
  columns,
  hiddenColumnIds,
  onToggleColumn,
  onHideAll,
  onShowAll,
  sortColumns,
  currentSorts,
  effectiveSortCount,
  hasTemporarySorts,
  autoSort,
  onPickSort,
  onAddSort,
  onChangeSortField,
  onChangeDirection,
  onRemoveSort,
  onToggleAutoSort,
  onSaveSorts,
  onCancelSorts,
  onReorderColumns,
  baseColor,
  findMatchCount,
  findCurrentIndex,
  isSearchPending,
  onPrevMatch,
  onNextMatch,
  rowHeightPreset,
  onRowHeightPresetChange,
  wrapHeaders,
  onToggleWrapHeaders,
  viewLoading,
}: GridBarProps, ref) {
  // === ZUSTAND STORE — search ===
  const search = useGridStore((s) => s.search);
  const setSearch = useGridStore((s) => s.setSearch);

  // === ZUSTAND STORE — filter conditions (for button label) ===
  const filterConditions = useGridStore((s) => s.filterConditions) ?? [];

  // === HIDE FIELDS PANEL STATE ===
  const [isHideFieldsOpen, setIsHideFieldsOpen] = useState(false);
  const hideFieldsButtonRef = useRef<HTMLButtonElement>(null);
  const hideFieldsPanelRef = useRef<HTMLDivElement>(null);

  // === SORT PANEL STATE ===
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const sortPanelRef = useRef<HTMLDivElement>(null);

  // === FILTER PANEL STATE (declared early for imperative handle) ===
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // === IMPERATIVE HANDLE — allows parent to open panels programmatically ===
  useImperativeHandle(ref, () => ({
    openFilterPanel: () => setIsFilterOpen(true),
    openSortPanel: () => setIsSortOpen(true),
  }), []);

  // === ROW HEIGHT DROPDOWN STATE ===
  const [isRowHeightOpen, setIsRowHeightOpen] = useState(false);
  const rowHeightButtonRef = useRef<HTMLDivElement>(null);
  const rowHeightDropdownRef = useRef<HTMLDivElement>(null);

  // Close row height dropdown on outside click
  useEffect(() => {
    if (!isRowHeightOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !rowHeightDropdownRef.current?.contains(target) &&
        !rowHeightButtonRef.current?.contains(target)
      ) {
        setIsRowHeightOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isRowHeightOpen]);

  // === FIND BAR STATE ===
  const [isFindOpen, setIsFindOpen] = useState(false);

  const toggleFindBar = useCallback(() => {
    setIsFindOpen((prev) => !prev);
  }, []);

  const closeFindBar = useCallback(() => {
    setIsFindOpen(false);
    setSearch("");
  }, [setSearch]);

  /** Push FindBar input changes into the Zustand store (which feeds useGridRows). */
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
    },
    [setSearch],
  );

  /**
   * Compute totalMatches for FindBar:
   * - undefined → no search text, or still loading with no count yet
   * - 0        → "No results"
   * - >0       → "X of Y" + nav arrows
   * Show count whenever we have search and (we have matches, or we're done loading).
   */
  const findBarTotalMatches = useMemo(() => {
    if (!search.trim()) return undefined;
    if (findMatchCount > 0) return findMatchCount; // show even while refetching
    if (!isSearchPending) return findMatchCount;   // show 0 when done loading
    return undefined;                              // pending and no count yet
  }, [search, isSearchPending, findMatchCount]);

  const findBarMatchIndex =
    findBarTotalMatches !== undefined && findBarTotalMatches > 0
      ? findCurrentIndex + 1 // 1-based for display
      : 0;

  // Cmd+F / Ctrl+F keyboard shortcut to open find bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setIsFindOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleHideFieldsPanel = useCallback(() => {
    setIsHideFieldsOpen((prev) => !prev);
  }, []);

  // Click-outside handler
  useEffect(() => {
    if (!isHideFieldsOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (hideFieldsPanelRef.current?.contains(event.target as Node)) {
        return;
      }
      if (hideFieldsButtonRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsHideFieldsOpen(false);
    }

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isHideFieldsOpen]);

  // Escape key to close
  useEffect(() => {
    if (!isHideFieldsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsHideFieldsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isHideFieldsOpen]);

  // === SORT PANEL HANDLERS ===
  const toggleSortPanel = useCallback(() => {
    setIsSortOpen((prev) => !prev);
  }, []);

  // Click-outside handler for sort panel
  useEffect(() => {
    if (!isSortOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (sortPanelRef.current?.contains(event.target as Node)) {
        return;
      }
      if (sortButtonRef.current?.contains(event.target as Node)) {
        return;
      }
      // Don't close sort panel when clicking inside a portal sub-dropdown
      if ((event.target as HTMLElement).closest("[data-sort-subdropdown]")) {
        return;
      }
      setIsSortOpen(false);
    }

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSortOpen]);

  // Escape key to close sort panel
  useEffect(() => {
    if (!isSortOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSortOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSortOpen]);

  // Handle sort field pick — set sort ascending; close panel only if no sort was active
  const handleSortPick = useCallback(
    (columnId: string, columnType: "TEXT" | "NUMBER") => {
      onPickSort(columnId, columnType);
      // Don't close the panel — the active sort view will now show
    },
    [onPickSort],
  );

  // Handle removing a sort at index — if no sorts left, close the panel
  const handleRemoveSort = useCallback(
    (index: number) => {
      onRemoveSort(index);
      // If removing the last sort, close the panel
      if (currentSorts.length <= 1) {
        setIsSortOpen(false);
      }
    },
    [onRemoveSort, currentSorts.length],
  );

  const toggleFilterPanel = useCallback(() => {
    setIsFilterOpen((prev) => !prev);
  }, []);

  // Click-outside handler for filter panel
  useEffect(() => {
    if (!isFilterOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (filterPanelRef.current?.contains(target)) {
        return;
      }
      if (filterButtonRef.current?.contains(target)) {
        return;
      }
      // FilterPanel renders sub-dropdowns (field/operator/conjunction) as
      // portals into document.body — don't treat those clicks as "outside".
      if (target.closest?.("[data-filter-subdropdown]")) {
        return;
      }
      setIsFilterOpen(false);
    }

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFilterOpen]);

  // Escape key to close filter panel
  useEffect(() => {
    if (!isFilterOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFilterOpen]);

  // === FILTER BUTTON LABEL ===
  // A condition is "active" when it has a non-empty value (or is_empty/is_not_empty which need no value)
  const activeFilterConditions = filterConditions.filter(
    (c) => c.value.trim() !== "" || c.operator === "is_empty" || c.operator === "is_not_empty",
  );
  const activeFilterCount = activeFilterConditions.length;
  const filterButtonLabel = (() => {
    if (activeFilterCount === 0) return "Filter";
    const firstName = columns.find((col) => col.id === activeFilterConditions[0]?.columnId)?.name ?? "field";
    if (activeFilterCount === 1) return `Filtered by ${firstName}`;
    const otherCount = activeFilterCount - 1;
    return `Filtered by ${firstName} and ${otherCount} other field${otherCount > 1 ? "s" : ""}`;
  })();
  const isFilterActive = activeFilterCount > 0;

  return (
    <div
      className={styles.gridBar}
      onContextMenu={(e) => {
        // Don't hijack right-click on buttons
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        setIsViewDropdownOpen(true);
        setIsCreateNewDropdownOpen(false);
      }}
    >
      {/* Left section */}
      <div className={styles.gridBarLeft}>
        {/* List icon button (toggles views sidebar) */}
        <button
          type="button"
          className={styles.gridBarListButton}
          onClick={handleToggleViewsSidebar}
          onMouseEnter={handleListButtonMouseEnter}
          onMouseLeave={handleListButtonMouseLeave}
        >
          <svg className={styles.gridBarListButtonIcon} viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="nonzero" d="M2.5 11.5C2.36739 11.5 2.24021 11.5527 2.14645 11.6464C2.05268 11.7402 2 11.8674 2 12C2 12.1326 2.05268 12.2598 2.14645 12.3536C2.24021 12.4473 2.36739 12.5 2.5 12.5H13.5C13.6326 12.5 13.7598 12.4473 13.8536 12.3536C13.9473 12.2598 14 12.1326 14 12C14 11.8674 13.9473 11.7402 13.8536 11.6464C13.7598 11.5527 13.6326 11.5 13.5 11.5H2.5Z M2.5 3.5C2.36739 3.5 2.24021 3.55268 2.14645 3.64645C2.05268 3.74021 2 3.86739 2 4C2 4.13261 2.05268 4.25979 2.14645 4.35355C2.24021 4.44732 2.36739 4.5 2.5 4.5H13.5C13.6326 4.5 13.7598 4.44732 13.8536 4.35355C13.9473 4.25979 14 4.13261 14 4C14 3.86739 13.9473 3.74021 13.8536 3.64645C13.7598 3.55268 13.6326 3.5 13.5 3.5H2.5Z M2.5 7.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H2.5Z" />
          </svg>
        </button>

        {/* Grid View selector */}
        <div
          ref={viewDropdownButtonRef}
          className={`${styles.gridBarViewSelector} ${isRenamingView ? styles.gridBarViewSelectorRenaming : ''}`}
          onClick={isRenamingView ? undefined : () => {
            setIsViewDropdownOpen((prev) => !prev);
            setIsCreateNewDropdownOpen(false);
          }}
          onDoubleClick={isRenamingView ? undefined : () => startRenamingView()}
        >
          {isRenamingView ? (
            <div className={styles.gridBarRenameInputWrapper}>
              <input
                ref={renameViewInputRef}
                className={styles.gridBarRenameInput}
                value={renameViewValue}
                onChange={(e) => setRenameViewValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRenameView();
                  if (e.key === 'Escape') cancelRenameView();
                }}
                onBlur={() => {
                  if (showDuplicateViewTooltip) {
                    cancelRenameView();
                  } else {
                    commitRenameView();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
              {showDuplicateViewTooltip && (
                <div className={styles.viewRenameTooltip}>
                  <div className={styles.viewRenameTooltipContent}>
                    Please enter a unique view name
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Grid Feature icon */}
              <svg className={styles.gridBarViewIcon} viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M2.5 2C1.67157 2 1 2.67157 1 3.5V12.5C1 13.3284 1.67157 14 2.5 14H13.5C14.3284 14 15 13.3284 15 12.5V3.5C15 2.67157 14.3284 2 13.5 2H2.5ZM2 3.5C2 3.22386 2.22386 3 2.5 3H13.5C13.7761 3 14 3.22386 14 3.5V5H2V3.5ZM8.5 6H14V9H8.5V6ZM7.5 9V6H2V9H7.5ZM2 10V12.5C2 12.7761 2.22386 13 2.5 13H7.5V10H2ZM8.5 10H14V12.5C14 12.7761 13.7761 13 13.5 13H8.5V10Z" />
              </svg>
              {/* Grid View text */}
              <span className={styles.gridBarViewText}>{activeViewName}</span>
              {/* Dropdown chevron */}
              <svg className={styles.gridBarViewChevron} viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="nonzero" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" />
              </svg>
            </>
          )}

          {/* View Dropdown Menu (rendered via portal to escape stacking contexts) */}
          {!isRenamingView && isViewDropdownOpen && (() => {
            const vdRect = viewDropdownButtonRef.current?.getBoundingClientRect();
            const vdStyle: React.CSSProperties = vdRect
              ? { position: 'fixed', top: vdRect.bottom + 8, left: vdRect.left, zIndex: 99999 }
              : {};
            return createPortal(
            <ul ref={viewDropdownRef} className={styles.viewDropdownMenu} style={vdStyle} onClick={(e) => e.stopPropagation()}>
              {/* Collaborative view */}
              <li className={styles.viewDropdownCollaborativeItem}>
                <div className={styles.viewDropdownCollaborativeRow}>
                  {/* UsersThree icon */}
                  <svg className={styles.viewDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                    <path fillRule="nonzero" d="M3.68726 2.76918C3.00369 2.77619 2.31788 3.05605 1.8208 3.65761C0.919321 4.74857 1.17576 6.24775 2.08557 7.09572C1.40673 7.38504 0.802933 7.84404 0.349488 8.4507C0.310181 8.50329 0.281619 8.56312 0.265432 8.62675C0.249245 8.69038 0.24575 8.75658 0.255147 8.82157C0.264544 8.88656 0.286648 8.94905 0.320199 9.00549C0.353749 9.06194 0.398088 9.11122 0.450684 9.15053C0.503281 9.18983 0.563104 9.21839 0.626738 9.23458C0.690373 9.25077 0.756572 9.25426 0.821558 9.24487C0.886543 9.23547 0.949041 9.21337 1.00548 9.17981C1.06193 9.14626 1.11121 9.10193 1.15051 9.04933C1.76315 8.2297 2.72586 7.74834 3.74915 7.75001C3.74907 7.75005 3.74923 7.74997 3.74915 7.75001C3.74953 7.75001 3.75011 7.75001 3.75049 7.75001C3.87664 7.74769 3.99725 7.69777 4.08814 7.61024C4.09539 7.60337 4.10243 7.59629 4.10925 7.589C4.19691 7.49831 4.24706 7.37783 4.24963 7.25172C4.24951 7.252 4.24976 7.25144 4.24963 7.25172C4.24959 7.25147 4.24992 7.25038 4.24988 7.25013C4.24984 7.25034 4.24992 7.24993 4.24988 7.25013C4.24976 7.24984 4.24976 7.24894 4.24963 7.24865C4.24718 7.12237 4.19703 7.0017 4.10925 6.91088C4.10254 6.90377 4.09562 6.89685 4.0885 6.89013C3.99767 6.80248 3.87706 6.75243 3.75086 6.75001C3.75044 6.75001 3.75005 6.75014 3.74963 6.75014C3.74967 6.75018 3.74959 6.7501 3.74963 6.75014C2.44509 6.75147 1.76078 5.30012 2.59168 4.29457C3.42258 3.28902 4.97671 3.68735 5.22131 4.96876C5.23363 5.03326 5.25853 5.09471 5.29459 5.14958C5.33066 5.20446 5.37718 5.25169 5.4315 5.28859C5.48582 5.32549 5.54687 5.35132 5.61118 5.36462C5.67548 5.37792 5.74178 5.37843 5.80628 5.3661C5.93651 5.34123 6.05154 5.26564 6.12605 5.15596C6.20057 5.04629 6.22847 4.91151 6.20361 4.78126C5.95974 3.50367 4.82653 2.7575 3.68726 2.76918Z M12.3127 2.76918C11.1735 2.7575 10.0403 3.50367 9.79639 4.78126C9.77154 4.91151 9.79943 5.04629 9.87395 5.15596C9.94846 5.26564 10.0635 5.34123 10.1937 5.3661C10.2582 5.37843 10.3245 5.37792 10.3888 5.36462C10.4531 5.35132 10.5142 5.32549 10.5685 5.28859C10.6228 5.25169 10.6693 5.20446 10.7054 5.14958C10.7415 5.09471 10.7664 5.03326 10.7787 4.96876C11.0233 3.68735 12.5774 3.28902 13.4083 4.29457C14.2392 5.30012 13.555 6.75134 12.2505 6.75001C12.2505 6.74997 12.2504 6.75005 12.2505 6.75001C12.25 6.75001 12.2496 6.75001 12.2491 6.75001C12.1871 6.76292 12.1282 6.78748 12.0753 6.8224C12.0115 6.83534 11.9508 6.86064 11.8966 6.89686C11.8603 6.95112 11.835 7.01196 11.8221 7.07594C11.7873 7.12872 11.7629 7.18762 11.75 7.24952C11.75 7.24931 11.7501 7.24973 11.75 7.24952C11.75 7.24976 11.7501 7.25064 11.75 7.25088C11.7629 7.31289 11.7875 7.37187 11.8224 7.42471C11.8353 7.48856 11.8606 7.54927 11.8969 7.60342C11.9511 7.63969 12.0119 7.66499 12.0759 7.67788C12.1287 7.71269 12.1876 7.73717 12.2495 7.75003C12.2499 7.75003 12.2502 7.7499 12.2506 7.7499C12.2505 7.74986 12.2507 7.74994 12.2506 7.7499C13.2738 7.7481 14.237 8.22964 14.8495 9.04934C14.8888 9.10194 14.9381 9.14628 14.9945 9.17983C15.051 9.21338 15.1135 9.23548 15.1785 9.24488C15.2434 9.25428 15.3096 9.25078 15.3733 9.2346C15.4369 9.21841 15.4967 9.18985 15.5493 9.15054C15.6019 9.11123 15.6463 9.06195 15.6798 9.00551C15.7134 8.94907 15.7355 8.88657 15.7449 8.82158C15.7543 8.7566 15.7508 8.6904 15.7346 8.62676C15.7184 8.56313 15.6898 8.50331 15.6505 8.45071C15.1971 7.844 14.5934 7.38493 13.9146 7.09561C14.8243 6.24762 15.0806 4.74853 14.1792 3.65762C13.6821 3.05606 12.9962 2.77619 12.3127 2.76918Z M8 5.75001C6.34908 5.75001 5 7.0991 5 8.75001C5 9.72266 5.47549 10.5819 6.19788 11.1309C5.23485 11.5518 4.42849 12.3022 3.95068 13.2808C3.92187 13.3398 3.90497 13.4039 3.90093 13.4694C3.8969 13.535 3.90582 13.6007 3.92717 13.6628C3.94853 13.7249 3.98191 13.7821 4.0254 13.8313C4.0689 13.8805 4.12165 13.9207 4.18067 13.9495C4.29982 14.0076 4.4372 14.0161 4.56258 13.9729C4.68796 13.9298 4.79107 13.8386 4.84924 13.7195C5.43767 12.5144 6.65894 11.7517 8 11.7517C9.34106 11.7517 10.5623 12.5144 11.1508 13.7195C11.2089 13.8386 11.312 13.9298 11.4374 13.9729C11.5628 14.0161 11.7002 14.0076 11.8193 13.9495C11.8783 13.9207 11.9311 13.8805 11.9746 13.8313C12.0181 13.7821 12.0515 13.7249 12.0728 13.6628C12.0942 13.6007 12.1031 13.535 12.0991 13.4694C12.095 13.4039 12.0781 13.3398 12.0493 13.2808C11.5715 12.3022 10.7652 11.5518 9.80212 11.1309C10.5245 10.5819 11 9.72266 11 8.75001C11 7.0991 9.65092 5.75001 8 5.75001ZM8 6.75001C9.11046 6.75001 10 7.63956 10 8.75001C10 9.86047 9.11046 10.75 8 10.75C6.88955 10.75 6 9.86047 6 8.75001C6 7.63956 6.88955 6.75001 8 6.75001Z" />
                  </svg>
                  {/* Collaborative view text */}
                  <span className={styles.viewDropdownItemText}>Collaborative view</span>
                  {/* ChevronDown rotated as right chevron */}
                  <svg className={styles.viewDropdownCollaborativeChevron} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                    <path fillRule="nonzero" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" />
                  </svg>
                </div>
                {/* Subtitle text */}
                <span className={styles.viewDropdownCollaborativeSubtitle}>Editors and up can edit the view configuration</span>
              </li>

              {/* Separator */}
              <li className={styles.viewDropdownSeparator} />

              {/* Rename view */}
              <li
                className={styles.viewDropdownItem}
                onClick={() => startRenamingView()}
              >
                <svg className={styles.viewDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                  <path fillRule="nonzero" d="M10.5 1.71045C10.2406 1.71045 9.9813 1.80867 9.7876 2.00525L2.29017 9.50269L2.28931 9.50354C2.10332 9.69048 1.9991 9.94419 2.00001 10.2079V12.9999C2.00007 13.5462 2.45358 13.9998 2.99988 13.9999H5.79212C6.05578 14.0008 6.30942 13.8966 6.49635 13.7107L6.49732 13.7097L13.9948 6.21228C14.3878 5.82489 14.3878 5.17499 13.9948 4.7876L11.2124 2.00525C11.0187 1.80867 10.7594 1.71045 10.5 1.71045ZM10.4999 2.70715C10.4955 2.70269 10.5043 2.70269 10.4999 2.70715L10.5027 2.70972L13.2902 5.49719L13.2927 5.49976C13.2972 5.49534 13.2972 5.50418 13.2927 5.49976L13.2902 5.50269L12 6.79297L9.20704 4L10.4973 2.70972L10.4999 2.70715ZM8.50001 4.70703L11.293 7.5L5.79297 12.9999H3.00013L3.00001 10.207L8.50001 4.70703Z" />
                </svg>
                <span className={styles.viewDropdownItemText}>Rename view</span>
              </li>

              {/* Edit view description */}
              <li className={styles.viewDropdownItem}>
                <svg className={styles.viewDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                  <path fillRule="nonzero" d="M7.875 6C8.28919 6 8.625 5.66419 8.625 5.25C8.625 4.83581 8.28919 4.5 7.875 4.5C7.46081 4.5 7.125 4.83581 7.125 5.25C7.125 5.66419 7.46081 6 7.875 6Z M7.5 7C7.36739 7 7.24021 7.05268 7.14645 7.14645C7.05268 7.24021 7 7.36739 7 7.5C7 7.63261 7.05268 7.75979 7.14645 7.85355C7.24021 7.94732 7.36739 8 7.5 8V11C7.50001 11.1326 7.5527 11.2598 7.64646 11.3535C7.74023 11.4473 7.8674 11.5 8 11.5H8.5C8.63261 11.5 8.75979 11.4473 8.85355 11.3536C8.94732 11.2598 9 11.1326 9 11C9 10.8674 8.94732 10.7402 8.85355 10.6464C8.75979 10.5527 8.63261 10.5 8.5 10.5V7.5C8.49999 7.3674 8.4473 7.24023 8.35354 7.14646C8.25977 7.0527 8.1326 7.00001 8 7H7.5Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
                </svg>
                <span className={styles.viewDropdownItemText}>Edit view description</span>
              </li>

              {/* Separator */}
              <li className={styles.viewDropdownSeparator} />

              {/* Duplicate view */}
              <li className={styles.viewDropdownItem}>
                <svg className={styles.viewDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                  <path fillRule="nonzero" d="M2.5 5C2.3674 5.00001 2.24023 5.0527 2.14646 5.14646C2.0527 5.24023 2.00001 5.3674 2 5.5V13.5C2.00001 13.6326 2.0527 13.7598 2.14646 13.8535C2.24023 13.9473 2.3674 14 2.5 14H10.5C10.6326 14 10.7598 13.9473 10.8535 13.8535C10.9473 13.7598 11 13.6326 11 13.5V5.5C11 5.3674 10.9473 5.24023 10.8535 5.14646C10.7598 5.0527 10.6326 5.00001 10.5 5H2.5ZM3 6H10V13H3V6Z M5.5 2C5.3674 2.00001 5.24023 2.0527 5.14646 2.14646C5.0527 2.24023 5.00001 2.3674 5 2.5V5.5C5 5.63261 5.05268 5.75979 5.14645 5.85355C5.24021 5.94732 5.36739 6 5.5 6C5.63261 6 5.75979 5.94732 5.85355 5.85355C5.94732 5.75979 6 5.63261 6 5.5V3H13V10H10.5C10.3674 10 10.2402 10.0527 10.1464 10.1464C10.0527 10.2402 10 10.3674 10 10.5C10 10.6326 10.0527 10.7598 10.1464 10.8536C10.2402 10.9473 10.3674 11 10.5 11H13.5C13.6326 11 13.7598 10.9473 13.8535 10.8535C13.9473 10.7598 14 10.6326 14 10.5V2.5C14 2.3674 13.9473 2.24023 13.8535 2.14646C13.7598 2.0527 13.6326 2.00001 13.5 2H5.5Z" />
                </svg>
                <span className={styles.viewDropdownItemText}>Duplicate view</span>
              </li>

              {/* Separator */}
              <li className={styles.viewDropdownSeparator} />

              {/* Download CSV */}
              <li className={styles.viewDropdownItem}>
                <svg className={styles.viewDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                  <path fillRule="nonzero" d="M8 5C7.86739 5 7.74021 5.05268 7.64645 5.14645C7.55268 5.24021 7.5 5.36739 7.5 5.5V9.29297L6.23486 8.02771C6.18843 7.98127 6.13331 7.94444 6.07264 7.91931C6.01198 7.89418 5.94695 7.88124 5.88129 7.88124C5.81562 7.88124 5.7506 7.89418 5.68993 7.91931C5.62926 7.94444 5.57414 7.98127 5.52771 8.02771C5.48127 8.07414 5.44444 8.12926 5.41931 8.18993C5.39418 8.2506 5.38124 8.31562 5.38124 8.38129C5.38124 8.44695 5.39418 8.51198 5.41931 8.57264C5.44444 8.63331 5.48127 8.68843 5.52771 8.73486L7.64648 10.8535C7.74026 10.9472 7.86741 10.9999 8 10.9999C8.13259 10.9999 8.25974 10.9472 8.35352 10.8535L10.4723 8.73486C10.5187 8.68843 10.5556 8.63331 10.5807 8.57264C10.6058 8.51198 10.6188 8.44695 10.6188 8.38129C10.6188 8.31562 10.6058 8.2506 10.5807 8.18993C10.5556 8.12926 10.5187 8.07414 10.4723 8.02771C10.4259 7.98127 10.3707 7.94444 10.3101 7.91931C10.2494 7.89418 10.1844 7.88124 10.1187 7.88124C10.053 7.88124 9.98802 7.89418 9.92736 7.91931C9.86669 7.94444 9.81157 7.98127 9.76514 8.02771L8.5 9.29297V5.5C8.5 5.36739 8.44732 5.24021 8.35355 5.14645C8.25979 5.05268 8.13261 5 8 5Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
                </svg>
                <span className={styles.viewDropdownItemText}>Download CSV</span>
              </li>

              {/* Print view */}
              <li className={styles.viewDropdownItem}>
                <svg className={styles.viewDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                  <path fillRule="nonzero" d="M11.75 8C12.1642 8 12.5 7.66419 12.5 7.25C12.5 6.83581 12.1642 6.5 11.75 6.5C11.3358 6.5 11 6.83581 11 7.25C11 7.66419 11.3358 8 11.75 8Z M2.8313 4.5C1.98492 4.5 1.25 5.15455 1.25 6V11C1.25001 11.1326 1.3027 11.2598 1.39646 11.3535C1.49023 11.4473 1.6174 11.5 1.75 11.5H4C4.13261 11.5 4.25979 11.4473 4.35355 11.3536C4.44732 11.2598 4.5 11.1326 4.5 11C4.5 10.8674 4.44732 10.7402 4.35355 10.6464C4.25979 10.5527 4.13261 10.5 4 10.5H2.25V6C2.25 5.74545 2.49018 5.5 2.8313 5.5H13.1687C13.5098 5.5 13.75 5.74545 13.75 6V10.5H12C11.8674 10.5 11.7402 10.5527 11.6464 10.6464C11.5527 10.7402 11.5 10.8674 11.5 11C11.5 11.1326 11.5527 11.2598 11.6464 11.3536C11.7402 11.4473 11.8674 11.5 12 11.5H14.25C14.3826 11.5 14.5098 11.4473 14.6035 11.3535C14.6973 11.2598 14.75 11.1326 14.75 11V6C14.75 5.15455 14.0151 4.5 13.1687 4.5H2.8313Z M4 2C3.8674 2.00001 3.74023 2.0527 3.64646 2.14646C3.5527 2.24023 3.50001 2.3674 3.5 2.5V5C3.5 5.13261 3.55268 5.25979 3.64645 5.35355C3.74021 5.44732 3.86739 5.5 4 5.5C4.13261 5.5 4.25979 5.44732 4.35355 5.35355C4.44732 5.25979 4.5 5.13261 4.5 5V3H11.5V5C11.5 5.13261 11.5527 5.25979 11.6464 5.35355C11.7402 5.44732 11.8674 5.5 12 5.5C12.1326 5.5 12.2598 5.44732 12.3536 5.35355C12.4473 5.25979 12.5 5.13261 12.5 5V2.5C12.5 2.3674 12.4473 2.24023 12.3535 2.14646C12.2598 2.0527 12.1326 2.00001 12 2H4Z M4 9C3.8674 9.00001 3.74023 9.0527 3.64646 9.14646C3.5527 9.24023 3.50001 9.3674 3.5 9.5V13.75C3.50001 13.8826 3.5527 14.0098 3.64646 14.1035C3.74023 14.1973 3.8674 14.25 4 14.25H12C12.1326 14.25 12.2598 14.1973 12.3535 14.1035C12.4473 14.0098 12.5 13.8826 12.5 13.75V9.5C12.5 9.3674 12.4473 9.24023 12.3535 9.14646C12.2598 9.0527 12.1326 9.00001 12 9H4ZM4.5 10H11.5V13.25H4.5V10Z" />
                </svg>
                <span className={styles.viewDropdownItemText}>Print view</span>
              </li>

              {/* Delete view — disabled when there is only a single view */}
              <li
                className={styles.viewDropdownItem}
                style={canDeleteView ? { cursor: 'pointer' } : { opacity: 0.5, cursor: 'default' }}
                onClick={() => {
                  if (canDeleteView && activeViewId) {
                    deleteViewMut.mutate({ viewId: activeViewId });
                  }
                }}
              >
                <svg className={styles.viewDropdownDeleteIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                  <path fillRule="nonzero" d="M6.5 6C6.36739 6 6.24021 6.05268 6.14645 6.14645C6.05268 6.24021 6 6.36739 6 6.5V10.5C6 10.6326 6.05268 10.7598 6.14645 10.8536C6.24021 10.9473 6.36739 11 6.5 11C6.63261 11 6.75979 10.9473 6.85355 10.8536C6.94732 10.7598 7 10.6326 7 10.5V6.5C7 6.36739 6.94732 6.24021 6.85355 6.14645C6.75979 6.05268 6.63261 6 6.5 6Z M9.5 6C9.36739 6 9.24021 6.05268 9.14645 6.14645C9.05268 6.24021 9 6.36739 9 6.5V10.5C9 10.6326 9.05268 10.7598 9.14645 10.8536C9.24021 10.9473 9.36739 11 9.5 11C9.63261 11 9.75979 10.9473 9.85355 10.8536C9.94732 10.7598 10 10.6326 10 10.5V6.5C10 6.36739 9.94732 6.24021 9.85355 6.14645C9.75979 6.05268 9.63261 6 9.5 6Z M6.5 1C5.6775 1 5 1.6775 5 2.5V3H2.5C2.36739 3 2.24021 3.05268 2.14645 3.14645C2.05268 3.24021 2 3.36739 2 3.5C2 3.63261 2.05268 3.75979 2.14645 3.85355C2.24021 3.94732 2.36739 4 2.5 4H3V13C3.00007 13.5463 3.45357 13.9999 3.99988 14H12C12.5464 14 13 13.5464 13 13V4H13.5C13.6326 4 13.7598 3.94732 13.8536 3.85355C13.9473 3.75979 14 3.63261 14 3.5C14 3.36739 13.9473 3.24021 13.8536 3.14645C13.7598 3.05268 13.6326 3 13.5 3H11V2.5C10.9999 1.67757 10.3226 1.0001 9.50012 1H6.5ZM6.5 2H9.5C9.78202 2.0001 9.99996 2.21808 10 2.50012V3H6V2.5C6 2.21794 6.21794 2 6.5 2ZM4 4H12V13H4.00012L4 4Z" />
                </svg>
                <span className={styles.viewDropdownDeleteText}>Delete view</span>
              </li>
            </ul>,
            document.body
            );
          })()}
        </div>
      </div>

      {/* Right section */}
      <div className={styles.gridBarRight}>
        {viewLoading ? (
          /* Skeleton pills while view is loading */
          <div className={styles.gridBarSkeletonPills}>
            <div className={styles.gridBarSkeletonPill} style={{ width: 50, marginRight: 8 }} />
            <div className={styles.gridBarSkeletonPill} style={{ width: 51.75 }} />
          </div>
        ) : (
        <>
        {/* Tools outer container */}
        <div className={styles.gridBarToolsOuter}>
          {/* Tools inner container */}
          <div className={styles.gridBarToolsInner}>
            {/* Hide fields button + panel wrapper */}
            <div className={styles.gridBarHideFieldsWrapper}>
              <button
                ref={hideFieldsButtonRef}
                type="button"
                className={[
                  styles.gridBarToolButton,
                  styles.gridBarHideFieldsButton,
                  isHideFieldsOpen ? styles.gridBarToolButtonActive : '',
                  hiddenColumnIds.length > 0 ? styles.gridBarHideFieldsButtonHasHidden : '',
                ].filter(Boolean).join(' ')}
                onClick={toggleHideFieldsPanel}
              >
                <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="nonzero" d="M8.00013 2.99999C7.53899 2.99917 7.07864 3.03701 6.62379 3.11315C6.55902 3.12398 6.49703 3.14747 6.44134 3.18226C6.38565 3.21706 6.33736 3.26248 6.29923 3.31594C6.2611 3.3694 6.23387 3.42984 6.2191 3.49382C6.20433 3.5578 6.2023 3.62407 6.21314 3.68883C6.23505 3.81961 6.30801 3.93632 6.41597 4.01331C6.52393 4.0903 6.65805 4.12125 6.78883 4.09935C7.18869 4.03242 7.59357 3.99923 7.99915 3.99999C7.99882 3.99999 7.99948 3.99999 7.99915 3.99999C12.083 3.99999 14.0065 7.16727 14.4415 7.99926C14.2327 8.39403 13.6815 9.3219 12.7042 10.196C12.6553 10.2398 12.6154 10.2928 12.587 10.352C12.5585 10.4112 12.542 10.4754 12.5383 10.5409C12.5347 10.6065 12.544 10.6721 12.5657 10.7341C12.5874 10.7961 12.6211 10.8531 12.6649 10.9021C12.7533 11.0009 12.8774 11.0606 13.0097 11.0679C13.1421 11.0753 13.272 11.0298 13.3709 10.9414C14.8157 9.64896 15.4569 8.20311 15.4569 8.20311C15.4853 8.13917 15.5 8.06997 15.5 7.99999C15.5 7.93001 15.4853 7.86081 15.4569 7.79686C15.4569 7.79686 13.2994 3.00052 8.00013 2.99999Z M8.56177 5.05248C8.4315 5.02783 8.29677 5.05593 8.18721 5.1306C8.07765 5.20527 8.00223 5.3204 7.97755 5.45067C7.96532 5.51519 7.96592 5.58148 7.97932 5.64576C7.99271 5.71004 8.01864 5.77106 8.05562 5.82532C8.09259 5.87958 8.13989 5.92603 8.19482 5.96201C8.24975 5.99799 8.31122 6.0228 8.37574 6.03502C9.25118 6.20086 9.90696 6.92166 9.98963 7.80883C9.99573 7.87421 10.0146 7.93775 10.0453 7.99582C10.076 8.05389 10.1177 8.10536 10.1683 8.14727C10.2188 8.18919 10.2771 8.22074 10.3399 8.24013C10.4026 8.25951 10.4686 8.26635 10.5339 8.26024C10.666 8.24793 10.7877 8.18368 10.8723 8.08163C10.957 7.97958 10.9976 7.84808 10.9854 7.71605C10.8617 6.38949 9.8708 5.30045 8.56177 5.05248Z M3.02381 2.0006C2.89137 1.99428 2.76183 2.04082 2.6637 2.12999C2.56557 2.21919 2.5069 2.34371 2.50058 2.47617C2.49426 2.60862 2.54082 2.73816 2.63001 2.83629L5.64234 6.14989C4.99783 6.97182 4.81667 8.0854 5.20167 9.08153C5.64782 10.2359 6.7614 10.9994 7.99891 10.9997C8.57697 11.0018 9.13723 10.8317 9.61744 10.5226L12.63 13.8363C12.7192 13.9344 12.8437 13.9931 12.9762 13.9994C13.1086 14.0057 13.2382 13.9592 13.3363 13.87C13.4344 13.7808 13.4931 13.6563 13.4994 13.5238C13.5058 13.3914 13.4592 13.2618 13.37 13.1637L6.6908 5.81652C6.69016 5.81554 6.68951 5.81456 6.68885 5.81359C6.6884 5.81338 6.68796 5.81318 6.68751 5.81298L3.37 2.16369C3.2808 2.06557 3.15627 2.0069 3.02381 2.0006ZM4.78126 3.81261C4.65529 3.7712 4.51803 3.78151 4.39966 3.8413C1.67465 5.21716 0.542853 7.79748 0.542853 7.79748C0.514536 7.86137 0.499927 7.93049 0.49997 8.00038C0.500012 8.07027 0.514704 8.13938 0.543098 8.20324C0.543098 8.20324 2.69954 12.9988 7.99805 13C9.24842 13.0098 10.4832 12.7217 11.6 12.1592C11.6586 12.1296 11.7109 12.0888 11.7537 12.0391C11.7966 11.9893 11.8293 11.9317 11.8498 11.8693C11.8704 11.8069 11.8785 11.7411 11.8736 11.6757C11.8688 11.6102 11.8511 11.5463 11.8215 11.4877C11.792 11.429 11.7512 11.3768 11.7015 11.3339C11.6517 11.291 11.594 11.2584 11.5317 11.2378C11.4693 11.2172 11.4035 11.2091 11.338 11.214C11.2726 11.2189 11.2087 11.2366 11.15 11.2661C10.1746 11.7574 9.09616 12.009 8.00403 12.0001C8.00269 12.0001 8.00135 12.0001 8.00001 12.0001C3.9214 12.0001 1.99934 8.84205 1.56104 8.00512C1.80002 7.53467 2.78966 5.77445 4.85035 4.734C4.90897 4.7044 4.96118 4.66355 5.00401 4.61377C5.04684 4.56399 5.07944 4.50626 5.09996 4.44389C5.12048 4.38151 5.12851 4.3157 5.12359 4.25021C5.11867 4.18473 5.1009 4.12086 5.0713 4.06225C5.01154 3.94387 4.90721 3.85407 4.78126 3.81261ZM6.3307 6.90709L8.92811 9.76427C8.64391 9.91434 8.32855 10.0011 8.00196 9.99987C8.00131 9.99987 8.00066 9.99987 8.00001 9.99987C7.17209 9.99993 6.43288 9.49318 6.13441 8.72094C5.89804 8.10936 5.98275 7.43768 6.3307 6.90709Z" />
                </svg>
                <span className={styles.gridBarToolText}>
                  {hiddenColumnIds.length > 0
                    ? `${hiddenColumnIds.length} hidden field${hiddenColumnIds.length === 1 ? '' : 's'}`
                    : 'Hide fields'}
                </span>
              </button>

              {/* Hide Fields Panel — positioned absolutely below the button */}
              {isHideFieldsOpen && (
                <div
                  ref={hideFieldsPanelRef}
                  className={styles.hideFieldsPanelAnchor}
                >
                  <HideFieldsPanel
                    columns={columns}
                    hiddenColumnIds={hiddenColumnIds}
                    onToggleColumn={onToggleColumn}
                    onHideAll={onHideAll}
                    onShowAll={onShowAll}
                    onReorder={onReorderColumns}
                  />
                </div>
              )}
            </div>

            {/* Filter button + panel wrapper */}
            <div className={styles.gridBarFilterWrapper}>
              <button
                ref={filterButtonRef}
                type="button"
                className={[
                  styles.gridBarToolButton,
                  styles.gridBarFilterButton,
                  isFilterOpen ? styles.gridBarToolButtonActive : '',
                  isFilterActive ? styles.gridBarFilterButtonActive : '',
                ].filter(Boolean).join(' ')}
                onClick={toggleFilterPanel}
              >
                <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="nonzero" d="M6.5 10.5C6.36739 10.5 6.24021 10.5527 6.14645 10.6464C6.05268 10.7402 6 10.8674 6 11C6 11.1326 6.05268 11.2598 6.14645 11.3536C6.24021 11.4473 6.36739 11.5 6.5 11.5H9.5C9.63261 11.5 9.75979 11.4473 9.85355 11.3536C9.94732 11.2598 10 11.1326 10 11C10 10.8674 9.94732 10.7402 9.85355 10.6464C9.75979 10.5527 9.63261 10.5 9.5 10.5H6.5Z M1.5 4.5C1.36739 4.5 1.24021 4.55268 1.14645 4.64645C1.05268 4.74021 1 4.86739 1 5C1 5.13261 1.05268 5.25979 1.14645 5.35355C1.24021 5.44732 1.36739 5.5 1.5 5.5H14.5C14.6326 5.5 14.7598 5.44732 14.8536 5.35355C14.9473 5.25979 15 5.13261 15 5C15 4.86739 14.9473 4.74021 14.8536 4.64645C14.7598 4.55268 14.6326 4.5 14.5 4.5H1.5Z M4 7.5C3.86739 7.5 3.74021 7.55268 3.64645 7.64645C3.55268 7.74021 3.5 7.86739 3.5 8C3.5 8.13261 3.55268 8.25979 3.64645 8.35355C3.74021 8.44732 3.86739 8.5 4 8.5H12C12.1326 8.5 12.2598 8.44732 12.3536 8.35355C12.4473 8.25979 12.5 8.13261 12.5 8C12.5 7.86739 12.4473 7.74021 12.3536 7.64645C12.2598 7.55268 12.1326 7.5 12 7.5H4Z" />
                </svg>
                <span className={styles.gridBarToolText}>{filterButtonLabel}</span>
              </button>

              {/* Filter Panel — positioned absolutely below the button */}
              {isFilterOpen && (
                <div
                  ref={filterPanelRef}
                  className={styles.filterPanelAnchor}
                >
                  <FilterPanel baseColor={baseColor} columns={columns} />
                </div>
              )}
            </div>

            {/* Group button */}
            <button type="button" className={`${styles.gridBarToolButton} ${styles.gridBarGroupButton}`}>
              <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="nonzero" d="M6 6.5C6 6.91421 5.66421 7.25 5.25 7.25C4.83579 7.25 4.5 6.91421 4.5 6.5C4.5 6.08579 4.83579 5.75 5.25 5.75C5.66421 5.75 6 6.08579 6 6.5Z M7 6.5C7 6.22386 7.22386 6 7.5 6H11C11.2761 6 11.5 6.22386 11.5 6.5C11.5 6.77614 11.2761 7 11 7H7.5C7.22386 7 7 6.77614 7 6.5Z M7.5 9C7.22386 9 7 9.22386 7 9.5C7 9.77614 7.22386 10 7.5 10H11C11.2761 10 11.5 9.77614 11.5 9.5C11.5 9.22386 11.2761 9 11 9H7.5Z M6 9.5C6 9.91421 5.66421 10.25 5.25 10.25C4.83579 10.25 4.5 9.91421 4.5 9.5C4.5 9.08579 4.83579 8.75 5.25 8.75C5.66421 8.75 6 9.08579 6 9.5Z M2.54545 2.5C2.0573 2.5 1.5 2.84588 1.5 3.45455V12.5455C1.5 13.1541 2.0573 13.5 2.54545 13.5H13.4545C13.9427 13.5 14.5 13.1541 14.5 12.5455V3.45455C14.5 2.84588 13.9427 2.5 13.4545 2.5H2.54545ZM2.5 12.4929V3.50706C2.51085 3.50329 2.52597 3.5 2.54545 3.5H13.4545C13.474 3.5 13.4891 3.50329 13.5 3.50706V12.4929C13.4891 12.4967 13.474 12.5 13.4545 12.5H2.54545C2.52597 12.5 2.51085 12.4967 2.5 12.4929Z" />
              </svg>
              <span className={styles.gridBarToolText}>Group</span>
            </button>

            {/* Sort button + panel wrapper */}
            <div className={styles.gridBarSortWrapper}>
              <button
                ref={sortButtonRef}
                type="button"
                className={[
                  styles.gridBarToolButton,
                  styles.gridBarSortButton,
                  isSortOpen ? styles.gridBarToolButtonActive : '',
                  hasTemporarySorts ? styles.gridBarSortButtonHasSort : '',
                ].filter(Boolean).join(' ')}
                onClick={toggleSortPanel}
              >
                <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="nonzero" d="M4.99999 2.5C4.86738 2.5 4.7402 2.55268 4.64643 2.64645C4.55266 2.74021 4.49999 2.86739 4.49999 3V11.793L3.3535 10.6465C3.25974 10.5527 3.13258 10.5001 2.99999 10.5001C2.8674 10.5001 2.74023 10.5527 2.64647 10.6465C2.55272 10.7402 2.50006 10.8674 2.50006 11C2.50006 11.1326 2.55272 11.2598 2.64647 11.3535L4.64647 13.3535C4.74022 13.4473 4.86738 13.5 4.99999 13.5C5.13259 13.5 5.25975 13.4473 5.3535 13.3535L7.3535 11.3535C7.44725 11.2598 7.49991 11.1326 7.49991 11C7.49991 10.8674 7.44725 10.7402 7.3535 10.6465C7.25974 10.5527 7.13258 10.5001 6.99999 10.5001C6.8674 10.5001 6.74024 10.5527 6.64647 10.6465L5.49999 11.793V3C5.49999 2.86739 5.44731 2.74021 5.35354 2.64645C5.25977 2.55268 5.13259 2.5 4.99999 2.5Z M11 2.5C10.8674 2.50003 10.7402 2.55272 10.6465 2.64648L8.64647 4.64648C8.55272 4.74025 8.50006 4.86741 8.50006 5C8.50006 5.13259 8.55272 5.25975 8.64647 5.35352C8.74024 5.44726 8.8674 5.49992 8.99999 5.49992C9.13258 5.49992 9.25974 5.44726 9.3535 5.35352L10.5 4.20703V13C10.5 13.1326 10.5527 13.2598 10.6464 13.3536C10.7402 13.4473 10.8674 13.5 11 13.5C11.1326 13.5 11.2598 13.4473 11.3535 13.3536C11.4473 13.2598 11.5 13.1326 11.5 13V4.20703L12.6465 5.35352C12.7402 5.44726 12.8674 5.49992 13 5.49992C13.1326 5.49992 13.2597 5.44726 13.3535 5.35352C13.4472 5.25975 13.4999 5.13259 13.4999 5C13.4999 4.86741 13.4472 4.74025 13.3535 4.64648L11.3535 2.64648C11.3487 2.64437 11.3438 2.64234 11.3389 2.64038C11.2478 2.55235 11.1266 2.50218 11 2.5Z" />
                </svg>
                <span className={styles.gridBarToolText}>
                  {effectiveSortCount > 0
                    ? `Sorted by ${effectiveSortCount} field${effectiveSortCount === 1 ? '' : 's'}`
                    : 'Sort'}
                </span>
              </button>

              {/* Sort Panel — positioned absolutely below the button */}
              {isSortOpen && (
                <div
                  ref={sortPanelRef}
                  className={styles.sortPanelAnchor}
                >
                  <SortPanel
                    columns={sortColumns}
                    currentSorts={currentSorts}
                    autoSort={autoSort}
                    onPickSort={handleSortPick}
                    onAddSort={onAddSort}
                    onChangeSortField={onChangeSortField}
                    onChangeDirection={onChangeDirection}
                    onRemoveSort={handleRemoveSort}
                    onToggleAutoSort={onToggleAutoSort}
                    onSaveSorts={onSaveSorts}
                    onCancelSorts={onCancelSorts}
                  />
                </div>
              )}
            </div>

            {/* Color button */}
            <button type="button" className={`${styles.gridBarToolButton} ${styles.gridBarColorButton}`}>
              <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="nonzero" d="M2.36878 1.36865C2.30311 1.36863 2.23808 1.38154 2.17741 1.40666C2.11673 1.43177 2.06159 1.46859 2.01515 1.51501C1.96871 1.56144 1.93187 1.61657 1.90674 1.67723C1.88161 1.7379 1.86868 1.80292 1.86868 1.86859C1.86868 1.93426 1.88161 1.99928 1.90674 2.05995C1.93187 2.12062 1.96871 2.17574 2.01515 2.22217L6.21803 6.42505C6.08351 6.67237 6.00001 6.95077 6.00001 7.25C6.00001 8.21058 6.78943 9 7.75001 9C8.71059 9 9.50001 8.21058 9.50001 7.25C9.50001 6.28942 8.71059 5.5 7.75001 5.5C7.45086 5.5 7.17258 5.58356 6.9253 5.71802L2.7223 1.51501C2.62853 1.42129 2.50137 1.36864 2.36878 1.36865ZM7.75001 6.5C8.17018 6.5 8.50001 6.82983 8.50001 7.25C8.50001 7.67017 8.17018 8 7.75001 8C7.32984 8 7.00001 7.67017 7.00001 7.25C7.00001 7.04405 7.08091 6.86114 7.21119 6.72681C7.21491 6.72531 7.21862 6.72376 7.2223 6.72217C7.22618 6.71703 7.22997 6.71183 7.23365 6.70654C7.36745 6.57966 7.54709 6.5 7.75001 6.5Z M14.25 9.75C14.1174 9.75003 13.9902 9.80272 13.8965 9.89648C13.8965 9.89648 13.5499 10.2425 13.209 10.7539C12.868 11.2653 12.5 11.9583 12.5 12.75C12.5 13.7106 13.2894 14.5 14.25 14.5C15.2106 14.5 16 13.7106 16 12.75C16 11.9583 15.632 11.2653 15.291 10.7539C14.9501 10.2425 14.6035 9.89648 14.6035 9.89648C14.5098 9.80272 14.3826 9.75003 14.25 9.75ZM14.25 11.0325C14.3204 11.1233 14.3825 11.1938 14.459 11.3086C14.743 11.7347 15 12.2917 15 12.75C15 13.1701 14.6701 13.5 14.25 13.5C13.8299 13.5 13.5 13.1701 13.5 12.75C13.5 12.2917 13.757 11.7347 14.041 11.3086C14.1176 11.1938 14.1796 11.1233 14.25 11.0325Z M7.21876 0.5C7.08616 0.500026 6.959 0.552716 6.86524 0.646484L0.852671 6.65894C0.851813 6.65979 0.850959 6.66064 0.850108 6.6615C0.276242 7.24384 0.276242 8.19366 0.850108 8.776C0.850959 8.77686 0.851813 8.77771 0.852671 8.77856L6.15895 14.0848C6.15984 14.0857 6.16073 14.0865 6.16163 14.0874C6.74398 14.6612 7.69354 14.6612 8.27589 14.0874C8.27679 14.0865 8.27768 14.0857 8.27858 14.0848L14.291 8.07226C14.3848 7.97849 14.4374 7.85133 14.4374 7.71875C14.4374 7.58616 14.3848 7.459 14.291 7.36523L7.57228 0.646483C7.47852 0.552715 7.35136 0.500025 7.21876 0.5ZM7.21876 1.70703L13.2305 7.71875L7.57374 13.3754C7.37274 13.5731 7.06478 13.5731 6.86378 13.3754L1.56239 8.0741C1.36466 7.87311 1.36441 7.56475 1.56214 7.36376C1.56203 7.36388 1.56225 7.36364 1.56214 7.36376L7.21876 1.70703Z" />
              </svg>
              <span className={styles.gridBarToolText}>Color</span>
            </button>

            {/* Row height button (icon only) + dropdown */}
            <div className={styles.gridBarRowHeightWrapper} ref={rowHeightButtonRef}>
              <button
                type="button"
                className={styles.gridBarRowHeightButton}
                onClick={() => setIsRowHeightOpen((v) => !v)}
              >
                <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                  {rowHeightPreset === "short" && (
                    <path fillRule="nonzero" d="M13.1464 2.64645L12.1464 3.64645C11.9512 3.84171 11.9512 4.15829 12.1464 4.35355C12.3417 4.54882 12.6583 4.54882 12.8536 4.35355L13 4.20711V11.7929L12.8536 11.6464C12.6583 11.4512 12.3417 11.4512 12.1464 11.6464C11.9512 11.8417 11.9512 12.1583 12.1464 12.3536L13.1464 13.3536C13.2402 13.4473 13.3674 13.5 13.5 13.5C13.6326 13.5 13.7598 13.4473 13.8536 13.3536L14.8536 12.3536C15.0488 12.1583 15.0488 11.8417 14.8536 11.6464C14.6583 11.4512 14.3417 11.4512 14.1464 11.6464L14 11.7929V4.20711L14.1464 4.35355C14.3417 4.54882 14.6583 4.54882 14.8536 4.35355C15.0488 4.15829 15.0488 3.84171 14.8536 3.64645L13.8536 2.64645C13.6583 2.45118 13.3417 2.45118 13.1464 2.64645Z M1.5 3C1.22386 3 1 3.22386 1 3.5C1 3.77614 1.22386 4 1.5 4H9.5C9.77614 4 10 3.77614 10 3.5C10 3.22386 9.77614 3 9.5 3H1.5Z M1.5 6C1.22386 6 1 6.22386 1 6.5C1 6.77614 1.22386 7 1.5 7H9.5C9.77614 7 10 6.77614 10 6.5C10 6.22386 9.77614 6 9.5 6H1.5Z M1 9.5C1 9.22386 1.22386 9 1.5 9H9.5C9.77614 9 10 9.22386 10 9.5C10 9.77614 9.77614 10 9.5 10H1.5C1.22386 10 1 9.77614 1 9.5Z M1.5 12C1.22386 12 1 12.2239 1 12.5C1 12.7761 1.22386 13 1.5 13H9.5C9.77614 13 10 12.7761 10 12.5C10 12.2239 9.77614 12 9.5 12H1.5Z" />
                  )}
                  {rowHeightPreset === "medium" && (
                    <path fillRule="nonzero" d="M12.1464 3.64645L13.1464 2.64645C13.3417 2.45118 13.6583 2.45118 13.8536 2.64645L14.8536 3.64645C15.0488 3.84171 15.0488 4.15829 14.8536 4.35355C14.6583 4.54882 14.3417 4.54882 14.1464 4.35355L14 4.20711V11.7929L14.1464 11.6464C14.3417 11.4512 14.6583 11.4512 14.8536 11.6464C15.0488 11.8417 15.0488 12.1583 14.8536 12.3536L13.8536 13.3536C13.7598 13.4473 13.6326 13.5 13.5 13.5C13.3674 13.5 13.2402 13.4473 13.1464 13.3536L12.1464 12.3536C11.9512 12.1583 11.9512 11.8417 12.1464 11.6464C12.3417 11.4512 12.6583 11.4512 12.8536 11.6464L13 11.7929V4.20711L12.8536 4.35355C12.6583 4.54882 12.3417 4.54882 12.1464 4.35355C11.9512 4.15829 11.9512 3.84171 12.1464 3.64645Z M2.5 3C1.67157 3 1 3.67157 1 4.5V5.5C1 6.32843 1.67157 7 2.5 7H8.5C9.32843 7 10 6.32843 10 5.5V4.5C10 3.67157 9.32843 3 8.5 3H2.5ZM2 4.5C2 4.22386 2.22386 4 2.5 4H8.5C8.77614 4 9 4.22386 9 4.5V5.5C9 5.77614 8.77614 6 8.5 6H2.5C2.22386 6 2 5.77614 2 5.5V4.5Z M1.5 9C1.22386 9 1 9.22386 1 9.5C1 9.77614 1.22386 10 1.5 10H9.5C9.77614 10 10 9.77614 10 9.5C10 9.22386 9.77614 9 9.5 9H1.5Z M1 12.5C1 12.2239 1.22386 12 1.5 12H9.5C9.77614 12 10 12.2239 10 12.5C10 12.7761 9.77614 13 9.5 13H1.5C1.22386 13 1 12.7761 1 12.5Z" />
                  )}
                  {rowHeightPreset === "tall" && (
                    <path fillRule="nonzero" d="M13.1464 2.64645L12.1464 3.64645C11.9512 3.84171 11.9512 4.15829 12.1464 4.35355C12.3417 4.54882 12.6583 4.54882 12.8536 4.35355L13 4.20711V11.7929L12.8536 11.6464C12.6583 11.4512 12.3417 11.4512 12.1464 11.6464C11.9512 11.8417 11.9512 12.1583 12.1464 12.3536L13.1464 13.3536C13.2402 13.4473 13.3674 13.5 13.5 13.5C13.6326 13.5 13.7598 13.4473 13.8536 13.3536L14.8536 12.3536C15.0488 12.1583 15.0488 11.8417 14.8536 11.6464C14.6583 11.4512 14.3417 11.4512 14.1464 11.6464L14 11.7929V4.20711L14.1464 4.35355C14.3417 4.54882 14.6583 4.54882 14.8536 4.35355C15.0488 4.15829 15.0488 3.84171 14.8536 3.64645L13.8536 2.64645C13.6583 2.45118 13.3417 2.45118 13.1464 2.64645Z M1 4.5C1 3.67157 1.67157 3 2.5 3H8.5C9.32843 3 10 3.67157 10 4.5V8.5C10 9.32843 9.32843 10 8.5 10H2.5C1.67157 10 1 9.32843 1 8.5V4.5ZM2.5 4C2.22386 4 2 4.22386 2 4.5V8.5C2 8.77614 2.22386 9 2.5 9H8.5C8.77614 9 9 8.77614 9 8.5V4.5C9 4.22386 8.77614 4 8.5 4H2.5Z M1.5 12C1.22386 12 1 12.2239 1 12.5C1 12.7761 1.22386 13 1.5 13H9.5C9.77614 13 10 12.7761 10 12.5C10 12.2239 9.77614 12 9.5 12H1.5Z" />
                  )}
                  {rowHeightPreset === "extraTall" && (
                    <path fillRule="nonzero" d="M12.1464 3.64645L13.1464 2.64645C13.3417 2.45118 13.6583 2.45118 13.8536 2.64645L14.8536 3.64645C15.0488 3.84171 15.0488 4.15829 14.8536 4.35355C14.6583 4.54882 14.3417 4.54882 14.1464 4.35355L14 4.20711V11.7929L14.1464 11.6464C14.3417 11.4512 14.6583 11.4512 14.8536 11.6464C15.0488 11.8417 15.0488 12.1583 14.8536 12.3536L13.8536 13.3536C13.7598 13.4473 13.6326 13.5 13.5 13.5C13.3674 13.5 13.2402 13.4473 13.1464 13.3536L12.1464 12.3536C11.9512 12.1583 11.9512 11.8417 12.1464 11.6464C12.3417 11.4512 12.6583 11.4512 12.8536 11.6464L13 11.7929V4.20711L12.8536 4.35355C12.6583 4.54882 12.3417 4.54882 12.1464 4.35355C11.9512 4.15829 11.9512 3.84171 12.1464 3.64645Z M1 4.5C1 3.67157 1.67157 3 2.5 3H8.5C9.32843 3 10 3.67157 10 4.5V11.5C10 12.3284 9.32843 13 8.5 13H2.5C1.67157 13 1 12.3284 1 11.5V4.5ZM2.5 4C2.22386 4 2 4.22386 2 4.5V11.5C2 11.7761 2.22386 12 2.5 12H8.5C8.77614 12 9 11.7761 9 11.5V4.5C9 4.22386 8.77614 4 8.5 4H2.5Z" />
                  )}
                </svg>
              </button>
              {!isRowHeightOpen && (
                <span className={styles.gridBarRowHeightTooltip}>Row height</span>
              )}

              {/* Row height dropdown panel */}
              {isRowHeightOpen && (
                <div className={styles.rowHeightDropdown} ref={rowHeightDropdownRef}>
                  <span className={styles.rowHeightDropdownTitle}>Select a row height</span>

                  {/* Short */}
                  <div
                    className={`${styles.rowHeightDropdownItem}${rowHeightPreset === "short" ? ` ${styles.rowHeightDropdownItemActive}` : ""}`}
                    onClick={() => { onRowHeightPresetChange("short"); setIsRowHeightOpen(false); }}
                  >
                    <svg className={styles.rowHeightDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M13.1464 2.64645L12.1464 3.64645C11.9512 3.84171 11.9512 4.15829 12.1464 4.35355C12.3417 4.54882 12.6583 4.54882 12.8536 4.35355L13 4.20711V11.7929L12.8536 11.6464C12.6583 11.4512 12.3417 11.4512 12.1464 11.6464C11.9512 11.8417 11.9512 12.1583 12.1464 12.3536L13.1464 13.3536C13.2402 13.4473 13.3674 13.5 13.5 13.5C13.6326 13.5 13.7598 13.4473 13.8536 13.3536L14.8536 12.3536C15.0488 12.1583 15.0488 11.8417 14.8536 11.6464C14.6583 11.4512 14.3417 11.4512 14.1464 11.6464L14 11.7929V4.20711L14.1464 4.35355C14.3417 4.54882 14.6583 4.54882 14.8536 4.35355C15.0488 4.15829 15.0488 3.84171 14.8536 3.64645L13.8536 2.64645C13.6583 2.45118 13.3417 2.45118 13.1464 2.64645Z M1.5 3C1.22386 3 1 3.22386 1 3.5C1 3.77614 1.22386 4 1.5 4H9.5C9.77614 4 10 3.77614 10 3.5C10 3.22386 9.77614 3 9.5 3H1.5Z M1.5 6C1.22386 6 1 6.22386 1 6.5C1 6.77614 1.22386 7 1.5 7H9.5C9.77614 7 10 6.77614 10 6.5C10 6.22386 9.77614 6 9.5 6H1.5Z M1 9.5C1 9.22386 1.22386 9 1.5 9H9.5C9.77614 9 10 9.22386 10 9.5C10 9.77614 9.77614 10 9.5 10H1.5C1.22386 10 1 9.77614 1 9.5Z M1.5 12C1.22386 12 1 12.2239 1 12.5C1 12.7761 1.22386 13 1.5 13H9.5C9.77614 13 10 12.7761 10 12.5C10 12.2239 9.77614 12 9.5 12H1.5Z" />
                    </svg>
                    <span className={styles.rowHeightDropdownItemText}>Short</span>
                  </div>

                  {/* Medium */}
                  <div
                    className={`${styles.rowHeightDropdownItem}${rowHeightPreset === "medium" ? ` ${styles.rowHeightDropdownItemActive}` : ""}`}
                    onClick={() => { onRowHeightPresetChange("medium"); setIsRowHeightOpen(false); }}
                  >
                    <svg className={styles.rowHeightDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M12.1464 3.64645L13.1464 2.64645C13.3417 2.45118 13.6583 2.45118 13.8536 2.64645L14.8536 3.64645C15.0488 3.84171 15.0488 4.15829 14.8536 4.35355C14.6583 4.54882 14.3417 4.54882 14.1464 4.35355L14 4.20711V11.7929L14.1464 11.6464C14.3417 11.4512 14.6583 11.4512 14.8536 11.6464C15.0488 11.8417 15.0488 12.1583 14.8536 12.3536L13.8536 13.3536C13.7598 13.4473 13.6326 13.5 13.5 13.5C13.3674 13.5 13.2402 13.4473 13.1464 13.3536L12.1464 12.3536C11.9512 12.1583 11.9512 11.8417 12.1464 11.6464C12.3417 11.4512 12.6583 11.4512 12.8536 11.6464L13 11.7929V4.20711L12.8536 4.35355C12.6583 4.54882 12.3417 4.54882 12.1464 4.35355C11.9512 4.15829 11.9512 3.84171 12.1464 3.64645Z M2.5 3C1.67157 3 1 3.67157 1 4.5V5.5C1 6.32843 1.67157 7 2.5 7H8.5C9.32843 7 10 6.32843 10 5.5V4.5C10 3.67157 9.32843 3 8.5 3H2.5ZM2 4.5C2 4.22386 2.22386 4 2.5 4H8.5C8.77614 4 9 4.22386 9 4.5V5.5C9 5.77614 8.77614 6 8.5 6H2.5C2.22386 6 2 5.77614 2 5.5V4.5Z M1.5 9C1.22386 9 1 9.22386 1 9.5C1 9.77614 1.22386 10 1.5 10H9.5C9.77614 10 10 9.77614 10 9.5C10 9.22386 9.77614 9 9.5 9H1.5Z M1 12.5C1 12.2239 1.22386 12 1.5 12H9.5C9.77614 12 10 12.2239 10 12.5C10 12.7761 9.77614 13 9.5 13H1.5C1.22386 13 1 12.7761 1 12.5Z" />
                    </svg>
                    <span className={styles.rowHeightDropdownItemText}>Medium</span>
                  </div>

                  {/* Tall */}
                  <div
                    className={`${styles.rowHeightDropdownItem}${rowHeightPreset === "tall" ? ` ${styles.rowHeightDropdownItemActive}` : ""}`}
                    onClick={() => { onRowHeightPresetChange("tall"); setIsRowHeightOpen(false); }}
                  >
                    <svg className={styles.rowHeightDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M13.1464 2.64645L12.1464 3.64645C11.9512 3.84171 11.9512 4.15829 12.1464 4.35355C12.3417 4.54882 12.6583 4.54882 12.8536 4.35355L13 4.20711V11.7929L12.8536 11.6464C12.6583 11.4512 12.3417 11.4512 12.1464 11.6464C11.9512 11.8417 11.9512 12.1583 12.1464 12.3536L13.1464 13.3536C13.2402 13.4473 13.3674 13.5 13.5 13.5C13.6326 13.5 13.7598 13.4473 13.8536 13.3536L14.8536 12.3536C15.0488 12.1583 15.0488 11.8417 14.8536 11.6464C14.6583 11.4512 14.3417 11.4512 14.1464 11.6464L14 11.7929V4.20711L14.1464 4.35355C14.3417 4.54882 14.6583 4.54882 14.8536 4.35355C15.0488 4.15829 15.0488 3.84171 14.8536 3.64645L13.8536 2.64645C13.6583 2.45118 13.3417 2.45118 13.1464 2.64645Z M1 4.5C1 3.67157 1.67157 3 2.5 3H8.5C9.32843 3 10 3.67157 10 4.5V8.5C10 9.32843 9.32843 10 8.5 10H2.5C1.67157 10 1 9.32843 1 8.5V4.5ZM2.5 4C2.22386 4 2 4.22386 2 4.5V8.5C2 8.77614 2.22386 9 2.5 9H8.5C8.77614 9 9 8.77614 9 8.5V4.5C9 4.22386 8.77614 4 8.5 4H2.5Z M1.5 12C1.22386 12 1 12.2239 1 12.5C1 12.7761 1.22386 13 1.5 13H9.5C9.77614 13 10 12.7761 10 12.5C10 12.2239 9.77614 12 9.5 12H1.5Z" />
                    </svg>
                    <span className={styles.rowHeightDropdownItemText}>Tall</span>
                  </div>

                  {/* Extra Tall */}
                  <div
                    className={`${styles.rowHeightDropdownItem}${rowHeightPreset === "extraTall" ? ` ${styles.rowHeightDropdownItemActive}` : ""}`}
                    onClick={() => { onRowHeightPresetChange("extraTall"); setIsRowHeightOpen(false); }}
                  >
                    <svg className={styles.rowHeightDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M12.1464 3.64645L13.1464 2.64645C13.3417 2.45118 13.6583 2.45118 13.8536 2.64645L14.8536 3.64645C15.0488 3.84171 15.0488 4.15829 14.8536 4.35355C14.6583 4.54882 14.3417 4.54882 14.1464 4.35355L14 4.20711V11.7929L14.1464 11.6464C14.3417 11.4512 14.6583 11.4512 14.8536 11.6464C15.0488 11.8417 15.0488 12.1583 14.8536 12.3536L13.8536 13.3536C13.7598 13.4473 13.6326 13.5 13.5 13.5C13.3674 13.5 13.2402 13.4473 13.1464 13.3536L12.1464 12.3536C11.9512 12.1583 11.9512 11.8417 12.1464 11.6464C12.3417 11.4512 12.6583 11.4512 12.8536 11.6464L13 11.7929V4.20711L12.8536 4.35355C12.6583 4.54882 12.3417 4.54882 12.1464 4.35355C11.9512 4.15829 11.9512 3.84171 12.1464 3.64645Z M1 4.5C1 3.67157 1.67157 3 2.5 3H8.5C9.32843 3 10 3.67157 10 4.5V11.5C10 12.3284 9.32843 13 8.5 13H2.5C1.67157 13 1 12.3284 1 11.5V4.5ZM2.5 4C2.22386 4 2 4.22386 2 4.5V11.5C2 11.7761 2.22386 12 2.5 12H8.5C8.77614 12 9 11.7761 9 11.5V4.5C9 4.22386 8.77614 4 8.5 4H2.5Z" />
                    </svg>
                    <span className={styles.rowHeightDropdownItemText}>Extra Tall</span>
                  </div>

                  {/* Separator */}
                  <div className={styles.rowHeightDropdownSeparator} />

                  {/* Wrap headers */}
                  <div
                    className={`${styles.rowHeightDropdownWrapItem}${wrapHeaders ? ` ${styles.rowHeightDropdownWrapItemActive}` : ""}`}
                    onClick={() => onToggleWrapHeaders()}
                  >
                    <svg className={styles.rowHeightDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M2.504 2.5c.278 0 .505.226.505.504v9.992a.505.505 0 0 1-1.009 0V3.004c0-.278.226-.504.504-.504Zm10.991 0c.279 0 .505.226.505.504v9.992a.505.505 0 0 1-1.009 0V3.004c0-.278.226-.504.504-.504ZM9.063 4.704c.731 0 1.434.289 1.953.803a2.735 2.735 0 0 1 0 3.886 2.774 2.774 0 0 1-1.954.802H5.886l1.079 1.07a.5.5 0 0 1-.704.71l-1.942-1.924a.502.502 0 0 1 0-.71l1.942-1.926a.5.5 0 0 1 .704.711l-1.08 1.07h3.178c.469 0 .918-.186 1.248-.513a1.736 1.736 0 0 0 0-2.466 1.775 1.775 0 0 0-1.248-.513h-3.56a.5.5 0 0 1 0-1h3.56Z" />
                    </svg>
                    <span className={styles.rowHeightDropdownItemText}>Wrap headers</span>
                  </div>
                </div>
              )}
            </div>

            {/* Share and sync button */}
            <div className={styles.gridBarShareViewWrapper}>
              <button type="button" className={`${styles.gridBarToolButton} ${styles.gridBarShareSyncButton}`}>
                <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="nonzero" d="M9.75 2C9.61739 2 9.49021 2.05268 9.39645 2.14645C9.30268 2.24021 9.25 2.36739 9.25 2.5C9.25 2.63261 9.30268 2.75979 9.39645 2.85355C9.49021 2.94732 9.61739 3 9.75 3H12.293L8.64648 6.64648C8.55274 6.74025 8.50008 6.86741 8.50008 7C8.50008 7.13259 8.55274 7.25975 8.64648 7.35352C8.74025 7.44726 8.86741 7.49992 9 7.49992C9.13259 7.49992 9.25975 7.44726 9.35352 7.35352L13 3.70703V6.25C13 6.38261 13.0527 6.50979 13.1464 6.60355C13.2402 6.69732 13.3674 6.75 13.5 6.75C13.6326 6.75 13.7598 6.69732 13.8536 6.60355C13.9473 6.50979 14 6.38261 14 6.25V2.5C13.998 2.49504 13.996 2.49012 13.9939 2.48523C13.9917 2.35861 13.9415 2.23755 13.8535 2.14648C13.7598 2.05272 13.6326 2.00003 13.5 2H9.75Z M3 4C2.45364 4 2 4.45364 2 5V13C2.00007 13.5463 2.45357 13.9999 2.99988 14C2.99984 14 2.99992 14 2.99988 14H11C11.5464 14 12 13.5464 12 13V9C12 8.86739 11.9473 8.74021 11.8536 8.64645C11.7598 8.55268 11.6326 8.5 11.5 8.5C11.3674 8.5 11.2402 8.55268 11.1464 8.64645C11.0527 8.74021 11 8.86739 11 9V13H3.00012L3 5H7C7.1326 5 7.25978 4.94732 7.35355 4.85355C7.44732 4.75979 7.5 4.63261 7.5 4.5C7.5 4.36739 7.44732 4.24021 7.35355 4.14645C7.25978 4.05268 7.1326 4 7 4H3Z" />
                </svg>
                <span className={styles.gridBarToolText}>Share and sync</span>
              </button>
              <span className={styles.gridBarShareViewTooltip}>Share view</span>
            </div>
          </div>
        </div>

        {/* Search button with custom tooltip + Find bar dropdown */}
        <div className={styles.findBarWrapper}>
          <div className={styles.tooltipWrapper}>
            <button type="button" className={styles.gridBarSearchButton} onClick={toggleFindBar}>
              <svg className={styles.gridBarSearchIcon} viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="nonzero" d="M7.25 1.5C4.08028 1.5 1.5 4.08028 1.5 7.25C1.5 10.4197 4.08028 13 7.25 13C8.65529 13 9.94315 12.4911 10.9432 11.6503L13.6465 14.3534C13.7402 14.4471 13.8674 14.4998 14 14.4998C14.1326 14.4998 14.2598 14.4471 14.3535 14.3534C14.4473 14.2596 14.4999 14.1325 14.4999 13.9999C14.4999 13.8673 14.4473 13.7401 14.3535 13.6464L11.6504 10.9431C12.4912 9.94305 13 8.65523 13 7.25C13 4.08028 10.4197 1.5 7.25 1.5ZM7.25 2.5C9.87928 2.5 12 4.62072 12 7.25C12 8.56227 11.4715 9.74761 10.6154 10.6061C10.6132 10.607 10.611 10.6079 10.6089 10.6088C10.608 10.611 10.6071 10.6132 10.6062 10.6154C9.74772 11.4715 8.5623 12 7.25 12C4.62072 12 2.5 9.87928 2.5 7.25C2.5 4.62072 4.62072 2.5 7.25 2.5Z" />
              </svg>
            </button>
            {!isFindOpen && (
              <span className={styles.tooltip}><span className={styles.tooltipText}>Find in view</span><span className={styles.tooltipShortcut}><span className={styles.tooltipShortcutKey}>⌘</span><span className={styles.tooltipShortcutKey}>F</span></span></span>
            )}
          </div>

          {/* Find bar dropdown — positioned below the search button */}
          {isFindOpen && (
            <div className={styles.findBarAnchor}>
              <FindBar
                onClose={closeFindBar}
                defaultValue={search}
                onSearchChange={handleSearchChange}
                matchIndex={findBarMatchIndex}
                totalMatches={findBarTotalMatches}
                isSearching={isSearchPending}
                onPrevMatch={onPrevMatch}
                onNextMatch={onNextMatch}
              />
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
});
