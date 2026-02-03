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
  const [adjustedTransform, setAdjustedTransform] = useState<string | null>(null);

  // useLayoutEffect runs synchronously after DOM mutations but before paint
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Get computed transform to preserve X offset
    const computedStyle = window.getComputedStyle(dialog);
    const matrix = new DOMMatrix(computedStyle.transform);
    const currentX = matrix.m41;
    const currentY = matrix.m42;

    // Get dialog height
    const dialogHeight = dialog.offsetHeight;
    const viewportHeight = window.innerHeight;

    // Calculate expected dialog bottom using parent's position
    const parent = dialog.parentElement;
    if (!parent) return;
    
    const parentRect = parent.getBoundingClientRect();
    // Dialog CSS: top: calc(100% + 8px) + transform Y offset
    const expectedDialogTop = parentRect.bottom + 8 + currentY;
    const expectedDialogBottom = expectedDialogTop + dialogHeight;

    if (expectedDialogBottom > viewportHeight - VIEWPORT_BOTTOM_BUFFER) {
      // Move dialog up exactly enough so its bottom edge is flush with viewport bottom
      const overflow = expectedDialogBottom - viewportHeight;
      setAdjustedTransform(`translate(${currentX}px, ${currentY - overflow}px)`);
    } else {
      setAdjustedTransform(null);
    }
  }, []);

  return (
    <>
      <div className={styles.deleteConfirmOverlay} onClick={onCancel} />
      <div
        ref={dialogRef}
        className={styles.deleteConfirmDialog}
        style={adjustedTransform ? { transform: adjustedTransform } : undefined}
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
