import React from "react";
import styles from "./GridContainer.module.css";
import { BulkAddDialog } from "./BulkAddDialog";
import { useWorkspace } from "./GridWorkspaceContext";

interface BulkAddPillProps {
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
  bulkPopulate: boolean;
  setBulkPopulate: React.Dispatch<React.SetStateAction<boolean>>;
}

export function BulkAddPill({
  show,
  setShow,
  bulkPopulate,
  setBulkPopulate,
}: BulkAddPillProps) {
  const { isBulkAdding, baseColor, baseTextColor, handleAddBulkRows } =
    useWorkspace();

  return (
    <>
      <div
        className={`${styles.bulkAddPill}${isBulkAdding ? ` ${styles.bulkAddPillLoading}` : ""}`}
        style={{ "--pill-base-color": baseColor } as React.CSSProperties}
        onClick={isBulkAdding ? undefined : () => setShow(true)}
      >
        {isBulkAdding ? (
          <>
            <svg
              className={styles.bulkAddSpinner}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="8" cy="8" r="6" opacity="0.25" />
              <path d="M14 8a6 6 0 0 0-6-6" strokeLinecap="round" />
            </svg>
            <span className={styles.bulkAddPulseText}>Adding records…</span>
          </>
        ) : (
          <>
            <svg
              className={styles.bulkAddPillIcon}
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
            <span className={styles.bulkAddPillDivider} />
            <span>100,000 rows</span>
            <span className={styles.bulkAddTooltip}>
              Generate 100,000 rows of sample data
            </span>
          </>
        )}
      </div>

      {show && (
        <BulkAddDialog
          bulkPopulate={bulkPopulate}
          setBulkPopulate={setBulkPopulate}
          onClose={() => setShow(false)}
          onConfirm={(populate) => {
            setShow(false);
            handleAddBulkRows(populate);
          }}
          baseColor={baseColor}
          baseTextColor={baseTextColor}
        />
      )}
    </>
  );
}
