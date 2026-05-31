import React from "react";
import styles from "./TableToolbar.module.css";
import {
  IconMagnifyingGlass,
  IconCheck,
  IconEyeSlash,
  IconDotsSixVertical,
} from "./GridIcons";
import { getBaseToolbarColor } from "~/components/bases/useBases";
import { useGridTableState } from "~/components/grid/hooks/useGridTableState";
import { TableTab } from "./TableTab";
import { TableRenamePopup } from "./TableRenamePopup";
import { AddOrImportDropdown } from "./AddOrImportDropdown";

export function TableToolbar() {
  const {
    baseId,
    hasOverflow,
    scrollProgress,
    scrollToEnd,
    tabsScrollRef,
    tables,
    activeTableId,
    navigateToTable,
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
  } = useGridTableState();

  return (
    <div
      className={styles.tableToolbar}
      style={{ backgroundColor: getBaseToolbarColor(baseId) }}
    >
      <div className={styles.tableToolbarInner}>
        {hasOverflow && scrollProgress > 0 && (
          <div
            className={styles.scrollIndicatorLeft}
            style={{ width: `${Math.min(scrollProgress * 3, 1) * 40}px` }}
          >
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
            <div className={styles.scrollIndicatorShadowRight} />
          </div>
        )}

        <div className={styles.tableTabsScrollable} ref={tabsScrollRef}>
          {tables.map((table) => (
            <TableTab
              key={table.id}
              table={table}
              isActive={table.id === activeTableId}
              setActiveTableId={navigateToTable}
              isTableTitleDropdownOpen={isTableTitleDropdownOpen}
              setIsTableTitleDropdownOpen={setIsTableTitleDropdownOpen}
              tableTitleDropdownPosition={tableTitleDropdownPosition}
              setTableTitleDropdownPosition={setTableTitleDropdownPosition}
              tableTitleDropdownButtonRef={tableTitleDropdownButtonRef}
              tableTitleDropdownRef={tableTitleDropdownRef}
              handleOpenRenamePopup={handleOpenRenamePopup}
              handleOpenClearDataModal={handleOpenClearDataModal}
              handleOpenDeleteTablePopup={handleOpenDeleteTablePopup}
              tablesCount={tables.length}
            />
          ))}
        </div>

        {isRenamePopupOpen && renamePopupPosition && (
          <TableRenamePopup
            popupRef={renamePopupRef}
            position={renamePopupPosition}
            inputRef={renameInputRef}
            renameTableName={renameTableName}
            setRenameTableName={setRenameTableName}
            renameRecordName={renameRecordName}
            showDuplicateTooltip={showDuplicateTooltip}
            handleSaveRename={handleSaveRename}
            handleCancelRename={handleCancelRename}
          />
        )}

        {hasOverflow && scrollProgress < 1 && (
          <div
            className={styles.scrollIndicatorRight}
            style={{ width: `${Math.min((1 - scrollProgress) * 3, 1) * 40}px` }}
          >
            <div className={styles.scrollIndicatorShadowLeft} />
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

          {isTableDropdownOpen && (
            <div ref={tableDropdownRef} className={`${styles.tableDropdown} ${tableDropdownAlignRight ? styles.tableDropdownAlignRight : ''}`}>
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

          {isAddOrImportDropdownOpen && addOrImportDropdownPosition && (
            <AddOrImportDropdown
              dropdownRef={addOrImportDropdownRef}
              position={addOrImportDropdownPosition}
              handleAddTable={handleAddTable}
              onClose={() => setIsAddOrImportDropdownOpen(false)}
            />
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
