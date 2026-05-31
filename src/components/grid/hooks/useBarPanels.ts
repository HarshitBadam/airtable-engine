import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { HideFieldColumn } from "~/components/grid/ui/HideFieldsPanel";
import type { ActiveSort } from "~/components/grid/ui/SortPanel";
import { useGridStore } from "~/components/grid/GridStore";

interface UseBarPanelsProps {
  columns: HideFieldColumn[];
  currentSorts: ActiveSort[];
  findMatchCount: number;
  findCurrentIndex: number;
  isSearchPending: boolean;
  onRemoveSort: (index: number) => void;
  onPickSort: (columnId: string, columnType: "TEXT" | "NUMBER") => void;
}

export function useBarPanels({
  columns,
  currentSorts,
  findMatchCount,
  findCurrentIndex,
  isSearchPending,
  onRemoveSort,
  onPickSort,
}: UseBarPanelsProps) {
  const search = useGridStore((s) => s.search);
  const setSearch = useGridStore((s) => s.setSearch);
  const filterConditions = useGridStore((s) => s.filterConditions) ?? [];

  const [isHideFieldsOpen, setIsHideFieldsOpen] = useState(false);
  const hideFieldsButtonRef = useRef<HTMLButtonElement>(null);
  const hideFieldsPanelRef = useRef<HTMLDivElement>(null);

  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const sortPanelRef = useRef<HTMLDivElement>(null);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const [isRowHeightOpen, setIsRowHeightOpen] = useState(false);
  const rowHeightButtonRef = useRef<HTMLDivElement>(null);

  const [isFindOpen, setIsFindOpen] = useState(false);

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

  useEffect(() => {
    if (!isHideFieldsOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (hideFieldsPanelRef.current?.contains(event.target as Node)) return;
      if (hideFieldsButtonRef.current?.contains(event.target as Node)) return;
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

  useEffect(() => {
    if (!isHideFieldsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsHideFieldsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isHideFieldsOpen]);

  const toggleSortPanel = useCallback(() => {
    setIsSortOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isSortOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (sortPanelRef.current?.contains(event.target as Node)) return;
      if (sortButtonRef.current?.contains(event.target as Node)) return;
      if ((event.target as HTMLElement).closest("[data-sort-subdropdown]")) return;
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

  useEffect(() => {
    if (!isSortOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsSortOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSortOpen]);

  const handleSortPick = useCallback(
    (columnId: string, columnType: "TEXT" | "NUMBER") => {
      onPickSort(columnId, columnType);
    },
    [onPickSort],
  );

  const handleRemoveSort = useCallback(
    (index: number) => {
      onRemoveSort(index);
      if (currentSorts.length <= 1) setIsSortOpen(false);
    },
    [onRemoveSort, currentSorts.length],
  );

  const toggleFilterPanel = useCallback(() => {
    setIsFilterOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isFilterOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (filterPanelRef.current?.contains(target)) return;
      if (filterButtonRef.current?.contains(target)) return;
      // FilterPanel renders sub-dropdowns as portals — don't close on those clicks.
      if (target.closest?.("[data-filter-subdropdown]")) return;
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

  useEffect(() => {
    if (!isFilterOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFilterOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFilterOpen]);

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

  const toggleFindBar = useCallback(() => {
    setIsFindOpen((prev) => !prev);
  }, []);

  const closeFindBar = useCallback(() => {
    setIsFindOpen(false);
    setSearch("");
  }, [setSearch]);

  const handleSearchChange = useCallback(
    (value: string) => { setSearch(value); },
    [setSearch],
  );

  const findBarTotalMatches = useMemo(() => {
    if (!search.trim()) return undefined;
    if (findMatchCount > 0) return findMatchCount;
    if (!isSearchPending) return findMatchCount;
    return undefined;
  }, [search, isSearchPending, findMatchCount]);

  const findBarMatchIndex =
    findBarTotalMatches !== undefined && findBarTotalMatches > 0
      ? findCurrentIndex + 1
      : 0;

  return {
    search,
    isHideFieldsOpen, setIsHideFieldsOpen, hideFieldsButtonRef, hideFieldsPanelRef, toggleHideFieldsPanel,
    isSortOpen, setIsSortOpen, sortButtonRef, sortPanelRef, toggleSortPanel, handleSortPick, handleRemoveSort,
    isFilterOpen, setIsFilterOpen, filterButtonRef, filterPanelRef, toggleFilterPanel, filterButtonLabel, isFilterActive,
    isRowHeightOpen, setIsRowHeightOpen, rowHeightButtonRef,
    isFindOpen, toggleFindBar, closeFindBar, handleSearchChange, findBarTotalMatches, findBarMatchIndex,
  };
}
