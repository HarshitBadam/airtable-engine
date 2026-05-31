import React, { createContext, useContext } from "react";
import type { SubDropdown } from "../utils/filterPanelTypes";

export interface FilterPanelContextValue {
  dragIndex: number | null;
  inGroupDrag: { groupId: string; fromIdx: number; overIdx: number } | null;
  getRowDragStyle: (index: number) => React.CSSProperties | undefined;
  getInGroupDragStyle: (groupId: string, childIdx: number) => React.CSSProperties | undefined;

  openDropdown: SubDropdown;
  dropIntoGroupId: string | null;
  expandingGroupId: string | null;

  conjunctionRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  fieldDropdownRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  operatorDropdownRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  groupConjunctionRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  groupBoxRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  groupContentRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  groupPlusRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;

  onConjunctionClick: (conditionId: string) => void;
  onGroupConjunctionClick: (groupId: string) => void;
  onFieldClick: (conditionId: string) => void;
  onOperatorClick: (conditionId: string) => void;
  onValueChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
  onDragStart: (e: React.MouseEvent, index: number) => void;
  onInGroupDragStart: (e: React.MouseEvent, groupId: string, childIdx: number) => void;
  onGroupPlusClick: (groupId: string) => void;
  onToggleGroupConjunction: (groupId: string) => void;
  onRemoveGroup: (id: string) => void;

  getColumnName: (columnId: string) => string;
  getColumnType: (columnId: string) => string;
}

const FilterPanelContext = createContext<FilterPanelContextValue | null>(null);

export function FilterPanelProvider({
  value,
  children,
}: {
  value: FilterPanelContextValue;
  children: React.ReactNode;
}) {
  return (
    <FilterPanelContext.Provider value={value}>
      {children}
    </FilterPanelContext.Provider>
  );
}

export function useFilterPanel(): FilterPanelContextValue {
  const ctx = useContext(FilterPanelContext);
  if (!ctx) throw new Error("useFilterPanel must be used within a FilterPanelProvider");
  return ctx;
}
