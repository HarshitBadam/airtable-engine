import React from "react";
import styles from "./GridBarViewSelector.module.css";
import { ViewDropdown } from "./ViewDropdown";
import { useWorkspace } from "./GridWorkspaceContext";

export function GridBarViewSelector() {
  const workspace = useWorkspace();

  const {
    viewDropdownButtonRef,
    viewDropdownRef,
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
    activeViewName,
    activeViewId,
    canDeleteView,
    deleteViewMut,
    duplicateViewMut,
  } = workspace;

  return (
    <div
      ref={viewDropdownButtonRef}
      className={`${styles.gridBarViewSelector} ${isRenamingView ? styles.gridBarViewSelectorRenaming : ""}`}
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
              if (e.key === "Enter") commitRenameView();
              if (e.key === "Escape") cancelRenameView();
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
          <svg className={styles.gridBarViewIcon} viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M2.5 2C1.67157 2 1 2.67157 1 3.5V12.5C1 13.3284 1.67157 14 2.5 14H13.5C14.3284 14 15 13.3284 15 12.5V3.5C15 2.67157 14.3284 2 13.5 2H2.5ZM2 3.5C2 3.22386 2.22386 3 2.5 3H13.5C13.7761 3 14 3.22386 14 3.5V5H2V3.5ZM8.5 6H14V9H8.5V6ZM7.5 9V6H2V9H7.5ZM2 10V12.5C2 12.7761 2.22386 13 2.5 13H7.5V10H2ZM8.5 10H14V12.5C14 12.7761 13.7761 13 13.5 13H8.5V10Z" />
          </svg>
          <span className={styles.gridBarViewText}>{activeViewName}</span>
          <svg className={styles.gridBarViewChevron} viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="nonzero" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" />
          </svg>
          {isViewDropdownOpen && (
            <ViewDropdown
              viewDropdownButtonRef={viewDropdownButtonRef}
              viewDropdownRef={viewDropdownRef}
              activeViewId={activeViewId}
              canDeleteView={canDeleteView}
              deleteViewMut={deleteViewMut}
              duplicateViewMut={duplicateViewMut}
              startRenamingView={startRenamingView}
            />
          )}
        </>
      )}
    </div>
  );
}
