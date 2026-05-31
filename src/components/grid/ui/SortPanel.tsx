"use client";

import React from "react";
import styles from "./SortPanel.module.css";
import type { SortFieldColumn, ActiveSort } from "./SortRow";
import {
  SortRow,
  SortFieldPicker,
  AddSortRow,
  QuestionIcon,
} from "./SortRow";

export type { SortFieldColumn, ActiveSort };

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
}: Omit<SortPanelProps, "onPickSort">) {
  const sortedColumnIds = new Set(currentSorts.map((s) => s.columnId));

  return (
    <div className={styles.sortActivePanel}>
      <div className={styles.sortActiveMain}>
        <div className={styles.sortActiveHeader}>
          <span className={styles.sortHeaderText}>Sort by</span>
          <span className={styles.sortHeaderIcon}>
            <QuestionIcon />
          </span>
        </div>

        <div className={styles.sortActiveSeparator} />

        {currentSorts.map((sort, index) => (
          <SortRow
            key={`${sort.columnId}-${index}`}
            sort={sort}
            columns={columns}
            sortedColumnIds={sortedColumnIds}
            onChangeSortField={(columnId, columnType) =>
              onChangeSortField(index, columnId, columnType)
            }
            onChangeDirection={(direction) => onChangeDirection(index, direction)}
            onRemoveSort={() => onRemoveSort(index)}
          />
        ))}

        <AddSortRow
          columns={columns}
          sortedColumnIds={sortedColumnIds}
          onAddSort={onAddSort}
        />
      </div>

      <div className={styles.sortFooter}>
        <div className={styles.sortFooterLeft} onClick={onToggleAutoSort}>
          <div
            className={`${styles.sortTogglePill} ${autoSort ? styles.sortTogglePillOn : styles.sortTogglePillOff}`}
          >
            <div className={styles.sortTogglePillCircle} />
          </div>
          <span className={styles.sortFooterToggleText}>
            Automatically sort records
          </span>
        </div>

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
    </div>
  );
}

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

  return <SortFieldPicker columns={columns} onPickSort={onPickSort} />;
}
