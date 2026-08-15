import React from "react";
import styles from "./TableTab.module.css";
import { TableTitleDropdown } from "./TableTitleDropdown";

interface TableTabProps {
  table: { id: string; name: string };
  isActive: boolean;
  setActiveTableId: (id: string) => void;
  isTableTitleDropdownOpen: boolean;
  setIsTableTitleDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tableTitleDropdownPosition: { top: number; left: number } | null;
  setTableTitleDropdownPosition: React.Dispatch<
    React.SetStateAction<{ top: number; left: number } | null>
  >;
  tableTitleDropdownButtonRef: React.RefObject<HTMLButtonElement | null>;
  tableTitleDropdownRef: React.RefObject<HTMLUListElement | null>;
  handleOpenRenamePopup: () => void;
  handleOpenClearDataModal: () => void;
  handleOpenDeleteTablePopup: (event: React.MouseEvent<HTMLLIElement>) => void;
  tablesCount: number;
}

export function TableTab({
  table,
  isActive,
  setActiveTableId,
  isTableTitleDropdownOpen,
  setIsTableTitleDropdownOpen,
  tableTitleDropdownPosition,
  setTableTitleDropdownPosition,
  tableTitleDropdownButtonRef,
  tableTitleDropdownRef,
  handleOpenRenamePopup,
  handleOpenClearDataModal,
  handleOpenDeleteTablePopup,
  tablesCount,
}: TableTabProps) {
  return (
    <div className={styles.tableTabWrapper}>
      <div
        className={`${styles.tableTab} ${isActive ? styles.tableTabActive : ""}`}
        data-table-tab
        data-table-id={table.id}
        onClick={() => setActiveTableId(table.id)}
      >
        <span className={styles.tableTabName}>{table.name}</span>
        <button
          type="button"
          ref={isActive ? tableTitleDropdownButtonRef : null}
          className={styles.tableTabDropdown}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const newIsOpen = !isTableTitleDropdownOpen;
            setIsTableTitleDropdownOpen(newIsOpen);
            if (newIsOpen) {
              const button = e.currentTarget;
              const parentTab = button.closest(`.${styles.tableTab}`);
              if (parentTab) {
                const tabRect = parentTab.getBoundingClientRect();
                setTableTitleDropdownPosition({
                  top: tabRect.bottom + 8,
                  left: tabRect.left,
                });
              }
            } else {
              setTableTitleDropdownPosition(null);
            }
          }}
        >
          <svg
            className={styles.tableTabDropdownIcon}
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="nonzero"
              d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z"
            />
          </svg>
        </button>
      </div>

      {isActive && isTableTitleDropdownOpen && tableTitleDropdownPosition && (
        <TableTitleDropdown
          position={tableTitleDropdownPosition}
          dropdownRef={tableTitleDropdownRef}
          tableCount={tablesCount}
          onOpenRenamePopup={handleOpenRenamePopup}
          onClearData={handleOpenClearDataModal}
          onDeleteTable={handleOpenDeleteTablePopup}
        />
      )}
    </div>
  );
}
