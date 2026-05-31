/*
 * FilterPanel.tsx is intentionally at the line limit. It renders the complete
 * filter UI: condition rows, group blocks, drag overlay, conjunction toggles,
 * and sub-dropdowns — all sharing tightly coupled state from FilterPanelContext.
 * Splitting by UI section would scatter co-dependent state handlers.
 */
import React, { useState, useCallback, useRef, useEffect } from "react";
import styles from "./FilterPanel.module.css";
import type { SubDropdown, FilterColumn } from "../utils/filterPanelTypes";
import { isGroup } from "~/components/grid/utils/filterTree";
import type { FilterTreeCondition, FilterTreeItem } from "~/components/grid/utils/filterTree";
import { getOperatorsForType } from "~/components/grid/utils/filterOperators";
import { useFilterTreeState } from "~/components/grid/hooks/useFilterTreeState";
import { useFilterDrag } from "~/components/grid/hooks/useFilterDrag";
import { FilterConditionRow } from "./FilterConditionRow";
import { FilterGroupBlock } from "./FilterGroupBlock";
import { FilterPanelProvider } from "./FilterPanelContext";
import { FilterDropdowns } from "./FilterDropdowns";
import { FilterDragOverlay } from "./FilterDragOverlay";
import { QuestionIcon, PlusIcon, ChevronDownIcon, OmniIcon } from "./FilterIcons";

export type { FilterColumn };

interface FilterPanelProps {
  /** Base color (hex) for the Omni icon tint. */
  baseColor?: string;
  columns?: FilterColumn[];
}

export function FilterPanel({ baseColor, columns = [] }: FilterPanelProps) {
  const {
    rootItems,
    setRootItems,
    rootConjunction,
    setRootConjunction,
    hasAnyItems,
    panelHasGroups,
    panelHasNestedGroups,
    addCondition,
    removeCondition,
    updateValue,
    updateField: treeUpdateField,
    updateOperator: treeUpdateOperator,
    addRootGroup,
    removeGroup,
    addConditionToGroup: treeAddConditionToGroup,
    addNestedGroupToGroup: treeAddNestedGroupToGroup,
    handleToggleGroupConjunction,
    setGroupConjunction,
  } = useFilterTreeState({ columns });

  const {
    dragIndex,
    dragPos,
    dropIntoGroupId,
    expandingGroupId,
    inGroupDrag,
    inGroupDragPos,
    rowsContainerRef,
    itemRectsRef,
    inGroupItemRectsRef,
    groupBoxRefs,
    groupContentRefs,
    handleDragStart,
    handleInGroupDragStart,
    getRowDragStyle,
    getInGroupDragStyle,
  } = useFilterDrag({
    rootItems,
    setRootItems,
    closeDropdown: () => setOpenDropdown(null),
  });

  const [openDropdown, setOpenDropdown] = useState<SubDropdown>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [subSearchQuery, setSubSearchQuery] = useState("");
  const [isSubSearchFocused, setIsSubSearchFocused] = useState(false);

  const BOTTOM_GAP = 104;
  const ACTIONS_HEIGHT = 34;
  const [rowsMaxHeight, setRowsMaxHeight] = useState<number | undefined>(undefined);
  const updateRowsMaxHeight = useCallback(() => {
    const el = rowsContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setRowsMaxHeight(Math.max(80, window.innerHeight - rect.top - BOTTOM_GAP - ACTIONS_HEIGHT));
  }, [rowsContainerRef]);
  useEffect(() => {
    updateRowsMaxHeight();
    window.addEventListener("resize", updateRowsMaxHeight);
    return () => window.removeEventListener("resize", updateRowsMaxHeight);
  }, [updateRowsMaxHeight]);
  useEffect(() => { updateRowsMaxHeight(); }, [rootItems, updateRowsMaxHeight]);

  const conjunctionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const fieldDropdownRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const operatorDropdownRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const groupPlusRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const groupConjunctionRefs = useRef<Map<string, HTMLElement>>(new Map());

  const handleConjunctionClick = useCallback((conditionId: string) => {
    setOpenDropdown((prev) => {
      if (prev?.kind === "conjunction" && prev.conditionId === conditionId) return null;
      const rect = conjunctionRefs.current.get(conditionId)?.getBoundingClientRect();
      if (rect) setDropdownPos({ top: rect.bottom, left: rect.left });
      return { kind: "conjunction", conditionId };
    });
  }, []);

  const handleFieldClick = useCallback((conditionId: string) => {
    setOpenDropdown((prev) => {
      if (prev?.kind === "field" && prev.conditionId === conditionId) return null;
      const rect = fieldDropdownRefs.current.get(conditionId)?.getBoundingClientRect();
      if (rect) setDropdownPos({ top: rect.bottom, left: rect.left });
      setSubSearchQuery("");
      setIsSubSearchFocused(false);
      return { kind: "field", conditionId };
    });
  }, []);

  const handleOperatorClick = useCallback((conditionId: string) => {
    setOpenDropdown((prev) => {
      if (prev?.kind === "operator" && prev.conditionId === conditionId) return null;
      const rect = operatorDropdownRefs.current.get(conditionId)?.getBoundingClientRect();
      if (rect) setDropdownPos({ top: rect.bottom, left: rect.left });
      setSubSearchQuery("");
      setIsSubSearchFocused(false);
      return { kind: "operator", conditionId };
    });
  }, []);

  const handleGroupPlusClick = useCallback((groupId: string) => {
    setOpenDropdown((prev) => {
      if (prev?.kind === "groupPlus" && prev.groupId === groupId) return null;
      const rect = groupPlusRefs.current.get(groupId)?.getBoundingClientRect();
      if (rect) setDropdownPos({ top: rect.bottom + 2, left: rect.left });
      return { kind: "groupPlus", groupId };
    });
  }, []);

  const handleGroupConjunctionClick = useCallback((groupId: string) => {
    setOpenDropdown((prev) => {
      if (prev?.kind === "groupConjunction" && prev.groupId === groupId) return null;
      const rect = groupConjunctionRefs.current.get(groupId)?.getBoundingClientRect();
      if (rect) setDropdownPos({ top: rect.bottom, left: rect.left });
      return { kind: "groupConjunction", groupId };
    });
  }, []);

  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-filter-subdropdown]")) return;
      for (const el of conjunctionRefs.current.values()) { if (el.contains(target)) return; }
      for (const el of fieldDropdownRefs.current.values()) { if (el.contains(target)) return; }
      for (const el of operatorDropdownRefs.current.values()) { if (el.contains(target)) return; }
      for (const el of groupPlusRefs.current.values()) { if (el.contains(target)) return; }
      for (const el of groupConjunctionRefs.current.values()) { if (el.contains(target)) return; }
      setOpenDropdown(null);
    };
    const tid = setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => { clearTimeout(tid); document.removeEventListener("mousedown", handler); };
  }, [openDropdown]);

  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setOpenDropdown(null); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openDropdown]);

  const updateConjunction = useCallback((_id: string, conjunction: "and" | "or") => {
    setRootConjunction(conjunction);
    setOpenDropdown(null);
  }, [setRootConjunction]);

  const updateField = useCallback((id: string, columnId: string, columnType: string) => {
    treeUpdateField(id, columnId, columnType);
    setOpenDropdown(null);
  }, [treeUpdateField]);

  const updateOperator = useCallback((id: string, operator: string) => {
    treeUpdateOperator(id, operator);
    setOpenDropdown(null);
  }, [treeUpdateOperator]);

  const addConditionToGroup = useCallback((groupId: string) => {
    treeAddConditionToGroup(groupId);
    setOpenDropdown(null);
  }, [treeAddConditionToGroup]);

  const addNestedGroupToGroup = useCallback((groupId: string) => {
    treeAddNestedGroupToGroup(groupId);
    setOpenDropdown(null);
  }, [treeAddNestedGroupToGroup]);

  const getColumn = useCallback((columnId: string) => columns.find((c) => c.id === columnId), [columns]);
  const getColumnName = useCallback((columnId: string) => getColumn(columnId)?.name ?? "—", [getColumn]);
  const getColumnType = useCallback((columnId: string) => getColumn(columnId)?.type ?? "TEXT", [getColumn]);

  const filteredColumns = columns.filter((col) => col.name.toLowerCase().includes(subSearchQuery.toLowerCase()));

  const findConditionInTree = useCallback((items: FilterTreeItem[], id: string): FilterTreeCondition | null => {
    for (const item of items) {
      if (isGroup(item)) { const found = findConditionInTree(item.items, id); if (found) return found; }
      else if (item.id === id) return item;
    }
    return null;
  }, []);

  const activeCondition =
    openDropdown && "conditionId" in openDropdown
      ? findConditionInTree(rootItems, openDropdown.conditionId)
      : null;

  const filteredOperators = activeCondition
    ? getOperatorsForType(getColumnType(activeCondition.columnId)).filter((op) =>
        op.label.toLowerCase().includes(subSearchQuery.toLowerCase()),
      )
    : [];

  const panelCls = [
    styles.filterPanel,
    hasAnyItems ? styles.filterPanelActive : "",
    panelHasNestedGroups
      ? styles.filterPanelWithNestedGroups
      : panelHasGroups
        ? styles.filterPanelWithGroups
        : "",
  ]
    .filter(Boolean)
    .join(" ");

  const contextValue = {
    dragIndex,
    inGroupDrag,
    getRowDragStyle,
    getInGroupDragStyle,
    openDropdown,
    dropIntoGroupId,
    expandingGroupId,
    conjunctionRefs,
    fieldDropdownRefs,
    operatorDropdownRefs,
    groupConjunctionRefs,
    groupBoxRefs,
    groupContentRefs,
    groupPlusRefs,
    onConjunctionClick: handleConjunctionClick,
    onGroupConjunctionClick: handleGroupConjunctionClick,
    onFieldClick: handleFieldClick,
    onOperatorClick: handleOperatorClick,
    onValueChange: updateValue,
    onRemove: removeCondition,
    onDragStart: handleDragStart,
    onInGroupDragStart: handleInGroupDragStart,
    onGroupPlusClick: handleGroupPlusClick,
    onToggleGroupConjunction: handleToggleGroupConjunction,
    onRemoveGroup: removeGroup,
    getColumnName,
    getColumnType,
  };

  const headerBlock = (
    <>
      <div className={styles.filterHeader}>
        <span>Filter</span>
      </div>
      <div className={styles.filterDescribeRow}>
        <div className={styles.filterDescribeInner}>
          <OmniIcon className={styles.filterDescribeIcon} color={baseColor} />
          <input
            className={styles.filterDescribeInput}
            type="text"
            placeholder="Describe what you want to see"
            readOnly
            tabIndex={-1}
          />
        </div>
      </div>
    </>
  );

  const actionsBlock = (
    <div className={styles.filterActions}>
      <div className={styles.filterAddCondition} onClick={addCondition}>
        <PlusIcon className={styles.filterAddIcon} />
        <span>Add condition</span>
      </div>
      <div className={styles.filterConditionGroupWrapper}>
        <div className={styles.filterAddConditionGroup} onClick={addRootGroup}>
          <PlusIcon className={styles.filterAddIcon} />
          <span>Add condition group</span>
        </div>
        <QuestionIcon className={styles.filterConditionGroupQuestion} />
      </div>
      <span className={styles.filterCopyFromView}>Copy from another view</span>
    </div>
  );

  if (!hasAnyItems) {
    return (
      <div className={panelCls}>
        {headerBlock}
        <div className={styles.filterEmptyRow}>
          <span className={styles.filterEmptyText}>No filter conditions are applied</span>
          <QuestionIcon className={styles.filterQuestionIcon} />
        </div>
        {actionsBlock}
      </div>
    );
  }

  return (
    <FilterPanelProvider value={contextValue}>
      <div className={panelCls}>
        {headerBlock}
        <div className={styles.filterShowRecords}>In this view, show records</div>

        <div
          ref={rowsContainerRef}
          className={styles.filterRowsContainer}
          style={rowsMaxHeight !== undefined ? { maxHeight: rowsMaxHeight } : undefined}
        >
          {rootItems.map((item, idx) => {
            if (isGroup(item)) {
              return (
                <div
                  key={item.id}
                  data-filter-row
                  className={dragIndex === idx ? styles.filterRowPlaceholder : styles.filterRow}
                  style={getRowDragStyle(idx)}
                >
                  <div className={styles.filterRowLeft}>
                    {idx === 0 ? (
                      <div className={styles.filterRowWhereText}>Where</div>
                    ) : idx === 1 ? (
                      <div
                        ref={(el) => {
                          if (el) conjunctionRefs.current.set(item.id, el);
                          else conjunctionRefs.current.delete(item.id);
                        }}
                        className={styles.filterRowConjunction}
                        onClick={dragIndex !== null ? undefined : () => handleConjunctionClick(item.id)}
                      >
                        <span className={styles.filterRowConjunctionText}>{rootConjunction}</span>
                        <ChevronDownIcon className={styles.filterRowConjunctionChevron} />
                      </div>
                    ) : (
                      <div className={styles.filterRowWhereText}>{rootConjunction}</div>
                    )}
                  </div>
                  <FilterGroupBlock group={item} depth={0} rootIdx={idx} />
                </div>
              );
            }

            return (
              <FilterConditionRow
                key={item.id}
                cond={item}
                idx={idx}
                parentConjunction={rootConjunction}
                isFirst={idx === 0}
                rootIdx={idx}
              />
            );
          })}
        </div>

        <FilterDragOverlay
          rootItems={rootItems}
          dragIndex={dragIndex}
          dragPos={dragPos}
          itemRectsRef={itemRectsRef}
          groupBoxRefs={groupBoxRefs}
          inGroupDrag={inGroupDrag}
          inGroupDragPos={inGroupDragPos}
          inGroupItemRectsRef={inGroupItemRectsRef}
          groupContentRefs={groupContentRefs}
          getColumnName={getColumnName}
          getColumnType={getColumnType}
        />

        {actionsBlock}

        <FilterDropdowns
          openDropdown={openDropdown}
          dropdownPos={dropdownPos}
          subSearchQuery={subSearchQuery}
          setSubSearchQuery={setSubSearchQuery}
          isSubSearchFocused={isSubSearchFocused}
          setIsSubSearchFocused={setIsSubSearchFocused}
          filteredColumns={filteredColumns}
          filteredOperators={filteredOperators}
          rootItems={rootItems}
          onUpdateConjunction={updateConjunction}
          onUpdateField={updateField}
          onUpdateOperator={updateOperator}
          onAddConditionToGroup={addConditionToGroup}
          onAddNestedGroupToGroup={addNestedGroupToGroup}
          onSetGroupConjunction={setGroupConjunction}
          onClose={() => setOpenDropdown(null)}
        />
      </div>
    </FilterPanelProvider>
  );
}
