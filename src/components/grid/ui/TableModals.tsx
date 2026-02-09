import { useRef, useEffect } from "react";
import styles from "./TableModals.module.css";

// ============================================
// CLEAR DATA MODAL
// ============================================

interface ClearDataModalProps {
  isOpen: boolean;
  tableName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function ClearDataModal({ isOpen, tableName, onClose, onConfirm }: ClearDataModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className={styles.clearDataModalOverlay}
      onClick={onClose}
    >
      <div 
        className={styles.clearDataModal}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={styles.clearDataModalTitle}>
          Are you sure you want to clear all data in {tableName}?
        </h2>
        <p className={styles.clearDataModalDescription}>
          All records will be deleted from {tableName} table.
        </p>
        <div className={styles.clearDataModalButtons}>
          <button
            type="button"
            className={styles.clearDataCancelButton}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.clearDataConfirmButton}
            onClick={onConfirm}
          >
            Clear data
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// DELETE TABLE POPUP
// ============================================

interface DeleteTablePopupProps {
  isOpen: boolean;
  position: { top: number; left: number } | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTablePopup({ isOpen, position, onClose, onConfirm }: DeleteTablePopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  return (
    <div 
      ref={popupRef}
      className={styles.deleteTablePopup}
      style={{ 
        top: position.top, 
        left: position.left 
      }}
    >
      <p className={styles.deleteTablePopupTitle}>
        Are you sure you want to delete this table?
      </p>
      <p className={styles.deleteTablePopupDescription}>
        Recently deleted tables can be restored from trash.{' '}
        <svg className={styles.deleteTablePopupIcon} viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="nonzero" d="M8.07349 4.50134C7.75062 4.49155 7.43049 4.55078 7.13904 4.67151C6.36183 4.99344 5.75017 5.76895 5.75 6.74988C5.74997 6.88249 5.80262 7.00968 5.89636 7.10347C5.99011 7.19726 6.11727 7.24997 6.24988 7.25C6.31554 7.25002 6.38056 7.2371 6.44123 7.21199C6.5019 7.18687 6.55703 7.15006 6.60347 7.10364C6.64991 7.05722 6.68675 7.00211 6.71189 6.94145C6.73704 6.8808 6.74998 6.81578 6.75 6.75012C6.75013 6.17215 7.08092 5.77793 7.52173 5.59534C7.96254 5.41275 8.47515 5.45759 8.88391 5.86621C9.24251 6.22468 9.34907 6.75995 9.15503 7.22839C8.96099 7.69684 8.50716 8.00009 8.00012 8C7.93445 7.99999 7.86942 8.01292 7.80875 8.03804C7.74808 8.06316 7.69295 8.09999 7.6465 8.14642C7.60006 8.19285 7.56322 8.24797 7.53809 8.30864C7.51295 8.36931 7.50001 8.43433 7.5 8.5V9C7.5 9.13261 7.55268 9.25979 7.64645 9.35355C7.74021 9.44732 7.86739 9.5 8 9.5C8.13261 9.5 8.25979 9.44732 8.35355 9.35355C8.44732 9.25979 8.5 9.13261 8.5 9V8.93738C9.1999 8.77686 9.79665 8.2924 10.0789 7.61108C10.4266 6.77156 10.2336 5.80137 9.59094 5.15894C9.15735 4.7255 8.61159 4.51766 8.07349 4.50134Z M8 12C8.41419 12 8.75 11.6642 8.75 11.25C8.75 10.8358 8.41419 10.5 8 10.5C7.58581 10.5 7.25 10.8358 7.25 11.25C7.25 11.6642 7.58581 12 8 12Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
        </svg>
      </p>
      <div className={styles.deleteTablePopupButtons}>
        <button
          type="button"
          className={styles.deleteTableCancelButton}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.deleteTableConfirmButton}
          onClick={onConfirm}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
