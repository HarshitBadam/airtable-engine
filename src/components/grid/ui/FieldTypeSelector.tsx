import React from "react";
import styles from "./CreateFieldPanel.module.css";
import {
  fieldAgentItems,
  standardFieldItems,
  enabledFieldTypes,
} from "~/components/grid/utils/fieldTypeData";

export type { FieldAgentItem, StandardFieldItem } from "~/components/grid/utils/fieldTypeData";
export { fieldAgentItems, standardFieldItems, enabledFieldTypes } from "~/components/grid/utils/fieldTypeData";

const ChevronRight = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
    <path fillRule="nonzero" d="M5.64645 3.64645C5.45118 3.84171 5.45118 4.15829 5.64645 4.35355L9.29289 8L5.64645 11.6464C5.45118 11.8417 5.45118 12.1583 5.64645 12.3536C5.84171 12.5488 6.15829 12.5488 6.35355 12.3536L10.3536 8.35355C10.5488 8.15829 10.5488 7.84171 10.3536 7.64645L6.35355 3.64645C6.15829 3.45118 5.84171 3.45118 5.64645 3.64645Z" />
  </svg>
);

export interface FieldTypeSelectorProps {
  pickerMode: "full" | "typeSwitch";
  searchQuery: string;
  onSelect: (label: string, icon: React.ReactNode) => void;
}

export function FieldTypeSelector({ pickerMode, searchQuery, onSelect }: FieldTypeSelectorProps) {
  const queryLower = searchQuery.toLowerCase().trim();

  const filteredAgents = queryLower
    ? fieldAgentItems.filter((item) => item.label.toLowerCase().includes(queryLower))
    : fieldAgentItems;

  const filteredStandard = queryLower
    ? standardFieldItems.filter((item) => item.label.toLowerCase().includes(queryLower))
    : standardFieldItems;

  const isEmpty =
    pickerMode === "full"
      ? filteredAgents.length === 0 && filteredStandard.length === 0
      : filteredStandard.length === 0;

  return (
    <>
      {pickerMode === "full" && filteredAgents.length > 0 && (
        <>
          <p className={styles.sectionLabel}>Field agents</p>
          <div className={styles.agentsGrid}>
            {filteredAgents.map((agent, idx) => {
              const coloredHover = idx < 6;
              return (
                <div
                  key={agent.label}
                  className={styles.agentItem}
                  style={
                    coloredHover
                      ? ({ "--hover-bg": `${agent.color}14` } as React.CSSProperties)
                      : undefined
                  }
                  onClick={() => onSelect(agent.label, agent.icon)}
                >
                  <span className={styles.agentItemIcon} style={{ color: agent.color }}>
                    {agent.icon}
                  </span>
                  <span className={styles.agentItemText}>{agent.label}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {pickerMode === "full" && filteredAgents.length > 0 && filteredStandard.length > 0 && (
        <hr className={styles.dividerThin} />
      )}

      {filteredStandard.length > 0 && (
        <>
          {pickerMode === "full" && <p className={styles.sectionLabel}>Standard fields</p>}
          {filteredStandard.map((field) => {
            const disabled = !enabledFieldTypes.has(field.label);
            return (
              <div
                key={field.label}
                className={`${styles.standardItem} ${disabled ? styles.disabledItem : ""}`}
                onClick={
                  disabled ? undefined : () => onSelect(field.label, field.icon)
                }
              >
                <span className={styles.standardItemIcon}>{field.icon}</span>
                <span className={styles.standardItemTextWrapper}>
                  <span className={styles.standardItemText}>{field.label}</span>
                  {field.hasChevron && (
                    <span className={styles.standardItemChevron}>
                      <ChevronRight />
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </>
      )}

      {isEmpty && <p className={styles.emptyState}>No matching field types</p>}
    </>
  );
}
