import React, { forwardRef, useImperativeHandle } from "react";
import styles from "./GridBar.module.css";
import { useBarPanels } from "~/components/grid/hooks/useBarPanels";
import { useWorkspace } from "./GridWorkspaceContext";
import type { GridBarHandle } from "./GridWorkspaceContext";
import { GridBarViewSelector } from "./GridBarViewSelector";
import { GridBarTools } from "./GridBarTools";

export type { GridBarHandle };

export const GridBar = forwardRef<GridBarHandle>(function GridBar(_props, ref) {
  const {
    handleToggleViewsSidebar,
    handleListButtonMouseEnter,
    handleListButtonMouseLeave,
    setIsViewDropdownOpen,
    setIsCreateNewDropdownOpen,
    createViewMut,
    orderedColumns,
    currentSorts,
    activeSearchTerm,
    displayMatchCount,
    currentMatchIdx,
    isSearchPending,
    sortHandlers,
  } = useWorkspace();

  const panelState = useBarPanels({
    columns: orderedColumns,
    currentSorts,
    findMatchCount: activeSearchTerm ? displayMatchCount : 0,
    findCurrentIndex: currentMatchIdx,
    isSearchPending,
    onRemoveSort: sortHandlers.removeSort,
    onPickSort: sortHandlers.pickSort,
  });

  useImperativeHandle(
    ref,
    () => ({
      openFilterPanel: () => panelState.setIsFilterOpen(true),
      openSortPanel: () => panelState.setIsSortOpen(true),
    }),
    [panelState.setIsFilterOpen, panelState.setIsSortOpen],
  );

  return (
    <div
      className={styles.gridBar}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        e.preventDefault();
        setIsViewDropdownOpen(true);
        setIsCreateNewDropdownOpen(false);
      }}
    >
      <div className={styles.gridBarLeft}>
        <button
          type="button"
          aria-label="Toggle views sidebar"
          className={styles.gridBarListButton}
          onClick={handleToggleViewsSidebar}
          onMouseEnter={handleListButtonMouseEnter}
          onMouseLeave={handleListButtonMouseLeave}
        >
          <svg
            className={styles.gridBarListButtonIcon}
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path
              fillRule="nonzero"
              d="M2.5 11.5C2.36739 11.5 2.24021 11.5527 2.14645 11.6464C2.05268 11.7402 2 11.8674 2 12C2 12.1326 2.05268 12.2598 2.14645 12.3536C2.24021 12.4473 2.36739 12.5 2.5 12.5H13.5C13.6326 12.5 13.7598 12.4473 13.8536 12.3536C13.9473 12.2598 14 12.1326 14 12C14 11.8674 13.9473 11.7402 13.8536 11.6464C13.7598 11.5527 13.6326 11.5 13.5 11.5H2.5Z M2.5 3.5C2.36739 3.5 2.24021 3.55268 2.14645 3.64645C2.05268 3.74021 2 3.86739 2 4C2 4.13261 2.05268 4.25979 2.14645 4.35355C2.24021 4.44732 2.36739 4.5 2.5 4.5H13.5C13.6326 4.5 13.7598 4.44732 13.8536 4.35355C13.9473 4.25979 14 4.13261 14 4C14 3.86739 13.9473 3.74021 13.8536 3.64645C13.7598 3.55268 13.6326 3.5 13.5 3.5H2.5Z M2.5 7.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H2.5Z"
            />
          </svg>
        </button>

        <GridBarViewSelector />
      </div>

      <GridBarTools
        panelState={panelState}
        viewLoading={createViewMut.isPending}
      />
    </div>
  );
});
