"use client";

import type React from "react";
import { useState, useRef, useCallback, useEffect } from "react";
import { useClickOutside } from "~/hooks/useClickOutside";

interface UseTableTitleMenuProps {
  activeTableId: string;
  tablesCount: number;
  onClearData: () => void;
  onDeleteTable: () => void;
}

export function useTableTitleMenu({
  activeTableId,
  tablesCount,
  onClearData,
  onDeleteTable,
}: UseTableTitleMenuProps) {
  const [isTableTitleDropdownOpen, setIsTableTitleDropdownOpen] =
    useState(false);
  const [tableTitleDropdownPosition, setTableTitleDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);

  const [isDeleteTablePopupOpen, setIsDeleteTablePopupOpen] = useState(false);
  const [deleteTablePopupPosition, setDeleteTablePopupPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const tableTitleDropdownRef = useRef<HTMLUListElement>(null);
  const tableTitleDropdownButtonRef = useRef<HTMLButtonElement>(null);

  const handleOpenClearDataModal = () => {
    setIsTableTitleDropdownOpen(false);
    setIsClearDataModalOpen(true);
  };

  const handleCloseClearDataModal = () => {
    setIsClearDataModalOpen(false);
  };

  const handleClearData = () => {
    setIsClearDataModalOpen(false);
    onClearData();
  };

  const handleOpenDeleteTablePopup = (
    event: React.MouseEvent<HTMLLIElement>,
  ) => {
    if (tablesCount <= 1) return;
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
    if (tablesCount <= 1) return;
    setIsDeleteTablePopupOpen(false);
    setDeleteTablePopupPosition(null);
    onDeleteTable();
  };

  useClickOutside(
    tableTitleDropdownRef,
    isTableTitleDropdownOpen,
    useCallback(() => setIsTableTitleDropdownOpen(false), []),
    {
      delay: true,
      ignoreRefs: [tableTitleDropdownButtonRef],
    },
  );

  useEffect(() => {
    setIsTableTitleDropdownOpen(false);
    setTableTitleDropdownPosition(null);
  }, [activeTableId]);

  return {
    isTableTitleDropdownOpen,
    setIsTableTitleDropdownOpen,
    tableTitleDropdownPosition,
    setTableTitleDropdownPosition,
    tableTitleDropdownRef,
    tableTitleDropdownButtonRef,
    isClearDataModalOpen,
    handleOpenClearDataModal,
    handleCloseClearDataModal,
    handleClearData,
    isDeleteTablePopupOpen,
    deleteTablePopupPosition,
    handleOpenDeleteTablePopup,
    handleCloseDeleteTablePopup,
    handleDeleteTable,
  };
}
