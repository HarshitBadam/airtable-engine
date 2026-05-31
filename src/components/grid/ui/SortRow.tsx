"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import styles from "./SortPanel.module.css";
import { useClickOutside } from "~/hooks/useClickOutside";
import {
  TextTypeIcon,
  NumberTypeIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  XIcon,
  QuestionIcon,
  PlusIcon,
} from "./SortIcons";

export { QuestionIcon, PlusIcon, TextTypeIcon, NumberTypeIcon, MagnifyingGlassIcon };
export type { SortFieldColumn, SortFieldPickerProps } from "./SortFieldPicker";
export { SortFieldPicker } from "./SortFieldPicker";
import type { SortFieldColumn } from "./SortFieldPicker";

export interface ActiveSort {
  columnId: string;
  direction: "asc" | "desc";
  type: "TEXT" | "NUMBER";
}

export function getDirectionLabel(
  type: "TEXT" | "NUMBER",
  direction: "asc" | "desc",
): string {
  if (type === "TEXT") {
    return direction === "asc" ? "A \u2192 Z" : "Z \u2192 A";
  }
  return direction === "asc" ? "1 \u2192 9" : "9 \u2192 1";
}

export interface SortRowProps {
  sort: ActiveSort;
  columns: SortFieldColumn[];
  sortedColumnIds: Set<string>;
  onChangeSortField: (columnId: string, columnType: "TEXT" | "NUMBER") => void;
  onChangeDirection: (direction: "asc" | "desc") => void;
  onRemoveSort: () => void;
}

export interface AddSortRowProps {
  columns: SortFieldColumn[];
  sortedColumnIds: Set<string>;
  onAddSort: (columnId: string, columnType: "TEXT" | "NUMBER") => void;
}

export function AddSortRow({ columns, sortedColumnIds, onAddSort }: AddSortRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredColumns = columns.filter(
    (col) =>
      !sortedColumnIds.has(col.id) &&
      col.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleClick = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (rect) setPos({ top: rect.bottom, left: rect.left });
        setSearch("");
        setIsSearchFocused(false);
      }
      return !prev;
    });
  }, []);

  useClickOutside(triggerRef, isOpen, useCallback(() => setIsOpen(false), []), { delay: true, ignoreRefs: [dropdownRef] });

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  return (
    <div className={styles.sortAddRow}>
      <div ref={triggerRef} className={styles.sortAddRowButton} onClick={handleClick}>
        <span className={styles.sortAddRowIcon}>
          <PlusIcon />
        </span>
        <span className={styles.sortAddRowText}>Add another sort</span>
      </div>
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            data-sort-subdropdown
            className={`${styles.sortSubDropdown} ${styles.sortAddSortPickerDropdown}`}
            style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 10004 }}
          >
            <div
              className={`${styles.sortSubSearchContainer}${isSearchFocused ? ` ${styles.sortSubSearchContainerFocused}` : ""}`}
            >
              <span className={styles.sortSearchIcon}>
                <MagnifyingGlassIcon />
              </span>
              <input
                className={styles.sortSearchInput}
                style={{ width: "auto", flexGrow: 1 }}
                type="text"
                placeholder="Find a field"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                autoFocus
              />
            </div>
            {filteredColumns.map((col) => (
              <div
                key={col.id}
                className={styles.sortSubFieldItem}
                onClick={() => {
                  onAddSort(col.id, col.type as "TEXT" | "NUMBER");
                  setIsOpen(false);
                }}
              >
                <span className={styles.sortFieldTypeIcon}>
                  {col.type === "NUMBER" ? <NumberTypeIcon /> : <TextTypeIcon />}
                </span>
                <span className={styles.sortFieldName}>{col.name}</span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function SortRow({
  sort,
  columns,
  sortedColumnIds,
  onChangeSortField,
  onChangeDirection,
  onRemoveSort,
}: SortRowProps) {
  const [isFieldOpen, setIsFieldOpen] = useState(false);
  const [isDirectionOpen, setIsDirectionOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [fieldPos, setFieldPos] = useState({ top: 0, left: 0 });
  const [directionPos, setDirectionPos] = useState({ top: 0, left: 0 });
  const fieldTriggerRef = useRef<HTMLDivElement>(null);
  const directionTriggerRef = useRef<HTMLDivElement>(null);
  const fieldDropdownRef = useRef<HTMLDivElement>(null);
  const directionDropdownRef = useRef<HTMLDivElement>(null);

  const col = columns.find((c) => c.id === sort.columnId);
  const fieldName = col?.name ?? "Unknown";
  const directionLabel = getDirectionLabel(sort.type, sort.direction);

  const filteredColumns = columns.filter((c) => {
    if (!c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (c.id === sort.columnId) return true;
    return !sortedColumnIds.has(c.id);
  });

  const handleFieldClick = useCallback(() => {
    setIsFieldOpen((prev) => {
      if (!prev) {
        const rect = fieldTriggerRef.current?.getBoundingClientRect();
        if (rect) setFieldPos({ top: rect.bottom, left: rect.left });
        setSearchQuery("");
        setIsSearchFocused(false);
      }
      return !prev;
    });
    setIsDirectionOpen(false);
  }, []);

  const handleDirectionClick = useCallback(() => {
    setIsDirectionOpen((prev) => {
      if (!prev) {
        const rect = directionTriggerRef.current?.getBoundingClientRect();
        if (rect) setDirectionPos({ top: rect.bottom, left: rect.left });
      }
      return !prev;
    });
    setIsFieldOpen(false);
  }, []);

  useClickOutside(
    fieldTriggerRef,
    isFieldOpen || isDirectionOpen,
    useCallback(() => { setIsFieldOpen(false); setIsDirectionOpen(false); }, []),
    { delay: true, ignoreRefs: [directionTriggerRef, fieldDropdownRef, directionDropdownRef] },
  );

  useEffect(() => {
    if (!isFieldOpen && !isDirectionOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsFieldOpen(false);
        setIsDirectionOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isFieldOpen, isDirectionOpen]);

  return (
    <div className={styles.sortLineItemOuter}>
      <div className={styles.sortLineItemInner}>
        <div className={styles.sortLineItemRow}>
          <div
            ref={fieldTriggerRef}
            className={styles.sortFieldDropdown}
            onClick={handleFieldClick}
          >
            <span className={styles.sortFieldDropdownName}>{fieldName}</span>
            <span className={styles.sortDropdownChevron}>
              <ChevronDownIcon />
            </span>
          </div>

          <div
            ref={directionTriggerRef}
            className={styles.sortDirectionDropdown}
            onClick={handleDirectionClick}
          >
            <span className={styles.sortDirectionText}>{directionLabel}</span>
            <span className={styles.sortDirectionChevron}>
              <ChevronDownIcon />
            </span>
          </div>

          <div className={styles.sortRemoveButton} onClick={onRemoveSort}>
            <span className={styles.sortRemoveIcon}>
              <XIcon />
            </span>
          </div>
        </div>
      </div>

      {isFieldOpen &&
        createPortal(
          <div
            ref={fieldDropdownRef}
            data-sort-subdropdown
            className={`${styles.sortSubDropdown} ${styles.sortFieldPickerDropdown}`}
            style={{
              position: "fixed",
              top: fieldPos.top,
              left: fieldPos.left,
              zIndex: 10004,
            }}
          >
            <div
              className={`${styles.sortSubSearchContainer}${isSearchFocused ? ` ${styles.sortSubSearchContainerFocused}` : ""}`}
            >
              <span className={styles.sortSearchIcon}>
                <MagnifyingGlassIcon />
              </span>
              <input
                className={styles.sortSearchInput}
                style={{ width: "auto", flexGrow: 1 }}
                type="text"
                placeholder="Find a field"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                autoFocus
              />
            </div>
            {filteredColumns.map((c) => (
              <div
                key={c.id}
                className={styles.sortSubFieldItem}
                onClick={() => {
                  onChangeSortField(c.id, c.type as "TEXT" | "NUMBER");
                  setIsFieldOpen(false);
                }}
              >
                <span className={styles.sortFieldTypeIcon}>
                  {c.type === "NUMBER" ? <NumberTypeIcon /> : <TextTypeIcon />}
                </span>
                <span className={styles.sortFieldName}>{c.name}</span>
              </div>
            ))}
          </div>,
          document.body,
        )}

      {isDirectionOpen &&
        createPortal(
          <div
            ref={directionDropdownRef}
            data-sort-subdropdown
            className={`${styles.sortSubDropdown} ${styles.sortDirectionDropdownMenu}`}
            style={{
              position: "fixed",
              top: directionPos.top,
              left: directionPos.left,
              zIndex: 10004,
            }}
          >
            <div
              className={styles.sortDirectionDropdownItem}
              onClick={() => {
                onChangeDirection("asc");
                setIsDirectionOpen(false);
              }}
            >
              {sort.type === "TEXT" ? "A \u2192 Z" : "1 \u2192 9"}
            </div>
            <div
              className={styles.sortDirectionDropdownItem}
              onClick={() => {
                onChangeDirection("desc");
                setIsDirectionOpen(false);
              }}
            >
              {sort.type === "TEXT" ? "Z \u2192 A" : "9 \u2192 1"}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
