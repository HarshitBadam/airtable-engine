import React, { useState, useEffect, useCallback } from "react";
import styles from "./NumberFormatConfig.module.css";
import type { NumberFormatConfig } from "~/shared/numberUtils";
import {
  NumberDropdown,
  computeExample,
  presetOptions,
  decimalPlacesOptions,
  thousandsSepOptions,
  largeNumberOptions,
} from "./NumberDropdown";

function TogglePill({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
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

export interface NumberFormatSectionProps {
  initialConfig?: NumberFormatConfig;
  onChange: (cfg: NumberFormatConfig) => void;
}

export function NumberFormatSection({
  initialConfig,
  onChange,
}: NumberFormatSectionProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedDecimal, setSelectedDecimal] = useState<string>(
    initialConfig?.decimalPlaces !== undefined
      ? String(initialConfig.decimalPlaces)
      : "1",
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
  }, [
    selectedDecimal,
    selectedThousands,
    showThousandsSep,
    selectedLargeNum,
    allowNegative,
    onChange,
  ]);

  const presetDisplay = selectedPreset ?? "Select a preset";
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
        {computeExample(
          selectedDecimal,
          selectedThousands,
          showThousandsSep,
          selectedLargeNum,
        )}
      </div>
    </div>
  );
}
