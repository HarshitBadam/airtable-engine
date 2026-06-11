"use client";

import { useEffect } from "react";
import Image from "next/image";
import { toast } from "sonner";
import styles from "./CreateModal.module.css";
import { CloseIcon, ChevronDownIcon } from "./Icons";

interface CreateModalProps {
  isOpen: boolean;
  isCreating: boolean;
  onClose: () => void;
  onCreateBase: () => void;
}

export function CreateModal({ isOpen, isCreating, onClose, onCreateBase }: CreateModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>How do you want to start?</h2>
          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div className={styles.modalWorkspace}>
          <span className={styles.modalWorkspaceLabel}>Workspace:</span>
          <span className={styles.modalWorkspaceSelect}>
            Select a workspace
            <ChevronDownIcon size={14} />
          </span>
        </div>

        <div className={styles.modalContent}>
          <div className={styles.modalOptions}>
            <div
              className={styles.modalOptionCard}
              onClick={(e) => {
                e.stopPropagation();
                toast("This feature is currently not available");
              }}
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer" }}
            >
              <Image
                src="/image.png"
                alt="Build an app with Omni"
                width={340}
                height={200}
                className={styles.modalOptionImage}
              />
              <div className={styles.modalOptionText}>
                <div className={styles.modalOptionTitleRow}>
                  <h3 className={styles.modalOptionTitle}>Build an app with Omni</h3>
                  <span className={styles.modalOptionBadge}>New</span>
                </div>
                <p className={styles.modalOptionDesc}>
                  Use AI to build a custom app tailored to your workflow.
                </p>
              </div>
            </div>

            <div
              className={styles.modalOptionCard}
              onClick={(e) => {
                e.stopPropagation();
                onCreateBase();
              }}
              role="button"
              tabIndex={0}
              style={{
                cursor: isCreating ? "wait" : "pointer",
                opacity: isCreating ? 0.6 : 1,
              }}
            >
              <Image
                src="/images/build-app.png"
                alt="Build an app on your own"
                width={340}
                height={200}
                className={styles.modalOptionImage}
              />
              <div className={styles.modalOptionText}>
                <h3 className={styles.modalOptionTitle}>
                  {isCreating ? "Creating..." : "Build an app on your own"}
                </h3>
                <p className={styles.modalOptionDesc}>
                  Start with a blank app and build your ideal workflow.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
