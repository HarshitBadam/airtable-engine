"use client";

import React, { useState, useCallback } from "react";
import styles from "./SortPanel.module.css";
import { TextTypeIcon, NumberTypeIcon, MagnifyingGlassIcon, QuestionIcon } from "./SortIcons";

export interface SortFieldColumn {
  id: string;
  name: string;
  type: string;
}

export interface SortFieldPickerProps {
  columns: SortFieldColumn[];
  onPickSort: (columnId: string, columnType: "TEXT" | "NUMBER") => void;
}

export function SortFieldPicker({ columns, onPickSort }: SortFieldPickerProps) {
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
      <div className={styles.sortHeader}>
        <span className={styles.sortHeaderText}>Sort by</span>
        <span className={styles.sortHeaderIcon}>
          <QuestionIcon />
        </span>
      </div>
      <div className={styles.sortSeparator} />
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
