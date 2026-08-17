"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { STORAGE_LIMIT_EVENT } from "~/shared/storageLimit";
import styles from "./StorageLimitModal.module.css";

export function StorageLimitModal() {
  const [isOpen, setIsOpen] = useState(false);
  const okButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const openModal = () => setIsOpen(true);
    window.addEventListener(STORAGE_LIMIT_EVENT, openModal);
    return () => window.removeEventListener(STORAGE_LIMIT_EVENT, openModal);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    okButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay}>
      <div
        className={styles.modal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="storage-limit-title"
        aria-describedby="storage-limit-description"
      >
        <div className={styles.icon} aria-hidden="true">
          !
        </div>
        <h2 id="storage-limit-title" className={styles.title}>
          Hosted demo storage limit reached
        </h2>
        <p id="storage-limit-description" className={styles.description}>
          This hosted demo has reached its database storage allowance.
          Million-row benchmarks require a larger PostgreSQL instance or a
          local setup.
        </p>
        <button
          ref={okButtonRef}
          type="button"
          className={styles.okButton}
          onClick={() => setIsOpen(false)}
        >
          OK
        </button>
      </div>
    </div>,
    document.body,
  );
}
