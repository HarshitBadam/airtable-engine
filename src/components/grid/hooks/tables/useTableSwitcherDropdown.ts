"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { useRouter } from "next/navigation";
import { useClickOutside } from "~/hooks/useClickOutside";

interface TableItem {
  id: string;
  name: string;
}

interface UseTableSwitcherDropdownProps {
  baseId: string;
  tables: TableItem[];
  router: ReturnType<typeof useRouter>;
}

export function useTableSwitcherDropdown({
  baseId,
  tables,
  router,
}: UseTableSwitcherDropdownProps) {
  const [isTableDropdownOpen, setIsTableDropdownOpen] = useState(false);
  const [isAddOrImportDropdownOpen, setIsAddOrImportDropdownOpen] =
    useState(false);
  const [addOrImportDropdownPosition, setAddOrImportDropdownPosition] =
    useState<{
      top?: number;
      left?: number;
      right?: number;
      openLeft?: boolean;
    } | null>(null);
  const [
    addOrImportOpenedFromTableDropdown,
    setAddOrImportOpenedFromTableDropdown,
  ] = useState(false);
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [tableDropdownAlignRight, setTableDropdownAlignRight] = useState(false);

  const tableDropdownRef = useRef<HTMLDivElement>(null);
  const tableDropdownButtonRef = useRef<HTMLButtonElement>(null);
  const addOrImportDropdownRef = useRef<HTMLUListElement>(null);
  const addOrImportButtonRef = useRef<HTMLButtonElement>(null);
  const addTableSectionRef = useRef<HTMLDivElement>(null);

  const filteredTables = tables.filter((table) =>
    table.name.toLowerCase().includes(tableSearchQuery.toLowerCase()),
  );

  const handleTableSelect = (selectedTableId: string) => {
    router.push(`/bases/${baseId}/tables/${selectedTableId}`);
    setIsTableDropdownOpen(false);
    setTableSearchQuery("");
  };

  const closeTableDropdown = useCallback(() => {
    setIsTableDropdownOpen(false);
    setTableSearchQuery("");
  }, []);
  useClickOutside(tableDropdownRef, isTableDropdownOpen, closeTableDropdown, {
    ignoreRefs: [tableDropdownButtonRef, addOrImportDropdownRef],
  });

  const closeAddOrImportDropdown = useCallback(() => {
    setIsAddOrImportDropdownOpen(false);
    setAddOrImportOpenedFromTableDropdown(false);
  }, []);
  useClickOutside(
    addOrImportDropdownRef,
    isAddOrImportDropdownOpen,
    closeAddOrImportDropdown,
    {
      delay: true,
      ignoreRefs: [addOrImportButtonRef, tableDropdownRef],
    },
  );

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

  return {
    isTableDropdownOpen,
    setIsTableDropdownOpen,
    isAddOrImportDropdownOpen,
    setIsAddOrImportDropdownOpen,
    addOrImportOpenedFromTableDropdown,
    setAddOrImportOpenedFromTableDropdown,
    addOrImportDropdownPosition,
    tableSearchQuery,
    setTableSearchQuery,
    hoveredTableId,
    setHoveredTableId,
    tableDropdownAlignRight,
    filteredTables,
    handleTableSelect,
    tableDropdownRef,
    tableDropdownButtonRef,
    addOrImportDropdownRef,
    addOrImportButtonRef,
    addTableSectionRef,
  };
}
