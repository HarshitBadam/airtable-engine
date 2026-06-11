import React, { useState, useRef, useEffect, useCallback } from "react";
import styles from "./FieldConfigPanel.module.css";
import { NumberFormatSection } from "./NumberFormatConfig";
import type { NumberFormatConfig } from "~/shared/numberUtils";
import { DEFAULT_NUMBER_CONFIG } from "~/shared/numberUtils";

const ChevronDown = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
    <path fillRule="nonzero" d="M4.14645 5.64645C4.34171 5.45118 4.65829 5.45118 4.85355 5.64645L8 8.79289L11.1464 5.64645C11.3417 5.45118 11.6583 5.45118 11.8536 5.64645C12.0488 5.84171 12.0488 6.15829 11.8536 6.35355L8.35355 9.85355C8.15829 10.0488 7.84171 10.0488 7.64645 9.85355L4.14645 6.35355C3.95118 6.15829 3.95118 5.84171 4.14645 5.64645Z" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
    <path fillRule="nonzero" d="M8 2C7.86739 2 7.74021 2.05268 7.64645 2.14645C7.55268 2.24021 7.5 2.36739 7.5 2.5V7.5H2.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H7.5V13.5C7.5 13.6326 7.55268 13.7598 7.64645 13.8536C7.74021 13.9473 7.86739 14 8 14C8.13261 14 8.25979 13.9473 8.35355 13.8536C8.44732 13.7598 8.5 13.6326 8.5 13.5V8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H8.5V2.5C8.5 2.36739 8.44732 2.24021 8.35355 2.14645C8.25979 2.05268 8.13261 2 8 2Z" />
  </svg>
);

const AiAgentIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="20" height="20" style={{ shapeRendering: "geometricPrecision" }}>
    <path fillRule="nonzero" d="M8.24023 2C10.2562 2 11.2641 2.00025 12.0342 2.39258C12.7116 2.73772 13.2623 3.28844 13.6074 3.96582C13.9997 4.73586 14 5.74379 14 7.75977V8.24023C14 10.2562 13.9997 11.2641 13.6074 12.0342C13.2623 12.7116 12.7116 13.2623 12.0342 13.6074C11.2641 13.9997 10.2562 14 8.24023 14H7.75977C5.74379 14 4.73586 13.9997 3.96582 13.6074C3.28844 13.2623 2.73772 12.7116 2.39258 12.0342C2.00025 11.2641 2 10.2562 2 8.24023V7.75977C2 5.74379 2.00025 4.73586 2.39258 3.96582C2.73772 3.28844 3.28844 2.73772 3.96582 2.39258C4.73586 2.00025 5.74379 2 7.75977 2H8.24023ZM5.95996 7C5.62396 7 5.45549 7.00004 5.32715 7.06543C5.21455 7.1229 5.1229 7.21455 5.06543 7.32715C5.00004 7.45549 5 7.62396 5 7.95996V8.04004C5 8.37604 5.00004 8.54451 5.06543 8.67285C5.1229 8.78545 5.21455 8.8771 5.32715 8.93457C5.45549 8.99996 5.62396 9 5.95996 9H6.04004C6.37604 9 6.54451 8.99996 6.67285 8.93457C6.78545 8.8771 6.8771 8.78545 6.93457 8.67285C6.99996 8.54451 7 8.37604 7 8.04004V7.95996C7 7.62396 6.99996 7.45549 6.93457 7.32715C6.8771 7.21455 6.78545 7.1229 6.67285 7.06543C6.54451 7.00004 6.37604 7 6.04004 7H5.95996ZM9.95996 7C9.62396 7 9.45549 7.00004 9.32715 7.06543C9.21455 7.1229 9.1229 7.21455 9.06543 7.32715C9.00004 7.45549 9 7.62396 9 7.95996V8.04004C9 8.37604 9.00004 8.54451 9.06543 8.67285C9.1229 8.78545 9.21455 8.8771 9.32715 8.93457C9.45549 8.99996 9.62396 9 9.95996 9H10.04C10.376 9 10.5445 8.99996 10.6729 8.93457C10.7855 8.8771 10.8771 8.78545 10.9346 8.67285C11 8.54451 11 8.37604 11 8.04004V7.95996C11 7.62396 11 7.45549 10.9346 7.32715C10.8771 7.21455 10.7855 7.1229 10.6729 7.06543C10.5445 7.00004 10.376 7 10.04 7H9.95996Z" />
  </svg>
);

const InfoIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
    <path fillRule="nonzero" d="M7.875 6C8.28919 6 8.625 5.66419 8.625 5.25C8.625 4.83581 8.28919 4.5 7.875 4.5C7.46081 4.5 7.125 4.83581 7.125 5.25C7.125 5.66419 7.46081 6 7.875 6Z M7.5 7C7.36739 7 7.24021 7.05268 7.14645 7.14645C7.05268 7.24021 7 7.36739 7 7.5C7 7.63261 7.05268 7.75979 7.14645 7.85355C7.24021 7.94732 7.36739 8 7.5 8V11C7.50001 11.1326 7.5527 11.2598 7.64646 11.3535C7.74023 11.4473 7.8674 11.5 8 11.5H8.5C8.63261 11.5 8.75979 11.4473 8.85355 11.3536C8.94732 11.2598 9 11.1326 9 11C9 10.8674 8.94732 10.7402 8.85355 10.6464C8.75979 10.5527 8.63261 10.5 8.5 10.5V7.5C8.49999 7.3674 8.4473 7.24023 8.35354 7.14646C8.25977 7.0527 8.1326 7.00001 8 7H7.5Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
  </svg>
);

const fieldDescriptions: Record<string, string> = {
  "Single line text": "Enter text, or prefill each new cell with a default value.",
  Number: "Enter a number, or prefill each new cell with a default value.",
};

interface FieldConfigPanelProps {
  fieldType: string;
  fieldTypeIcon: React.ReactNode;
  onBack: () => void;
  onClose: () => void;
  onCreateField?: (name: string, type: string, defaultValue: string, numberConfig?: NumberFormatConfig) => void;
  isEditMode?: boolean;
  initialFieldName?: string;
  initialNumberConfig?: NumberFormatConfig;
  onEditFieldSave?: (name: string, numberConfig?: NumberFormatConfig) => void;
  existingFieldNames?: string[];
  baseColor?: string;
}

export function FieldConfigPanel({
  fieldType,
  fieldTypeIcon,
  onBack,
  onClose,
  onCreateField,
  isEditMode,
  initialFieldName,
  initialNumberConfig,
  onEditFieldSave,
  existingFieldNames,
  baseColor,
}: FieldConfigPanelProps) {
  const [fieldName, setFieldName] = useState(initialFieldName ?? "");
  const [defaultValue, setDefaultValue] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [showCreateDuplicateWarning, setShowCreateDuplicateWarning] = useState(false);

  const isNumber = fieldType === "Number";

  const numberConfigRef = useRef<NumberFormatConfig>(
    initialNumberConfig ?? DEFAULT_NUMBER_CONFIG,
  );

  const handleNumberConfigChange = useCallback((cfg: NumberFormatConfig) => {
    numberConfigRef.current = cfg;
  }, []);

  const descriptionText =
    fieldDescriptions[fieldType] ?? "Enter text, or prefill each new cell with a default value.";

  useEffect(() => {
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }, []);

  const isDuplicateFieldName = (() => {
    const trimmed = fieldName.trim();
    if (!trimmed || !existingFieldNames) return false;
    if (isEditMode && trimmed === initialFieldName) return false;
    return existingFieldNames.some((n) => n === trimmed);
  })();

  const handleCreate = () => {
    if (isEditMode && isDuplicateFieldName) return;

    if (!isEditMode && isDuplicateFieldName) {
      setShowCreateDuplicateWarning(true);
      return;
    }
    setShowCreateDuplicateWarning(false);

    const numConfig: NumberFormatConfig | undefined = isNumber
      ? numberConfigRef.current
      : undefined;

    if (isEditMode) {
      onEditFieldSave?.(fieldName, numConfig);
    } else {
      onCreateField?.(fieldName, fieldType, defaultValue, numConfig);
    }
    onClose();
  };

  return (
    <div className={isNumber ? styles.configContainerScrollable : styles.configContainer}>
      <div className={!isEditMode ? styles.configTopCreate : styles.configTop}>
        <input
          ref={nameInputRef}
          className={styles.configNameInput}
          type="text"
          placeholder="Field name (optional)"
          value={fieldName}
          onChange={(e) => {
            setFieldName(e.target.value);
            if (showCreateDuplicateWarning) setShowCreateDuplicateWarning(false);
          }}
        />
        {showCreateDuplicateWarning && (
          <div className={styles.configCreateDuplicateWarning}>
            Please enter a unique field name
          </div>
        )}
        <div
          className={`${styles.configTypeSelector}${isEditMode ? ` ${styles.configTypeSelectorDisabled}` : ""}`}
          onClick={isEditMode ? undefined : onBack}
        >
          <span className={styles.configTypeSelectorIcon}>{fieldTypeIcon}</span>
          <span className={styles.configTypeSelectorText}>{fieldType}</span>
          <span className={styles.configTypeSelectorChevron}>
            <ChevronDown />
          </span>
        </div>
      </div>

      {isNumber ? (
        <div className={styles.configMiddleScrollable}>
          <p className={styles.configDescription}>{descriptionText}</p>
          <NumberFormatSection
            initialConfig={initialNumberConfig}
            onChange={handleNumberConfigChange}
          />
          <div className={styles.configDefaultSection}>
            <label className={styles.configDefaultLabel}>Default</label>
            <input
              className={styles.configDefaultInput}
              type="text"
              placeholder="Enter default value (optional)"
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className={styles.configMiddle}>
          <div className={styles.configMiddleInner}>
            <p className={styles.configDescription}>{descriptionText}</p>
            <div className={styles.configDefaultSection}>
              <label className={styles.configDefaultLabel}>Default</label>
              <input
                className={styles.configDefaultInput}
                type="text"
                placeholder="Enter default value (optional)"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {isEditMode ? (
        <div className={styles.configActionsEditWrapper}>
          {isDuplicateFieldName && (
            <div className={styles.configDuplicateWarning}>
              Please enter a unique field name
            </div>
          )}
          <div className={styles.configActionsInner}>
            <button type="button" disabled className={styles.configAddDescBtn}>
              <span className={styles.configAddDescBtnIcon}>
                <PlusIcon />
              </span>
              <span className={styles.configAddDescBtnText}>Add description</span>
            </button>
            <div className={styles.configActionsRight}>
              <button type="button" className={styles.configCancelBtn} onClick={onClose}>
                <span className={styles.configCancelBtnText}>Cancel</span>
              </button>
              <button type="button" className={styles.configCreateBtn} onClick={handleCreate}>
                <span className={styles.configCreateBtnText}>Save</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.configActions}>
          <button type="button" disabled className={styles.configAddDescBtn}>
            <span className={styles.configAddDescBtnIcon}>
              <PlusIcon />
            </span>
            <span className={styles.configAddDescBtnText}>Add description</span>
          </button>
          <div className={styles.configActionsRight}>
            <button type="button" className={styles.configCancelBtn} onClick={onClose}>
              <span className={styles.configCancelBtnText}>Cancel</span>
            </button>
            <button type="button" className={styles.configCreateBtn} onClick={handleCreate}>
              <span className={styles.configCreateBtnText}>Create field</span>
            </button>
          </div>
        </div>
      )}

      {!isEditMode && (
        <div className={styles.configFooter}>
          <div className={styles.configAutomateSection} style={{ opacity: 0.5 }}>
            <span
              className={styles.configAutomateIcon}
              style={baseColor ? { color: baseColor } : undefined}
            >
              <AiAgentIcon />
            </span>
            <span className={styles.configAutomateText}>
              Automate this field with an agent
            </span>
            <span className={styles.configInfoIcon}>
              <InfoIcon />
            </span>
          </div>
          <button type="button" disabled className={styles.configConvertBtn}>
            <span className={styles.configConvertBtnText}>Convert</span>
          </button>
        </div>
      )}
    </div>
  );
}
