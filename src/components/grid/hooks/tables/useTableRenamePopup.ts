"use client";

import type React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useClickOutside } from "~/hooks/useClickOutside";
import { takePendingRenameTableId } from "./useTableMutations";

interface TableItem {
  id: string;
  name: string;
}

interface UseTableRenamePopupProps {
  tableId: string;
  activeTableId: string;
  tables: TableItem[];
  tableTitleDropdownButtonRef: React.RefObject<HTMLButtonElement | null>;
  closeTableTitleDropdown: () => void;
  renameTable: (name: string) => void;
}

export function useTableRenamePopup({
  tableId,
  activeTableId,
  tables,
  tableTitleDropdownButtonRef,
  closeTableTitleDropdown,
  renameTable,
}: UseTableRenamePopupProps) {
  const [isRenamePopupOpen, setIsRenamePopupOpen] = useState(false);
  const [renamePopupPosition, setRenamePopupPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [renameTableName, setRenameTableName] = useState("");
  const [renameRecordName, setRenameRecordName] = useState("Record");

  const [showDuplicateTooltip, setShowDuplicateTooltip] = useState(false);
  const duplicateTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const renamePopupRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const handleOpenRenamePopup = () => {
    const activeTable = tables.find((t) => t.id === activeTableId);
    if (activeTable && tableTitleDropdownButtonRef.current) {
      const parentTab =
        tableTitleDropdownButtonRef.current.closest("[data-table-tab]");
      if (parentTab) {
        const tabRect = parentTab.getBoundingClientRect();
        const transformOffset = 72;
        const minLeftMargin = 12;
        const minLeft = minLeftMargin + transformOffset;
        const left = Math.max(tabRect.left, minLeft);
        setRenamePopupPosition({ top: tabRect.bottom + 8, left });
        setRenameTableName(activeTable.name);
        setRenameRecordName("Record");
        setIsRenamePopupOpen(true);
        closeTableTitleDropdown();
      }
    }
  };

  const handleSaveRename = () => {
    const trimmed = renameTableName.trim();
    if (!trimmed) return;

    const isDuplicate = tables.some(
      (t) => t.id !== activeTableId && t.name === trimmed,
    );
    if (isDuplicate) {
      setShowDuplicateTooltip(true);
      if (duplicateTooltipTimerRef.current)
        clearTimeout(duplicateTooltipTimerRef.current);
      duplicateTooltipTimerRef.current = setTimeout(
        () => setShowDuplicateTooltip(false),
        10000,
      );
      return;
    }

    setShowDuplicateTooltip(false);
    if (duplicateTooltipTimerRef.current)
      clearTimeout(duplicateTooltipTimerRef.current);
    renameTable(trimmed);
    setIsRenamePopupOpen(false);
    setRenamePopupPosition(null);
  };

  const handleCancelRename = useCallback(() => {
    setIsRenamePopupOpen(false);
    setRenamePopupPosition(null);
    setShowDuplicateTooltip(false);
    if (duplicateTooltipTimerRef.current)
      clearTimeout(duplicateTooltipTimerRef.current);
  }, []);

  useClickOutside(renamePopupRef, isRenamePopupOpen, handleCancelRename, {
    delay: true,
  });

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
    const newTable = tables.find((t) => t.id === pendingId);
    if (!newTable) return;
    const tryOpen = (attempts = 0) => {
      const tab = document.querySelector<HTMLElement>(
        `[data-table-id="${pendingId}"]`,
      );
      if (tab) {
        const tabRect = tab.getBoundingClientRect();
        const transformOffset = 71;
        const minLeftMargin = 12;
        const minLeft = minLeftMargin + transformOffset;
        const left = Math.max(tabRect.left, minLeft);
        setRenamePopupPosition({ top: tabRect.bottom + 8, left });
        setRenameTableName(newTable.name);
        setRenameRecordName("Record");
        setIsRenamePopupOpen(true);
      } else if (attempts < 20) {
        requestAnimationFrame(() => tryOpen(attempts + 1));
      }
    };
    requestAnimationFrame(() => tryOpen());
  }, [tableId, tables]);

  return {
    isRenamePopupOpen,
    renamePopupPosition,
    renameTableName,
    setRenameTableName,
    renameRecordName,
    showDuplicateTooltip,
    renamePopupRef,
    renameInputRef,
    handleOpenRenamePopup,
    handleSaveRename,
    handleCancelRename,
  };
}
