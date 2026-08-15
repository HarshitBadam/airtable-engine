import React from "react";
import { createPortal } from "react-dom";
import styles from "./DupFieldDialog.module.css";

export interface DupFieldDialogInfo {
  colId: string;
  colName: string;
}

interface DupFieldDialogProps {
  dialog: DupFieldDialogInfo;
  dupCells: boolean;
  setDupCells: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
  onConfirm: (colId: string, dupCells: boolean) => void;
}

export function DupFieldDialog({ dialog, dupCells, setDupCells, onClose, onConfirm }: DupFieldDialogProps) {
  return createPortal(
    <div
      className={styles.dupFieldOverlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.dupFieldDialog}>
        <div className={styles.dupFieldCloseBtn} onClick={onClose}>
          <svg viewBox="0 0 16 16" fill="currentColor" className={styles.dupFieldCloseIcon} style={{ shapeRendering: "geometricPrecision" }}>
            <path fillRule="nonzero" d="M12.3536 3.64645C12.1583 3.45118 11.8417 3.45118 11.6464 3.64645L8 7.29289L4.35355 3.64645C4.15829 3.45118 3.84171 3.45118 3.64645 3.64645C3.45118 3.84171 3.45118 4.15829 3.64645 4.35355L7.29289 8L3.64645 11.6464C3.45118 11.8417 3.45118 12.1583 3.64645 12.3536C3.84171 12.5488 4.15829 12.5488 4.35355 12.3536L8 8.70711L11.6464 12.3536C11.8417 12.5488 12.1583 12.5488 12.3536 12.3536C12.5488 12.1583 12.5488 11.8417 12.3536 11.6464L8.70711 8L12.3536 4.35355C12.5488 4.15829 12.5488 3.84171 12.3536 3.64645Z" />
          </svg>
        </div>
        <p className={styles.dupFieldTitle}>Duplicate {dialog.colName}</p>
        <div className={styles.dupFieldToggleRow}>
          <div
            className={styles.dupFieldTogglePill}
            style={{
              backgroundColor: dupCells ? "rgb(4, 138, 14)" : "rgba(0, 0, 0, 0.1)",
              justifyContent: dupCells ? "flex-end" : "flex-start",
            }}
            onClick={() => setDupCells((v) => !v)}
          >
            <div className={styles.dupFieldToggleCircle} />
          </div>
          <span className={styles.dupFieldToggleLabel}>Duplicate cells</span>
        </div>
        <div className={styles.dupFieldActions}>
          <button type="button" className={styles.dupFieldCancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.dupFieldConfirmBtn}
            onClick={() => onConfirm(dialog.colId, dupCells)}
          >
            Duplicate field
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
