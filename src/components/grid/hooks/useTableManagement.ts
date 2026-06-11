"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AppRouter } from "~/server/api/root";
import { api } from "~/trpc/react";
import type { useRouter } from "next/navigation";
import { useTableTabsScroll } from "./useTableTabsScroll";
import { useClickOutside } from "~/hooks/useClickOutside";

const PENDING_RENAME_KEY = "grid:pendingRenameTableId";

export function takePendingRenameTableId(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(PENDING_RENAME_KEY);
  if (value) window.sessionStorage.removeItem(PENDING_RENAME_KEY);
  return value;
}

export function setPendingRenameTableId(id: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PENDING_RENAME_KEY, id);
}

interface TableItem {
  id: string;
  name: string;
}

interface UseTableManagementProps {
  baseId: string;
  tableId: string;
  router: ReturnType<typeof useRouter>;
  utils: ReturnType<typeof api.useUtils>;
}

export function useTableManagement({ baseId, tableId, router, utils }: UseTableManagementProps) {
  const queryClient = useQueryClient();
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

  const [isRenamePopupOpen, setIsRenamePopupOpen] = useState(false);
  const [renamePopupPosition, setRenamePopupPosition] = useState<{ top: number; left: number } | null>(null);
  const [renameTableName, setRenameTableName] = useState('');
  const [renameRecordName, setRenameRecordName] = useState('Record');

  const [showDuplicateTooltip, setShowDuplicateTooltip] = useState(false);
  const duplicateTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);

  const [isDeleteTablePopupOpen, setIsDeleteTablePopupOpen] = useState(false);
  const [deleteTablePopupPosition, setDeleteTablePopupPosition] = useState<{ top: number; left: number } | null>(null);

  const tableDropdownRef = useRef<HTMLDivElement>(null);
  const tableDropdownButtonRef = useRef<HTMLButtonElement>(null);
  const addOrImportDropdownRef = useRef<HTMLUListElement>(null);
  const addOrImportButtonRef = useRef<HTMLButtonElement>(null);
  const addTableSectionRef = useRef<HTMLDivElement>(null);
  const tableTitleDropdownRef = useRef<HTMLUListElement>(null);
  const tableTitleDropdownButtonRef = useRef<HTMLButtonElement>(null);
  const renamePopupRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const tablesQuery = api.table.listByBase.useQuery(
    { baseId },
    { staleTime: 30_000 },
  );
  const tables: TableItem[] = useMemo(
    () => (tablesQuery.data ?? []).map((t) => ({ id: t.id, name: t.name })),
    [tablesQuery.data],
  );
  const activeTableId = tableId;

  const createTableMut = api.table.create.useMutation({
    onSuccess: async (result) => {
      await utils.table.listByBase.invalidate({ baseId });
      setPendingRenameTableId(result.table.id);
      router.push(`/bases/${baseId}/tables/${result.table.id}`);
    },
  });

  const renameTableMut = api.table.rename.useMutation({
    onSuccess: () => utils.table.listByBase.invalidate({ baseId }),
  });

  const deleteTableMut = api.table.delete.useMutation({
    onSuccess: () => {
      void utils.table.listByBase.invalidate({ baseId });
    },
    onError: () => {
      void utils.table.listByBase.invalidate({ baseId });
    },
  });

  const clearDataMut = api.row.clearData.useMutation({
    onSuccess: () => {
      void utils.row.infinite.invalidate();
    },
    onError: () => {
      void utils.row.infinite.invalidate();
    },
  });

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
        setRenamePopupPosition({ top: tabRect.bottom + 8, left });
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

  const handleCancelRename = useCallback(() => {
    setIsRenamePopupOpen(false);
    setRenamePopupPosition(null);
    setShowDuplicateTooltip(false);
    if (duplicateTooltipTimerRef.current) clearTimeout(duplicateTooltipTimerRef.current);
  }, []);

  const handleOpenClearDataModal = () => {
    setIsTableTitleDropdownOpen(false);
    setIsClearDataModalOpen(true);
  };

  const handleCloseClearDataModal = () => {
    setIsClearDataModalOpen(false);
  };

  const handleClearData = async () => {
    setIsClearDataModalOpen(false);

    await utils.row.infinite.cancel();

    queryClient.setQueriesData<{
      pages: { items: unknown[]; totalCount: number; nextCursor: unknown }[];
      pageParams: unknown[];
    }>(
      {
        queryKey: [["row", "infinite"]],
        predicate: (query) => {
          const key = query.queryKey as [string[], { input?: { tableId?: string } }];
          return key[1]?.input?.tableId === activeTableId;
        },
      },
      (old) => {
        if (!old) return old;
        return {
          pages: [{ items: [], totalCount: 0, nextCursor: undefined }],
          pageParams: [old.pageParams[0]],
        };
      },
    );

    clearDataMut.mutate({ tableId: activeTableId });
  };

  const handleOpenDeleteTablePopup = (event: React.MouseEvent<HTMLLIElement>) => {
    if (tables.length <= 1) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setDeleteTablePopupPosition({ top: rect.bottom + 8 - 439, left: rect.left - 12 });
    setIsTableTitleDropdownOpen(false);
    setIsDeleteTablePopupOpen(true);
  };

  const handleCloseDeleteTablePopup = () => {
    setIsDeleteTablePopupOpen(false);
    setDeleteTablePopupPosition(null);
  };

  const handleDeleteTable = () => {
    if (tables.length <= 1) return;
    const remaining = tables.filter((t) => t.id !== activeTableId);
    setIsDeleteTablePopupOpen(false);
    setDeleteTablePopupPosition(null);
    router.push(`/bases/${baseId}/tables/${remaining[0]!.id}`);
    void utils.table.listByBase.cancel({ baseId });
    utils.table.listByBase.setData({ baseId }, (old) =>
      old ? old.filter((t) => t.id !== activeTableId) : old,
    );
    deleteTableMut.mutate({ id: activeTableId, baseId });
  };

  const { scrollProgress, hasOverflow, tabsScrollRef, scrollToEnd } = useTableTabsScroll({ tables });

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(tableSearchQuery.toLowerCase())
  );

  const handleTableSelect = (selectedTableId: string) => {
    router.push(`/bases/${baseId}/tables/${selectedTableId}`);
    setIsTableDropdownOpen(false);
    setTableSearchQuery('');
  };

  const closeTableDropdown = useCallback(() => {
    setIsTableDropdownOpen(false);
    setTableSearchQuery('');
  }, []);
  useClickOutside(tableDropdownRef, isTableDropdownOpen, closeTableDropdown, {
    ignoreRefs: [tableDropdownButtonRef, addOrImportDropdownRef],
  });

  const closeAddOrImportDropdown = useCallback(() => {
    setIsAddOrImportDropdownOpen(false);
    setAddOrImportOpenedFromTableDropdown(false);
  }, []);
  useClickOutside(addOrImportDropdownRef, isAddOrImportDropdownOpen, closeAddOrImportDropdown, {
    delay: true,
    ignoreRefs: [addOrImportButtonRef, tableDropdownRef],
  });

  useClickOutside(tableTitleDropdownRef, isTableTitleDropdownOpen, useCallback(() => setIsTableTitleDropdownOpen(false), []), {
    delay: true,
    ignoreRefs: [tableTitleDropdownButtonRef],
  });

  useClickOutside(renamePopupRef, isRenamePopupOpen, handleCancelRename, { delay: true });

  useEffect(() => {
    if (isRenamePopupOpen && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenamePopupOpen]);

  // Restore pending rename popup after table creation navigates to new route
  useEffect(() => {
    const pendingId = takePendingRenameTableId();
    if (!pendingId || tableId !== pendingId) return;
    const newTable = tables.find(t => t.id === pendingId);
    if (!newTable) return;
    const tryOpen = (attempts = 0) => {
      const tab = document.querySelector<HTMLElement>(`[data-table-id="${pendingId}"]`);
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
      if (top > maxTop) top = maxTop;
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

  return {
    tables,
    activeTableId,
    filteredTables,
    isTableDropdownOpen, setIsTableDropdownOpen,
    isAddOrImportDropdownOpen, setIsAddOrImportDropdownOpen,
    addOrImportOpenedFromTableDropdown, setAddOrImportOpenedFromTableDropdown,
    isTableTitleDropdownOpen, setIsTableTitleDropdownOpen,
    tableTitleDropdownPosition, setTableTitleDropdownPosition,
    addOrImportDropdownPosition,
    tableSearchQuery, setTableSearchQuery,
    hoveredTableId, setHoveredTableId,
    tableDropdownAlignRight,
    isRenamePopupOpen,
    renamePopupPosition,
    renameTableName, setRenameTableName,
    renameRecordName,
    showDuplicateTooltip,
    isClearDataModalOpen,
    isDeleteTablePopupOpen,
    deleteTablePopupPosition,
    scrollProgress,
    hasOverflow,
    tabsScrollRef,
    tableDropdownRef,
    tableDropdownButtonRef,
    addOrImportDropdownRef,
    addOrImportButtonRef,
    addTableSectionRef,
    tableTitleDropdownRef,
    tableTitleDropdownButtonRef,
    renamePopupRef,
    renameInputRef,
    handleAddTable,
    handleOpenRenamePopup,
    handleSaveRename,
    handleCancelRename,
    handleOpenClearDataModal,
    handleCloseClearDataModal,
    handleClearData,
    handleOpenDeleteTablePopup,
    handleCloseDeleteTablePopup,
    handleDeleteTable,
    handleTableSelect,
    scrollToEnd,
  };
}
