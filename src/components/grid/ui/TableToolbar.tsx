import React from "react";
import { createPortal } from "react-dom";
import styles from "./TableToolbar.module.css";
import {
  IconMagnifyingGlass,
  IconCheck,
  IconEyeSlash,
  IconDotsSixVertical,
} from "./icons";

interface TableToolbarProps {
  baseId: string;
  getBaseToolbarColor: (baseId: string) => string;

  // Scroll state
  hasOverflow: boolean;
  scrollProgress: number;
  scrollToEnd: (direction: 'left' | 'right') => void;
  tabsScrollRef: React.RefObject<HTMLDivElement | null>;

  // Tables
  tables: Array<{ id: string; name: string }>;
  activeTableId: string;
  setActiveTableId: (id: string) => void;

  // Table title dropdown
  isTableTitleDropdownOpen: boolean;
  setIsTableTitleDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tableTitleDropdownPosition: { top: number; left: number } | null;
  setTableTitleDropdownPosition: React.Dispatch<React.SetStateAction<{ top: number; left: number } | null>>;
  tableTitleDropdownButtonRef: React.RefObject<HTMLButtonElement | null>;
  tableTitleDropdownRef: React.RefObject<HTMLUListElement | null>;

  // Rename popup
  isRenamePopupOpen: boolean;
  renamePopupPosition: { top: number; left: number } | null;
  renamePopupRef: React.RefObject<HTMLDivElement | null>;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  renameTableName: string;
  setRenameTableName: React.Dispatch<React.SetStateAction<string>>;
  renameRecordName: string;
  showDuplicateTooltip: boolean;
  handleOpenRenamePopup: () => void;
  handleSaveRename: () => void;
  handleCancelRename: () => void;

  // Table dropdown
  isTableDropdownOpen: boolean;
  setIsTableDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tableDropdownAlignRight: boolean;
  tableSearchQuery: string;
  setTableSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  hoveredTableId: string | null;
  setHoveredTableId: React.Dispatch<React.SetStateAction<string | null>>;
  filteredTables: Array<{ id: string; name: string }>;
  handleTableSelect: (id: string) => void;
  tableDropdownButtonRef: React.RefObject<HTMLButtonElement | null>;
  tableDropdownRef: React.RefObject<HTMLDivElement | null>;
  addTableSectionRef: React.RefObject<HTMLDivElement | null>;

  // Add or import dropdown
  isAddOrImportDropdownOpen: boolean;
  setIsAddOrImportDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  addOrImportDropdownPosition: { top?: number; left?: number; right?: number; openLeft?: boolean } | null;
  setAddOrImportOpenedFromTableDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  addOrImportButtonRef: React.RefObject<HTMLButtonElement | null>;
  addOrImportDropdownRef: React.RefObject<HTMLUListElement | null>;
  handleAddTable: () => void;

  // Modal handlers
  handleOpenClearDataModal: () => void;
  handleOpenDeleteTablePopup: (event: React.MouseEvent<HTMLLIElement>) => void;
}

export function TableToolbar({
  baseId,
  getBaseToolbarColor,
  hasOverflow,
  scrollProgress,
  scrollToEnd,
  tabsScrollRef,
  tables,
  activeTableId,
  setActiveTableId,
  isTableTitleDropdownOpen,
  setIsTableTitleDropdownOpen,
  tableTitleDropdownPosition,
  setTableTitleDropdownPosition,
  tableTitleDropdownButtonRef,
  tableTitleDropdownRef,
  isRenamePopupOpen,
  renamePopupPosition,
  renamePopupRef,
  renameInputRef,
  renameTableName,
  setRenameTableName,
  renameRecordName,
  showDuplicateTooltip,
  handleOpenRenamePopup,
  handleSaveRename,
  handleCancelRename,
  isTableDropdownOpen,
  setIsTableDropdownOpen,
  tableDropdownAlignRight,
  tableSearchQuery,
  setTableSearchQuery,
  hoveredTableId,
  setHoveredTableId,
  filteredTables,
  handleTableSelect,
  tableDropdownButtonRef,
  tableDropdownRef,
  addTableSectionRef,
  isAddOrImportDropdownOpen,
  setIsAddOrImportDropdownOpen,
  addOrImportDropdownPosition,
  setAddOrImportOpenedFromTableDropdown,
  addOrImportButtonRef,
  addOrImportDropdownRef,
  handleAddTable,
  handleOpenClearDataModal,
  handleOpenDeleteTablePopup,
}: TableToolbarProps) {
  return (
    <div 
      className={styles.tableToolbar}
      style={{ backgroundColor: getBaseToolbarColor(baseId) }}
    >
      <div className={styles.tableToolbarInner}>
        {/* Left scroll indicator - only render when there's left overflow (scrollProgress > 0) */}
        {hasOverflow && scrollProgress > 0 && (
          <div 
            className={styles.scrollIndicatorLeft}
            style={{ width: `${Math.min(scrollProgress * 3, 1) * 40}px` }}
          >
            {/* Clip wrapper for button */}
            <div className={styles.scrollIndicatorClip}>
              <button 
                className={styles.scrollIndicatorButton}
                style={{ backgroundColor: getBaseToolbarColor(baseId) }}
                onClick={() => scrollToEnd('left')}
                aria-label="Scroll to first table"
              >
                <svg className={styles.scrollIndicatorIcon} viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="nonzero" d="M8 1.5C6.71442 1.5 5.45772 1.88122 4.3888 2.59545C3.31988 3.30968 2.48676 4.32484 1.99479 5.51256C1.50282 6.70028 1.37409 8.00721 1.6249 9.26809C1.8757 10.529 2.49477 11.6872 3.40381 12.5962C4.31285 13.5052 5.47104 14.1243 6.73192 14.3751C7.99279 14.6259 9.29973 14.4972 10.4874 14.0052C11.6752 13.5132 12.6903 12.6801 13.4046 11.6112C14.1188 10.5423 14.5 9.28558 14.5 8C14.4967 6.27711 13.8108 4.62573 12.5925 3.40746C11.3743 2.18918 9.7229 1.5033 8 1.5V1.5ZM9.3375 9.88125C9.43527 9.97078 9.49349 10.0955 9.49935 10.2279C9.50521 10.3603 9.45823 10.4897 9.36875 10.5875C9.32217 10.639 9.26525 10.6801 9.20171 10.7081C9.13817 10.7361 9.06944 10.7504 9 10.75C8.87528 10.7488 8.75528 10.7021 8.6625 10.6187L6.1625 8.36875C6.11135 8.32191 6.0705 8.26493 6.04255 8.20145C6.01461 8.13797 6.00018 8.06936 6.00018 8C6.00018 7.93064 6.01461 7.86203 6.04255 7.79855C6.0705 7.73507 6.11135 7.67809 6.1625 7.63125L8.6625 5.38125C8.71063 5.33525 8.76745 5.29932 8.82965 5.27558C8.89184 5.25183 8.95815 5.24075 9.02468 5.24297C9.09122 5.24519 9.15664 5.26068 9.21711 5.28852C9.27758 5.31637 9.33188 5.356 9.37683 5.40511C9.42177 5.45422 9.45646 5.51181 9.47885 5.5745C9.50125 5.6372 9.51089 5.70373 9.50723 5.7702C9.50357 5.83667 9.48667 5.90174 9.45752 5.96159C9.42838 6.02145 9.38757 6.07488 9.3375 6.11875L7.25 8L9.3375 9.88125Z" />
                </svg>
              </button>
            </div>
            {/* Shadow extends over tables (to the right) */}
            <div className={styles.scrollIndicatorShadowRight} />
          </div>
        )}

        {/* Scrollable container for table tabs only */}
        <div className={styles.tableTabsScrollable} ref={tabsScrollRef}>
          {/* Table Tabs */}
          {tables.map((table) => (
            <div 
              key={table.id}
              className={styles.tableTabWrapper}
            >
              <div 
                className={`${styles.tableTab} ${table.id === activeTableId ? styles.tableTabActive : ''}`}
                data-table-tab
                data-table-id={table.id}
                onClick={() => setActiveTableId(table.id)}
              >
                <span className={styles.tableTabName}>{table.name}</span>
                <button 
                  type="button"
                  ref={table.id === activeTableId ? tableTitleDropdownButtonRef : null}
                  className={styles.tableTabDropdown}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const newIsOpen = !isTableTitleDropdownOpen;
                    setIsTableTitleDropdownOpen(newIsOpen);
                    
                    if (newIsOpen) {
                      // Calculate position when opening
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

              {/* Table Title Dropdown Menu */}
              {table.id === activeTableId && isTableTitleDropdownOpen && tableTitleDropdownPosition && (
                <ul 
                  ref={tableTitleDropdownRef} 
                  className={styles.tableTitleDropdown}
                  style={{
                    top: tableTitleDropdownPosition.top,
                    left: tableTitleDropdownPosition.left,
                  }}
                >
                  {/* Import data - with arrow */}
                  <li className={styles.tableTitleDropdownItem}>
                    <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M8 5C7.8674 5.00003 7.74024 5.05272 7.64648 5.14648L5.52771 7.26514C5.48127 7.31157 5.44444 7.36669 5.41931 7.42736C5.39418 7.48802 5.38124 7.55305 5.38124 7.61871C5.38124 7.68438 5.39418 7.7494 5.41931 7.81007C5.44444 7.87074 5.48127 7.92586 5.52771 7.97229C5.57414 8.01873 5.62926 8.05556 5.68993 8.08069C5.7506 8.10582 5.81562 8.11876 5.88129 8.11876C5.94695 8.11876 6.01198 8.10582 6.07264 8.08069C6.13331 8.05556 6.18843 8.01873 6.23486 7.97229L7.5 6.70703V10.5C7.5 10.6326 7.55268 10.7598 7.64645 10.8536C7.74021 10.9473 7.86739 11 8 11C8.13261 11 8.25979 10.9473 8.35355 10.8536C8.44732 10.7598 8.5 10.6326 8.5 10.5V6.70703L9.76514 7.97229C9.81157 8.01873 9.86669 8.05556 9.92736 8.08069C9.98802 8.10582 10.053 8.11876 10.1187 8.11876C10.1844 8.11876 10.2494 8.10582 10.3101 8.08069C10.3707 8.05556 10.4259 8.01873 10.4723 7.97229C10.5187 7.92586 10.5556 7.87074 10.5807 7.81007C10.6058 7.7494 10.6188 7.68438 10.6188 7.61871C10.6188 7.55305 10.6058 7.48802 10.5807 7.42736C10.5556 7.36669 10.5187 7.31157 10.4723 7.26514L8.35352 5.14648C8.34867 5.14437 8.34378 5.14234 8.33887 5.14038C8.24777 5.05235 8.12666 5.00218 8 5Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
                    </svg>
                    <span className={styles.tableTitleDropdownItemText}>Import data</span>
                    <svg className={styles.tableTitleDropdownItemArrow} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" />
                    </svg>
                  </li>

                  {/* Divider */}
                  <li className={styles.tableTitleDropdownDivider} />

                  {/* Rename table */}
                  <li 
                    className={styles.tableTitleDropdownItem}
                    onClick={handleOpenRenamePopup}
                  >
                    <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M10.5 1.71045C10.2406 1.71045 9.9813 1.80867 9.7876 2.00525L2.29017 9.50269L2.28931 9.50354C2.10332 9.69048 1.9991 9.94419 2.00001 10.2079V12.9999C2.00007 13.5462 2.45358 13.9998 2.99988 13.9999H5.79212C6.05578 14.0008 6.30942 13.8966 6.49635 13.7107L6.49732 13.7097L13.9948 6.21228C14.3878 5.82489 14.3878 5.17499 13.9948 4.7876L11.2124 2.00525C11.0187 1.80867 10.7594 1.71045 10.5 1.71045ZM10.4999 2.70715C10.4955 2.70269 10.5043 2.70269 10.4999 2.70715L10.5027 2.70972L13.2902 5.49719L13.2927 5.49976C13.2972 5.49534 13.2972 5.50418 13.2927 5.49976L13.2902 5.50269L12 6.79297L9.20704 4L10.4973 2.70972L10.4999 2.70715ZM8.50001 4.70703L11.293 7.5L5.79297 12.9999H3.00013L3.00001 10.207L8.50001 4.70703Z" />
                    </svg>
                    <span className={styles.tableTitleDropdownItemText}>Rename table</span>
                  </li>

                  {/* Hide table */}
                  <li className={styles.tableTitleDropdownItem}>
                    <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M8.00013 2.99999C7.53899 2.99917 7.07864 3.03701 6.62379 3.11315C6.55902 3.12398 6.49703 3.14747 6.44134 3.18226C6.38565 3.21706 6.33736 3.26248 6.29923 3.31594C6.2611 3.3694 6.23387 3.42984 6.2191 3.49382C6.20433 3.5578 6.2023 3.62407 6.21314 3.68883C6.23505 3.81961 6.30801 3.93632 6.41597 4.01331C6.52393 4.0903 6.65805 4.12125 6.78883 4.09935C7.18869 4.03242 7.59357 3.99923 7.99915 3.99999C7.99882 3.99999 7.99948 3.99999 7.99915 3.99999C12.083 3.99999 14.0065 7.16727 14.4415 7.99926C14.2327 8.39403 13.6815 9.3219 12.7042 10.196C12.6553 10.2398 12.6154 10.2928 12.587 10.352C12.5585 10.4112 12.542 10.4754 12.5383 10.5409C12.5347 10.6065 12.544 10.6721 12.5657 10.7341C12.5874 10.7961 12.6211 10.8531 12.6649 10.9021C12.7533 11.0009 12.8774 11.0606 13.0097 11.0679C13.1421 11.0753 13.272 11.0298 13.3709 10.9414C14.8157 9.64896 15.4569 8.20311 15.4569 8.20311C15.4853 8.13917 15.5 8.06997 15.5 7.99999C15.5 7.93001 15.4853 7.86081 15.4569 7.79686C15.4569 7.79686 13.2994 3.00052 8.00013 2.99999Z M8.56177 5.05248C8.4315 5.02783 8.29677 5.05593 8.18721 5.1306C8.07765 5.20527 8.00223 5.3204 7.97755 5.45067C7.96532 5.51519 7.96592 5.58148 7.97932 5.64576C7.99271 5.71004 8.01864 5.77106 8.05562 5.82532C8.09259 5.87958 8.13989 5.92603 8.19482 5.96201C8.24975 5.99799 8.31122 6.0228 8.37574 6.03502C9.25118 6.20086 9.90696 6.92166 9.98963 7.80883C9.99573 7.87421 10.0146 7.93775 10.0453 7.99582C10.076 8.05389 10.1177 8.10536 10.1683 8.14727C10.2188 8.18919 10.2771 8.22074 10.3399 8.24013C10.4026 8.25951 10.4686 8.26635 10.5339 8.26024C10.666 8.24793 10.7877 8.18368 10.8723 8.08163C10.957 7.97958 10.9976 7.84808 10.9854 7.71605C10.8617 6.38949 9.8708 5.30045 8.56177 5.05248Z M3.02381 2.0006C2.89137 1.99428 2.76183 2.04082 2.6637 2.12999C2.56557 2.21919 2.5069 2.34371 2.50058 2.47617C2.49426 2.60862 2.54082 2.73816 2.63001 2.83629L5.64234 6.14989C4.99783 6.97182 4.81667 8.0854 5.20167 9.08153C5.64782 10.2359 6.7614 10.9994 7.99891 10.9997C8.57697 11.0018 9.13723 10.8317 9.61744 10.5226L12.63 13.8363C12.7192 13.9344 12.8437 13.9931 12.9762 13.9994C13.1086 14.0057 13.2382 13.9592 13.3363 13.87C13.4344 13.7808 13.4931 13.6563 13.4994 13.5238C13.5058 13.3914 13.4592 13.2618 13.37 13.1637L6.6908 5.81652C6.69016 5.81554 6.68951 5.81456 6.68885 5.81359C6.6884 5.81338 6.68796 5.81318 6.68751 5.81298L3.37 2.16369C3.2808 2.06557 3.15627 2.0069 3.02381 2.0006ZM4.78126 3.81261C4.65529 3.7712 4.51803 3.78151 4.39966 3.8413C1.67465 5.21716 0.542853 7.79748 0.542853 7.79748C0.514536 7.86137 0.499927 7.93049 0.49997 8.00038C0.500012 8.07027 0.514704 8.13938 0.543098 8.20324C0.543098 8.20324 2.69954 12.9988 7.99805 13C9.24842 13.0098 10.4832 12.7217 11.6 12.1592C11.6586 12.1296 11.7109 12.0888 11.7537 12.0391C11.7966 11.9893 11.8293 11.9317 11.8498 11.8693C11.8704 11.8069 11.8785 11.7411 11.8736 11.6757C11.8688 11.6102 11.8511 11.5463 11.8215 11.4877C11.792 11.429 11.7512 11.3768 11.7015 11.3339C11.6517 11.291 11.594 11.2584 11.5317 11.2378C11.4693 11.2172 11.4035 11.2091 11.338 11.214C11.2726 11.2189 11.2087 11.2366 11.15 11.2661C10.1746 11.7574 9.09616 12.009 8.00403 12.0001C8.00269 12.0001 8.00135 12.0001 8.00001 12.0001C3.9214 12.0001 1.99934 8.84205 1.56104 8.00512C1.80002 7.53467 2.78966 5.77445 4.85035 4.734C4.90897 4.7044 4.96118 4.66355 5.00401 4.61377C5.04684 4.56399 5.07944 4.50626 5.09996 4.44389C5.12048 4.38151 5.12851 4.3157 5.12359 4.25021C5.11867 4.18473 5.1009 4.12086 5.0713 4.06225C5.01154 3.94387 4.90721 3.85407 4.78126 3.81261ZM6.3307 6.90709L8.92811 9.76427C8.64391 9.91434 8.32855 10.0011 8.00196 9.99987C8.00131 9.99987 8.00066 9.99987 8.00001 9.99987C7.17209 9.99993 6.43288 9.49318 6.13441 8.72094C5.89804 8.10936 5.98275 7.43768 6.3307 6.90709Z" />
                    </svg>
                    <span className={styles.tableTitleDropdownItemText}>Hide table</span>
                  </li>

                  {/* Manage fields - with Team badge */}
                  <li className={styles.tableTitleDropdownItem}>
                    <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M6.5 3.25C6.36739 3.25 6.24021 3.30268 6.14645 3.39645C6.05268 3.49021 6 3.61739 6 3.75V6.75C6 6.88261 6.05268 7.00979 6.14645 7.10355C6.24021 7.19732 6.36739 7.25 6.5 7.25C6.63261 7.25 6.75979 7.19732 6.85355 7.10355C6.94732 7.00979 7 6.88261 7 6.75V5.75H13.5C13.6326 5.75 13.7598 5.69732 13.8536 5.60355C13.9473 5.50979 14 5.38261 14 5.25C14 5.11739 13.9473 4.99021 13.8536 4.89645C13.7598 4.80268 13.6326 4.75 13.5 4.75H7V3.75C7 3.61739 6.94732 3.49021 6.85355 3.39645C6.75979 3.30268 6.63261 3.25 6.5 3.25Z M2.5 4.75C2.36739 4.75 2.24021 4.80268 2.14645 4.89645C2.05268 4.99021 2 5.11739 2 5.25C2 5.38261 2.05268 5.50979 2.14645 5.60355C2.24021 5.69732 2.36739 5.75 2.5 5.75H4.5C4.63261 5.75 4.75979 5.69732 4.85355 5.60355C4.94732 5.50979 5 5.38261 5 5.25C5 5.11739 4.94732 4.99021 4.85355 4.89645C4.75979 4.80268 4.63261 4.75 4.5 4.75H2.5Z M10.5 8.75C10.3674 8.75 10.2402 8.80268 10.1464 8.89645C10.0527 8.99021 10 9.11739 10 9.25V12.25C10 12.3826 10.0527 12.5098 10.1464 12.6036C10.2402 12.6973 10.3674 12.75 10.5 12.75C10.6326 12.75 10.7598 12.6973 10.8536 12.6036C10.9473 12.5098 11 12.3826 11 12.25V11.25H13.5C13.6326 11.25 13.7598 11.1973 13.8536 11.1036C13.9473 11.0098 14 10.8826 14 10.75C14 10.6174 13.9473 10.4902 13.8536 10.3964C13.7598 10.3027 13.6326 10.25 13.5 10.25H11V9.25C11 9.11739 10.9473 8.99021 10.8536 8.89645C10.7598 8.80268 10.6326 8.75 10.5 8.75Z M2.5 10.25C2.36739 10.25 2.24021 10.3027 2.14645 10.3964C2.05268 10.4902 2 10.6174 2 10.75C2 10.8826 2.05268 11.0098 2.14645 11.1036C2.24021 11.1973 2.36739 11.25 2.5 11.25H8.5C8.63261 11.25 8.75979 11.1973 8.85355 11.1036C8.94732 11.0098 9 10.8826 9 10.75C9 10.6174 8.94732 10.4902 8.85355 10.3964C8.75979 10.3027 8.63261 10.25 8.5 10.25H2.5Z" />
                    </svg>
                    <span className={styles.tableTitleDropdownItemText}>Manage fields</span>
                    <span className={styles.tableTitleDropdownTeamBadge}>
                      <svg className={styles.tableTitleDropdownTeamBadgeIcon} viewBox="0 0 16 16" fill="currentColor">
                        <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                      </svg>
                      Team
                    </span>
                  </li>

                  {/* Duplicate table */}
                  <li className={styles.tableTitleDropdownItem}>
                    <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M2.5 5C2.3674 5.00001 2.24023 5.0527 2.14646 5.14646C2.0527 5.24023 2.00001 5.3674 2 5.5V13.5C2.00001 13.6326 2.0527 13.7598 2.14646 13.8535C2.24023 13.9473 2.3674 14 2.5 14H10.5C10.6326 14 10.7598 13.9473 10.8535 13.8535C10.9473 13.7598 11 13.6326 11 13.5V5.5C11 5.3674 10.9473 5.24023 10.8535 5.14646C10.7598 5.0527 10.6326 5.00001 10.5 5H2.5ZM3 6H10V13H3V6Z M5.5 2C5.3674 2.00001 5.24023 2.0527 5.14646 2.14646C5.0527 2.24023 5.00001 2.3674 5 2.5V5.5C5 5.63261 5.05268 5.75979 5.14645 5.85355C5.24021 5.94732 5.36739 6 5.5 6C5.63261 6 5.75979 5.94732 5.85355 5.85355C5.94732 5.75979 6 5.63261 6 5.5V3H13V10H10.5C10.3674 10 10.2402 10.0527 10.1464 10.1464C10.0527 10.2402 10 10.3674 10 10.5C10 10.6326 10.0527 10.7598 10.1464 10.8536C10.2402 10.9473 10.3674 11 10.5 11H13.5C13.6326 11 13.7598 10.9473 13.8535 10.8535C13.9473 10.7598 14 10.6326 14 10.5V2.5C14 2.3674 13.9473 2.24023 13.8535 2.14646C13.7598 2.0527 13.6326 2.00001 13.5 2H5.5Z" />
                    </svg>
                    <span className={styles.tableTitleDropdownItemText}>Duplicate table</span>
                  </li>

                  {/* Divider */}
                  <li className={styles.tableTitleDropdownDivider} />

                  {/* Configure date dependencies - with Team badge */}
                  <li className={styles.tableTitleDropdownItem}>
                    <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M0 3.5C0 2.67157 0.671573 2 1.5 2H11.5C12.3284 2 13 2.67157 13 3.5V5.5C13 6.32843 12.3284 7 11.5 7H4.5V10C4.5 10.5523 4.94771 11 5.5 11H7.5V10.5C7.5 9.67157 8.17157 9 9 9H14.5C15.3284 9 16 9.67157 16 10.5V12.5C16 13.3284 15.3284 14 14.5 14H9C8.17157 14 7.5 13.3284 7.5 12.5V12H5.5C4.39543 12 3.5 11.1046 3.5 10V7H1.5C0.671573 7 0 6.32843 0 5.5V3.5ZM8.5 12.5C8.5 12.7761 8.72386 13 9 13H14.5C14.7761 13 15 12.7761 15 12.5V10.5C15 10.2239 14.7761 10 14.5 10H9C8.72386 10 8.5 10.2239 8.5 10.5V12.5ZM1.5 3C1.22386 3 1 3.22386 1 3.5V5.5C1 5.77614 1.22386 6 1.5 6H11.5C11.7761 6 12 5.77614 12 5.5V3.5C12 3.22386 11.7761 3 11.5 3H1.5Z" />
                    </svg>
                    <span className={styles.tableTitleDropdownItemText}>Configure date dependencies</span>
                    <span className={styles.tableTitleDropdownTeamBadge}>
                      <svg className={styles.tableTitleDropdownTeamBadgeIcon} viewBox="0 0 16 16" fill="currentColor">
                        <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                      </svg>
                      Team
                    </span>
                  </li>

                  {/* Divider */}
                  <li className={styles.tableTitleDropdownDivider} />

                  {/* Edit table description */}
                  <li className={styles.tableTitleDropdownItem}>
                    <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M7.875 6C8.28919 6 8.625 5.66419 8.625 5.25C8.625 4.83581 8.28919 4.5 7.875 4.5C7.46081 4.5 7.125 4.83581 7.125 5.25C7.125 5.66419 7.46081 6 7.875 6Z M7.5 7C7.36739 7 7.24021 7.05268 7.14645 7.14645C7.05268 7.24021 7 7.36739 7 7.5C7 7.63261 7.05268 7.75979 7.14645 7.85355C7.24021 7.94732 7.36739 8 7.5 8V11C7.50001 11.1326 7.5527 11.2598 7.64646 11.3535C7.74023 11.4473 7.8674 11.5 8 11.5H8.5C8.63261 11.5 8.75979 11.4473 8.85355 11.3536C8.94732 11.2598 9 11.1326 9 11C9 10.8674 8.94732 10.7402 8.85355 10.6464C8.75979 10.5527 8.63261 10.5 8.5 10.5V7.5C8.49999 7.3674 8.4473 7.24023 8.35354 7.14646C8.25977 7.0527 8.1326 7.00001 8 7H7.5Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
                    </svg>
                    <span className={styles.tableTitleDropdownItemText}>Edit table description</span>
                  </li>

                  {/* Edit table permissions - with Team badge */}
                  <li className={styles.tableTitleDropdownItem}>
                    <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M8 10.25C8.41419 10.25 8.75 9.91419 8.75 9.5C8.75 9.08581 8.41419 8.75 8 8.75C7.58581 8.75 7.25 9.08581 7.25 9.5C7.25 9.91419 7.58581 10.25 8 10.25Z M8 0.5C6.48714 0.5 5.25 1.73714 5.25 3.25V5H3C2.45364 5 2 5.45364 2 6V13C2 13.5464 2.45364 14 3 14H13C13.5464 14 14 13.5464 14 13V6C14 5.45364 13.5464 5 13 5H10.75V3.25C10.75 1.73714 9.51286 0.5 8 0.5ZM8 1.5C8.97242 1.5 9.75 2.27758 9.75 3.25V5H6.25V3.25C6.25 2.27758 7.02758 1.5 8 1.5ZM3 6H13V13H3V6Z" />
                    </svg>
                    <span className={styles.tableTitleDropdownItemText}>Edit table permissions</span>
                    <span className={styles.tableTitleDropdownTeamBadge}>
                      <svg className={styles.tableTitleDropdownTeamBadgeIcon} viewBox="0 0 16 16" fill="currentColor">
                        <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                      </svg>
                      Team
                    </span>
                  </li>

                  {/* Divider */}
                  <li className={styles.tableTitleDropdownDivider} />

                  {/* Clear data */}
                  <li 
                    className={styles.tableTitleDropdownItem}
                    onClick={handleOpenClearDataModal}
                  >
                    <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M3.49999 3C3.36738 3.00002 3.24022 3.05271 3.14647 3.14648C3.05272 3.24025 3.00006 3.36741 3.00006 3.5C3.00006 3.63259 3.05272 3.75975 3.14647 3.85352L12.1465 12.8535C12.2402 12.9473 12.3674 12.9999 12.5 12.9999C12.6326 12.9999 12.7597 12.9473 12.8535 12.8535C12.9472 12.7598 12.9999 12.6326 12.9999 12.5C12.9999 12.3674 12.9472 12.2402 12.8535 12.1465L3.8535 3.14648C3.75975 3.05271 3.63259 3.00002 3.49999 3Z M12.5 3C12.3674 3.00002 12.2402 3.05271 12.1465 3.14648L3.14647 12.1465C3.05272 12.2402 3.00006 12.3674 3.00006 12.5C3.00006 12.6326 3.05272 12.7598 3.14647 12.8535C3.24023 12.9473 3.3674 12.9999 3.49999 12.9999C3.63258 12.9999 3.75974 12.9473 3.8535 12.8535L12.8535 3.85352C12.9472 3.75975 12.9999 3.63259 12.9999 3.5C12.9999 3.36741 12.9472 3.24025 12.8535 3.14648C12.7597 3.05271 12.6326 3.00002 12.5 3Z" />
                    </svg>
                    <span className={styles.tableTitleDropdownItemText}>Clear data</span>
                  </li>

                  {/* Delete table - disabled when only 1 table */}
                  <li 
                    className={`${styles.tableTitleDropdownItem} ${tables.length <= 1 ? styles.tableTitleDropdownItemDisabled : ''}`}
                    onClick={tables.length > 1 ? handleOpenDeleteTablePopup : undefined}
                  >
                    <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M6.5 6C6.36739 6 6.24021 6.05268 6.14645 6.14645C6.05268 6.24021 6 6.36739 6 6.5V10.5C6 10.6326 6.05268 10.7598 6.14645 10.8536C6.24021 10.9473 6.36739 11 6.5 11C6.63261 11 6.75979 10.9473 6.85355 10.8536C6.94732 10.7598 7 10.6326 7 10.5V6.5C7 6.36739 6.94732 6.24021 6.85355 6.14645C6.75979 6.05268 6.63261 6 6.5 6Z M9.5 6C9.36739 6 9.24021 6.05268 9.14645 6.14645C9.05268 6.24021 9 6.36739 9 6.5V10.5C9 10.6326 9.05268 10.7598 9.14645 10.8536C9.24021 10.9473 9.36739 11 9.5 11C9.63261 11 9.75979 10.9473 9.85355 10.8536C9.94732 10.7598 10 10.6326 10 10.5V6.5C10 6.36739 9.94732 6.24021 9.85355 6.14645C9.75979 6.05268 9.63261 6 9.5 6Z M6.5 1C5.6775 1 5 1.6775 5 2.5V3H2.5C2.36739 3 2.24021 3.05268 2.14645 3.14645C2.05268 3.24021 2 3.36739 2 3.5C2 3.63261 2.05268 3.75979 2.14645 3.85355C2.24021 3.94732 2.36739 4 2.5 4H3V13C3.00007 13.5463 3.45357 13.9999 3.99988 14H12C12.5464 14 13 13.5464 13 13V4H13.5C13.6326 4 13.7598 3.94732 13.8536 3.85355C13.9473 3.75979 14 3.63261 14 3.5C14 3.36739 13.9473 3.24021 13.8536 3.14645C13.7598 3.05268 13.6326 3 13.5 3H11V2.5C10.9999 1.67757 10.3226 1.0001 9.50012 1H6.5ZM6.5 2H9.5C9.78202 2.0001 9.99996 2.21808 10 2.50012V3H6V2.5C6 2.21794 6.21794 2 6.5 2ZM4 4H12V13H4.00012L4 4Z" />
                    </svg>
                    <span className={styles.tableTitleDropdownItemText}>Delete table</span>
                  </li>
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Table Rename Popup — rendered via Portal so it escapes the toolbar stacking context */}
        {isRenamePopupOpen && renamePopupPosition && createPortal(
          <div
            ref={renamePopupRef}
            className={styles.tableRenamePopup}
            style={{
              top: renamePopupPosition.top,
              left: renamePopupPosition.left,
            }}
          >
            {/* Input box + overlay tooltip */}
            <div className={styles.tableRenameInputWrapper}>
              <input
                ref={renameInputRef}
                type="text"
                className={styles.tableRenameInput}
                value={renameTableName}
                onChange={(e) => setRenameTableName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveRename();
                  } else if (e.key === 'Escape') {
                    handleCancelRename();
                  }
                }}
              />

              {/* Duplicate name error tooltip (shown on Save, overlays below input) */}
              {showDuplicateTooltip && (
                <div className={styles.tableRenameTooltip}>
                  <div className={styles.tableRenameTooltipContent}>
                    Please enter a unique table name
                  </div>
                </div>
              )}
            </div>

            {/* "What should each record be called?" row */}
            <div className={styles.tableRenameRecordLabelRow}>
              <span className={styles.tableRenameRecordLabelText}>What should each record be called?</span>
              <svg className={styles.tableRenameQuestionIcon} viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="nonzero" d="M8.07349 4.50134C7.75062 4.49155 7.43049 4.55078 7.13904 4.67151C6.36183 4.99344 5.75017 5.76895 5.75 6.74988C5.74997 6.88249 5.80262 7.00968 5.89636 7.10347C5.99011 7.19726 6.11727 7.24997 6.24988 7.25C6.31554 7.25002 6.38056 7.2371 6.44123 7.21199C6.5019 7.18687 6.55703 7.15006 6.60347 7.10364C6.64991 7.05722 6.68675 7.00211 6.71189 6.94145C6.73704 6.8808 6.74998 6.81578 6.75 6.75012C6.75013 6.17215 7.08092 5.77793 7.52173 5.59534C7.96254 5.41275 8.47515 5.45759 8.88391 5.86621C9.24251 6.22468 9.34907 6.75995 9.15503 7.22839C8.96099 7.69684 8.50716 8.00009 8.00012 8C7.93445 7.99999 7.86942 8.01292 7.80875 8.03804C7.74808 8.06316 7.69295 8.09999 7.6465 8.14642C7.60006 8.19285 7.56322 8.24797 7.53809 8.30864C7.51295 8.36931 7.50001 8.43433 7.5 8.5V9C7.5 9.13261 7.55268 9.25979 7.64645 9.35355C7.74021 9.44732 7.86739 9.5 8 9.5C8.13261 9.5 8.25979 9.44732 8.35355 9.35355C8.44732 9.25979 8.5 9.13261 8.5 9V8.93738C9.1999 8.77686 9.79665 8.2924 10.0789 7.61108C10.4266 6.77156 10.2336 5.80137 9.59094 5.15894C9.15735 4.7255 8.61159 4.51766 8.07349 4.50134Z M8 12C8.41419 12 8.75 11.6642 8.75 11.25C8.75 10.8358 8.41419 10.5 8 10.5C7.58581 10.5 7.25 10.8358 7.25 11.25C7.25 11.6642 7.58581 12 8 12Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
              </svg>
            </div>

            {/* Record selector box */}
            <div className={styles.tableRenameRecordSelector}>
              <span className={styles.tableRenameRecordText}>{renameRecordName}</span>
              <svg className={styles.tableRenameChevronIcon} viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="nonzero" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" />
              </svg>
            </div>

            {/* Example row */}
            <div className={styles.tableRenameExampleRow}>
              <span className={styles.tableRenameExampleLabel}>Examples:</span>
              <div className={styles.tableRenameExampleItems}>
                <div className={styles.tableRenameExampleItem}>
                  <svg className={styles.tableRenameExampleIcon} viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="nonzero" d="M8 2C7.86739 2 7.74021 2.05268 7.64645 2.14645C7.55268 2.24021 7.5 2.36739 7.5 2.5V7.5H2.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H7.5V13.5C7.5 13.6326 7.55268 13.7598 7.64645 13.8536C7.74021 13.9473 7.86739 14 8 14C8.13261 14 8.25979 13.9473 8.35355 13.8536C8.44732 13.7598 8.5 13.6326 8.5 13.5V8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H8.5V2.5C8.5 2.36739 8.44732 2.24021 8.35355 2.14645C8.25979 2.05268 8.13261 2 8 2Z" />
                  </svg>
                  Add {renameRecordName.toLowerCase()}
                </div>
                <div className={styles.tableRenameExampleItem}>
                  <svg className={styles.tableRenameExampleIcon} viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="nonzero" d="M2.5 4H13.5V12H2.50012L2.5 4Z M2 3C1.8674 3.00001 1.74023 3.0527 1.64646 3.14646C1.5527 3.24023 1.50001 3.3674 1.5 3.5V12C1.50007 12.5463 1.95357 12.9999 2.49988 13C2.49984 13 2.49992 13 2.49988 13H13.5C14.0464 13 14.5 12.5464 14.5 12V3.5C14.5 3.3674 14.4473 3.24023 14.3535 3.14646C14.2598 3.0527 14.1326 3.00001 14 3H2ZM1.97827 3.00049C1.84581 3.00625 1.72107 3.06439 1.63147 3.16211C1.54186 3.25985 1.49475 3.38919 1.50049 3.52167C1.50624 3.65414 1.56437 3.77891 1.66211 3.86853L7.66211 9.36853C7.75433 9.45307 7.87489 9.49996 8 9.49996C8.12511 9.49996 8.24567 9.45307 8.33789 9.36853L14.3379 3.86853C14.4356 3.77891 14.4938 3.65414 14.4995 3.52167C14.5053 3.38919 14.4581 3.25985 14.3685 3.16211C14.2789 3.06437 14.1541 3.00624 14.0217 3.00049C13.8892 2.99475 13.7599 3.04186 13.6621 3.13147L8 8.32166L2.33789 3.13147C2.28949 3.08709 2.23281 3.05268 2.17111 3.03021C2.10941 3.00773 2.04388 2.99764 1.97827 3.00049Z" />
                  </svg>
                  Send {renameRecordName.toLowerCase()}s
                </div>
              </div>
            </div>

            {/* Buttons row */}
            <div className={styles.tableRenameButtonsRow}>
              <button 
                type="button"
                className={styles.tableRenameCancelButton}
                onClick={handleCancelRename}
              >
                Cancel
              </button>
              <button 
                type="button"
                className={styles.tableRenameSaveButton}
                onClick={handleSaveRename}
              >
                Save
              </button>
            </div>
          </div>,
          document.body
        )}

        {/* Right scroll indicator - only render when there's right overflow (scrollProgress < 1) */}
        {hasOverflow && scrollProgress < 1 && (
          <div 
            className={styles.scrollIndicatorRight}
            style={{ width: `${Math.min((1 - scrollProgress) * 3, 1) * 40}px` }}
          >
            {/* Shadow extends over tables (to the left) */}
            <div className={styles.scrollIndicatorShadowLeft} />
            {/* Clip wrapper for button */}
            <div className={styles.scrollIndicatorClip}>
              <button 
                className={styles.scrollIndicatorButton}
                style={{ backgroundColor: getBaseToolbarColor(baseId) }}
                onClick={() => scrollToEnd('right')}
                aria-label="Scroll to last table"
              >
                <svg className={styles.scrollIndicatorIcon} viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="nonzero" d="M8 1.5C6.71442 1.5 5.45772 1.88122 4.3888 2.59545C3.31988 3.30968 2.48676 4.32484 1.99479 5.51256C1.50282 6.70028 1.37409 8.00721 1.6249 9.26809C1.8757 10.529 2.49477 11.6872 3.40381 12.5962C4.31285 13.5052 5.47104 14.1243 6.73192 14.3751C7.99279 14.6259 9.29973 14.4972 10.4874 14.0052C11.6752 13.5132 12.6903 12.6801 13.4046 11.6112C14.1188 10.5423 14.5 9.28558 14.5 8C14.4967 6.27711 13.8108 4.62573 12.5925 3.40746C11.3743 2.18918 9.7229 1.5033 8 1.5V1.5ZM10.0875 8.36875L7.5875 10.6187C7.49472 10.7021 7.37473 10.7488 7.25 10.75C7.18057 10.7504 7.11184 10.7361 7.0483 10.7081C6.98476 10.6801 6.92784 10.639 6.88125 10.5875C6.79177 10.4897 6.7448 10.3603 6.75066 10.2279C6.75652 10.0955 6.81473 9.97078 6.9125 9.88125L9 8L6.9125 6.11875C6.818 6.02842 6.76263 5.90466 6.75827 5.774C6.7539 5.64334 6.80089 5.51617 6.88915 5.41973C6.97742 5.32329 7.09994 5.26526 7.23048 5.25807C7.36102 5.25087 7.48918 5.29509 7.5875 5.38125L10.0875 7.63125C10.1387 7.67809 10.1795 7.73507 10.2075 7.79855C10.2354 7.86203 10.2498 7.93064 10.2498 8C10.2498 8.06936 10.2354 8.13797 10.2075 8.20145C10.1795 8.26493 10.1387 8.32191 10.0875 8.36875V8.36875Z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Tabs Dropdown Button - stays fixed */}
        <div className={`${styles.tableTabsDropdownWrapper} ${!hasOverflow ? styles.tableTabsDropdownWrapperNoScroll : ''}`}>
          <button 
            ref={tableDropdownButtonRef}
            className={styles.tableTabsDropdownButton}
            onClick={() => {
              setIsTableDropdownOpen(!isTableDropdownOpen);
              setTableSearchQuery('');
            }}
            aria-expanded={isTableDropdownOpen}
          >
            <svg 
              className={styles.tableTabsDropdownButtonIcon}
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

          {/* Table Dropdown Menu */}
          {isTableDropdownOpen && (
            <div ref={tableDropdownRef} className={`${styles.tableDropdown} ${tableDropdownAlignRight ? styles.tableDropdownAlignRight : ''}`}>
              {/* Search Section */}
              <div className={styles.tableDropdownSearch}>
                <div className={styles.tableDropdownSearchIcon}>
                  <IconMagnifyingGlass />
                </div>
                <input
                  type="text"
                  className={styles.tableDropdownSearchInput}
                  placeholder="Find a table"
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Table Entries (Scrollable) */}
              <div className={styles.tableDropdownEntries}>
                {filteredTables.map((table) => (
                  <div 
                    key={table.id}
                    className={`${styles.tableDropdownEntry} ${hoveredTableId === table.id ? styles.tableDropdownEntryHover : ''}`}
                    onMouseEnter={() => setHoveredTableId(table.id)}
                    onMouseLeave={() => setHoveredTableId(null)}
                    onClick={() => handleTableSelect(table.id)}
                  >
                    {activeTableId === table.id && (
                      <div className={styles.tableDropdownEntryCheck}>
                        <IconCheck />
                      </div>
                    )}
                    <span className={`${styles.tableDropdownEntryText} ${hoveredTableId === table.id ? styles.tableDropdownEntryTextHover : ''}`}>
                      {table.name}
                    </span>
                    {hoveredTableId === table.id && (
                      <>
                        <button className={styles.tableDropdownEntryEyeSlash} onClick={(e) => e.stopPropagation()}>
                          <IconEyeSlash />
                        </button>
                        <div className={styles.tableDropdownEntryDrag}>
                          <IconDotsSixVertical />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Table Section */}
              <div 
                ref={addTableSectionRef}
                className={styles.tableDropdownAddSection} 
                onClick={() => {
                  setAddOrImportOpenedFromTableDropdown(true);
                  setIsAddOrImportDropdownOpen(true);
                }}
              >
                <svg className={styles.tableDropdownAddIcon} viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z"/>
                </svg>
                <span className={styles.tableDropdownAddText}>Add table</span>
                <svg className={styles.tableDropdownAddChevron} viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="nonzero" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Add or Import Button - stays fixed, collapses to just + when > 3 tables */}
        <div className={styles.addOrImportWrapper}>
          <button 
            ref={addOrImportButtonRef}
            className={`${styles.addOrImportButton} ${tables.length > 3 ? styles.addOrImportButtonCollapsed : ''} ${!hasOverflow ? styles.addOrImportButtonNoScroll : ''}`} 
            onClick={() => {
              setAddOrImportOpenedFromTableDropdown(false);
              setIsAddOrImportDropdownOpen(!isAddOrImportDropdownOpen);
            }}
          >
            <svg 
              className={styles.addOrImportButtonIcon}
              viewBox="0 0 16 16" 
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z"/>
            </svg>
            <span className={styles.addOrImportButtonText}>Add or import</span>
          </button>

          {/* Add or Import Dropdown Menu */}
          {isAddOrImportDropdownOpen && addOrImportDropdownPosition && (
            <ul 
              ref={addOrImportDropdownRef} 
              className={styles.addOrImportDropdown}
              style={{
                top: addOrImportDropdownPosition.top,
                left: addOrImportDropdownPosition.left,
              }}
            >
              {/* Section: Add a blank table */}
              <li className={styles.addOrImportSectionHeader}>Add a blank table</li>
              
              {/* Add from scratch */}
              <li 
                className={styles.addOrImportMenuItem}
                onClick={() => {
                  handleAddTable();
                  setIsAddOrImportDropdownOpen(false);
                }}
              >
                <span className={styles.addOrImportMenuItemText}>Start from scratch</span>
              </li>

              {/* Divider */}
              <li className={styles.addOrImportDivider} />

              {/* Section: Build with Omni */}
              <li className={styles.addOrImportSectionHeaderOmni}>Build with Omni</li>

              {/* New table */}
              <li className={styles.addOrImportMenuItem}>
                <span className={styles.addOrImportMenuItemText}>New table</span>
              </li>

              {/* New table with web data (with Beta badge) */}
              <li className={styles.addOrImportMenuItem}>
                <div className={styles.addOrImportMenuItemWithBadge}>
                  <span className={styles.addOrImportMenuItemText}>New table with web data</span>
                  <span className={styles.addOrImportBetaBadge}>Beta</span>
                </div>
              </li>

              {/* Divider */}
              <li className={styles.addOrImportDivider} />

              {/* Section: Add from other sources */}
              <li className={styles.addOrImportSectionHeaderSources}>Add from other sources</li>

              {/* Item 1: Airtable base */}
              <li className={styles.addOrImportMenuItem}>
                <svg
                  className={styles.addOrImportItemIconAirtable}
                  viewBox="0 0 200 170"
                  aria-hidden="true"
                >
                  <g>
                    <path fill="rgb(255, 186, 5)" d="M90.0389,12.3675 L24.0799,39.6605 C20.4119,41.1785 20.4499,46.3885 24.1409,47.8515 L90.3759,74.1175 C96.1959,76.4255 102.6769,76.4255 108.4959,74.1175 L174.7319,47.8515 C178.4219,46.3885 178.4609,41.1785 174.7919,39.6605 L108.8339,12.3675 C102.8159,9.8775 96.0559,9.8775 90.0389,12.3675" />
                    <path fill="rgb(57, 202, 255)" d="M105.3122,88.4608 L105.3122,154.0768 C105.3122,157.1978 108.4592,159.3348 111.3602,158.1848 L185.1662,129.5368 C186.8512,128.8688 187.9562,127.2408 187.9562,125.4288 L187.9562,59.8128 C187.9562,56.6918 184.8092,54.5548 181.9082,55.7048 L108.1022,84.3528 C106.4182,85.0208 105.3122,86.6488 105.3122,88.4608" />
                    <path fill="rgb(220, 4, 59)" d="M88.0781,91.8464 L66.1741,102.4224 L63.9501,103.4974 L17.7121,125.6524 C14.7811,127.0664 11.0401,124.9304 11.0401,121.6744 L11.0401,60.0884 C11.0401,58.9104 11.6441,57.8934 12.4541,57.1274 C12.7921,56.7884 13.1751,56.5094 13.5731,56.2884 C14.6781,55.6254 16.2541,55.4484 17.5941,55.9784 L87.7101,83.7594 C91.2741,85.1734 91.5541,90.1674 88.0781,91.8464" />
                    <path fill="rgba(29, 31, 37, 0.25)" d="M88.0781,91.8464 L66.1741,102.4224 L12.4541,57.1274 C12.7921,56.7884 13.1751,56.5094 13.5731,56.2884 C14.6781,55.6254 16.2541,55.4484 17.5941,55.9784 L87.7101,83.7594 C91.2741,85.1734 91.5541,90.1674 88.0781,91.8464" />
                  </g>
                </svg>
                <span className={styles.addOrImportItemText}>Airtable base</span>
                <span className={styles.addOrImportTeamBadge}>
                  <svg
                    className={styles.addOrImportBadgeIcon}
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                  </svg>
                  Team
                </span>
              </li>

              {/* Item 2: CSV file */}
              <li className={styles.addOrImportMenuItem}>
                <svg
                  className={styles.addOrImportItemIconCsv}
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path fillRule="nonzero" d="M9.5 1.5C9.36739 1.5 9.24021 1.55268 9.14645 1.64645C9.05268 1.74021 9 1.86739 9 2V5.5C9.00001 5.6326 9.0527 5.75977 9.14646 5.85354C9.24023 5.9473 9.3674 5.99999 9.5 6H13C13.1326 6 13.2598 5.94732 13.3536 5.85355C13.4473 5.75979 13.5 5.63261 13.5 5.5C13.5 5.36739 13.4473 5.24021 13.3536 5.14645C13.2598 5.05268 13.1326 5 13 5H10V2C10 1.86739 9.94732 1.74021 9.85355 1.64645C9.75979 1.55268 9.63261 1.5 9.5 1.5Z M3.5 1.5C2.95364 1.5 2.5 1.95364 2.5 2.5V8C2.5 8.13261 2.55268 8.25979 2.64645 8.35355C2.74021 8.44732 2.86739 8.5 3 8.5C3.13261 8.5 3.25979 8.44732 3.35355 8.35355C3.44732 8.25979 3.5 8.13261 3.5 8V2.5H9.29285L12.5 5.70715V8C12.5 8.13261 12.5527 8.25979 12.6464 8.35355C12.7402 8.44732 12.8674 8.5 13 8.5C13.1326 8.5 13.2598 8.44732 13.3536 8.35355C13.4473 8.25979 13.5 8.13261 13.5 8V5.5C13.5 5.36739 13.4473 5.24021 13.3536 5.14645L9.85355 1.64645C9.75979 1.55268 9.63261 1.5 9.5 1.5H3.5Z M7.9375 9.9375C7.56366 9.9375 7.20561 10.0424 6.93237 10.2766C6.65914 10.5108 6.5 10.875 6.5 11.25C6.5 11.6622 6.78759 12.0162 7.06567 12.1741C7.34376 12.3319 7.62393 12.3941 7.87158 12.4598C8.11923 12.5256 8.33284 12.595 8.42737 12.6526C8.52189 12.7102 8.5 12.6667 8.5 12.75C8.5 12.9292 8.47991 12.9248 8.41016 12.9695C8.3405 13.0141 8.16358 13.0622 7.93835 13.0624C7.70783 13.0617 7.48374 12.9871 7.29895 12.8492C7.19266 12.77 7.05923 12.7362 6.92801 12.7552C6.79679 12.7743 6.67853 12.8448 6.59924 12.951C6.51996 13.0573 6.48615 13.1908 6.50524 13.322C6.52433 13.4532 6.59477 13.5715 6.70105 13.6508C7.05787 13.9169 7.49099 14.0613 7.93616 14.0625C7.93661 14.0625 7.93705 14.0625 7.9375 14.0625C8.2743 14.0625 8.62835 14.0171 8.94922 13.8118C9.27009 13.6064 9.5 13.1958 9.5 12.75C9.5 12.3333 9.2281 11.9695 8.94763 11.7986C8.66716 11.6277 8.38077 11.5603 8.12842 11.4933C7.87607 11.4263 7.65624 11.3595 7.55933 11.3044C7.46241 11.2494 7.5 11.3066 7.5 11.25C7.5 11.125 7.52836 11.0829 7.58325 11.0359C7.63805 10.9889 7.74867 10.9378 7.93677 10.9376C8.16725 10.9384 8.39129 11.0129 8.57605 11.1508C8.68234 11.23 8.81577 11.2638 8.94699 11.2448C9.07821 11.2257 9.19647 11.1552 9.27576 11.049C9.35504 10.9427 9.38885 10.8092 9.36976 10.678C9.35067 10.5468 9.28023 10.4285 9.17395 10.3492C8.81713 10.0831 8.38401 9.93865 7.93884 9.9375C7.93839 9.9375 7.93795 9.9375 7.9375 9.9375Z M4.125 10C3.07015 10 2.25 10.9231 2.25 12C2.25 13.0769 3.07015 14 4.125 14C4.12634 14 4.12769 14 4.12903 14C4.57646 13.9964 5.00715 13.8272 5.3374 13.5253C5.38586 13.481 5.42512 13.4275 5.45294 13.3681C5.48076 13.3086 5.49659 13.2442 5.49952 13.1786C5.50246 13.113 5.49244 13.0475 5.47005 12.9857C5.44766 12.924 5.41333 12.8673 5.36902 12.8188C5.32471 12.7704 5.27129 12.7311 5.21181 12.7033C5.15233 12.6755 5.08795 12.6597 5.02236 12.6567C4.95676 12.6538 4.89122 12.6638 4.8295 12.6862C4.76777 12.7086 4.71106 12.7429 4.6626 12.7872C4.51478 12.9224 4.32267 12.9978 4.12244 12.9998C3.6534 12.9982 3.25 12.5846 3.25 12C3.25 11.4154 3.6534 11.0018 4.12244 11.0002C4.32267 11.0022 4.51478 11.0776 4.6626 11.2128C4.71106 11.2571 4.76777 11.2914 4.8295 11.3138C4.89122 11.3362 4.95676 11.3462 5.02236 11.3433C5.08795 11.3403 5.15233 11.3245 5.21181 11.2967C5.27129 11.2689 5.32471 11.2296 5.36902 11.1812C5.41333 11.1327 5.44766 11.076 5.47005 11.0143C5.49244 10.9525 5.50246 10.887 5.49952 10.8214C5.49659 10.7558 5.48076 10.6914 5.45294 10.6319C5.42512 10.5725 5.38586 10.519 5.3374 10.4747C5.00715 10.1728 4.57646 10.0036 4.12903 10C4.12769 9.99999 4.12634 9.99999 4.125 10Z M10.9404 10.0377C10.8797 10.0127 10.8147 9.9999 10.749 10C10.6833 10.0001 10.6184 10.0132 10.5577 10.0385C10.4353 10.0894 10.3382 10.187 10.2877 10.3096C10.2372 10.4322 10.2375 10.5698 10.2885 10.6923L11.5385 13.6923C11.5764 13.7834 11.6405 13.8612 11.7227 13.9159C11.8048 13.9707 11.9013 13.9999 12 13.9999C12.0987 13.9999 12.1952 13.9707 12.2773 13.9159C12.3595 13.8612 12.4236 13.7834 12.4615 13.6923L13.7115 10.6923C13.7625 10.5698 13.7628 10.4322 13.7123 10.3096C13.6618 10.187 13.5647 10.0894 13.4423 10.0385C13.3199 9.98746 13.1822 9.98719 13.0596 10.0377C12.937 10.0882 12.8394 10.1853 12.7885 10.3077L12 12.2001L11.2115 10.3077C11.1606 10.1853 11.063 10.0882 10.9404 10.0377Z" />
                </svg>
                <span className={styles.addOrImportItemText}>CSV file</span>
              </li>

              {/* Item 3: Google Calendar */}
              <li className={styles.addOrImportMenuItem}>
                <svg
                  className={styles.addOrImportItemIconGoogle}
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M11.4211 14.5003L14.5 11.4214H11.4211V14.5003Z" fill="#EA4335"/>
                  <path d="M14.5 4.57861H11.4211V11.4207H14.5V4.57861Z" fill="#FBBC04"/>
                  <path d="M11.4211 11.4214H4.57895V14.5003H11.4211V11.4214Z" fill="#34A853"/>
                  <path d="M1.5 11.4214V13.474C1.5 14.0411 1.95928 14.5003 2.52632 14.5003H4.57895V11.4214H1.5Z" fill="#188038"/>
                  <path d="M14.5 4.57895V2.52632C14.5 1.95928 14.0407 1.5 13.4737 1.5H11.4211V4.57895H14.5Z" fill="#1967D2"/>
                  <path d="M11.4211 1.5H2.52632C1.95928 1.5 1.5 1.95928 1.5 2.52632V11.4211H4.57895V4.57895H11.4211V1.5Z" fill="#4285F4"/>
                  <path d="M5.98241 9.88658C5.72669 9.71381 5.54965 9.46151 5.453 9.12796L6.04656 8.88335C6.10044 9.08862 6.19452 9.2477 6.32879 9.36059C6.46221 9.47349 6.62471 9.52908 6.81458 9.52908C7.00873 9.52908 7.1755 9.47006 7.31491 9.35204C7.45432 9.23401 7.52445 9.08348 7.52445 8.90131C7.52445 8.71487 7.4509 8.56263 7.30379 8.4446C7.15669 8.32658 6.97195 8.26756 6.75129 8.26756H6.40833V7.68H6.71623C6.90609 7.68 7.06603 7.62868 7.19603 7.52605C7.32603 7.42342 7.39103 7.28316 7.39103 7.10441C7.39103 6.94533 7.33287 6.81875 7.21655 6.72381C7.10024 6.62888 6.95314 6.58099 6.77439 6.58099C6.59991 6.58099 6.46136 6.62717 6.35873 6.72039C6.25616 6.81386 6.17905 6.93188 6.13465 7.06335L5.54708 6.81875C5.62491 6.59809 5.76774 6.40309 5.97728 6.2346C6.18682 6.06612 6.45452 5.98145 6.77952 5.98145C7.01985 5.98145 7.23623 6.02763 7.42781 6.12085C7.61938 6.21408 7.76991 6.34322 7.87853 6.50743C7.98715 6.6725 8.04103 6.85723 8.04103 7.0625C8.04103 7.27204 7.99057 7.44908 7.88965 7.59447C7.78873 7.73987 7.66471 7.85105 7.51761 7.92888V7.96395C7.70755 8.04226 7.87255 8.17088 7.99484 8.33598C8.11886 8.50276 8.18129 8.70204 8.18129 8.93467C8.18129 9.1673 8.12228 9.37513 8.00425 9.5573C7.88623 9.73947 7.72287 9.88316 7.5159 9.9875C7.30807 10.0918 7.07458 10.1449 6.81544 10.1449C6.51524 10.1457 6.23813 10.0593 5.98241 9.88658ZM9.6284 6.94105L8.97669 7.4123L8.65083 6.91796L9.81998 6.07467H10.2681V10.0525H9.6284V6.94105Z" fill="#4285F4"/>
                </svg>
                <span className={styles.addOrImportItemText}>Google Calendar</span>
                <span className={styles.addOrImportTeamBadge}>
                  <svg
                    className={styles.addOrImportBadgeIcon}
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                  </svg>
                  Team
                </span>
              </li>
              {/* Item 4: Google Sheets */}
              <li className={styles.addOrImportMenuItem}>
                <svg
                  className={styles.addOrImportItemIconGoogleSheets}
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M12.333 15H3.66699C3.40178 15 3.14742 14.8946 2.95989 14.7071C2.77235 14.5196 2.66699 14.2652 2.66699 14V2C2.66699 1.73478 2.77235 1.48043 2.95989 1.29289C3.14742 1.10536 3.40178 1 3.66699 1H9.99999L13.333 4.333V14C13.333 14.2652 13.2276 14.5196 13.0401 14.7071C12.8526 14.8946 12.5982 15 12.333 15Z" fill="#43A047"/>
                  <path d="M13.333 4.333H10V1L13.333 4.333Z" fill="#C8E6C9"/>
                  <path d="M10 4.3335L13.333 7.6675V4.3335H10Z" fill="#2E7D32"/>
                  <path d="M10.333 7.66699H5V12.333H11V7.66699H10.333ZM5.667 8.33299H7V8.99999H5.667V8.33299ZM5.667 9.66699H7V10.333H5.667V9.66699ZM5.667 11H7V11.667H5.667V11ZM10.333 11.667H7.667V11H10.333V11.667ZM10.333 10.333H7.667V9.66699H10.333V10.333ZM10.333 8.99999H7.667V8.33299H10.333V8.99999Z" fill="#E8F5E9"/>
                </svg>
                <span className={styles.addOrImportItemText}>Google Sheets</span>
              </li>

              {/* Item 5: Microsoft Excel */}
              <li className={styles.addOrImportMenuItem}>
                <svg
                  className={styles.addOrImportItemIconExcel}
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect x="4.5" y="2.125" width="10.5" height="12.25" rx="0.875" fill="#2FB776"/>
                  <path d="M4.5 11.3125H15V13.5C15 13.9832 14.6082 14.375 14.125 14.375H5.375C4.89175 14.375 4.5 13.9832 4.5 13.5V11.3125Z" fill="url(#paint0_linear_excel)"/>
                  <rect x="9.75" y="8.25" width="5.25" height="3.0625" fill="#229C5B"/>
                  <rect x="9.75" y="5.1875" width="5.25" height="3.0625" fill="#27AE68"/>
                  <path d="M4.5 3C4.5 2.51675 4.89175 2.125 5.375 2.125H9.75V5.1875H4.5V3Z" fill="#1D854F"/>
                  <rect x="4.5" y="5.1875" width="5.25" height="3.0625" fill="#197B43"/>
                  <rect x="4.5" y="8.25" width="5.25" height="3.0625" fill="#1B5B38"/>
                  <path d="M4.5 6.5C4.5 5.77513 5.08763 5.1875 5.8125 5.1875H8.4375C9.16237 5.1875 9.75 5.77513 9.75 6.5V11.75C9.75 12.4749 9.16237 13.0625 8.4375 13.0625H4.5V6.5Z" fill="black" fillOpacity="0.3"/>
                  <rect x="1" y="4.3125" width="7.875" height="7.875" rx="0.875" fill="url(#paint1_linear_excel)"/>
                  <path d="M6.6875 10.4375L5.45468 8.20625L6.63338 6.0625H5.67118L4.94351 7.43125L4.22788 6.0625H3.23561L4.42032 8.20625L3.1875 10.4375H4.1497L4.92547 8.9875L5.69523 10.4375H6.6875Z" fill="white"/>
                  <defs>
                    <linearGradient id="paint0_linear_excel" x1="4.5" y1="12.8437" x2="15" y2="12.8438" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#163C27"/>
                      <stop offset="1" stopColor="#2A6043"/>
                    </linearGradient>
                    <linearGradient id="paint1_linear_excel" x1="1" y1="8.25" x2="8.875" y2="8.25" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#185A30"/>
                      <stop offset="1" stopColor="#176F3D"/>
                    </linearGradient>
                  </defs>
                </svg>
                <span className={styles.addOrImportItemText}>Microsoft Excel</span>
              </li>

              {/* Item 6: Salesforce */}
              <li className={styles.addOrImportMenuItem}>
                <svg
                  className={styles.addOrImportItemIconSalesforce}
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path fillRule="evenodd" clipRule="evenodd" d="M6.6174 3.64849C7.13009 3.1144 7.84436 2.78275 8.63392 2.78275C9.68349 2.78275 10.5995 3.36814 11.0871 4.23718C11.5235 4.04228 11.9961 3.94183 12.4739 3.9424C14.3671 3.9424 15.9017 5.49057 15.9017 7.40066C15.9017 9.31075 14.3671 10.8589 12.4739 10.8589C12.2424 10.8589 12.0167 10.8358 11.7984 10.7918C11.3691 11.5575 10.5503 12.0751 9.61096 12.0751C9.21775 12.0751 8.84575 11.9847 8.51479 11.8227C8.07931 12.8471 7.06488 13.565 5.88279 13.565C4.65183 13.565 3.60244 12.7859 3.19983 11.6935C3.02045 11.7314 2.8376 11.7504 2.65427 11.7504C1.18836 11.7506 7.37231e-06 10.5499 7.37231e-06 9.06866C-0.00109238 8.59925 0.120866 8.13775 0.353723 7.73016C0.586581 7.32258 0.922205 6.98314 1.32714 6.7457C1.15915 6.35861 1.07271 5.94106 1.07322 5.51909C1.07322 3.81544 2.45601 2.43457 4.16175 2.43457C4.63692 2.43402 5.1058 2.54329 5.53177 2.75387C5.95775 2.96444 6.32929 3.27061 6.6174 3.64849Z" fill="#00A1E0"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M2.30333 8.20671L2.36768 8.0281C2.37794 7.9975 2.40107 8.00758 2.41046 8.01332C2.42838 8.02393 2.44125 8.0335 2.46438 8.04706C2.65394 8.16689 2.82959 8.1681 2.88438 8.1681C3.02629 8.1681 3.11429 8.09297 3.11429 7.99158V7.98637C3.11429 7.87611 2.97864 7.83437 2.82194 7.78637L2.78716 7.77524C2.57203 7.71402 2.34194 7.6255 2.34194 7.35315V7.34758C2.34194 7.08915 2.55046 6.9088 2.8489 6.9088L2.88159 6.90845C3.0569 6.90845 3.22629 6.95941 3.34907 7.03384C3.3602 7.0408 3.37099 7.05367 3.36472 7.07071L3.29864 7.24932C3.28699 7.27976 3.25516 7.25958 3.25516 7.25958C3.12706 7.19283 2.98531 7.15647 2.8409 7.15332C2.71429 7.15332 2.6329 7.22045 2.6329 7.31158V7.31732C2.6329 7.42358 2.77238 7.46897 2.93412 7.52167L2.96194 7.53037C3.17638 7.59819 3.40525 7.69211 3.40525 7.95037V7.95576C3.40525 8.23489 3.20246 8.40828 2.87638 8.40828C2.7162 8.40828 2.56299 8.38358 2.4009 8.2975C2.37029 8.27976 2.34003 8.26445 2.31012 8.24271C2.30699 8.23819 2.29325 8.2328 2.30316 8.20671H2.30333ZM7.07846 8.20671L7.14299 8.0281C7.15238 7.99889 7.17968 8.00967 7.18559 8.01332C7.20333 8.02428 7.21655 8.0335 7.23951 8.04706C7.42942 8.16689 7.60472 8.1681 7.66003 8.1681C7.80142 8.1681 7.8896 8.09297 7.8896 7.99158V7.98637C7.8896 7.87611 7.75412 7.83437 7.59742 7.78637L7.56264 7.77524C7.34716 7.71402 7.11707 7.6255 7.11707 7.35315V7.34758C7.11707 7.08915 7.32577 6.9088 7.6242 6.9088L7.65672 6.90845C7.83203 6.90845 8.00159 6.95941 8.12455 7.03384C8.13533 7.0408 8.14629 7.05367 8.1402 7.07071C8.13412 7.08654 8.07985 7.23263 8.07412 7.24932C8.06212 7.27976 8.03064 7.25958 8.03064 7.25958C7.90249 7.19281 7.76067 7.15645 7.6162 7.15332C7.48959 7.15332 7.4082 7.22045 7.4082 7.31158V7.31732C7.4082 7.42358 7.54751 7.46897 7.70942 7.52167L7.73725 7.53037C7.95168 7.59819 8.18038 7.69211 8.18038 7.95037V7.95576C8.18038 8.23489 7.97777 8.40828 7.65168 8.40828C7.49133 8.40828 7.33812 8.38358 7.1762 8.2975C7.14559 8.27976 7.11533 8.26445 7.08525 8.24271C7.08212 8.23819 7.06838 8.2328 7.07846 8.20671ZM10.6106 7.36689C10.6374 7.45663 10.6506 7.55524 10.6506 7.65941C10.6506 7.76376 10.6374 7.86202 10.6106 7.95176C10.5861 8.03829 10.5441 8.11886 10.4872 8.18845C10.4301 8.25604 10.3585 8.3099 10.2778 8.34602C10.1943 8.38428 10.0962 8.40341 9.98594 8.40341C9.87568 8.40341 9.77725 8.38428 9.69412 8.34602C9.61336 8.3099 9.54179 8.25604 9.48472 8.18845C9.42782 8.11886 9.38574 8.03837 9.36107 7.95193C9.33373 7.85686 9.32026 7.75833 9.32107 7.65941C9.32107 7.55506 9.33446 7.45663 9.36107 7.36689C9.38786 7.27645 9.42942 7.1968 9.48455 7.13037C9.54176 7.0625 9.61334 7.0082 9.69412 6.97141C9.77742 6.93245 9.87533 6.9128 9.98594 6.9128C10.0966 6.9128 10.1945 6.93245 10.2778 6.97141C10.3609 7.01019 10.4315 7.06358 10.4872 7.13037C10.5425 7.1968 10.5842 7.27645 10.6106 7.36689ZM10.3386 7.65941C10.3386 7.50167 10.3094 7.37767 10.2513 7.29071C10.1939 7.20445 10.107 7.16271 9.98594 7.16271C9.8649 7.16271 9.77864 7.20445 9.72194 7.29071C9.66507 7.37767 9.63603 7.50167 9.63603 7.65941C9.63603 7.81697 9.66507 7.94184 9.72229 8.0295C9.77864 8.1168 9.8649 8.15906 9.98594 8.15906C10.107 8.15906 10.1939 8.11663 10.2513 8.0295C10.3091 7.94184 10.3386 7.81697 10.3386 7.65941ZM12.8468 8.1168L12.9136 8.3015C12.9223 8.32411 12.9026 8.33402 12.9026 8.33402C12.7995 8.37402 12.6564 8.40254 12.5171 8.40254C12.2809 8.40254 12.1 8.33454 11.9793 8.20028C11.8593 8.06637 11.7981 7.88428 11.7981 7.65837C11.7981 7.55384 11.8132 7.45489 11.8428 7.36532C11.8724 7.27489 11.9167 7.19524 11.9752 7.1288C12.0358 7.0605 12.1107 7.00626 12.1945 6.96984C12.2814 6.93106 12.3837 6.91158 12.4978 6.91158C12.5748 6.91158 12.6433 6.91628 12.7021 6.92497C12.7649 6.93471 12.8486 6.95732 12.8839 6.97106C12.8903 6.9735 12.9082 6.98219 12.9009 7.00324C12.8752 7.07576 12.8576 7.12306 12.8338 7.18915C12.8233 7.21732 12.8021 7.20793 12.8021 7.20793C12.7126 7.17976 12.6266 7.16689 12.5145 7.16689C12.3797 7.16689 12.2785 7.21176 12.2124 7.29958C12.1456 7.38811 12.1082 7.50411 12.1077 7.65837C12.1072 7.82758 12.1496 7.95297 12.2247 8.03054C12.2997 8.10793 12.4044 8.14706 12.5362 8.14706C12.5896 8.14706 12.64 8.14358 12.6854 8.13645C12.7303 8.12932 12.7724 8.11541 12.812 8.09993C12.812 8.09993 12.8376 8.09037 12.8468 8.1168ZM14.2399 7.31558C14.2992 7.52324 14.2682 7.70254 14.2672 7.71245C14.2649 7.73611 14.2406 7.73645 14.2406 7.73645L13.319 7.73576C13.3247 7.87576 13.3583 7.97489 13.4261 8.04219C13.4927 8.10811 13.5985 8.15037 13.7416 8.15054C13.9604 8.15106 14.0538 8.10706 14.12 8.08254C14.12 8.08254 14.1452 8.0735 14.1548 8.09854L14.2148 8.26741C14.227 8.29576 14.2172 8.30567 14.207 8.31141C14.1492 8.34324 14.0092 8.40271 13.7428 8.40341C13.6136 8.40393 13.5011 8.3855 13.4084 8.3495C13.3203 8.31687 13.241 8.26431 13.1766 8.19593C13.115 8.12884 13.0693 8.04878 13.0428 7.96167C13.0143 7.86622 13.0003 7.76703 13.0012 7.66741C13.0012 7.56306 13.0146 7.46393 13.0416 7.37332C13.0686 7.28202 13.1105 7.2015 13.1663 7.13384C13.2241 7.0648 13.2967 7.00954 13.3786 6.97211C13.4632 6.93228 13.5679 6.9128 13.683 6.9128C13.7816 6.9128 13.8717 6.93402 13.9466 6.96637C14.0044 6.99106 14.0625 7.03576 14.1219 7.09976C14.1595 7.14011 14.2167 7.22845 14.2399 7.31558ZM13.3233 7.50811H13.9807C13.9739 7.42358 13.9574 7.34776 13.9195 7.29071C13.8618 7.20445 13.7821 7.15697 13.6612 7.15697C13.5402 7.15697 13.4543 7.20445 13.3974 7.29071C13.3602 7.34776 13.3362 7.42045 13.3232 7.50811H13.3233ZM6.85812 7.31558C6.91725 7.52324 6.88681 7.70254 6.88577 7.71245C6.88333 7.73611 6.85899 7.73645 6.85899 7.73645L5.93725 7.73576C5.94316 7.87576 5.97655 7.97489 6.04455 8.04219C6.11116 8.10811 6.21672 8.15037 6.35986 8.15054C6.57864 8.15106 6.67238 8.10706 6.73846 8.08254C6.73846 8.08254 6.76368 8.0735 6.77307 8.09854L6.83325 8.26741C6.84542 8.29576 6.83568 8.30567 6.82559 8.31141C6.76751 8.34324 6.62733 8.40271 6.36125 8.40341C6.23186 8.40393 6.11933 8.3855 6.02681 8.3495C5.9387 8.31683 5.85931 8.26428 5.79481 8.19593C5.73343 8.12877 5.68785 8.04873 5.66142 7.96167C5.63269 7.86626 5.61856 7.76705 5.61951 7.66741C5.61951 7.56306 5.63307 7.46393 5.65986 7.37332C5.68491 7.2859 5.72739 7.20444 5.78473 7.13384C5.84257 7.06485 5.91505 7.0096 5.9969 6.97211C6.08177 6.93228 6.18646 6.9128 6.30125 6.9128C6.39197 6.91259 6.48178 6.93081 6.56525 6.96637C6.62299 6.99106 6.68107 7.03576 6.74038 7.09976C6.77794 7.14011 6.83516 7.22845 6.85812 7.31558ZM5.94142 7.50811H6.59916C6.5922 7.42358 6.57568 7.34776 6.53794 7.29071C6.48055 7.20445 6.40055 7.15697 6.27968 7.15697C6.15864 7.15697 6.07255 7.20445 6.01603 7.29071C5.97846 7.34776 5.95464 7.42045 5.94125 7.50811H5.94142ZM4.31603 7.46411C4.31603 7.46411 4.38872 7.47054 4.46803 7.48202V7.44306C4.46803 7.32011 4.44246 7.26219 4.3922 7.22341C4.34072 7.1841 4.26386 7.16376 4.16438 7.16376C4.16438 7.16376 3.94003 7.16097 3.76264 7.25732C3.75446 7.26219 3.74768 7.26497 3.74768 7.26497C3.74768 7.26497 3.72542 7.2728 3.71742 7.25002L3.6522 7.07471C3.64212 7.0495 3.66038 7.03802 3.66038 7.03802C3.74333 6.97332 3.94438 6.93419 3.94438 6.93419C4.02599 6.91985 4.10865 6.91223 4.19151 6.91141C4.37551 6.91141 4.51794 6.95419 4.61481 7.03889C4.71186 7.12393 4.76125 7.26097 4.76125 7.44567L4.76177 8.2888C4.76177 8.2888 4.76368 8.31315 4.74055 8.31871C4.74055 8.31871 4.70664 8.32811 4.6762 8.33524C4.64542 8.34237 4.53446 8.36497 4.44386 8.38028C4.35133 8.39578 4.25767 8.40358 4.16386 8.40358C4.07429 8.40358 3.9922 8.39524 3.91986 8.37871C3.85243 8.36459 3.78859 8.3369 3.7322 8.29732C3.68082 8.26001 3.63957 8.21045 3.6122 8.15315C3.58386 8.09524 3.56959 8.02445 3.56959 7.94271C3.56959 7.86254 3.58646 7.79106 3.61899 7.73019C3.65168 7.66967 3.69655 7.61837 3.7529 7.57819C3.81111 7.53721 3.8762 7.50699 3.94507 7.48897C4.0169 7.46984 4.09325 7.45993 4.1722 7.45993C4.23012 7.45993 4.27846 7.46115 4.31603 7.46411ZM3.94925 8.11176C3.94872 8.11158 4.03185 8.17697 4.21951 8.1655C4.35133 8.1575 4.4682 8.13245 4.4682 8.13245V7.71332C4.4682 7.71332 4.35029 7.69402 4.21794 7.69211C4.03029 7.68984 3.95029 7.75889 3.95081 7.75871C3.89551 7.79802 3.86855 7.85628 3.86855 7.93697C3.86855 7.98863 3.87777 8.02898 3.89638 8.05715C3.90803 8.07576 3.91307 8.08271 3.94925 8.11176ZM11.7501 6.98915C11.7414 7.01437 11.6967 7.14063 11.6806 7.18254C11.6746 7.19854 11.6649 7.2095 11.647 7.20758C11.647 7.20758 11.5941 7.19541 11.5458 7.19541C11.5126 7.19541 11.4651 7.19958 11.4223 7.2128C11.3794 7.22599 11.3403 7.24945 11.3086 7.28115C11.2748 7.31367 11.2475 7.35941 11.2277 7.4168C11.2075 7.47454 11.1971 7.56637 11.1971 7.65854V8.34515C11.1971 8.34882 11.1964 8.35245 11.195 8.35585C11.1936 8.35925 11.1916 8.36233 11.189 8.36494C11.1864 8.36754 11.1833 8.36961 11.1799 8.37101C11.1765 8.37242 11.1729 8.37315 11.1692 8.37315H10.9273C10.9236 8.37319 10.92 8.37251 10.9165 8.37114C10.9131 8.36976 10.91 8.36773 10.9073 8.36514C10.9047 8.36256 10.9025 8.35948 10.9011 8.35608C10.8996 8.35268 10.8989 8.34902 10.8988 8.34532V6.97054C10.8988 6.95506 10.9101 6.94271 10.9256 6.94271H11.1616C11.1772 6.94271 11.1884 6.95506 11.1884 6.97054V7.08289C11.2237 7.03558 11.287 6.99384 11.3442 6.96811C11.4016 6.94202 11.4658 6.92289 11.5818 6.92984C11.6421 6.9335 11.7206 6.95002 11.7364 6.95611C11.7395 6.95734 11.7423 6.95919 11.7447 6.96153C11.747 6.96387 11.7489 6.96666 11.7502 6.96974C11.7515 6.97282 11.7521 6.97612 11.7521 6.97945C11.7521 6.98278 11.7514 6.98608 11.7501 6.98915ZM9.47707 6.3521C9.48351 6.35471 9.50107 6.36324 9.49412 6.3841L9.42333 6.57767C9.41742 6.59228 9.41359 6.60097 9.38351 6.59193C9.34372 6.57942 9.30226 6.57297 9.26055 6.5728C9.22403 6.5728 9.19099 6.5775 9.16177 6.58724C9.13253 6.5966 9.10603 6.61295 9.08455 6.63489C9.05597 6.66251 9.03387 6.69613 9.01986 6.73332C8.98594 6.83071 8.9729 6.93454 8.97116 6.94115H9.26577C9.29064 6.94115 9.29846 6.95263 9.29603 6.97089L9.26159 7.16254C9.25603 7.19037 9.23081 7.18932 9.23081 7.18932H8.92716L8.71968 8.36428C8.70184 8.46965 8.67472 8.57325 8.63864 8.67384C8.60612 8.75889 8.57255 8.82097 8.51864 8.88028C8.47262 8.93335 8.41411 8.97412 8.34838 8.99889C8.28455 9.02237 8.20699 9.03437 8.12229 9.03437C8.08194 9.03437 8.03846 9.0335 7.98716 9.02132C7.95857 9.01479 7.93041 9.00655 7.90281 8.99663C7.89151 8.99263 7.88229 8.97819 7.8889 8.95976C7.89516 8.9415 7.94977 8.79211 7.95707 8.77245C7.96646 8.7488 7.99046 8.75784 7.99046 8.75784C8.00681 8.7648 8.01829 8.76932 8.04003 8.77367C8.06212 8.77802 8.09168 8.78184 8.11412 8.78184C8.15429 8.78184 8.19081 8.77698 8.22264 8.76619C8.2609 8.75384 8.28351 8.73141 8.30681 8.7015C8.33116 8.67002 8.35099 8.62741 8.37133 8.57019C8.39168 8.51228 8.41029 8.43576 8.42629 8.34306L8.6329 7.1895H8.42942C8.40507 7.1895 8.39673 7.17802 8.39951 7.15958L8.43359 6.96793C8.43899 6.9401 8.4649 6.94115 8.4649 6.94115H8.67377L8.68507 6.87889C8.71638 6.69384 8.77846 6.55315 8.87029 6.4608C8.96264 6.36776 9.09394 6.3208 9.26055 6.3208C9.3082 6.3208 9.35029 6.32393 9.38594 6.33037C9.4209 6.33697 9.44751 6.34306 9.47707 6.3521ZM5.35951 8.34515C5.35951 8.3608 5.34873 8.37315 5.33307 8.37315H5.08872C5.07307 8.37315 5.06246 8.36063 5.06246 8.34532V6.37784C5.06246 6.36271 5.07325 6.35019 5.08855 6.35019H5.33307C5.34873 6.35019 5.35951 6.36271 5.35951 6.37802V8.34515Z" fill="white"/>
                </svg>
                <span className={styles.addOrImportItemText}>Salesforce</span>
                <span className={styles.addOrImportBusinessBadge}>
                  <svg
                    className={styles.addOrImportBadgeIcon}
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                  </svg>
                  Business
                </span>
              </li>
              {/* Item 7: Smartsheet */}
              <li className={styles.addOrImportMenuItem}>
                <svg
                  className={styles.addOrImportItemIconSmartsheet}
                  width="16"
                  height="16"
                  viewBox="0 0 165 165"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M19 76.7c0 40.1-.5 75.7-1 79.3-.5 3.5-.7 6.6-.5 6.9 1 .9 26.5-5 39-9 21.4-6.8 43.7-17.7 55.5-27 2.7-2.1 5.3-3.9 5.7-3.9.4 0 2.4 3 4.3 6.8 4.5 8.6 11.9 16.5 15.1 16 5.4-.7 5.4-1 5.6-68.8l.3-62.5-2.6 3c-4 4.7-18.5 26.9-25.4 39-7.2 12.5-24.9 48.3-30.9 62.5-2.3 5.4-4.2 8.8-4.5 8-.3-.8-2-5.6-3.7-10.5C67 90.6 52.8 69 44.8 69c-3 0-.5-3.5 4.6-6.5 4.8-2.8 9.4-3.2 13.5-1.1 3.7 2 10.2 9.2 13.6 15.2 1.6 2.7 3.7 6.4 4.8 8.2l2 3.4 6.6-12.9c10.8-20.9 25.3-41.1 42.6-59.3 4.4-4.7 8.7-9.3 9.4-10.3 1.3-1.6-1.8-1.7-60.8-1.7H19v72.7z"/>
                </svg>
                <span className={styles.addOrImportItemText}>Smartsheet</span>
              </li>

              {/* Item 8: 26 more sources... */}
              <li className={styles.addOrImportMenuItem}>
                <svg
                  className={styles.addOrImportItemIconBookOpen}
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path fillRule="nonzero" d="M2 3C1.45364 3 1 3.45364 1 4V12C1 12.5464 1.45364 13 2 13H6C6.398 13 6.77926 13.1579 7.06067 13.4393C7.34212 13.7207 7.50001 14.102 7.5 14.5C7.50186 14.6314 7.55535 14.7568 7.64892 14.849C7.74249 14.9413 7.8686 14.993 8 14.993C8.1314 14.993 8.25751 14.9413 8.35108 14.849C8.44465 14.7568 8.49814 14.6314 8.5 14.5V5.5C8.50013 4.12514 7.37486 2.99987 6 3H2ZM2 4H6C6.83436 3.99992 7.50008 4.66564 7.5 5.5V12.5127C7.06877 12.1874 6.54629 12 6 12H2V4Z M10 3C8.62514 2.99987 7.49987 4.12514 7.5 5.5C7.5 5.63261 7.55268 5.75979 7.64645 5.85355C7.74021 5.94732 7.86739 6 8 6C8.13261 6 8.25979 5.94732 8.35355 5.85355C8.44732 5.75979 8.5 5.63261 8.5 5.5C8.49994 4.66564 9.16564 3.99992 10 4H14V12H10C9.33719 12 8.70097 12.2635 8.2323 12.7322C7.76355 13.2009 7.49998 13.8371 7.5 14.5C7.5 14.6326 7.55268 14.7598 7.64645 14.8536C7.74021 14.9473 7.86739 15 8 15C8.13261 15 8.25979 14.9473 8.35355 14.8536C8.44732 14.7598 8.5 14.6326 8.5 14.5C8.49999 14.102 8.65788 13.7207 8.93933 13.4393C9.22074 13.1579 9.602 13 10 13H14C14.5464 13 15 12.5464 15 12V4C15 3.45364 14.5464 3 14 3H10Z" />
                </svg>
                <span className={styles.addOrImportItemText}>26 more sources...</span>
                <svg
                  className={styles.addOrImportItemChevronRight}
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path fillRule="nonzero" d="M5.64645 12.3536C5.45118 12.1583 5.45118 11.8417 5.64645 11.6464L9.29289 8L5.64645 4.35355C5.45118 4.15829 5.45118 3.84171 5.64645 3.64645C5.84171 3.45118 6.15829 3.45118 6.35355 3.64645L10.3536 7.64645C10.5488 7.84171 10.5488 8.15829 10.3536 8.35355L6.35355 12.3536C6.15829 12.5488 5.84171 12.5488 5.64645 12.3536Z" />
                </svg>
              </li>
            </ul>
          )}
        </div>
      </div>
      <div className={styles.tableToolbarSpacer} />
      <button className={styles.tableToolbarRightButton}>
        <span className={styles.tableToolbarRightButtonText}>Tools</span>
        <svg 
          className={styles.tableToolbarRightButtonIcon}
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
  );
}
