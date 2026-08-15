"use client";

import type { useRouter } from "next/navigation";
import type { api } from "~/trpc/react";
import { useTableTabsScroll } from "./useTableTabsScroll";
import { useTableMutations } from "./tables/useTableMutations";
import { useTableSwitcherDropdown } from "./tables/useTableSwitcherDropdown";
import { useTableTitleMenu } from "./tables/useTableTitleMenu";
import { useTableRenamePopup } from "./tables/useTableRenamePopup";

interface UseTableManagementProps {
  baseId: string;
  tableId: string;
  router: ReturnType<typeof useRouter>;
  utils: ReturnType<typeof api.useUtils>;
}

export function useTableManagement({
  baseId,
  tableId,
  router,
  utils,
}: UseTableManagementProps) {
  const {
    tables,
    activeTableId,
    handleAddTable,
    renameTable,
    clearData,
    deleteTable,
  } = useTableMutations({ baseId, tableId, router, utils });

  const switcherDropdown = useTableSwitcherDropdown({ baseId, tables, router });

  const titleMenu = useTableTitleMenu({
    activeTableId,
    tablesCount: tables.length,
    onClearData: () => void clearData(),
    onDeleteTable: deleteTable,
  });

  const renamePopup = useTableRenamePopup({
    tableId,
    activeTableId,
    tables,
    tableTitleDropdownButtonRef: titleMenu.tableTitleDropdownButtonRef,
    closeTableTitleDropdown: () => titleMenu.setIsTableTitleDropdownOpen(false),
    renameTable,
  });

  const { scrollProgress, hasOverflow, tabsScrollRef, scrollToEnd } =
    useTableTabsScroll({ tables });

  return {
    tables,
    activeTableId,
    handleAddTable,
    ...switcherDropdown,
    ...titleMenu,
    ...renamePopup,
    scrollProgress,
    hasOverflow,
    tabsScrollRef,
    scrollToEnd,
  };
}
