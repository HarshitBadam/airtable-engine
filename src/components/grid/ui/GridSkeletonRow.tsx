import React from "react";
import styles from "./GridRow.module.css";
import type { GridColumnDef } from "./GridRow";

interface GridSkeletonRowProps {
  actualIndex: number;
  frozenColumns: GridColumnDef[];
  scrollableColumns: GridColumnDef[];
  getColWidth: (colId: string) => number;
  cellHeight: number;
  freezeWidth: number;
}

export function GridSkeletonRow({
  actualIndex,
  frozenColumns,
  scrollableColumns,
  getColWidth,
  cellHeight,
  freezeWidth,
}: GridSkeletonRowProps) {
  return (
    <div className={styles.gridRow}>
      <div className={styles.gridRowFrozenGroup} style={{ width: freezeWidth }}>
        <div className={styles.gridRowNumCell} style={{ height: cellHeight }}>
          <div className={styles.gridRowNumOuter}>
            <div className={styles.gridRowNumInner} style={{ color: "#ccc" }}>
              {actualIndex + 1}
            </div>
          </div>
        </div>
        {frozenColumns.map((col, colIdx) => (
          <div
            key={col.id}
            className={styles.gridDataCell}
            style={{ width: getColWidth(col.id), height: cellHeight }}
          >
            <div className={styles.gridCellContent}>
              <div
                className={styles.skeletonBar}
                style={{
                  width: `${40 + ((actualIndex * 7 + colIdx * 13) % 40)}%`,
                  height: 10,
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {scrollableColumns.map((col, colIdx) => (
        <div
          key={col.id}
          className={styles.gridDataCell}
          style={{ width: getColWidth(col.id), height: cellHeight }}
        >
          <div className={styles.gridCellContent}>
            <div
              className={styles.skeletonBar}
              style={{
                width: `${40 + ((actualIndex * 11 + colIdx * 17) % 40)}%`,
                height: 10,
                borderRadius: 3,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
