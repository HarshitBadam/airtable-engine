import { useRef, useState, useCallback } from "react";
import type React from "react";
import type { GridColumnDef } from "~/components/grid/ui/GridRow";
import type { NumberFormatConfig } from "~/shared/numberUtils";

interface UseColumnFieldPanelParams {
  frozenColumns: GridColumnDef[];
  scrollableColumns: GridColumnDef[];
  onCreateField?: (
    name: string,
    type: string,
    defaultValue: string,
    numberConfig?: NumberFormatConfig,
    insertPosition?: { anchorColId: string; side: "left" | "right" },
  ) => void;
}

export function useColumnFieldPanel({
  frozenColumns,
  scrollableColumns,
  onCreateField,
}: UseColumnFieldPanelParams) {
  const [headerMenuColId, setHeaderMenuColId] = useState<string | null>(null);
  const [headerMenuPosition, setHeaderMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const totalColumnCount = frozenColumns.length + scrollableColumns.length;
  const canModifyField = totalColumnCount > 1;

  const [dupFieldDialog, setDupFieldDialog] = useState<{ colId: string; colName: string } | null>(null);
  const [dupCells, setDupCells] = useState(true);
  const allColumns = [...frozenColumns, ...scrollableColumns];

  const [showBulkAddDialog, setShowBulkAddDialog] = useState(false);
  const [bulkPopulate, setBulkPopulate] = useState(true);

  const handleHeaderMenuToggle = useCallback((e: React.MouseEvent, colId: string) => {
    if (headerMenuColId === colId) {
      setHeaderMenuColId(null);
      setHeaderMenuPosition(null);
      return;
    }
    const cell = (e.currentTarget as HTMLElement).parentElement;
    if (!cell) return;
    const rect = cell.getBoundingClientRect();
    let left = rect.left;
    if (left + 320 > window.innerWidth - 6) {
      left = rect.right - 320;
    }
    setHeaderMenuPosition({ top: rect.bottom, left });
    setHeaderMenuColId(colId);
  }, [headerMenuColId]);

  const insertFieldAnchorRef = useRef<{ anchorColId: string; side: "left" | "right" } | null>(null);

  const [createFieldPosition, setCreateFieldPosition] = useState<{ top: number; left: number } | null>(null);
  const addColButtonRef = useRef<HTMLDivElement>(null);

  const [editFieldInfo, setEditFieldInfo] = useState<{
    columnId: string;
    fieldName: string;
    fieldType: string;
    numberConfig?: NumberFormatConfig;
  } | null>(null);

  const handleAddColClick = useCallback(() => {
    const btn = addColButtonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    let left = rect.left + 4;
    if (left + 400 > window.innerWidth) {
      left = rect.right - 400 - 4;
    }
    insertFieldAnchorRef.current = null;
    setEditFieldInfo(null);
    setCreateFieldPosition({ top: rect.bottom + 2, left });
  }, []);

  const handleCloseCreateField = useCallback(() => {
    setCreateFieldPosition(null);
    insertFieldAnchorRef.current = null;
    setEditFieldInfo(null);
  }, []);

  const handleCreateFieldWrapped = useCallback(
    (name: string, type: string, defaultValue: string, numberConfig?: NumberFormatConfig) => {
      const anchor = insertFieldAnchorRef.current;
      onCreateField?.(name, type, defaultValue, numberConfig, anchor ?? undefined);
      insertFieldAnchorRef.current = null;
    },
    [onCreateField],
  );

  const handleInsertField = useCallback((side: "left" | "right") => {
    if (!headerMenuColId) return;
    const headerCell = document.querySelector(`[data-col-header-id="${headerMenuColId}"]`);
    if (headerCell) {
      const rect = headerCell.getBoundingClientRect();
      let left = rect.left;
      if (left + 400 > window.innerWidth) {
        left = rect.right - 400;
      }
      insertFieldAnchorRef.current = { anchorColId: headerMenuColId, side };
      setEditFieldInfo(null);
      setCreateFieldPosition({ top: rect.bottom + 2, left });
    }
    setHeaderMenuColId(null);
    setHeaderMenuPosition(null);
  }, [headerMenuColId]);

  const handleEditField = useCallback(() => {
    if (!headerMenuColId) return;
    const col = allColumns.find((c) => c.id === headerMenuColId);
    if (!col) return;
    const uiType = col.type === "NUMBER" ? "Number" : "Single line text";
    const numCfg = col.type === "NUMBER" && col.config
      ? (col.config as NumberFormatConfig)
      : undefined;
    const headerCell = document.querySelector(`[data-col-header-id="${headerMenuColId}"]`);
    if (headerCell) {
      const rect = headerCell.getBoundingClientRect();
      let left = rect.left;
      if (left + 400 > window.innerWidth) {
        left = rect.right - 400;
      }
      setEditFieldInfo({ columnId: headerMenuColId, fieldName: col.name, fieldType: uiType, numberConfig: numCfg });
      setCreateFieldPosition({ top: rect.bottom + 2, left });
    }
    setHeaderMenuColId(null);
    setHeaderMenuPosition(null);
  }, [headerMenuColId, allColumns]);

  return {
    headerMenuColId,
    setHeaderMenuColId,
    headerMenuPosition,
    setHeaderMenuPosition,
    handleHeaderMenuToggle,
    canModifyField,
    allColumns,
    addColButtonRef,
    createFieldPosition,
    editFieldInfo,
    handleAddColClick,
    handleCloseCreateField,
    handleCreateFieldWrapped,
    handleInsertField,
    handleEditField,
    dupFieldDialog,
    setDupFieldDialog,
    dupCells,
    setDupCells,
    showBulkAddDialog,
    setShowBulkAddDialog,
    bulkPopulate,
    setBulkPopulate,
  };
}
