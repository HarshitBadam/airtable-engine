import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import styles from "./FieldConfigPanel.module.css";
import type { NumberFormatConfig } from "~/shared/numberUtils";

const ChevronDown = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
    <path fillRule="nonzero" d="M4.14645 5.64645C4.34171 5.45118 4.65829 5.45118 4.85355 5.64645L8 8.79289L11.1464 5.64645C11.3417 5.45118 11.6583 5.45118 11.8536 5.64645C12.0488 5.84171 12.0488 6.15829 11.8536 6.35355L8.35355 9.85355C8.15829 10.0488 7.84171 10.0488 7.64645 9.85355L4.14645 6.35355C3.95118 6.15829 3.95118 5.84171 4.14645 5.64645Z" />
  </svg>
);

const ClearIcon = () => (
  <svg viewBox="0 0 12 12" fill="currentColor" width="12" height="12" style={{ shapeRendering: "geometricPrecision" }}>
    <path fillRule="evenodd" d="M6 0C2.68629 0 0 2.68629 0 6C0 9.31371 2.68629 12 6 12C9.31371 12 12 9.31371 12 6C12 2.68629 9.31371 0 6 0ZM4.35355 3.64645C4.15829 3.45118 3.84171 3.45118 3.64645 3.64645C3.45118 3.84171 3.45118 4.15829 3.64645 4.35355L5.29289 6L3.64645 7.64645C3.45118 7.84171 3.45118 8.15829 3.64645 8.35355C3.84171 8.54882 4.15829 8.54882 4.35355 8.35355L6 6.70711L7.64645 8.35355C7.84171 8.54882 8.15829 8.54882 8.35355 8.35355C8.54882 8.15829 8.54882 7.84171 8.35355 7.64645L6.70711 6L8.35355 4.35355C8.54882 4.15829 8.54882 3.84171 8.35355 3.64645C8.15829 3.45118 7.84171 3.45118 7.64645 3.64645L6 5.29289L4.35355 3.64645Z" />
  </svg>
);

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

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom, left: r.left, width: r.width });
      setSearch("");
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [isOpen]);

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
                    selectedLabel === opt.label ? styles.numDropdownItemSelected : ""
                  }`}
                  onClick={() => {
                    onSelect(opt.label);
                    onToggle();
                  }}
                >
                  <span className={styles.numDropdownItemLabel}>{opt.label}</span>
                  {opt.value !== undefined && (
                    <span className={styles.numDropdownItemValue}>{opt.value}</span>
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

function computeExample(
  decimalLabel: string,
  thousandsLabel: string,
  showThousands: boolean,
  largeNumLabel: string | null,
): string {
  const decimals = parseInt(decimalLabel, 10) || 0;

  let thousandChar = ",";
  let decimalChar = ".";
  switch (thousandsLabel) {
    case "Period, comma":
      thousandChar = ".";
      decimalChar = ",";
      break;
    case "Space, comma":
      thousandChar = "\u00A0";
      decimalChar = ",";
      break;
    case "Space, period":
      thousandChar = "\u00A0";
      decimalChar = ".";
      break;
    default:
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

  const fixed = num.toFixed(decimals);
  const dotIdx = fixed.indexOf(".");
  const intPart = dotIdx >= 0 ? fixed.slice(0, dotIdx) : fixed;
  const decPart = dotIdx >= 0 ? fixed.slice(dotIdx + 1) : "";

  let intFormatted = intPart;
  if (showThousands && !largeNumLabel) {
    intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandChar);
  }

  if (decPart.length > 0) {
    return `${intFormatted}${decimalChar}${decPart}${suffix}`;
  }
  return `${intFormatted}${suffix}`;
}

export interface NumberFormatSectionProps {
  initialConfig?: NumberFormatConfig;
  onChange: (cfg: NumberFormatConfig) => void;
}

export function NumberFormatSection({ initialConfig, onChange }: NumberFormatSectionProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedDecimal, setSelectedDecimal] = useState<string>(
    initialConfig?.decimalPlaces !== undefined ? String(initialConfig.decimalPlaces) : "1",
  );
  const [selectedThousands, setSelectedThousands] = useState<string>(
    initialConfig?.thousandsSep ?? "Local",
  );
  const [selectedLargeNum, setSelectedLargeNum] = useState<string | null>(
    initialConfig?.largeNumAbbrev ?? null,
  );
  const [showThousandsSep, setShowThousandsSep] = useState(
    initialConfig?.showThousands ?? true,
  );
  const [allowNegative, setAllowNegative] = useState(
    initialConfig?.allowNegative ?? true,
  );

  const toggleDropdown = useCallback(
    (id: string) => setOpenDropdown((prev) => (prev === id ? null : id)),
    [],
  );

  useEffect(() => {
    onChange({
      decimalPlaces: parseInt(selectedDecimal, 10) || 0,
      thousandsSep: selectedThousands,
      showThousands: showThousandsSep,
      largeNumAbbrev: selectedLargeNum,
      allowNegative,
    });
  }, [selectedDecimal, selectedThousands, showThousandsSep, selectedLargeNum, allowNegative, onChange]);

  const presetDisplay = selectedPreset ?? "Select a preset";
  const decimalOpt = decimalPlacesOptions.find((o) => o.label === selectedDecimal);
  const decimalDisplay = decimalOpt ? `${decimalOpt.label} (${decimalOpt.value})` : "1 (1.0)";
  const thousandsOpt = thousandsSepOptions.find((o) => o.label === selectedThousands);
  const thousandsDisplay = thousandsOpt
    ? `${thousandsOpt.label} (${thousandsOpt.value})`
    : "Local (1,000,000.00)";
  const largeNumDisplay = selectedLargeNum ?? "None";

  return (
    <div className={styles.numFormattingWrapper}>
      <div className={styles.numFormattingHeader}>Formatting</div>

      <NumberDropdown
        headingLabel="Presets"
        displayValue={presetDisplay}
        options={presetOptions}
        selectedLabel={selectedPreset}
        onSelect={(label) => {
          setSelectedPreset(label);
          switch (label) {
            case "1.2345":
              setSelectedDecimal("4");
              setSelectedLargeNum(null);
              break;
            case "3456":
              setSelectedDecimal("0");
              setSelectedLargeNum(null);
              break;
            case "34.0M":
              setSelectedDecimal("1");
              setSelectedLargeNum("Million");
              break;
          }
        }}
        isOpen={openDropdown === "presets"}
        onToggle={() => toggleDropdown("presets")}
      />

      <NumberDropdown
        headingLabel="Decimal places"
        displayValue={decimalDisplay}
        options={decimalPlacesOptions}
        selectedLabel={selectedDecimal}
        onSelect={setSelectedDecimal}
        isOpen={openDropdown === "decimal"}
        onToggle={() => toggleDropdown("decimal")}
      />

      <NumberDropdown
        headingLabel="Thousands and decimal separators"
        displayValue={thousandsDisplay}
        options={thousandsSepOptions}
        selectedLabel={selectedThousands}
        onSelect={setSelectedThousands}
        isOpen={openDropdown === "thousands"}
        onToggle={() => toggleDropdown("thousands")}
      />

      <div className={styles.numToggleRow}>
        <TogglePill
          checked={showThousandsSep}
          onChange={() => setShowThousandsSep((v) => !v)}
        />
        <span className={styles.numToggleLabel}>Show thousands separator</span>
      </div>

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

      <div className={styles.numToggleRow}>
        <TogglePill
          checked={allowNegative}
          onChange={() => setAllowNegative((v) => !v)}
        />
        <span className={styles.numToggleLabel}>Allow negative numbers</span>
      </div>

      <div className={styles.numExample}>
        Example:{" "}
        {computeExample(selectedDecimal, selectedThousands, showThousandsSep, selectedLargeNum)}
      </div>
    </div>
  );
}
