import React from "react";
import { createPortal } from "react-dom";
import styles from "./FilterPanel.module.css";
import type { SubDropdown, FilterColumn } from "../utils/filterPanelTypes";
import type { FilterTreeItem } from "~/components/grid/utils/filterTree";
import { isGroup } from "~/components/grid/utils/filterTree";
import type { FilterOperatorOption } from "~/components/grid/utils/filterOperators";
import {
  MagnifyingGlassIcon,
  TextTypeIcon,
  NumberTypeIcon,
  ChevronDownIcon,
} from "./FilterIcons";

export interface FilterDropdownsProps {
  openDropdown: SubDropdown;
  dropdownPos: { top: number; left: number };
  subSearchQuery: string;
  setSubSearchQuery: (v: string) => void;
  isSubSearchFocused: boolean;
  setIsSubSearchFocused: (v: boolean) => void;
  filteredColumns: FilterColumn[];
  filteredOperators: FilterOperatorOption[];
  rootItems: FilterTreeItem[];
  onUpdateConjunction: (conditionId: string, conjunction: "and" | "or") => void;
  onUpdateField: (conditionId: string, columnId: string, columnType: string) => void;
  onUpdateOperator: (conditionId: string, operator: string) => void;
  onAddConditionToGroup: (groupId: string) => void;
  onAddNestedGroupToGroup: (groupId: string) => void;
  onSetGroupConjunction: (groupId: string, conjunction: "and" | "or") => void;
  onClose: () => void;
}

export function FilterDropdowns({
  openDropdown,
  dropdownPos,
  subSearchQuery,
  setSubSearchQuery,
  isSubSearchFocused,
  setIsSubSearchFocused,
  filteredColumns,
  filteredOperators,
  rootItems,
  onUpdateConjunction,
  onUpdateField,
  onUpdateOperator,
  onAddConditionToGroup,
  onAddNestedGroupToGroup,
  onSetGroupConjunction,
  onClose,
}: FilterDropdownsProps) {
  const portalStyle = {
    position: "fixed" as const,
    top: dropdownPos.top,
    left: dropdownPos.left,
    zIndex: 10004,
  };

  const searchContainerCls = `${styles.filterSubSearchContainer}${
    isSubSearchFocused ? ` ${styles.filterSubSearchContainerFocused}` : ""
  }`;

  return (
    <>
      {/* Root conjunction dropdown (and / or) */}
      {openDropdown?.kind === "conjunction" &&
        createPortal(
          <div
            data-filter-subdropdown
            className={`${styles.filterSubDropdown} ${styles.filterConjunctionDropdown}`}
            style={portalStyle}
          >
            <div
              className={styles.filterConjunctionItem}
              onClick={() => onUpdateConjunction(openDropdown.conditionId, "and")}
            >
              and
            </div>
            <div
              className={styles.filterConjunctionItem}
              onClick={() => onUpdateConjunction(openDropdown.conditionId, "or")}
            >
              or
            </div>
          </div>,
          document.body,
        )}

      {/* Field picker dropdown (FilterFieldDropdown) */}
      {openDropdown?.kind === "field" &&
        createPortal(
          <div
            data-filter-subdropdown
            className={`${styles.filterSubDropdown} ${styles.filterFieldDropdown}`}
            style={portalStyle}
          >
            <div className={searchContainerCls}>
              <MagnifyingGlassIcon className={styles.filterSearchIcon} />
              <input
                className={styles.filterSubSearchInput}
                type="text"
                placeholder="Find a field"
                value={subSearchQuery}
                onChange={(e) => setSubSearchQuery(e.target.value)}
                onFocus={() => setIsSubSearchFocused(true)}
                onBlur={() => setIsSubSearchFocused(false)}
                autoFocus
              />
            </div>
            <div className={styles.filterSubItemList}>
              {filteredColumns.map((col) => (
                <div
                  key={col.id}
                  className={styles.filterFieldItem}
                  onClick={() => onUpdateField(openDropdown.conditionId, col.id, col.type)}
                >
                  <span className={styles.filterFieldTypeIcon}>
                    {col.type === "NUMBER" ? <NumberTypeIcon /> : <TextTypeIcon />}
                  </span>
                  <span className={styles.filterFieldName}>{col.name}</span>
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}

      {/* Operator dropdown */}
      {openDropdown?.kind === "operator" &&
        createPortal(
          <div
            data-filter-subdropdown
            className={`${styles.filterSubDropdown} ${styles.filterOperatorDropdown}`}
            style={portalStyle}
          >
            <div className={searchContainerCls}>
              <MagnifyingGlassIcon className={styles.filterSearchIcon} />
              <input
                className={styles.filterSubSearchInput}
                type="text"
                placeholder="Find an operator"
                value={subSearchQuery}
                onChange={(e) => setSubSearchQuery(e.target.value)}
                onFocus={() => setIsSubSearchFocused(true)}
                onBlur={() => setIsSubSearchFocused(false)}
                autoFocus
              />
            </div>
            <div className={styles.filterSubItemList}>
              {filteredOperators.map((op) => (
                <div
                  key={op.value}
                  className={styles.filterOperatorItem}
                  onClick={() => onUpdateOperator(openDropdown.conditionId, op.value)}
                >
                  {op.label}
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}

      {/* Group + button dropdown (Add condition / Add group) */}
      {openDropdown?.kind === "groupPlus" &&
        createPortal(
          <div
            data-filter-subdropdown
            className={styles.filterGroupPlusMenu}
            style={portalStyle}
          >
            <div
              className={styles.filterGroupPlusMenuItem}
              onClick={() => { onAddConditionToGroup(openDropdown.groupId); onClose(); }}
            >
              <span className={styles.filterGroupPlusMenuItemText}>Add condition</span>
            </div>
            {(() => {
              const isNestedGroup = rootItems.some(
                (ri) =>
                  isGroup(ri) &&
                  ri.items.some((child) => isGroup(child) && child.id === openDropdown.groupId),
              );
              if (isNestedGroup) return null;
              return (
                <div
                  className={styles.filterGroupPlusMenuItem}
                  onClick={() => { onAddNestedGroupToGroup(openDropdown.groupId); onClose(); }}
                >
                  <span className={styles.filterGroupPlusMenuItemText}>Add condition group</span>
                </div>
              );
            })()}
          </div>,
          document.body,
        )}

      {/* Group conjunction dropdown (and / or within a group) */}
      {openDropdown?.kind === "groupConjunction" &&
        createPortal(
          <div
            data-filter-subdropdown
            className={`${styles.filterSubDropdown} ${styles.filterConjunctionDropdown}`}
            style={portalStyle}
          >
            <div
              className={styles.filterConjunctionItem}
              onClick={() => { onSetGroupConjunction(openDropdown.groupId, "and"); onClose(); }}
            >
              and
            </div>
            <div
              className={styles.filterConjunctionItem}
              onClick={() => { onSetGroupConjunction(openDropdown.groupId, "or"); onClose(); }}
            >
              or
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
