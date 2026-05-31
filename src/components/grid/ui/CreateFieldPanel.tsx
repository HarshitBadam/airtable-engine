import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./CreateFieldPanel.module.css";
import { FieldConfigPanel } from "./FieldConfigPanel";
import { FieldTypeSelector, standardFieldItems } from "./FieldTypeSelector";
import type { NumberFormatConfig } from "~/shared/numberUtils";

const SearchIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="currentColor"
    width="16"
    height="16"
    className={styles.searchIcon}
    style={{ shapeRendering: "geometricPrecision" }}
  >
    <path fillRule="nonzero" d="M7.25 1.5C4.08028 1.5 1.5 4.08028 1.5 7.25C1.5 10.4197 4.08028 13 7.25 13C8.65529 13 9.94315 12.4911 10.9432 11.6503L13.6465 14.3534C13.7402 14.4471 13.8674 14.4998 14 14.4998C14.1326 14.4998 14.2598 14.4471 14.3535 14.3534C14.4473 14.2596 14.4999 14.1325 14.4999 13.9999C14.4999 13.8673 14.4473 13.7401 14.3535 13.6464L11.6504 10.9431C12.4912 9.94305 13 8.65523 13 7.25C13 4.08028 10.4197 1.5 7.25 1.5ZM7.25 2.5C9.87928 2.5 12 4.62072 12 7.25C12 8.56227 11.4715 9.74761 10.6154 10.6061C10.6132 10.607 10.611 10.6079 10.6089 10.6088C10.608 10.611 10.6071 10.6132 10.6062 10.6154C9.74772 11.4715 8.5623 12 7.25 12C4.62072 12 2.5 9.87928 2.5 7.25C2.5 4.62072 4.62072 2.5 7.25 2.5Z" />
  </svg>
);

const QuestionIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="currentColor"
    width="16"
    height="16"
    style={{ shapeRendering: "geometricPrecision", display: "block" }}
  >
    <path fillRule="nonzero" d="M8.07349 4.50134C7.75062 4.49155 7.43049 4.55078 7.13904 4.67151C6.36183 4.99344 5.75017 5.76895 5.75 6.74988C5.74997 6.88249 5.80262 7.00968 5.89636 7.10347C5.99011 7.19726 6.11727 7.24997 6.24988 7.25C6.31554 7.25002 6.38056 7.2371 6.44123 7.21199C6.5019 7.18687 6.55703 7.15006 6.60347 7.10364C6.64991 7.05722 6.68675 7.00211 6.71189 6.94145C6.73704 6.8808 6.74998 6.81578 6.75 6.75012C6.75013 6.17215 7.08092 5.77793 7.52173 5.59534C7.96254 5.41275 8.47515 5.45759 8.88391 5.86621C9.24251 6.22468 9.34907 6.75995 9.15503 7.22839C8.96099 7.69684 8.50716 8.00009 8.00012 8C7.93445 7.99999 7.86942 8.01292 7.80875 8.03804C7.74808 8.06316 7.69295 8.09999 7.6465 8.14642C7.60006 8.19285 7.56322 8.24797 7.53809 8.30864C7.51295 8.36931 7.50001 8.43433 7.5 8.5V9C7.5 9.13261 7.55268 9.25979 7.64645 9.35355C7.74021 9.44732 7.86739 9.5 8 9.5C8.13261 9.5 8.25979 9.44732 8.35355 9.35355C8.44732 9.25979 8.5 9.13261 8.5 9V8.93738C9.1999 8.77686 9.79665 8.2924 10.0789 7.61108C10.4266 6.77156 10.2336 5.80137 9.59094 5.15894C9.15735 4.7255 8.61159 4.51766 8.07349 4.50134Z M8 12C8.41419 12 8.75 11.6642 8.75 11.25C8.75 10.8358 8.41419 10.5 8 10.5C7.58581 10.5 7.25 10.8358 7.25 11.25C7.25 11.6642 7.58581 12 8 12Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
  </svg>
);

interface EditFieldInfo {
  fieldName: string;
  fieldType: string;
  numberConfig?: NumberFormatConfig;
}

interface CreateFieldPanelProps {
  position: { top: number; left: number };
  onClose: () => void;
  onSelectFieldType?: (fieldType: string) => void;
  onCreateField?: (name: string, type: string, defaultValue: string, numberConfig?: NumberFormatConfig) => void;
  editField?: EditFieldInfo;
  onEditFieldSave?: (name: string, numberConfig?: NumberFormatConfig) => void;
  existingFieldNames?: string[];
  baseColor?: string;
}

export function CreateFieldPanel({
  position,
  onClose,
  onSelectFieldType,
  onCreateField,
  editField,
  onEditFieldSave,
  existingFieldNames,
  baseColor,
}: CreateFieldPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedField, setSelectedField] = useState<{ label: string; icon: React.ReactNode } | null>(null);
  const [pickerMode, setPickerMode] = useState<"full" | "typeSwitch">("full");
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editModeInitialized = useRef(false);

  useEffect(() => {
    if (editField && !editModeInitialized.current) {
      editModeInitialized.current = true;
      const match = standardFieldItems.find((f) => f.label === editField.fieldType);
      if (match) {
        setSelectedField({ label: match.label, icon: match.icon });
      }
    }
  }, [editField]);

  useEffect(() => {
    if (!selectedField) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [selectedField]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (target.closest?.("[data-field-dropdown-popup]")) return;
        if (target.closest?.("[data-discard-dialog]")) return;
        if (selectedField?.label === "Number" && !editField) {
          setShowDiscardDialog(true);
          return;
        }
        onClose();
      }
    }
    const t = setTimeout(() => document.addEventListener("mousedown", handleClickOutside), 10);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handleClickOutside); };
  }, [onClose, selectedField, editField]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showDiscardDialog) {
          setShowDiscardDialog(false);
          return;
        }
        if (selectedField?.label === "Number" && !editField) {
          setShowDiscardDialog(true);
          return;
        }
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, selectedField, showDiscardDialog, editField]);

  const maxHeight = Math.max(300, window.innerHeight - position.top - 8);

  return (
    <>
      {createPortal(
        <div
          ref={panelRef}
          className={styles.createFieldPanel}
          style={{
            position: "fixed",
            zIndex: 99999,
            top: position.top,
            left: position.left,
            maxHeight: selectedField ? undefined : maxHeight,
            padding: selectedField ? 0 : 6,
            overflowY: selectedField ? "visible" : "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {selectedField ? (
            <FieldConfigPanel
              fieldType={selectedField.label}
              fieldTypeIcon={selectedField.icon}
              onBack={() => {
                setPickerMode("typeSwitch");
                setSelectedField(null);
                setSearchQuery("");
              }}
              onClose={onClose}
              onCreateField={onCreateField}
              isEditMode={!!editField}
              initialFieldName={editField?.fieldName}
              initialNumberConfig={editField?.numberConfig}
              onEditFieldSave={onEditFieldSave}
              existingFieldNames={existingFieldNames}
              baseColor={baseColor}
            />
          ) : (
            <>
              <div className={styles.searchHeader}>
                <div className={styles.searchRow}>
                  <div className={styles.searchBox}>
                    <SearchIcon />
                    <input
                      ref={inputRef}
                      className={styles.searchInput}
                      type="text"
                      placeholder="Find a field type"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <span className={styles.questionIcon}>
                    <QuestionIcon />
                  </span>
                </div>
              </div>

              <hr className={`${styles.divider} ${pickerMode === "typeSwitch" ? styles.dividerSticky : ""}`} />

              <div className={styles.scrollableContent}>
                <FieldTypeSelector
                  pickerMode={pickerMode}
                  searchQuery={searchQuery}
                  onSelect={(label, icon) => {
                    setSelectedField({ label, icon });
                    onSelectFieldType?.(label);
                  }}
                />
              </div>
            </>
          )}
        </div>,
        document.body,
      )}

      {showDiscardDialog &&
        createPortal(
          <div
            className={styles.discardOverlay}
            data-discard-dialog="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setShowDiscardDialog(false);
              }
            }}
          >
            <div className={styles.discardDialog}>
              <p className={styles.discardTitle}>Discard your new field?</p>
              <div className={styles.discardActions}>
                <button
                  type="button"
                  className={styles.discardCancelBtn}
                  onClick={() => setShowDiscardDialog(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.discardConfirmBtn}
                  onClick={onClose}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
