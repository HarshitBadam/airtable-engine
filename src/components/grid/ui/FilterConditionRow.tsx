import React from "react";
import styles from "./FilterPanel.module.css";
import type { FilterTreeCondition } from "~/components/grid/utils/filterTree";
import { operatorLabel } from "~/components/grid/utils/filterOperators";
import { ChevronDownIcon, TrashIcon, DragIcon } from "./FilterIcons";
import { useFilterPanel } from "./FilterPanelContext";

export interface FilterConditionRowProps {
  cond: FilterTreeCondition;
  idx: number;
  parentConjunction: "and" | "or";
  isFirst: boolean;
  /** Root index for drag (null if inside a group) */
  rootIdx: number | null;
  /** Group id if this condition is inside a group (for in-group drag) */
  parentGroupId?: string;
}

export function FilterConditionRow({
  cond,
  idx,
  parentConjunction,
  isFirst,
  rootIdx,
  parentGroupId,
}: FilterConditionRowProps) {
  const {
    dragIndex,
    inGroupDrag,
    getRowDragStyle,
    getInGroupDragStyle,
    conjunctionRefs,
    fieldDropdownRefs,
    operatorDropdownRefs,
    groupConjunctionRefs,
    onConjunctionClick,
    onGroupConjunctionClick,
    onFieldClick,
    onOperatorClick,
    onValueChange,
    onRemove,
    onDragStart,
    onInGroupDragStart,
    getColumnName,
    getColumnType,
  } = useFilterPanel();

  const isDraggingRoot = rootIdx !== null && dragIndex === rootIdx;
  const isDraggingInGroup =
    parentGroupId != null &&
    inGroupDrag?.groupId === parentGroupId &&
    inGroupDrag?.fromIdx === idx;
  const isDragging = isDraggingRoot || isDraggingInGroup;

  const inGrpStyle =
    parentGroupId != null
      ? getInGroupDragStyle(parentGroupId, idx)
      : undefined;

  return (
    <div
      data-filter-row
      className={isDragging ? styles.filterRowPlaceholder : styles.filterRow}
      style={rootIdx !== null ? getRowDragStyle(rootIdx) : inGrpStyle}
    >
      <div className={styles.filterRowLeft}>
        {isFirst ? (
          <div className={styles.filterRowWhereText}>Where</div>
        ) : rootIdx === 1 ? (
          <div
            ref={(el) => {
              if (el) conjunctionRefs.current.set(cond.id, el);
              else conjunctionRefs.current.delete(cond.id);
            }}
            className={styles.filterRowConjunction}
            onClick={
              dragIndex !== null
                ? undefined
                : () => onConjunctionClick(cond.id)
            }
          >
            <span className={styles.filterRowConjunctionText}>
              {parentConjunction}
            </span>
            <ChevronDownIcon className={styles.filterRowConjunctionChevron} />
          </div>
        ) : rootIdx !== null ? (
          <div className={styles.filterRowWhereText}>
            {parentConjunction}
          </div>
        ) : parentGroupId != null && idx === 1 ? (
          <div
            ref={(el) => {
              if (el) groupConjunctionRefs.current.set(parentGroupId, el);
              else groupConjunctionRefs.current.delete(parentGroupId);
            }}
            className={styles.filterRowConjunction}
            onClick={
              dragIndex !== null
                ? undefined
                : () => onGroupConjunctionClick(parentGroupId)
            }
          >
            <span className={styles.filterRowConjunctionText}>
              {parentConjunction}
            </span>
            <ChevronDownIcon className={styles.filterRowConjunctionChevron} />
          </div>
        ) : (
          <div className={styles.filterRowWhereText}>
            {parentConjunction}
          </div>
        )}
      </div>

      <div className={styles.filterRowRight}>
        <div
          ref={(el) => {
            if (el) fieldDropdownRefs.current.set(cond.id, el);
            else fieldDropdownRefs.current.delete(cond.id);
          }}
          className={styles.filterRowDropdown}
          onClick={
            dragIndex !== null ? undefined : () => onFieldClick(cond.id)
          }
        >
          <span className={styles.filterRowDropdownText}>
            {getColumnName(cond.columnId)}
          </span>
          <ChevronDownIcon className={styles.filterRowDropdownChevron} />
        </div>

        <div
          ref={(el) => {
            if (el) operatorDropdownRefs.current.set(cond.id, el);
            else operatorDropdownRefs.current.delete(cond.id);
          }}
          className={styles.filterRowOperatorDropdown}
          onClick={
            dragIndex !== null
              ? undefined
              : () => onOperatorClick(cond.id)
          }
        >
          <span className={styles.filterRowDropdownText}>
            {operatorLabel(cond.operator, getColumnType(cond.columnId))}
          </span>
          <ChevronDownIcon className={styles.filterRowDropdownChevron} />
        </div>

        <input
          className={styles.filterRowValueInput}
          type="text"
          placeholder="Enter a value"
          value={cond.value}
          onChange={(e) => onValueChange(cond.id, e.target.value)}
          readOnly={dragIndex !== null}
        />

        <div
          className={styles.filterRowTrashButton}
          onClick={
            dragIndex !== null
              ? undefined
              : () => onRemove(cond.id)
          }
        >
          <TrashIcon className={styles.filterRowTrashIcon} />
        </div>

        <div
          className={styles.filterRowDragHandle}
          onMouseDown={
            rootIdx !== null
              ? (e) => onDragStart(e, rootIdx)
              : parentGroupId != null
                ? (e) => onInGroupDragStart(e, parentGroupId, idx)
                : undefined
          }
        >
          <DragIcon className={styles.filterRowDragIcon} />
        </div>
      </div>
    </div>
  );
}
