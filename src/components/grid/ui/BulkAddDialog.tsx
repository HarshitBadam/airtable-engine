import React from "react";
import { createPortal } from "react-dom";
import styles from "./BulkAddDialog.module.css";

interface BulkAddDialogProps {
  bulkPopulate: boolean;
  setBulkPopulate: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
  onConfirm: (populate: boolean) => void;
  baseColor: string;
  baseTextColor: string;
}

export function BulkAddDialog({
  bulkPopulate,
  setBulkPopulate,
  onClose,
  onConfirm,
  baseColor,
  baseTextColor,
}: BulkAddDialogProps) {
  return createPortal(
    <div
      className={styles.bulkAddOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.bulkAddDialog}>
        <button type="button" className={styles.bulkAddCloseBtn} onClick={onClose}>
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="nonzero" d="M12.3536 3.64645C12.1583 3.45118 11.8417 3.45118 11.6464 3.64645L8 7.29289L4.35355 3.64645C4.15829 3.45118 3.84171 3.45118 3.64645 3.64645C3.45118 3.84171 3.45118 4.15829 3.64645 4.35355L7.29289 8L3.64645 11.6464C3.45118 11.8417 3.45118 12.1583 3.64645 12.3536C3.84171 12.5488 4.15829 12.5488 4.35355 12.3536L8 8.70711L11.6464 12.3536C11.8417 12.5488 12.1583 12.5488 12.3536 12.3536C12.5488 12.1583 12.5488 11.8417 12.3536 11.6464L8.70711 8L12.3536 4.35355C12.5488 4.15829 12.5488 3.84171 12.3536 3.64645Z" />
          </svg>
        </button>

        <h2 className={styles.bulkAddTitle}>Add 100,000 records</h2>

        <p className={styles.bulkAddDescription}>
          This will generate{" "}
          <span
            className={styles.bulkAddCountBadge}
            style={{ backgroundColor: `${baseColor}14`, color: baseColor }}
          >
            100,000 rows
          </span>{" "}
          of records {bulkPopulate ? "populated with sample data" : "with blank fields"} in this table.
          This may take a moment depending on table size.
        </p>

        <div className={styles.bulkAddActions}>
          <label className={styles.bulkAddToggleRow}>
            <button
              type="button"
              role="switch"
              aria-checked={bulkPopulate}
              className={`${styles.bulkAddToggle}${bulkPopulate ? ` ${styles.bulkAddToggleOn}` : ""}`}
              style={bulkPopulate ? { backgroundColor: baseColor } : undefined}
              onClick={() => setBulkPopulate((v) => !v)}
            >
              <span className={styles.bulkAddToggleThumb} />
            </button>
            <span className={styles.bulkAddToggleLabel}>Sample data</span>
          </label>
          <div className={styles.bulkAddButtons}>
            <button type="button" className={styles.bulkAddCancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.bulkAddConfirmBtn}
              style={{ backgroundColor: baseColor, color: baseTextColor }}
              onClick={() => onConfirm(bulkPopulate)}
            >
              Add records
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
