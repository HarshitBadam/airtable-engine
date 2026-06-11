import React from "react";
import styles from "./GridBar.module.css";
import { HideFieldsPanel } from "./HideFieldsPanel";
import { SortPanel } from "./SortPanel";
import { FindBar } from "./FindBar";
import { FilterPanel } from "./FilterPanel";
import { RowHeightMenu } from "./RowHeightMenu";
import type { useBarPanels } from "~/components/grid/hooks/useBarPanels";
import { useWorkspace } from "./GridWorkspaceContext";
import { toast } from "sonner";

type BarPanelState = ReturnType<typeof useBarPanels>;

interface GridBarToolsProps {
  panelState: BarPanelState;
  viewLoading?: boolean;
}

export function GridBarTools({ panelState, viewLoading }: GridBarToolsProps) {
  const workspace = useWorkspace();

  const {
    search,
    isHideFieldsOpen, hideFieldsButtonRef, hideFieldsPanelRef, toggleHideFieldsPanel,
    isSortOpen, sortButtonRef, sortPanelRef, toggleSortPanel, handleSortPick, handleRemoveSort,
    isFilterOpen, filterButtonRef, filterPanelRef, toggleFilterPanel, filterButtonLabel, isFilterActive,
    isRowHeightOpen, setIsRowHeightOpen, rowHeightButtonRef,
    isFindOpen, toggleFindBar, closeFindBar, handleSearchChange, findBarTotalMatches, findBarMatchIndex,
  } = panelState;

  return (
    <div className={styles.gridBarRight}>
      {viewLoading ? (
        <div className={styles.gridBarSkeletonPills}>
          <div className={styles.gridBarSkeletonPill} style={{ width: 50, marginRight: 8 }} />
          <div className={styles.gridBarSkeletonPill} style={{ width: 51.75 }} />
        </div>
      ) : (
        <>
          <div className={styles.gridBarToolsOuter}>
            <div className={styles.gridBarToolsInner}>
              <div className={styles.gridBarHideFieldsWrapper}>
                <button
                  ref={hideFieldsButtonRef}
                  type="button"
                  className={[
                    styles.gridBarToolButton,
                    styles.gridBarHideFieldsButton,
                    isHideFieldsOpen ? styles.gridBarToolButtonActive : "",
                    workspace.hiddenColumnIds.length > 0 ? styles.gridBarHideFieldsButtonHasHidden : "",
                  ].filter(Boolean).join(" ")}
                  onClick={toggleHideFieldsPanel}
                >
                  <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="nonzero" d="M8.00013 2.99999C7.53899 2.99917 7.07864 3.03701 6.62379 3.11315C6.55902 3.12398 6.49703 3.14747 6.44134 3.18226C6.38565 3.21706 6.33736 3.26248 6.29923 3.31594C6.2611 3.3694 6.23387 3.42984 6.2191 3.49382C6.20433 3.5578 6.2023 3.62407 6.21314 3.68883C6.23505 3.81961 6.30801 3.93632 6.41597 4.01331C6.52393 4.0903 6.65805 4.12125 6.78883 4.09935C7.18869 4.03242 7.59357 3.99923 7.99915 3.99999C7.99882 3.99999 7.99948 3.99999 7.99915 3.99999C12.083 3.99999 14.0065 7.16727 14.4415 7.99926C14.2327 8.39403 13.6815 9.3219 12.7042 10.196C12.6553 10.2398 12.6154 10.2928 12.587 10.352C12.5585 10.4112 12.542 10.4754 12.5383 10.5409C12.5347 10.6065 12.544 10.6721 12.5657 10.7341C12.5874 10.7961 12.6211 10.8531 12.6649 10.9021C12.7533 11.0009 12.8774 11.0606 13.0097 11.0679C13.1421 11.0753 13.272 11.0298 13.3709 10.9414C14.8157 9.64896 15.4569 8.20311 15.4569 8.20311C15.4853 8.13917 15.5 8.06997 15.5 7.99999C15.5 7.93001 15.4853 7.86081 15.4569 7.79686C15.4569 7.79686 13.2994 3.00052 8.00013 2.99999Z M8.56177 5.05248C8.4315 5.02783 8.29677 5.05593 8.18721 5.1306C8.07765 5.20527 8.00223 5.3204 7.97755 5.45067C7.96532 5.51519 7.96592 5.58148 7.97932 5.64576C7.99271 5.71004 8.01864 5.77106 8.05562 5.82532C8.09259 5.87958 8.13989 5.92603 8.19482 5.96201C8.24975 5.99799 8.31122 6.0228 8.37574 6.03502C9.25118 6.20086 9.90696 6.92166 9.98963 7.80883C9.99573 7.87421 10.0146 7.93775 10.0453 7.99582C10.076 8.05389 10.1177 8.10536 10.1683 8.14727C10.2188 8.18919 10.2771 8.22074 10.3399 8.24013C10.4026 8.25951 10.4686 8.26635 10.5339 8.26024C10.666 8.24793 10.7877 8.18368 10.8723 8.08163C10.957 7.97958 10.9976 7.84808 10.9854 7.71605C10.8617 6.38949 9.8708 5.30045 8.56177 5.05248Z M3.02381 2.0006C2.89137 1.99428 2.76183 2.04082 2.6637 2.12999C2.56557 2.21919 2.5069 2.34371 2.50058 2.47617C2.49426 2.60862 2.54082 2.73816 2.63001 2.83629L5.64234 6.14989C4.99783 6.97182 4.81667 8.0854 5.20167 9.08153C5.64782 10.2359 6.7614 10.9994 7.99891 10.9997C8.57697 11.0018 9.13723 10.8317 9.61744 10.5226L12.63 13.8363C12.7192 13.9344 12.8437 13.9931 12.9762 13.9994C13.1086 14.0057 13.2382 13.9592 13.3363 13.87C13.4344 13.7808 13.4931 13.6563 13.4994 13.5238C13.5058 13.3914 13.4592 13.2618 13.37 13.1637L6.6908 5.81652C6.69016 5.81554 6.68951 5.81456 6.68885 5.81359C6.6884 5.81338 6.68796 5.81318 6.68751 5.81298L3.37 2.16369C3.2808 2.06557 3.15627 2.0069 3.02381 2.0006ZM4.78126 3.81261C4.65529 3.7712 4.51803 3.78151 4.39966 3.8413C1.67465 5.21716 0.542853 7.79748 0.542853 7.79748C0.514536 7.86137 0.499927 7.93049 0.49997 8.00038C0.500012 8.07027 0.514704 8.13938 0.543098 8.20324C0.543098 8.20324 2.69954 12.9988 7.99805 13C9.24842 13.0098 10.4832 12.7217 11.6 12.1592C11.6586 12.1296 11.7109 12.0888 11.7537 12.0391C11.7966 11.9893 11.8293 11.9317 11.8498 11.8693C11.8704 11.8069 11.8785 11.7411 11.8736 11.6757C11.8688 11.6102 11.8511 11.5463 11.8215 11.4877C11.792 11.429 11.7512 11.3768 11.7015 11.3339C11.6517 11.291 11.594 11.2584 11.5317 11.2378C11.4693 11.2172 11.4035 11.2091 11.338 11.214C11.2726 11.2189 11.2087 11.2366 11.15 11.2661C10.1746 11.7574 9.09616 12.009 8.00403 12.0001C8.00269 12.0001 8.00135 12.0001 8.00001 12.0001C3.9214 12.0001 1.99934 8.84205 1.56104 8.00512C1.80002 7.53467 2.78966 5.77445 4.85035 4.734C4.90897 4.7044 4.96118 4.66355 5.00401 4.61377C5.04684 4.56399 5.07944 4.50626 5.09996 4.44389C5.12048 4.38151 5.12851 4.3157 5.12359 4.25021C5.11867 4.18473 5.1009 4.12086 5.0713 4.06225C5.01154 3.94387 4.90721 3.85407 4.78126 3.81261ZM6.3307 6.90709L8.92811 9.76427C8.64391 9.91434 8.32855 10.0011 8.00196 9.99987C8.00131 9.99987 8.00066 9.99987 8.00001 9.99987C7.17209 9.99993 6.43288 9.49318 6.13441 8.72094C5.89804 8.10936 5.98275 7.43768 6.3307 6.90709Z" />
                  </svg>
                  <span className={styles.gridBarToolText}>
                    {workspace.hiddenColumnIds.length > 0
                      ? `${workspace.hiddenColumnIds.length} hidden field${workspace.hiddenColumnIds.length === 1 ? "" : "s"}`
                      : "Hide fields"}
                  </span>
                </button>
                {isHideFieldsOpen && (
                  <div ref={hideFieldsPanelRef} className={styles.hideFieldsPanelAnchor}>
                    <HideFieldsPanel
                      columns={workspace.orderedColumns}
                      hiddenColumnIds={workspace.hiddenColumnIds}
                      onToggleColumn={workspace.toggleHiddenColumn}
                      onHideAll={workspace.handleHideAllColumns}
                      onShowAll={workspace.handleShowAllColumns}
                      onReorder={workspace.handleReorderColumns}
                    />
                  </div>
                )}
              </div>

              <div className={styles.gridBarFilterWrapper}>
                <button
                  ref={filterButtonRef}
                  type="button"
                  className={[
                    styles.gridBarToolButton,
                    styles.gridBarFilterButton,
                    isFilterOpen ? styles.gridBarToolButtonActive : "",
                    isFilterActive ? styles.gridBarFilterButtonActive : "",
                  ].filter(Boolean).join(" ")}
                  onClick={toggleFilterPanel}
                >
                  <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="nonzero" d="M6.5 10.5C6.36739 10.5 6.24021 10.5527 6.14645 10.6464C6.05268 10.7402 6 10.8674 6 11C6 11.1326 6.05268 11.2598 6.14645 11.3536C6.24021 11.4473 6.36739 11.5 6.5 11.5H9.5C9.63261 11.5 9.75979 11.4473 9.85355 11.3536C9.94732 11.2598 10 11.1326 10 11C10 10.8674 9.94732 10.7402 9.85355 10.6464C9.75979 10.5527 9.63261 10.5 9.5 10.5H6.5Z M1.5 4.5C1.36739 4.5 1.24021 4.55268 1.14645 4.64645C1.05268 4.74021 1 4.86739 1 5C1 5.13261 1.05268 5.25979 1.14645 5.35355C1.24021 5.44732 1.36739 5.5 1.5 5.5H14.5C14.6326 5.5 14.7598 5.44732 14.8536 5.35355C14.9473 5.25979 15 5.13261 15 5C15 4.86739 14.9473 4.74021 14.8536 4.64645C14.7598 4.55268 14.6326 4.5 14.5 4.5H1.5Z M4 7.5C3.86739 7.5 3.74021 7.55268 3.64645 7.64645C3.55268 7.74021 3.5 7.86739 3.5 8C3.5 8.13261 3.55268 8.25979 3.64645 8.35355C3.74021 8.44732 3.86739 8.5 4 8.5H12C12.1326 8.5 12.2598 8.44732 12.3536 8.35355C12.4473 8.25979 12.5 8.13261 12.5 8C12.5 7.86739 12.4473 7.74021 12.3536 7.64645C12.2598 7.55268 12.1326 7.5 12 7.5H4Z" />
                  </svg>
                  <span className={styles.gridBarToolText}>{filterButtonLabel}</span>
                </button>
                {isFilterOpen && (
                  <div ref={filterPanelRef} className={styles.filterPanelAnchor}>
                    <FilterPanel baseColor={workspace.baseColor} columns={workspace.orderedColumns} />
                  </div>
                )}
              </div>

              <button
                type="button"
                className={`${styles.gridBarToolButton} ${styles.gridBarGroupButton}`}
                onClick={() => toast("This feature is currently not available")}
              >
                <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="nonzero" d="M6 6.5C6 6.91421 5.66421 7.25 5.25 7.25C4.83579 7.25 4.5 6.91421 4.5 6.5C4.5 6.08579 4.83579 5.75 5.25 5.75C5.66421 5.75 6 6.08579 6 6.5Z M7 6.5C7 6.22386 7.22386 6 7.5 6H11C11.2761 6 11.5 6.22386 11.5 6.5C11.5 6.77614 11.2761 7 11 7H7.5C7.22386 7 7 6.77614 7 6.5Z M7.5 9C7.22386 9 7 9.22386 7 9.5C7 9.77614 7.22386 10 7.5 10H11C11.2761 10 11.5 9.77614 11.5 9.5C11.5 9.22386 11.2761 9 11 9H7.5Z M6 9.5C6 9.91421 5.66421 10.25 5.25 10.25C4.83579 10.25 4.5 9.91421 4.5 9.5C4.5 9.08579 4.83579 8.75 5.25 8.75C5.66421 8.75 6 9.08579 6 9.5Z M2.54545 2.5C2.0573 2.5 1.5 2.84588 1.5 3.45455V12.5455C1.5 13.1541 2.0573 13.5 2.54545 13.5H13.4545C13.9427 13.5 14.5 13.1541 14.5 12.5455V3.45455C14.5 2.84588 13.9427 2.5 13.4545 2.5H2.54545ZM2.5 12.4929V3.50706C2.51085 3.50329 2.52597 3.5 2.54545 3.5H13.4545C13.474 3.5 13.4891 3.50329 13.5 3.50706V12.4929C13.4891 12.4967 13.474 12.5 13.4545 12.5H2.54545C2.52597 12.5 2.51085 12.4967 2.5 12.4929Z" />
                </svg>
                <span className={styles.gridBarToolText}>Group</span>
              </button>

              <div className={styles.gridBarSortWrapper}>
                <button
                  ref={sortButtonRef}
                  type="button"
                  className={[
                    styles.gridBarToolButton,
                    styles.gridBarSortButton,
                    isSortOpen ? styles.gridBarToolButtonActive : "",
                    workspace.hasTemporarySorts ? styles.gridBarSortButtonHasSort : "",
                  ].filter(Boolean).join(" ")}
                  onClick={toggleSortPanel}
                >
                  <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="nonzero" d="M4.99999 2.5C4.86738 2.5 4.7402 2.55268 4.64643 2.64645C4.55266 2.74021 4.49999 2.86739 4.49999 3V11.793L3.3535 10.6465C3.25974 10.5527 3.13258 10.5001 2.99999 10.5001C2.8674 10.5001 2.74023 10.5527 2.64647 10.6465C2.55272 10.7402 2.50006 10.8674 2.50006 11C2.50006 11.1326 2.55272 11.2598 2.64647 11.3535L4.64647 13.3535C4.74022 13.4473 4.86738 13.5 4.99999 13.5C5.13259 13.5 5.25975 13.4473 5.3535 13.3535L7.3535 11.3535C7.44725 11.2598 7.49991 11.1326 7.49991 11C7.49991 10.8674 7.44725 10.7402 7.3535 10.6465C7.25974 10.5527 7.13258 10.5001 6.99999 10.5001C6.8674 10.5001 6.74024 10.5527 6.64647 10.6465L5.49999 11.793V3C5.49999 2.86739 5.44731 2.74021 5.35354 2.64645C5.25977 2.55268 5.13259 2.5 4.99999 2.5Z M11 2.5C10.8674 2.50003 10.7402 2.55272 10.6465 2.64648L8.64647 4.64648C8.55272 4.74025 8.50006 4.86741 8.50006 5C8.50006 5.13259 8.55272 5.25975 8.64647 5.35352C8.74024 5.44726 8.8674 5.49992 8.99999 5.49992C9.13258 5.49992 9.25974 5.44726 9.3535 5.35352L10.5 4.20703V13C10.5 13.1326 10.5527 13.2598 10.6464 13.3536C10.7402 13.4473 10.8674 13.5 11 13.5C11.1326 13.5 11.2598 13.4473 11.3535 13.3536C11.4473 13.2598 11.5 13.1326 11.5 13V4.20703L12.6465 5.35352C12.7402 5.44726 12.8674 5.49992 13 5.49992C13.1326 5.49992 13.2597 5.44726 13.3535 5.35352C13.4472 5.25975 13.4999 5.13259 13.4999 5C13.4999 4.86741 13.4472 4.74025 13.3535 4.64648L11.3535 2.64648C11.3487 2.64437 11.3438 2.64234 11.3389 2.64038C11.2478 2.55235 11.1266 2.50218 11 2.5Z" />
                  </svg>
                  <span className={styles.gridBarToolText}>
                    {workspace.effectiveSortCount > 0
                      ? `Sorted by ${workspace.effectiveSortCount} field${workspace.effectiveSortCount === 1 ? "" : "s"}`
                      : "Sort"}
                  </span>
                </button>
                {isSortOpen && (
                  <div ref={sortPanelRef} className={styles.sortPanelAnchor}>
                    <SortPanel
                      columns={workspace.orderedColumns}
                      currentSorts={workspace.currentSorts}
                      autoSort={workspace.autoSort}
                      onPickSort={handleSortPick}
                      onAddSort={workspace.sortHandlers.addSort}
                      onChangeSortField={workspace.sortHandlers.changeSortField}
                      onChangeDirection={workspace.sortHandlers.changeSortDirection}
                      onRemoveSort={handleRemoveSort}
                      onToggleAutoSort={workspace.handleToggleAutoSort}
                      onSaveSorts={workspace.handleSaveSorts}
                      onCancelSorts={workspace.handleCancelSorts}
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                className={`${styles.gridBarToolButton} ${styles.gridBarColorButton}`}
                onClick={() => toast("This feature is currently not available")}
              >
                <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="nonzero" d="M2.36878 1.36865C2.30311 1.36863 2.23808 1.38154 2.17741 1.40666C2.11673 1.43177 2.06159 1.46859 2.01515 1.51501C1.96871 1.56144 1.93187 1.61657 1.90674 1.67723C1.88161 1.7379 1.86868 1.80292 1.86868 1.86859C1.86868 1.93426 1.88161 1.99928 1.90674 2.05995C1.93187 2.12062 1.96871 2.17574 2.01515 2.22217L6.21803 6.42505C6.08351 6.67237 6.00001 6.95077 6.00001 7.25C6.00001 8.21058 6.78943 9 7.75001 9C8.71059 9 9.50001 8.21058 9.50001 7.25C9.50001 6.28942 8.71059 5.5 7.75001 5.5C7.45086 5.5 7.17258 5.58356 6.9253 5.71802L2.7223 1.51501C2.62853 1.42129 2.50137 1.36864 2.36878 1.36865ZM7.75001 6.5C8.17018 6.5 8.50001 6.82983 8.50001 7.25C8.50001 7.67017 8.17018 8 7.75001 8C7.32984 8 7.00001 7.67017 7.00001 7.25C7.00001 7.04405 7.08091 6.86114 7.21119 6.72681C7.21491 6.72531 7.21862 6.72376 7.2223 6.72217C7.22618 6.71703 7.22997 6.71183 7.23365 6.70654C7.36745 6.57966 7.54709 6.5 7.75001 6.5Z M14.25 9.75C14.1174 9.75003 13.9902 9.80272 13.8965 9.89648C13.8965 9.89648 13.5499 10.2425 13.209 10.7539C12.868 11.2653 12.5 11.9583 12.5 12.75C12.5 13.7106 13.2894 14.5 14.25 14.5C15.2106 14.5 16 13.7106 16 12.75C16 11.9583 15.632 11.2653 15.291 10.7539C14.9501 10.2425 14.6035 9.89648 14.6035 9.89648C14.5098 9.80272 14.3826 9.75003 14.25 9.75ZM14.25 11.0325C14.3204 11.1233 14.3825 11.1938 14.459 11.3086C14.743 11.7347 15 12.2917 15 12.75C15 13.1701 14.6701 13.5 14.25 13.5C13.8299 13.5 13.5 13.1701 13.5 12.75C13.5 12.2917 13.757 11.7347 14.041 11.3086C14.1176 11.1938 14.1796 11.1233 14.25 11.0325Z M7.21876 0.5C7.08616 0.500026 6.959 0.552716 6.86524 0.646484L0.852671 6.65894C0.851813 6.65979 0.850959 6.66064 0.850108 6.6615C0.276242 7.24384 0.276242 8.19366 0.850108 8.776C0.850959 8.77686 0.851813 8.77771 0.852671 8.77856L6.15895 14.0848C6.15984 14.0857 6.16073 14.0865 6.16163 14.0874C6.74398 14.6612 7.69354 14.6612 8.27589 14.0874C8.27679 14.0865 8.27768 14.0857 8.27858 14.0848L14.291 8.07226C14.3848 7.97849 14.4374 7.85133 14.4374 7.71875C14.4374 7.58616 14.3848 7.459 14.291 7.36523L7.57228 0.646483C7.47852 0.552715 7.35136 0.500025 7.21876 0.5ZM7.21876 1.70703L13.2305 7.71875L7.57374 13.3754C7.37274 13.5731 7.06478 13.5731 6.86378 13.3754L1.56239 8.0741C1.36466 7.87311 1.36441 7.56475 1.56214 7.36376C1.56203 7.36388 1.56225 7.36364 1.56214 7.36376L7.21876 1.70703Z" />
                </svg>
                <span className={styles.gridBarToolText}>Color</span>
              </button>

              <div className={styles.gridBarRowHeightWrapper} ref={rowHeightButtonRef}>
                <button
                  type="button"
                  aria-label="Row height"
                  className={styles.gridBarRowHeightButton}
                  onClick={() => setIsRowHeightOpen((v) => !v)}
                >
                  <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                    {workspace.rowHeightPreset === "short" && (
                      <path fillRule="nonzero" d="M13.1464 2.64645L12.1464 3.64645C11.9512 3.84171 11.9512 4.15829 12.1464 4.35355C12.3417 4.54882 12.6583 4.54882 12.8536 4.35355L13 4.20711V11.7929L12.8536 11.6464C12.6583 11.4512 12.3417 11.4512 12.1464 11.6464C11.9512 11.8417 11.9512 12.1583 12.1464 12.3536L13.1464 13.3536C13.2402 13.4473 13.3674 13.5 13.5 13.5C13.6326 13.5 13.7598 13.4473 13.8536 13.3536L14.8536 12.3536C15.0488 12.1583 15.0488 11.8417 14.8536 11.6464C14.6583 11.4512 14.3417 11.4512 14.1464 11.6464L14 11.7929V4.20711L14.1464 4.35355C14.3417 4.54882 14.6583 4.54882 14.8536 4.35355C15.0488 4.15829 15.0488 3.84171 14.8536 3.64645L13.8536 2.64645C13.6583 2.45118 13.3417 2.45118 13.1464 2.64645Z M1.5 3C1.22386 3 1 3.22386 1 3.5C1 3.77614 1.22386 4 1.5 4H9.5C9.77614 4 10 3.77614 10 3.5C10 3.22386 9.77614 3 9.5 3H1.5Z M1.5 6C1.22386 6 1 6.22386 1 6.5C1 6.77614 1.22386 7 1.5 7H9.5C9.77614 7 10 6.77614 10 6.5C10 6.22386 9.77614 6 9.5 6H1.5Z M1 9.5C1 9.22386 1.22386 9 1.5 9H9.5C9.77614 9 10 9.22386 10 9.5C10 9.77614 9.77614 10 9.5 10H1.5C1.22386 10 1 9.77614 1 9.5Z M1.5 12C1.22386 12 1 12.2239 1 12.5C1 12.7761 1.22386 13 1.5 13H9.5C9.77614 13 10 12.7761 10 12.5C10 12.2239 9.77614 12 9.5 12H1.5Z" />
                    )}
                    {workspace.rowHeightPreset === "medium" && (
                      <path fillRule="nonzero" d="M12.1464 3.64645L13.1464 2.64645C13.3417 2.45118 13.6583 2.45118 13.8536 2.64645L14.8536 3.64645C15.0488 3.84171 15.0488 4.15829 14.8536 4.35355C14.6583 4.54882 14.3417 4.54882 14.1464 4.35355L14 4.20711V11.7929L14.1464 11.6464C14.3417 11.4512 14.6583 11.4512 14.8536 11.6464C15.0488 11.8417 15.0488 12.1583 14.8536 12.3536L13.8536 13.3536C13.7598 13.4473 13.6326 13.5 13.5 13.5C13.3674 13.5 13.2402 13.4473 13.1464 13.3536L12.1464 12.3536C11.9512 12.1583 11.9512 11.8417 12.1464 11.6464C12.3417 11.4512 12.6583 11.4512 12.8536 11.6464L13 11.7929V4.20711L12.8536 4.35355C12.6583 4.54882 12.3417 4.54882 12.1464 4.35355C11.9512 4.15829 11.9512 3.84171 12.1464 3.64645Z M2.5 3C1.67157 3 1 3.67157 1 4.5V5.5C1 6.32843 1.67157 7 2.5 7H8.5C9.32843 7 10 6.32843 10 5.5V4.5C10 3.67157 9.32843 3 8.5 3H2.5ZM2 4.5C2 4.22386 2.22386 4 2.5 4H8.5C8.77614 4 9 4.22386 9 4.5V5.5C9 5.77614 8.77614 6 8.5 6H2.5C2.22386 6 2 5.77614 2 5.5V4.5Z M1.5 9C1.22386 9 1 9.22386 1 9.5C1 9.77614 1.22386 10 1.5 10H9.5C9.77614 10 10 9.77614 10 9.5C10 9.22386 9.77614 9 9.5 9H1.5Z M1 12.5C1 12.2239 1.22386 12 1.5 12H9.5C9.77614 12 10 12.2239 10 12.5C10 12.7761 9.77614 13 9.5 13H1.5C1.22386 13 1 12.7761 1 12.5Z" />
                    )}
                    {workspace.rowHeightPreset === "tall" && (
                      <path fillRule="nonzero" d="M13.1464 2.64645L12.1464 3.64645C11.9512 3.84171 11.9512 4.15829 12.1464 4.35355C12.3417 4.54882 12.6583 4.54882 12.8536 4.35355L13 4.20711V11.7929L12.8536 11.6464C12.6583 11.4512 12.3417 11.4512 12.1464 11.6464C11.9512 11.8417 11.9512 12.1583 12.1464 12.3536L13.1464 13.3536C13.2402 13.4473 13.3674 13.5 13.5 13.5C13.6326 13.5 13.7598 13.4473 13.8536 13.3536L14.8536 12.3536C15.0488 12.1583 15.0488 11.8417 14.8536 11.6464C14.6583 11.4512 14.3417 11.4512 14.1464 11.6464L14 11.7929V4.20711L14.1464 4.35355C14.3417 4.54882 14.6583 4.54882 14.8536 4.35355C15.0488 4.15829 15.0488 3.84171 14.8536 3.64645L13.8536 2.64645C13.6583 2.45118 13.3417 2.45118 13.1464 2.64645Z M1 4.5C1 3.67157 1.67157 3 2.5 3H8.5C9.32843 3 10 3.67157 10 4.5V8.5C10 9.32843 9.32843 10 8.5 10H2.5C1.67157 10 1 9.32843 1 8.5V4.5ZM2.5 4C2.22386 4 2 4.22386 2 4.5V8.5C2 8.77614 2.22386 9 2.5 9H8.5C8.77614 9 9 8.77614 9 8.5V4.5C9 4.22386 8.77614 4 8.5 4H2.5Z M1.5 12C1.22386 12 1 12.2239 1 12.5C1 12.7761 1.22386 13 1.5 13H9.5C9.77614 13 10 12.7761 10 12.5C10 12.2239 9.77614 12 9.5 12H1.5Z" />
                    )}
                    {workspace.rowHeightPreset === "extraTall" && (
                      <path fillRule="nonzero" d="M12.1464 3.64645L13.1464 2.64645C13.3417 2.45118 13.6583 2.45118 13.8536 2.64645L14.8536 3.64645C15.0488 3.84171 15.0488 4.15829 14.8536 4.35355C14.6583 4.54882 14.3417 4.54882 14.1464 4.35355L14 4.20711V11.7929L14.1464 11.6464C14.3417 11.4512 14.6583 11.4512 14.8536 11.6464C15.0488 11.8417 15.0488 12.1583 14.8536 12.3536L13.8536 13.3536C13.7598 13.4473 13.6326 13.5 13.5 13.5C13.3674 13.5 13.2402 13.4473 13.1464 13.3536L12.1464 12.3536C11.9512 12.1583 11.9512 11.8417 12.1464 11.6464C12.3417 11.4512 12.6583 11.4512 12.8536 11.6464L13 11.7929V4.20711L12.8536 4.35355C12.6583 4.54882 12.3417 4.54882 12.1464 4.35355C11.9512 4.15829 11.9512 3.84171 12.1464 3.64645Z M1 4.5C1 3.67157 1.67157 3 2.5 3H8.5C9.32843 3 10 3.67157 10 4.5V11.5C10 12.3284 9.32843 13 8.5 13H2.5C1.67157 13 1 12.3284 1 11.5V4.5ZM2.5 4C2.22386 4 2 4.22386 2 4.5V11.5C2 11.7761 2.22386 12 2.5 12H8.5C8.77614 12 9 11.7761 9 11.5V4.5C9 4.22386 8.77614 4 8.5 4H2.5Z" />
                    )}
                  </svg>
                </button>
                {!isRowHeightOpen && (
                  <span className={styles.gridBarRowHeightTooltip}>Row height</span>
                )}
                <RowHeightMenu
                  isOpen={isRowHeightOpen}
                  onClose={() => setIsRowHeightOpen(false)}
                  currentPreset={workspace.rowHeightPreset}
                  onChange={workspace.setRowHeightPreset}
                  wrapHeaders={workspace.wrapHeaders}
                  onToggleWrapHeaders={() => workspace.setWrapHeaders(!workspace.wrapHeaders)}
                  anchorRef={rowHeightButtonRef}
                />
              </div>

              <div className={styles.gridBarShareViewWrapper}>
                <button
                  type="button"
                  className={`${styles.gridBarToolButton} ${styles.gridBarShareSyncButton}`}
                  onClick={() => toast("This feature is currently not available")}
                >
                  <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="nonzero" d="M9.75 2C9.61739 2 9.49021 2.05268 9.39645 2.14645C9.30268 2.24021 9.25 2.36739 9.25 2.5C9.25 2.63261 9.30268 2.75979 9.39645 2.85355C9.49021 2.94732 9.61739 3 9.75 3H12.293L8.64648 6.64648C8.55274 6.74025 8.50008 6.86741 8.50008 7C8.50008 7.13259 8.55274 7.25975 8.64648 7.35352C8.74025 7.44726 8.86741 7.49992 9 7.49992C9.13259 7.49992 9.25975 7.44726 9.35352 7.35352L13 3.70703V6.25C13 6.38261 13.0527 6.50979 13.1464 6.60355C13.2402 6.69732 13.3674 6.75 13.5 6.75C13.6326 6.75 13.7598 6.69732 13.8536 6.60355C13.9473 6.50979 14 6.38261 14 6.25V2.5C13.998 2.49504 13.996 2.49012 13.9939 2.48523C13.9917 2.35861 13.9415 2.23755 13.8535 2.14648C13.7598 2.05272 13.6326 2.00003 13.5 2H9.75Z M3 4C2.45364 4 2 4.45364 2 5V13C2.00007 13.5463 2.45357 13.9999 2.99988 14C2.99984 14 2.99992 14 2.99988 14H11C11.5464 14 12 13.5464 12 13V9C12 8.86739 11.9473 8.74021 11.8536 8.64645C11.7598 8.55268 11.6326 8.5 11.5 8.5C11.3674 8.5 11.2402 8.55268 11.1464 8.64645C11.0527 8.74021 11 8.86739 11 9V13H3.00012L3 5H7C7.1326 5 7.25978 4.94732 7.35355 4.85355C7.44732 4.75979 7.5 4.63261 7.5 4.5C7.5 4.36739 7.44732 4.24021 7.35355 4.14645C7.25978 4.05268 7.1326 4 7 4H3Z" />
                  </svg>
                  <span className={styles.gridBarToolText}>Share and sync</span>
                </button>
                <span className={styles.gridBarShareViewTooltip}>Share view</span>
              </div>
            </div>
          </div>

          <div className={styles.findBarWrapper}>
            <div className={styles.tooltipWrapper}>
              <button type="button" aria-label="Find in view" className={styles.gridBarSearchButton} onClick={toggleFindBar}>
                <svg className={styles.gridBarSearchIcon} viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="nonzero" d="M7.25 1.5C4.08028 1.5 1.5 4.08028 1.5 7.25C1.5 10.4197 4.08028 13 7.25 13C8.65529 13 9.94315 12.4911 10.9432 11.6503L13.6465 14.3534C13.7402 14.4471 13.8674 14.4998 14 14.4998C14.1326 14.4998 14.2598 14.4471 14.3535 14.3534C14.4473 14.2596 14.4999 14.1325 14.4999 13.9999C14.4999 13.8673 14.4473 13.7401 14.3535 13.6464L11.6504 10.9431C12.4912 9.94305 13 8.65523 13 7.25C13 4.08028 10.4197 1.5 7.25 1.5ZM7.25 2.5C9.87928 2.5 12 4.62072 12 7.25C12 8.56227 11.4715 9.74761 10.6154 10.6061C10.6132 10.607 10.611 10.6079 10.6089 10.6088C10.608 10.611 10.6071 10.6132 10.6062 10.6154C9.74772 11.4715 8.5623 12 7.25 12C4.62072 12 2.5 9.87928 2.5 7.25C2.5 4.62072 4.62072 2.5 7.25 2.5Z" />
                </svg>
              </button>
              {!isFindOpen && (
                <span className={styles.tooltip}>
                  <span className={styles.tooltipText}>Find in view</span>
                  <span className={styles.tooltipShortcut}>
                    <span className={styles.tooltipShortcutKey}>⌘</span>
                    <span className={styles.tooltipShortcutKey}>F</span>
                  </span>
                </span>
              )}
            </div>
            {isFindOpen && (
              <div className={styles.findBarAnchor}>
                <FindBar
                  onClose={closeFindBar}
                  defaultValue={search}
                  onSearchChange={handleSearchChange}
                  matchIndex={findBarMatchIndex}
                  totalMatches={findBarTotalMatches}
                  isSearching={workspace.isSearchPending}
                  onPrevMatch={workspace.handlePrevMatch}
                  onNextMatch={workspace.handleNextMatch}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
