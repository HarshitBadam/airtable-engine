import React, { useRef, useEffect } from "react";
import styles from "./GridBar.module.css";
import type { RowHeightPreset } from "~/shared/grid";

interface RowHeightMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentPreset: RowHeightPreset;
  onChange: (preset: RowHeightPreset) => void;
  wrapHeaders: boolean;
  onToggleWrapHeaders: () => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}

export function RowHeightMenu({
  isOpen,
  onClose,
  currentPreset,
  onChange,
  wrapHeaders,
  onToggleWrapHeaders,
  anchorRef,
}: RowHeightMenuProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !dropdownRef.current?.contains(target) &&
        !anchorRef.current?.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div className={styles.rowHeightDropdown} ref={dropdownRef}>
      <span className={styles.rowHeightDropdownTitle}>Select a row height</span>

      <div
        className={`${styles.rowHeightDropdownItem}${currentPreset === "short" ? ` ${styles.rowHeightDropdownItemActive}` : ""}`}
        onClick={() => { onChange("short"); onClose(); }}
      >
        <svg className={styles.rowHeightDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="nonzero" d="M13.1464 2.64645L12.1464 3.64645C11.9512 3.84171 11.9512 4.15829 12.1464 4.35355C12.3417 4.54882 12.6583 4.54882 12.8536 4.35355L13 4.20711V11.7929L12.8536 11.6464C12.6583 11.4512 12.3417 11.4512 12.1464 11.6464C11.9512 11.8417 11.9512 12.1583 12.1464 12.3536L13.1464 13.3536C13.2402 13.4473 13.3674 13.5 13.5 13.5C13.6326 13.5 13.7598 13.4473 13.8536 13.3536L14.8536 12.3536C15.0488 12.1583 15.0488 11.8417 14.8536 11.6464C14.6583 11.4512 14.3417 11.4512 14.1464 11.6464L14 11.7929V4.20711L14.1464 4.35355C14.3417 4.54882 14.6583 4.54882 14.8536 4.35355C15.0488 4.15829 15.0488 3.84171 14.8536 3.64645L13.8536 2.64645C13.6583 2.45118 13.3417 2.45118 13.1464 2.64645Z M1.5 3C1.22386 3 1 3.22386 1 3.5C1 3.77614 1.22386 4 1.5 4H9.5C9.77614 4 10 3.77614 10 3.5C10 3.22386 9.77614 3 9.5 3H1.5Z M1.5 6C1.22386 6 1 6.22386 1 6.5C1 6.77614 1.22386 7 1.5 7H9.5C9.77614 7 10 6.77614 10 6.5C10 6.22386 9.77614 6 9.5 6H1.5Z M1 9.5C1 9.22386 1.22386 9 1.5 9H9.5C9.77614 9 10 9.22386 10 9.5C10 9.77614 9.77614 10 9.5 10H1.5C1.22386 10 1 9.77614 1 9.5Z M1.5 12C1.22386 12 1 12.2239 1 12.5C1 12.7761 1.22386 13 1.5 13H9.5C9.77614 13 10 12.7761 10 12.5C10 12.2239 9.77614 12 9.5 12H1.5Z" />
        </svg>
        <span className={styles.rowHeightDropdownItemText}>Short</span>
      </div>

      <div
        className={`${styles.rowHeightDropdownItem}${currentPreset === "medium" ? ` ${styles.rowHeightDropdownItemActive}` : ""}`}
        onClick={() => { onChange("medium"); onClose(); }}
      >
        <svg className={styles.rowHeightDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="nonzero" d="M12.1464 3.64645L13.1464 2.64645C13.3417 2.45118 13.6583 2.45118 13.8536 2.64645L14.8536 3.64645C15.0488 3.84171 15.0488 4.15829 14.8536 4.35355C14.6583 4.54882 14.3417 4.54882 14.1464 4.35355L14 4.20711V11.7929L14.1464 11.6464C14.3417 11.4512 14.6583 11.4512 14.8536 11.6464C15.0488 11.8417 15.0488 12.1583 14.8536 12.3536L13.8536 13.3536C13.7598 13.4473 13.6326 13.5 13.5 13.5C13.3674 13.5 13.2402 13.4473 13.1464 13.3536L12.1464 12.3536C11.9512 12.1583 11.9512 11.8417 12.1464 11.6464C12.3417 11.4512 12.6583 11.4512 12.8536 11.6464L13 11.7929V4.20711L12.8536 4.35355C12.6583 4.54882 12.3417 4.54882 12.1464 4.35355C11.9512 4.15829 11.9512 3.84171 12.1464 3.64645Z M2.5 3C1.67157 3 1 3.67157 1 4.5V5.5C1 6.32843 1.67157 7 2.5 7H8.5C9.32843 7 10 6.32843 10 5.5V4.5C10 3.67157 9.32843 3 8.5 3H2.5ZM2 4.5C2 4.22386 2.22386 4 2.5 4H8.5C8.77614 4 9 4.22386 9 4.5V5.5C9 5.77614 8.77614 6 8.5 6H2.5C2.22386 6 2 5.77614 2 5.5V4.5Z M1.5 9C1.22386 9 1 9.22386 1 9.5C1 9.77614 1.22386 10 1.5 10H9.5C9.77614 10 10 9.77614 10 9.5C10 9.22386 9.77614 9 9.5 9H1.5Z M1 12.5C1 12.2239 1.22386 12 1.5 12H9.5C9.77614 12 10 12.2239 10 12.5C10 12.7761 9.77614 13 9.5 13H1.5C1.22386 13 1 12.7761 1 12.5Z" />
        </svg>
        <span className={styles.rowHeightDropdownItemText}>Medium</span>
      </div>

      <div
        className={`${styles.rowHeightDropdownItem}${currentPreset === "tall" ? ` ${styles.rowHeightDropdownItemActive}` : ""}`}
        onClick={() => { onChange("tall"); onClose(); }}
      >
        <svg className={styles.rowHeightDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="nonzero" d="M13.1464 2.64645L12.1464 3.64645C11.9512 3.84171 11.9512 4.15829 12.1464 4.35355C12.3417 4.54882 12.6583 4.54882 12.8536 4.35355L13 4.20711V11.7929L12.8536 11.6464C12.6583 11.4512 12.3417 11.4512 12.1464 11.6464C11.9512 11.8417 11.9512 12.1583 12.1464 12.3536L13.1464 13.3536C13.2402 13.4473 13.3674 13.5 13.5 13.5C13.6326 13.5 13.7598 13.4473 13.8536 13.3536L14.8536 12.3536C15.0488 12.1583 15.0488 11.8417 14.8536 11.6464C14.6583 11.4512 14.3417 11.4512 14.1464 11.6464L14 11.7929V4.20711L14.1464 4.35355C14.3417 4.54882 14.6583 4.54882 14.8536 4.35355C15.0488 4.15829 15.0488 3.84171 14.8536 3.64645L13.8536 2.64645C13.6583 2.45118 13.3417 2.45118 13.1464 2.64645Z M1 4.5C1 3.67157 1.67157 3 2.5 3H8.5C9.32843 3 10 3.67157 10 4.5V8.5C10 9.32843 9.32843 10 8.5 10H2.5C1.67157 10 1 9.32843 1 8.5V4.5ZM2.5 4C2.22386 4 2 4.22386 2 4.5V8.5C2 8.77614 2.22386 9 2.5 9H8.5C8.77614 9 9 8.77614 9 8.5V4.5C9 4.22386 8.77614 4 8.5 4H2.5Z M1.5 12C1.22386 12 1 12.2239 1 12.5C1 12.7761 1.22386 13 1.5 13H9.5C9.77614 13 10 12.7761 10 12.5C10 12.2239 9.77614 12 9.5 12H1.5Z" />
        </svg>
        <span className={styles.rowHeightDropdownItemText}>Tall</span>
      </div>

      <div
        className={`${styles.rowHeightDropdownItem}${currentPreset === "extraTall" ? ` ${styles.rowHeightDropdownItemActive}` : ""}`}
        onClick={() => { onChange("extraTall"); onClose(); }}
      >
        <svg className={styles.rowHeightDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="nonzero" d="M12.1464 3.64645L13.1464 2.64645C13.3417 2.45118 13.6583 2.45118 13.8536 2.64645L14.8536 3.64645C15.0488 3.84171 15.0488 4.15829 14.8536 4.35355C14.6583 4.54882 14.3417 4.54882 14.1464 4.35355L14 4.20711V11.7929L14.1464 11.6464C14.3417 11.4512 14.6583 11.4512 14.8536 11.6464C15.0488 11.8417 15.0488 12.1583 14.8536 12.3536L13.8536 13.3536C13.7598 13.4473 13.6326 13.5 13.5 13.5C13.3674 13.5 13.2402 13.4473 13.1464 13.3536L12.1464 12.3536C11.9512 12.1583 11.9512 11.8417 12.1464 11.6464C12.3417 11.4512 12.6583 11.4512 12.8536 11.6464L13 11.7929V4.20711L12.8536 4.35355C12.6583 4.54882 12.3417 4.54882 12.1464 4.35355C11.9512 4.15829 11.9512 3.84171 12.1464 3.64645Z M1 4.5C1 3.67157 1.67157 3 2.5 3H8.5C9.32843 3 10 3.67157 10 4.5V11.5C10 12.3284 9.32843 13 8.5 13H2.5C1.67157 13 1 12.3284 1 11.5V4.5ZM2.5 4C2.22386 4 2 4.22386 2 4.5V11.5C2 11.7761 2.22386 12 2.5 12H8.5C8.77614 12 9 11.7761 9 11.5V4.5C9 4.22386 8.77614 4 8.5 4H2.5Z" />
        </svg>
        <span className={styles.rowHeightDropdownItemText}>Extra Tall</span>
      </div>

      <div className={styles.rowHeightDropdownSeparator} />

      <div
        className={`${styles.rowHeightDropdownWrapItem}${wrapHeaders ? ` ${styles.rowHeightDropdownWrapItemActive}` : ""}`}
        onClick={() => onToggleWrapHeaders()}
      >
        <svg className={styles.rowHeightDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="nonzero" d="M2.504 2.5c.278 0 .505.226.505.504v9.992a.505.505 0 0 1-1.009 0V3.004c0-.278.226-.504.504-.504Zm10.991 0c.279 0 .505.226.505.504v9.992a.505.505 0 0 1-1.009 0V3.004c0-.278.226-.504.504-.504ZM9.063 4.704c.731 0 1.434.289 1.953.803a2.735 2.735 0 0 1 0 3.886 2.774 2.774 0 0 1-1.954.802H5.886l1.079 1.07a.5.5 0 0 1-.704.71l-1.942-1.924a.502.502 0 0 1 0-.71l1.942-1.926a.5.5 0 0 1 .704.711l-1.08 1.07h3.178c.469 0 .918-.186 1.248-.513a1.736 1.736 0 0 0 0-2.466 1.775 1.775 0 0 0-1.248-.513h-3.56a.5.5 0 0 1 0-1h3.56Z" />
        </svg>
        <span className={styles.rowHeightDropdownItemText}>Wrap headers</span>
      </div>
    </div>
  );
}
