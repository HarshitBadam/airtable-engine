import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import styles from "./FieldConfigPanel.module.css";
import type { NumberFormatConfig } from "~/shared/numberUtils";

// ============================================
// LOCAL SVG ICONS
// ============================================

/** Down chevron (for field type selector + dropdowns) */
const ChevronDown = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
    <path fillRule="nonzero" d="M4.14645 5.64645C4.34171 5.45118 4.65829 5.45118 4.85355 5.64645L8 8.79289L11.1464 5.64645C11.3417 5.45118 11.6583 5.45118 11.8536 5.64645C12.0488 5.84171 12.0488 6.15829 11.8536 6.35355L8.35355 9.85355C8.15829 10.0488 7.84171 10.0488 7.64645 9.85355L4.14645 6.35355C3.95118 6.15829 3.95118 5.84171 4.14645 5.64645Z" />
  </svg>
);

/** Plus icon (for + Add description) */
const PlusIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
    <path fillRule="nonzero" d="M8 2C7.86739 2 7.74021 2.05268 7.64645 2.14645C7.55268 2.24021 7.5 2.36739 7.5 2.5V7.5H2.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H7.5V13.5C7.5 13.6326 7.55268 13.7598 7.64645 13.8536C7.74021 13.9473 7.86739 14 8 14C8.13261 14 8.25979 13.9473 8.35355 13.8536C8.44732 13.7598 8.5 13.6326 8.5 13.5V8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H8.5V2.5C8.5 2.36739 8.44732 2.24021 8.35355 2.14645C8.25979 2.05268 8.13261 2 8 2Z" />
  </svg>
);

/** AI Agent icon (for Automate footer) */
const AiAgentIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="20" height="20" style={{ shapeRendering: "geometricPrecision" }}>
    <path fillRule="nonzero" d="M8.24023 2C10.2562 2 11.2641 2.00025 12.0342 2.39258C12.7116 2.73772 13.2623 3.28844 13.6074 3.96582C13.9997 4.73586 14 5.74379 14 7.75977V8.24023C14 10.2562 13.9997 11.2641 13.6074 12.0342C13.2623 12.7116 12.7116 13.2623 12.0342 13.6074C11.2641 13.9997 10.2562 14 8.24023 14H7.75977C5.74379 14 4.73586 13.9997 3.96582 13.6074C3.28844 13.2623 2.73772 12.7116 2.39258 12.0342C2.00025 11.2641 2 10.2562 2 8.24023V7.75977C2 5.74379 2.00025 4.73586 2.39258 3.96582C2.73772 3.28844 3.28844 2.73772 3.96582 2.39258C4.73586 2.00025 5.74379 2 7.75977 2H8.24023ZM5.95996 7C5.62396 7 5.45549 7.00004 5.32715 7.06543C5.21455 7.1229 5.1229 7.21455 5.06543 7.32715C5.00004 7.45549 5 7.62396 5 7.95996V8.04004C5 8.37604 5.00004 8.54451 5.06543 8.67285C5.1229 8.78545 5.21455 8.8771 5.32715 8.93457C5.45549 8.99996 5.62396 9 5.95996 9H6.04004C6.37604 9 6.54451 8.99996 6.67285 8.93457C6.78545 8.8771 6.8771 8.78545 6.93457 8.67285C6.99996 8.54451 7 8.37604 7 8.04004V7.95996C7 7.62396 6.99996 7.45549 6.93457 7.32715C6.8771 7.21455 6.78545 7.1229 6.67285 7.06543C6.54451 7.00004 6.37604 7 6.04004 7H5.95996ZM9.95996 7C9.62396 7 9.45549 7.00004 9.32715 7.06543C9.21455 7.1229 9.1229 7.21455 9.06543 7.32715C9.00004 7.45549 9 7.62396 9 7.95996V8.04004C9 8.37604 9.00004 8.54451 9.06543 8.67285C9.1229 8.78545 9.21455 8.8771 9.32715 8.93457C9.45549 8.99996 9.62396 9 9.95996 9H10.04C10.376 9 10.5445 8.99996 10.6729 8.93457C10.7855 8.8771 10.8771 8.78545 10.9346 8.67285C11 8.54451 11 8.37604 11 8.04004V7.95996C11 7.62396 11 7.45549 10.9346 7.32715C10.8771 7.21455 10.7855 7.1229 10.6729 7.06543C10.5445 7.00004 10.376 7 10.04 7H9.95996Z" />
  </svg>
);

/** Info circle icon (for automate footer tooltip) */
const InfoIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
    <path fillRule="nonzero" d="M7.875 6C8.28919 6 8.625 5.66419 8.625 5.25C8.625 4.83581 8.28919 4.5 7.875 4.5C7.46081 4.5 7.125 4.83581 7.125 5.25C7.125 5.66419 7.46081 6 7.875 6Z M7.5 7C7.36739 7 7.24021 7.05268 7.14645 7.14645C7.05268 7.24021 7 7.36739 7 7.5C7 7.63261 7.05268 7.75979 7.14645 7.85355C7.24021 7.94732 7.36739 8 7.5 8V11C7.50001 11.1326 7.5527 11.2598 7.64646 11.3535C7.74023 11.4473 7.8674 11.5 8 11.5H8.5C8.63261 11.5 8.75979 11.4473 8.85355 11.3536C8.94732 11.2598 9 11.1326 9 11C9 10.8674 8.94732 10.7402 8.85355 10.6464C8.75979 10.5527 8.63261 10.5 8.5 10.5V7.5C8.49999 7.3674 8.4473 7.24023 8.35354 7.14646C8.25977 7.0527 8.1326 7.00001 8 7H7.5Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
  </svg>
);

/** Clear / X-in-circle icon (for dropdown clear button) */
const ClearIcon = () => (
  <svg viewBox="0 0 12 12" fill="currentColor" width="12" height="12" style={{ shapeRendering: "geometricPrecision" }}>
    <path fillRule="evenodd" d="M6 0C2.68629 0 0 2.68629 0 6C0 9.31371 2.68629 12 6 12C9.31371 12 12 9.31371 12 6C12 2.68629 9.31371 0 6 0ZM4.35355 3.64645C4.15829 3.45118 3.84171 3.45118 3.64645 3.64645C3.45118 3.84171 3.45118 4.15829 3.64645 4.35355L5.29289 6L3.64645 7.64645C3.45118 7.84171 3.45118 8.15829 3.64645 8.35355C3.84171 8.54882 4.15829 8.54882 4.35355 8.35355L6 6.70711L7.64645 8.35355C7.84171 8.54882 8.15829 8.54882 8.35355 8.35355C8.54882 8.15829 8.54882 7.84171 8.35355 7.64645L6.70711 6L8.35355 4.35355C8.54882 4.15829 8.54882 3.84171 8.35355 3.64645C8.15829 3.45118 7.84171 3.45118 7.64645 3.64645L6 5.29289L4.35355 3.64645Z" />
  </svg>
);

// ============================================
// REUSABLE SUB-COMPONENTS
// ============================================

/** Toggle pill switch (ON = green, OFF = gray) */
function TogglePill({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div
      className={styles.togglePill}
      style={{
        backgroundColor: checked ? "rgb(4, 138, 14)" : "rgba(0, 0, 0, 0.1)",
        justifyContent: checked ? "flex-end" : "flex-start",
      }}
      onClick={onChange}
    >
      <div className={styles.togglePillCircle} />
    </div>
  );
}

// ============================================
// NUMBER DROPDOWN DATA
// ============================================

interface DropdownOption {
  label: string;
  value?: string;
}

const presetOptions: DropdownOption[] = [
  { label: "1.2345" },
  { label: "3456" },
  { label: "34.0M" },
];

const decimalPlacesOptions: DropdownOption[] = [
  { label: "0", value: "1" },
  { label: "1", value: "1.0" },
  { label: "2", value: "1.00" },
  { label: "3", value: "1.000" },
  { label: "4", value: "1.0000" },
  { label: "5", value: "1.00000" },
  { label: "6", value: "1.000000" },
  { label: "7", value: "1.0000000" },
  { label: "8", value: "1.00000000" },
];

const thousandsSepOptions: DropdownOption[] = [
  { label: "Local", value: "1,000,000.00" },
  { label: "Comma, period", value: "1,000,000.00" },
  { label: "Period, comma", value: "1.000.000,00" },
  { label: "Space, comma", value: "1 000 000,00" },
  { label: "Space, period", value: "1 000 000.00" },
];

const largeNumberOptions: DropdownOption[] = [
  { label: "Thousand", value: "K" },
  { label: "Million", value: "M" },
  { label: "Billion", value: "B" },
];

// ============================================
// NUMBER DROPDOWN COMPONENT (interactive, with portal popup)
// ============================================

function NumberDropdown({
  headingLabel,
  displayValue,
  options,
  selectedLabel,
  onSelect,
  isOpen,
  onToggle,
  hasClear,
  onClear,
}: {
  headingLabel: string;
  displayValue: string;
  options: DropdownOption[];
  selectedLabel: string | null;
  onSelect: (label: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  hasClear?: boolean;
  onClear?: () => void;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  // Position popup when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom, left: r.left, width: r.width });
      setSearch("");
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Click-outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(t) &&
        popupRef.current &&
        !popupRef.current.contains(t)
      ) {
        onToggle();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onToggle]);

  const q = search.toLowerCase().trim();
  const filtered = q
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.value?.toLowerCase().includes(q) ?? false),
      )
    : options;

  return (
    <div className={styles.numDropdownBlock}>
      <div className={styles.numDropdownLabel}>{headingLabel}</div>
      <div
        ref={triggerRef}
        className={`${styles.numDropdown} ${isOpen ? styles.numDropdownActive : ""}`}
        onClick={onToggle}
      >
        <span className={styles.numDropdownText}>{displayValue}</span>
        {hasClear && selectedLabel && onClear && (
          <span
            className={styles.numDropdownClearBtn}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            <ClearIcon />
          </span>
        )}
        <span className={styles.numDropdownChevron}>
          <ChevronDown />
        </span>
      </div>
      {isOpen &&
        createPortal(
          <div
            ref={popupRef}
            className={styles.numDropdownPopup}
            data-field-dropdown-popup="true"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 999999,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={searchRef}
              className={styles.numDropdownSearch}
              type="text"
              placeholder="Find..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className={styles.numDropdownItemsList}>
              {filtered.map((opt) => (
                <div
                  key={opt.label}
                  className={`${styles.numDropdownItem} ${
                    selectedLabel === opt.label
                      ? styles.numDropdownItemSelected
                      : ""
                  }`}
                  onClick={() => {
                    onSelect(opt.label);
                    onToggle();
                  }}
                >
                  <span className={styles.numDropdownItemLabel}>
                    {opt.label}
                  </span>
                  {opt.value !== undefined && (
                    <span className={styles.numDropdownItemValue}>
                      {opt.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ============================================
// DESCRIPTION TEXT PER FIELD TYPE
// ============================================
const fieldDescriptions: Record<string, string> = {
  "Single line text": "Enter text, or prefill each new cell with a default value.",
  Number: "Enter a number, or prefill each new cell with a default value.",
};

// ============================================
// EXAMPLE NUMBER FORMATTER
// ============================================

function computeExample(
  decimalLabel: string,
  thousandsLabel: string,
  showThousands: boolean,
  largeNumLabel: string | null,
): string {
  const decimals = parseInt(decimalLabel, 10) || 0;

  // Determine separator characters from the thousands/decimal selector
  let thousandChar = ",";
  let decimalChar = ".";
  switch (thousandsLabel) {
    case "Period, comma":
      thousandChar = ".";
      decimalChar = ",";
      break;
    case "Space, comma":
      thousandChar = "\u00A0"; // non-breaking space
      decimalChar = ",";
      break;
    case "Space, period":
      thousandChar = "\u00A0";
      decimalChar = ".";
      break;
    default: // "Local", "Comma, period"
      thousandChar = ",";
      decimalChar = ".";
      break;
  }

  let num = 3456;
  let suffix = "";

  if (largeNumLabel === "Thousand") {
    num = num / 1000;
    suffix = "K";
  } else if (largeNumLabel === "Million") {
    num = num / 1_000_000;
    suffix = "M";
  } else if (largeNumLabel === "Billion") {
    num = num / 1_000_000_000;
    suffix = "B";
  }

  // Format to fixed decimal places
  const fixed = num.toFixed(decimals);
  const dotIdx = fixed.indexOf(".");
  const intPart = dotIdx >= 0 ? fixed.slice(0, dotIdx) : fixed;
  const decPart = dotIdx >= 0 ? fixed.slice(dotIdx + 1) : "";

  // Add thousands grouping (only when enabled and no abbreviation)
  let intFormatted = intPart;
  if (showThousands && !largeNumLabel) {
    intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandChar);
  }

  // Combine
  if (decPart.length > 0) {
    return `${intFormatted}${decimalChar}${decPart}${suffix}`;
  }
  return `${intFormatted}${suffix}`;
}

// ============================================
// MAIN COMPONENT
// ============================================

interface FieldConfigPanelProps {
  fieldType: string;
  fieldTypeIcon: React.ReactNode;
  onBack: () => void;
  onClose: () => void;
  onCreateField?: (name: string, type: string, defaultValue: string, numberConfig?: NumberFormatConfig) => void;
  /** When true, panel is in "edit existing field" mode — type selector disabled, button says "Save" */
  isEditMode?: boolean;
  /** Pre-fill field name when editing */
  initialFieldName?: string;
  /** Pre-fill number config when editing a Number field */
  initialNumberConfig?: NumberFormatConfig;
  /** Called when saving in edit mode (name + optional number config) */
  onEditFieldSave?: (name: string, numberConfig?: NumberFormatConfig) => void;
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
}: FieldConfigPanelProps) {
  const [fieldName, setFieldName] = useState(initialFieldName ?? "");
  const [defaultValue, setDefaultValue] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Number-specific state (pre-fill from initialNumberConfig when editing)
  const [showThousandsSep, setShowThousandsSep] = useState(initialNumberConfig?.showThousands ?? true);
  const [allowNegative, setAllowNegative] = useState(initialNumberConfig?.allowNegative ?? true);

  // Number dropdown state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedDecimal, setSelectedDecimal] = useState<string>(
    initialNumberConfig?.decimalPlaces !== undefined ? String(initialNumberConfig.decimalPlaces) : "1"
  );
  const [selectedThousands, setSelectedThousands] = useState<string>(initialNumberConfig?.thousandsSep ?? "Local");
  const [selectedLargeNum, setSelectedLargeNum] = useState<string | null>(initialNumberConfig?.largeNumAbbrev ?? null);

  const toggleDropdown = useCallback(
    (id: string) => setOpenDropdown((prev) => (prev === id ? null : id)),
    [],
  );

  // Compute display values
  const presetDisplay = selectedPreset || "Select a preset";
  const decimalOpt = decimalPlacesOptions.find(
    (o) => o.label === selectedDecimal,
  );
  const decimalDisplay = decimalOpt
    ? `${decimalOpt.label} (${decimalOpt.value})`
    : "1 (1.0)";
  const thousandsOpt = thousandsSepOptions.find(
    (o) => o.label === selectedThousands,
  );
  const thousandsDisplay = thousandsOpt
    ? `${thousandsOpt.label} (${thousandsOpt.value})`
    : "Local (1,000,000.00)";
  const largeNumDisplay = selectedLargeNum || "None";

  const isNumber = fieldType === "Number";
  const needsScroll = isNumber;
  const descriptionText =
    fieldDescriptions[fieldType] ??
    "Enter text, or prefill each new cell with a default value.";

  // Focus field name input on mount
  useEffect(() => {
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }, []);

  const handleCreate = () => {
    // Build number format config if this is a Number field
    const numConfig: NumberFormatConfig | undefined = isNumber
      ? {
          decimalPlaces: parseInt(selectedDecimal, 10) || 0,
          thousandsSep: selectedThousands,
          showThousands: showThousandsSep,
          largeNumAbbrev: selectedLargeNum,
          allowNegative,
        }
      : undefined;

    if (isEditMode) {
      onEditFieldSave?.(fieldName, numConfig);
    } else {
      onCreateField?.(fieldName, fieldType, defaultValue, numConfig);
    }
    onClose();
  };

  return (
    <div
      className={
        needsScroll
          ? styles.configContainerScrollable
          : styles.configContainer
      }
    >
      {/* ========== TOP: Field name + Type selector ========== */}
      <div className={styles.configTop}>
        <input
          ref={nameInputRef}
          className={styles.configNameInput}
          type="text"
          placeholder="Field name (optional)"
          value={fieldName}
          onChange={(e) => setFieldName(e.target.value)}
        />
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

      {/* ========== MIDDLE: Type-specific configuration ========== */}
      {needsScroll ? (
        /* --- NUMBER FIELD (scrollable middle) --- */
        <div className={styles.configMiddleScrollable}>
          <p className={styles.configDescription}>{descriptionText}</p>

          <div className={styles.numFormattingWrapper}>
            {/* "Formatting" heading */}
            <div className={styles.numFormattingHeader}>Formatting</div>

            {/* Presets */}
            <NumberDropdown
              headingLabel="Presets"
              displayValue={presetDisplay}
              options={presetOptions}
              selectedLabel={selectedPreset}
              onSelect={(label) => {
                setSelectedPreset(label);
                // Apply concrete config values for each preset
                switch (label) {
                  case "1.2345": // High precision, no abbreviation
                    setSelectedDecimal("4");
                    setSelectedLargeNum(null);
                    break;
                  case "3456": // Integer, no abbreviation
                    setSelectedDecimal("0");
                    setSelectedLargeNum(null);
                    break;
                  case "34.0M": // 1 decimal, Million abbreviation
                    setSelectedDecimal("1");
                    setSelectedLargeNum("Million");
                    break;
                }
              }}
              isOpen={openDropdown === "presets"}
              onToggle={() => toggleDropdown("presets")}
            />

            {/* Decimal places */}
            <NumberDropdown
              headingLabel="Decimal places"
              displayValue={decimalDisplay}
              options={decimalPlacesOptions}
              selectedLabel={selectedDecimal}
              onSelect={setSelectedDecimal}
              isOpen={openDropdown === "decimal"}
              onToggle={() => toggleDropdown("decimal")}
            />

            {/* Thousands and decimal separators */}
            <NumberDropdown
              headingLabel="Thousands and decimal separators"
              displayValue={thousandsDisplay}
              options={thousandsSepOptions}
              selectedLabel={selectedThousands}
              onSelect={setSelectedThousands}
              isOpen={openDropdown === "thousands"}
              onToggle={() => toggleDropdown("thousands")}
            />

            {/* Show thousands separator toggle */}
            <div className={styles.numToggleRow}>
              <TogglePill
                checked={showThousandsSep}
                onChange={() => setShowThousandsSep((v) => !v)}
              />
              <span className={styles.numToggleLabel}>
                Show thousands separator
              </span>
            </div>

            {/* Large number abbreviation */}
            <NumberDropdown
              headingLabel="Large number abbreviation"
              displayValue={largeNumDisplay}
              options={largeNumberOptions}
              selectedLabel={selectedLargeNum}
              onSelect={setSelectedLargeNum}
              isOpen={openDropdown === "largeNum"}
              onToggle={() => toggleDropdown("largeNum")}
              hasClear
              onClear={() => setSelectedLargeNum(null)}
            />

            {/* Allow negative numbers toggle */}
            <div className={styles.numToggleRow}>
              <TogglePill
                checked={allowNegative}
                onChange={() => setAllowNegative((v) => !v)}
              />
              <span className={styles.numToggleLabel}>
                Allow negative numbers
              </span>
            </div>

            {/* Example */}
            <div className={styles.numExample}>
              Example: {computeExample(selectedDecimal, selectedThousands, showThousandsSep, selectedLargeNum)}
            </div>
          </div>

          {/* Default value section */}
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
        /* --- TEXT FIELD (fixed middle) --- */
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

      {/* ========== ACTIONS: Add description, Cancel, Create field ========== */}
      <div className={styles.configActions}>
        <button type="button" className={styles.configAddDescBtn}>
          <span className={styles.configAddDescBtnIcon}>
            <PlusIcon />
          </span>
          <span className={styles.configAddDescBtnText}>Add description</span>
        </button>
        <div className={styles.configActionsRight}>
          <button
            type="button"
            className={styles.configCancelBtn}
            onClick={onClose}
          >
            <span className={styles.configCancelBtnText}>Cancel</span>
          </button>
          <button
            type="button"
            className={styles.configCreateBtn}
            onClick={handleCreate}
          >
            <span className={styles.configCreateBtnText}>{isEditMode ? "Save" : "Create field"}</span>
          </button>
        </div>
      </div>

      {/* ========== FOOTER: Automate + Convert ========== */}
      <div className={styles.configFooter}>
        <div className={styles.configAutomateSection}>
          <span className={styles.configAutomateIcon}>
            <AiAgentIcon />
          </span>
          <span className={styles.configAutomateText}>
            Automate this field with an agent
          </span>
          <span className={styles.configInfoIcon}>
            <InfoIcon />
          </span>
        </div>
        <button type="button" className={styles.configConvertBtn}>
          <span className={styles.configConvertBtnText}>Convert</span>
        </button>
      </div>
    </div>
  );
}
