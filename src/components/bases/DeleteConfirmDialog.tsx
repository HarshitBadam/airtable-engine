/**
 * DeleteConfirmDialog component
 * Confirmation dialog for deleting a base
 */

"use client";

import { useRef, useLayoutEffect, useState } from "react";
import styles from "./bases.module.css";
import { QuestionMarkCircleIcon } from "~/components/home/Icons";
import { VIEWPORT_BOTTOM_BUFFER } from "~/shared/constants";

interface DeleteConfirmDialogProps {
  baseName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({ baseName, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [offsetY, setOffsetY] = useState(0);

  // useLayoutEffect runs synchronously after DOM mutations but before paint
  // This is the correct hook for measuring and adjusting layout
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const rect = dialog.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    if (rect.bottom > viewportHeight - VIEWPORT_BOTTOM_BUFFER) {
      const overflow = rect.bottom - viewportHeight + VIEWPORT_BOTTOM_BUFFER;
      setOffsetY(-overflow);
    } else {
      setOffsetY(0);
    }
  }, []);

  return (
    <>
      <div className={styles.deleteConfirmOverlay} onClick={onCancel} />
      <div
        ref={dialogRef}
        className={styles.deleteConfirmDialog}
        style={offsetY !== 0 ? { transform: `translateY(${offsetY}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={styles.deleteConfirmTitle}>
          Are you sure you want to delete {baseName}?
        </p>
        <span className={styles.deleteConfirmMessage}>
          Recently deleted apps can be restored from trash.
          <span className={styles.deleteConfirmHelpIcon}>
            <QuestionMarkCircleIcon size={15} />
          </span>
        </span>
        <div className={styles.deleteConfirmButtons}>
          <button
            type="button"
            className={styles.deleteConfirmCancelButton}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.deleteConfirmDeleteButton}
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
