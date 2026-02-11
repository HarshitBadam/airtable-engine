"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./SortPanel.module.css";

export interface SortFieldColumn {
  id: string;
  name: string;
  type: string; // "TEXT" | "NUMBER"
}

export interface ActiveSort {
  columnId: string;
  direction: "asc" | "desc";
  type: "TEXT" | "NUMBER";
}

interface SortPanelProps {
  columns: SortFieldColumn[];
  currentSorts: ActiveSort[];
  autoSort: boolean;
  onPickSort: (columnId: string, columnType: "TEXT" | "NUMBER") => void;
  onAddSort: (columnId: string, columnType: "TEXT" | "NUMBER") => void;
  onChangeSortField: (index: number, columnId: string, columnType: "TEXT" | "NUMBER") => void;
  onChangeDirection: (index: number, direction: "asc" | "desc") => void;
  onRemoveSort: (index: number) => void;
  onToggleAutoSort: () => void;
  onSaveSorts: () => void;
  onCancelSorts: () => void;
}

// -------------------------------------------------
// Direction label helpers
// -------------------------------------------------
function getDirectionLabel(type: "TEXT" | "NUMBER", direction: "asc" | "desc"): string {
  if (type === "TEXT") {
    return direction === "asc" ? "A \u2192 Z" : "Z \u2192 A";
  }
  return direction === "asc" ? "1 \u2192 9" : "9 \u2192 1";
}

// -------------------------------------------------
// SVG Icons
// -------------------------------------------------

const TextTypeIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
    <path
      fillRule="evenodd"
      d="M8.44187 3.26606C8.35522 3.10237 8.18518 3 7.99998 3C7.81477 3 7.64474 3.10237 7.55808 3.26606L3.05808 11.7661C2.92888 12.0101 3.02198 12.3127 3.26603 12.4419C3.51009 12.5711 3.81267 12.478 3.94187 12.2339L5.12455 10H10.8754L12.0581 12.2339C12.1873 12.478 12.4899 12.5711 12.7339 12.4419C12.978 12.3127 13.0711 12.0101 12.9419 11.7661L8.44187 3.26606ZM10.346 9L7.99998 4.56863L5.65396 9H10.346Z"
    />
  </svg>
);

const NumberTypeIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
    <path
      fillRule="nonzero"
      d="M6 2C5.86739 2 5.74021 2.05268 5.64645 2.14645C5.55268 2.24021 5.5 2.36739 5.5 2.5V5.5H2.5C2.36739 5.5 2.24021 5.55268 2.14645 5.64645C2.05268 5.74021 2 5.86739 2 6C2 6.13261 2.05268 6.25979 2.14645 6.35355C2.24021 6.44732 2.36739 6.5 2.5 6.5H5.5V9.5H2.5C2.36739 9.5 2.24021 9.55268 2.14645 9.64645C2.05268 9.74021 2 9.86739 2 10C2 10.1326 2.05268 10.2598 2.14645 10.3536C2.24021 10.4473 2.36739 10.5 2.5 10.5H5.5V13.5C5.5 13.6326 5.55268 13.7598 5.64645 13.8536C5.74021 13.9473 5.86739 14 6 14C6.13261 14 6.25979 13.9473 6.35355 13.8536C6.44732 13.7598 6.5 13.6326 6.5 13.5V10.5H9.5V13.5C9.5 13.6326 9.55268 13.7598 9.64645 13.8536C9.74021 13.9473 9.86739 14 10 14C10.1326 14 10.2598 13.9473 10.3536 13.8536C10.4473 13.7598 10.5 13.6326 10.5 13.5V10.5H13.5C13.6326 10.5 13.7598 10.4473 13.8536 10.3536C13.9473 10.2598 14 10.1326 14 10C14 9.86739 13.9473 9.74021 13.8536 9.64645C13.7598 9.55268 13.6326 9.5 13.5 9.5H10.5V6.5H13.5C13.6326 6.5 13.7598 6.44732 13.8536 6.35355C13.9473 6.25979 14 6.13261 14 6C14 5.86739 13.9473 5.74021 13.8536 5.64645C13.7598 5.55268 13.6326 5.5 13.5 5.5H10.5V2.5C10.5 2.36739 10.4473 2.24021 10.3536 2.14645C10.2598 2.05268 10.1326 2 10 2C9.86739 2 9.74021 2.05268 9.64645 2.14645C9.55268 2.24021 9.5 2.36739 9.5 2.5V5.5H6.5V2.5C6.5 2.36739 6.44732 2.24021 6.35355 2.14645C6.25979 2.05268 6.13261 2 6 2ZM6.5 6.5H9.5V9.5H6.5V6.5Z"
    />
  </svg>
);

const QuestionIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
    <path
      fillRule="nonzero"
      d="M8.07349 4.50134C7.75062 4.49155 7.43049 4.55078 7.13904 4.67151C6.36183 4.99344 5.75017 5.76895 5.75 6.74988C5.74997 6.88249 5.80262 7.00968 5.89636 7.10347C5.99011 7.19726 6.11727 7.24997 6.24988 7.25C6.31554 7.25002 6.38056 7.2371 6.44123 7.21199C6.5019 7.18687 6.55703 7.15006 6.60347 7.10364C6.64991 7.05722 6.68675 7.00211 6.71189 6.94145C6.73704 6.8808 6.74998 6.81578 6.75 6.75012C6.75013 6.17215 7.08092 5.77793 7.52173 5.59534C7.96254 5.41275 8.47515 5.45759 8.88391 5.86621C9.24251 6.22468 9.34907 6.75995 9.15503 7.22839C8.96099 7.69684 8.50716 8.00009 8.00012 8C7.93445 7.99999 7.86942 8.01292 7.80875 8.03804C7.74808 8.06316 7.69295 8.09999 7.6465 8.14642C7.60006 8.19285 7.56322 8.24797 7.53809 8.30864C7.51295 8.36931 7.50001 8.43433 7.5 8.5V9C7.5 9.13261 7.55268 9.25979 7.64645 9.35355C7.74021 9.44732 7.86739 9.5 8 9.5C8.13261 9.5 8.25979 9.44732 8.35355 9.35355C8.44732 9.25979 8.5 9.13261 8.5 9V8.93738C9.1999 8.77686 9.79665 8.2924 10.0789 7.61108C10.4266 6.77156 10.2336 5.80137 9.59094 5.15894C9.15735 4.7255 8.61159 4.51766 8.07349 4.50134Z M8 12C8.41419 12 8.75 11.6642 8.75 11.25C8.75 10.8358 8.41419 10.5 8 10.5C7.58581 10.5 7.25 10.8358 7.25 11.25C7.25 11.6642 7.58581 12 8 12Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z"
    />
  </svg>
);

const MagnifyingGlassIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
    <path
      fillRule="nonzero"
      d="M7.25 1.5C4.08028 1.5 1.5 4.08028 1.5 7.25C1.5 10.4197 4.08028 13 7.25 13C8.65529 13 9.94315 12.4911 10.9432 11.6503L13.6465 14.3534C13.7402 14.4471 13.8674 14.4998 14 14.4998C14.1326 14.4998 14.2598 14.4471 14.3535 14.3534C14.4473 14.2596 14.4999 14.1325 14.4999 13.9999C14.4999 13.8673 14.4473 13.7401 14.3535 13.6464L11.6504 10.9431C12.4912 9.94305 13 8.65523 13 7.25C13 4.08028 10.4197 1.5 7.25 1.5ZM7.25 2.5C9.87928 2.5 12 4.62072 12 7.25C12 8.56227 11.4715 9.74761 10.6154 10.6061C10.6132 10.607 10.611 10.6079 10.6089 10.6088C10.608 10.611 10.6071 10.6132 10.6062 10.6154C9.74772 11.4715 8.5623 12 7.25 12C4.62072 12 2.5 9.87928 2.5 7.25C2.5 4.62072 4.62072 2.5 7.25 2.5Z"
    />
  </svg>
);

const ChevronDownIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
    <path
      fillRule="nonzero"
      d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z"
    />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
    <path
      fillRule="nonzero"
      d="M3.49999 3C3.36738 3.00002 3.24022 3.05271 3.14647 3.14648C3.05272 3.24025 3.00006 3.36741 3.00006 3.5C3.00006 3.63259 3.05272 3.75975 3.14647 3.85352L12.1465 12.8535C12.2402 12.9473 12.3674 12.9999 12.5 12.9999C12.6326 12.9999 12.7597 12.9473 12.8535 12.8535C12.9472 12.7598 12.9999 12.6326 12.9999 12.5C12.9999 12.3674 12.9472 12.2402 12.8535 12.1465L3.8535 3.14648C3.75975 3.05271 3.63259 3.00002 3.49999 3Z M12.5 3C12.3674 3.00002 12.2402 3.05271 12.1465 3.14648L3.14647 12.1465C3.05272 12.2402 3.00006 12.3674 3.00006 12.5C3.00006 12.6326 3.05272 12.7598 3.14647 12.8535C3.24023 12.9473 3.3674 12.9999 3.49999 12.9999C3.63258 12.9999 3.75974 12.9473 3.8535 12.8535L12.8535 3.85352C12.9472 3.75975 12.9999 3.63259 12.9999 3.5C12.9999 3.36741 12.9472 3.24025 12.8535 3.14648C12.7597 3.05271 12.6326 3.00002 12.5 3Z"
    />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
    <path
      fillRule="nonzero"
      d="M8 2C7.86739 2 7.74021 2.05268 7.64645 2.14645C7.55268 2.24021 7.5 2.36739 7.5 2.5V7.5H2.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H7.5V13.5C7.5 13.6326 7.55268 13.7598 7.64645 13.8536C7.74021 13.9473 7.86739 14 8 14C8.13261 14 8.25979 13.9473 8.35355 13.8536C8.44732 13.7598 8.5 13.6326 8.5 13.5V8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H8.5V2.5C8.5 2.36739 8.44732 2.24021 8.35355 2.14645C8.25979 2.05268 8.13261 2 8 2Z"
    />
  </svg>
);

// ============================================
// FIELD PICKER VIEW (no active sort)
// ============================================
function FieldPicker({
  columns,
  onPickSort,
}: {
  columns: SortFieldColumn[];
  onPickSort: (columnId: string, columnType: "TEXT" | "NUMBER") => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const filteredColumns = columns.filter((col) =>
    col.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handlePickField = useCallback(
    (col: SortFieldColumn) => {
      onPickSort(col.id, col.type as "TEXT" | "NUMBER");
    },
    [onPickSort],
  );

  return (
    <div className={styles.sortPanel}>
      {/* Header: "Sort by" + ? icon */}
      <div className={styles.sortHeader}>
        <span className={styles.sortHeaderText}>Sort by</span>
        <span className={styles.sortHeaderIcon}>
          <QuestionIcon />
        </span>
      </div>

      {/* Separator line */}
      <div className={styles.sortSeparator} />

      {/* Search container */}
      <div
        className={`${styles.sortSearchContainer}${isSearchFocused ? ` ${styles.sortSearchContainerFocused}` : ""}`}
      >
        <span className={styles.sortSearchIcon}>
          <MagnifyingGlassIcon />
        </span>
        <input
          className={styles.sortSearchInput}
          type="text"
          placeholder="Find a field"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          autoFocus
        />
      </div>

      {/* Field list items */}
      {filteredColumns.map((col) => (
        <div
          key={col.id}
          className={styles.sortFieldItem}
          onClick={() => handlePickField(col)}
        >
          <span className={styles.sortFieldTypeIcon}>
            {col.type === "NUMBER" ? <NumberTypeIcon /> : <TextTypeIcon />}
          </span>
          <span className={styles.sortFieldName}>{col.name}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// ACTIVE SORT VIEW (one or more sorts applied)
// ============================================
function ActiveSortPanel({
  columns,
  currentSorts,
  autoSort,
  onAddSort,
  onChangeSortField,
  onChangeDirection,
  onRemoveSort,
  onToggleAutoSort,
  onSaveSorts,
  onCancelSorts,
}: {
  columns: SortFieldColumn[];
  currentSorts: ActiveSort[];
  autoSort: boolean;
  onAddSort: (columnId: string, columnType: "TEXT" | "NUMBER") => void;
  onChangeSortField: (index: number, columnId: string, columnType: "TEXT" | "NUMBER") => void;
  onChangeDirection: (index: number, direction: "asc" | "desc") => void;
  onRemoveSort: (index: number) => void;
  onToggleAutoSort: () => void;
  onSaveSorts: () => void;
  onCancelSorts: () => void;
}) {

  // Sub-dropdown state: which one is open, and which sort index it belongs to
  const [openSubDropdown, setOpenSubDropdown] = useState<{
    kind: "field" | "direction" | "addSort";
    sortIndex: number; // -1 for addSort
  } | null>(null);
  const [subSearchQuery, setSubSearchQuery] = useState("");
  const [isSubSearchFocused, setIsSubSearchFocused] = useState(false);

  // Position captured when a sub-dropdown opens
  const [subDropdownPos, setSubDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Refs for trigger elements (used for positioning + click-outside)
  // We store refs per sort index using a map
  const fieldDropdownRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const directionDropdownRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const addSortRowRef = useRef<HTMLDivElement>(null);

  // Set of column IDs already being sorted (used to exclude from pickers)
  const sortedColumnIds = new Set(currentSorts.map((s) => s.columnId));

  // Columns available for the currently open sub-dropdown.
  // - "addSort": exclude ALL already-sorted columns
  // - "field" at index N: exclude all already-sorted columns EXCEPT the one at index N
  //   (so the user can see their current selection and pick a different field)
  const filteredPickerColumns = columns.filter((col) => {
    if (!col.name.toLowerCase().includes(subSearchQuery.toLowerCase())) return false;

    if (openSubDropdown?.kind === "addSort") {
      return !sortedColumnIds.has(col.id);
    }
    if (openSubDropdown?.kind === "field") {
      const currentColId = currentSorts[openSubDropdown.sortIndex]?.columnId;
      if (col.id === currentColId) return true; // keep own field visible
      return !sortedColumnIds.has(col.id);
    }
    return true;
  });

  // === SUB-DROPDOWN OPEN HANDLERS ===
  const handleFieldDropdownClick = useCallback((sortIndex: number) => {
    setOpenSubDropdown((prev) => {
      if (prev?.kind === "field" && prev.sortIndex === sortIndex) return null;
      const el = fieldDropdownRefs.current.get(sortIndex);
      const rect = el?.getBoundingClientRect();
      if (rect) setSubDropdownPos({ top: rect.bottom, left: rect.left });
      setSubSearchQuery("");
      setIsSubSearchFocused(false);
      return { kind: "field", sortIndex };
    });
  }, []);

  const handleDirectionDropdownClick = useCallback((sortIndex: number) => {
    setOpenSubDropdown((prev) => {
      if (prev?.kind === "direction" && prev.sortIndex === sortIndex) return null;
      const el = directionDropdownRefs.current.get(sortIndex);
      const rect = el?.getBoundingClientRect();
      if (rect) setSubDropdownPos({ top: rect.bottom, left: rect.left });
      return { kind: "direction", sortIndex };
    });
  }, []);

  const handleAddSortClick = useCallback(() => {
    setOpenSubDropdown((prev) => {
      if (prev?.kind === "addSort") return null;
      const rect = addSortRowRef.current?.getBoundingClientRect();
      if (rect) setSubDropdownPos({ top: rect.bottom, left: rect.left });
      setSubSearchQuery("");
      setIsSubSearchFocused(false);
      return { kind: "addSort", sortIndex: -1 };
    });
  }, []);

  // === SUB-DROPDOWN SELECTION HANDLERS ===
  const handleSubFieldPick = useCallback(
    (col: SortFieldColumn) => {
      if (!openSubDropdown) return;
      if (openSubDropdown.kind === "field") {
        onChangeSortField(openSubDropdown.sortIndex, col.id, col.type as "TEXT" | "NUMBER");
      } else if (openSubDropdown.kind === "addSort") {
        onAddSort(col.id, col.type as "TEXT" | "NUMBER");
      }
      setOpenSubDropdown(null);
    },
    [openSubDropdown, onChangeSortField, onAddSort],
  );

  const handleSubDirectionPick = useCallback(
    (direction: "asc" | "desc") => {
      if (!openSubDropdown || openSubDropdown.kind !== "direction") return;
      onChangeDirection(openSubDropdown.sortIndex, direction);
      setOpenSubDropdown(null);
    },
    [openSubDropdown, onChangeDirection],
  );

  const handleToggleAutoSort = useCallback(() => {
    onToggleAutoSort();
  }, [onToggleAutoSort]);

  // Click-outside to close sub-dropdown
  useEffect(() => {
    if (!openSubDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-sort-subdropdown]")) return;
      // Check if click is on any trigger element
      for (const el of fieldDropdownRefs.current.values()) {
        if (el.contains(target)) return;
      }
      for (const el of directionDropdownRefs.current.values()) {
        if (el.contains(target)) return;
      }
      if (addSortRowRef.current?.contains(target)) return;
      setOpenSubDropdown(null);
    };
    const tid = setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => {
      clearTimeout(tid);
      document.removeEventListener("mousedown", handler);
    };
  }, [openSubDropdown]);

  // Escape key closes sub-dropdown first
  useEffect(() => {
    if (!openSubDropdown) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpenSubDropdown(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openSubDropdown]);

  // Shared field picker content renderer
  const renderFieldPickerContent = () => (
    <>
      <div
        className={`${styles.sortSubSearchContainer}${isSubSearchFocused ? ` ${styles.sortSubSearchContainerFocused}` : ""}`}
      >
        <span className={styles.sortSearchIcon}>
          <MagnifyingGlassIcon />
        </span>
        <input
          className={styles.sortSearchInput}
          style={{ width: "auto", flexGrow: 1 }}
          type="text"
          placeholder="Find a field"
          value={subSearchQuery}
          onChange={(e) => setSubSearchQuery(e.target.value)}
          onFocus={() => setIsSubSearchFocused(true)}
          onBlur={() => setIsSubSearchFocused(false)}
          autoFocus
        />
      </div>
      {filteredPickerColumns.map((col) => (
        <div
          key={col.id}
          className={styles.sortSubFieldItem}
          onClick={() => handleSubFieldPick(col)}
        >
          <span className={styles.sortFieldTypeIcon}>
            {col.type === "NUMBER" ? <NumberTypeIcon /> : <TextTypeIcon />}
          </span>
          <span className={styles.sortFieldName}>{col.name}</span>
        </div>
      ))}
    </>
  );

  // The currently active sort for direction dropdown labels
  const activeSortForDirection = openSubDropdown?.kind === "direction"
    ? currentSorts[openSubDropdown.sortIndex]
    : null;

  return (
    <div className={styles.sortActivePanel}>
      {/* === Main content area === */}
      <div className={styles.sortActiveMain}>
        {/* Header: "Sort by" + ? icon */}
        <div className={styles.sortActiveHeader}>
          <span className={styles.sortHeaderText}>Sort by</span>
          <span className={styles.sortHeaderIcon}>
            <QuestionIcon />
          </span>
        </div>

        {/* Separator line */}
        <div className={styles.sortActiveSeparator} />

        {/* Sort line items — one per active sort */}
        {currentSorts.map((sort, index) => {
          const col = columns.find((c) => c.id === sort.columnId);
          const fieldName = col?.name ?? "Unknown";
          const directionLabel = getDirectionLabel(sort.type, sort.direction);

          return (
            <div key={`${sort.columnId}-${index}`} className={styles.sortLineItemOuter}>
              <div className={styles.sortLineItemInner}>
                <div className={styles.sortLineItemRow}>
                  {/* 1) Field name dropdown */}
                  <div
                    ref={(el) => {
                      if (el) fieldDropdownRefs.current.set(index, el);
                      else fieldDropdownRefs.current.delete(index);
                    }}
                    className={styles.sortFieldDropdown}
                    onClick={() => handleFieldDropdownClick(index)}
                  >
                    <span className={styles.sortFieldDropdownName}>{fieldName}</span>
                    <span className={styles.sortDropdownChevron}>
                      <ChevronDownIcon />
                    </span>
                  </div>

                  {/* 2) Direction dropdown */}
                  <div
                    ref={(el) => {
                      if (el) directionDropdownRefs.current.set(index, el);
                      else directionDropdownRefs.current.delete(index);
                    }}
                    className={styles.sortDirectionDropdown}
                    onClick={() => handleDirectionDropdownClick(index)}
                  >
                    <span className={styles.sortDirectionText}>{directionLabel}</span>
                    <span className={styles.sortDirectionChevron}>
                      <ChevronDownIcon />
                    </span>
                  </div>

                  {/* 3) X remove button */}
                  <div className={styles.sortRemoveButton} onClick={() => onRemoveSort(index)}>
                    <span className={styles.sortRemoveIcon}>
                      <XIcon />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add another sort row */}
        <div className={styles.sortAddRow}>
          <div ref={addSortRowRef} className={styles.sortAddRowButton} onClick={handleAddSortClick}>
            <span className={styles.sortAddRowIcon}>
              <PlusIcon />
            </span>
            <span className={styles.sortAddRowText}>Add another sort</span>
          </div>
        </div>
      </div>

      {/* === Footer bar === */}
      <div className={styles.sortFooter}>
        {/* Left: toggle + text */}
        <div className={styles.sortFooterLeft} onClick={handleToggleAutoSort}>
          <div
            className={`${styles.sortTogglePill} ${autoSort ? styles.sortTogglePillOn : styles.sortTogglePillOff}`}
          >
            <div className={styles.sortTogglePillCircle} />
          </div>
          <span className={styles.sortFooterToggleText}>
            Automatically sort records
          </span>
        </div>

        {/* Right: Cancel + Sort (only when auto-sort is OFF) */}
        {!autoSort && (
          <div className={styles.sortFooterRight}>
            <button
              type="button"
              className={styles.sortCancelButton}
              onClick={onCancelSorts}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.sortApplyButton}
              onClick={onSaveSorts}
            >
              Sort
            </button>
          </div>
        )}
      </div>

      {/* === Sub-dropdown: Field picker (from field name click or add sort) === */}
      {openSubDropdown && (openSubDropdown.kind === "field" || openSubDropdown.kind === "addSort") &&
        createPortal(
          <div
            data-sort-subdropdown
            className={`${styles.sortSubDropdown} ${
              openSubDropdown.kind === "addSort"
                ? styles.sortAddSortPickerDropdown
                : styles.sortFieldPickerDropdown
            }`}
            style={{
              position: "fixed",
              top: subDropdownPos.top,
              left: subDropdownPos.left,
              zIndex: 10004,
            }}
          >
            {renderFieldPickerContent()}
          </div>,
          document.body,
        )}

      {/* === Sub-dropdown: Direction picker === */}
      {openSubDropdown?.kind === "direction" && activeSortForDirection &&
        createPortal(
          <div
            data-sort-subdropdown
            className={`${styles.sortSubDropdown} ${styles.sortDirectionDropdownMenu}`}
            style={{
              position: "fixed",
              top: subDropdownPos.top,
              left: subDropdownPos.left,
              zIndex: 10004,
            }}
          >
            <div
              className={styles.sortDirectionDropdownItem}
              onClick={() => handleSubDirectionPick("asc")}
            >
              {activeSortForDirection.type === "TEXT" ? "A \u2192 Z" : "1 \u2192 9"}
            </div>
            <div
              className={styles.sortDirectionDropdownItem}
              onClick={() => handleSubDirectionPick("desc")}
            >
              {activeSortForDirection.type === "TEXT" ? "Z \u2192 A" : "9 \u2192 1"}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ============================================
// MAIN EXPORTED COMPONENT
// ============================================
export function SortPanel({
  columns,
  currentSorts,
  autoSort,
  onPickSort,
  onAddSort,
  onChangeSortField,
  onChangeDirection,
  onRemoveSort,
  onToggleAutoSort,
  onSaveSorts,
  onCancelSorts,
}: SortPanelProps) {
  if (currentSorts.length > 0) {
    return (
      <ActiveSortPanel
        columns={columns}
        currentSorts={currentSorts}
        autoSort={autoSort}
        onAddSort={onAddSort}
        onChangeSortField={onChangeSortField}
        onChangeDirection={onChangeDirection}
        onRemoveSort={onRemoveSort}
        onToggleAutoSort={onToggleAutoSort}
        onSaveSorts={onSaveSorts}
        onCancelSorts={onCancelSorts}
      />
    );
  }

  return <FieldPicker columns={columns} onPickSort={onPickSort} />;
}
