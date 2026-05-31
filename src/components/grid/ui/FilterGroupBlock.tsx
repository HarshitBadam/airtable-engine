import React from "react";
import styles from "./FilterPanel.module.css";
import type { FilterTreeGroup } from "~/components/grid/utils/filterTree";
import { isGroup } from "~/components/grid/utils/filterTree";
import { FilterConditionRow } from "./FilterConditionRow";
import { PlusIcon, TrashIcon, DragIcon, ChevronDownIcon } from "./FilterIcons";
import { useFilterPanel } from "./FilterPanelContext";

export interface FilterGroupBlockProps {
  group: FilterTreeGroup;
  depth: number;
  /** Root index — allows the group box's drag handle to participate in root-level drag */
  rootIdx?: number | null;
  /** Parent group id (for nested groups — enables in-group drag) */
  parentGroupIdForDrag?: string;
  /** Child index within parent group (for nested groups — enables in-group drag) */
  childIdxInParent?: number;
}

export function FilterGroupBlock({
  group,
  depth,
  rootIdx,
  parentGroupIdForDrag,
  childIdxInParent,
}: FilterGroupBlockProps) {
  const {
    dragIndex,
    inGroupDrag,
    getInGroupDragStyle,
    openDropdown,
    dropIntoGroupId,
    expandingGroupId,
    groupBoxRefs,
    groupContentRefs,
    groupPlusRefs,
    groupConjunctionRefs,
    onDragStart,
    onInGroupDragStart,
    onGroupPlusClick,
    onToggleGroupConjunction,
    onRemoveGroup,
    onGroupConjunctionClick,
  } = useFilterPanel();

  const isEmpty = group.items.length === 0;
  const headerText = isEmpty
    ? "Drag conditions here to add them to this group"
    : group.conjunction === "or"
      ? "Any of the following are true..."
      : "All of the following are true...";

  const isPlusOpen =
    openDropdown?.kind === "groupPlus" &&
    openDropdown.groupId === group.id;

  const isDropTarget = dropIntoGroupId === group.id;
  const isExpanding = expandingGroupId === group.id;

  const boxCls = [
    depth === 0 ? styles.filterGroupBox : styles.filterNestedGroupBox,
    isDropTarget ? styles.filterGroupBoxDropTarget : "",
    isExpanding ? styles.filterGroupBoxExpanding : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={(el) => {
        if (el) groupBoxRefs.current.set(group.id, el);
        else groupBoxRefs.current.delete(group.id);
      }}
      className={boxCls}
    >
      <div className={styles.filterGroupHeader}>
        <span
          ref={(el) => {
            if (el) groupConjunctionRefs.current.set(group.id, el);
            else groupConjunctionRefs.current.delete(group.id);
          }}
          className={`${styles.filterGroupHeaderText}${
            !isEmpty ? ` ${styles.filterGroupHeaderTextActive}` : ""
          }`}
          onClick={
            !isEmpty
              ? () => onToggleGroupConjunction(group.id)
              : undefined
          }
        >
          {headerText}
        </span>
        <div className={styles.filterGroupActions}>
          <div
            ref={(el) => {
              if (el) groupPlusRefs.current.set(group.id, el);
              else groupPlusRefs.current.delete(group.id);
            }}
            className={`${styles.filterGroupActionBtn}${
              isPlusOpen ? ` ${styles.filterGroupActionBtnActive}` : ""
            }`}
            onClick={() => onGroupPlusClick(group.id)}
          >
            <PlusIcon className={styles.filterGroupActionIcon} />
          </div>
          <div
            className={styles.filterGroupActionBtn}
            onClick={() => onRemoveGroup(group.id)}
          >
            <TrashIcon className={styles.filterGroupActionIcon} />
          </div>
          <div
            className={styles.filterGroupActionBtn}
            style={{ cursor: "grab" }}
            onMouseDown={
              rootIdx != null
                ? (e) => onDragStart(e, rootIdx)
                : parentGroupIdForDrag != null && childIdxInParent != null
                  ? (e) => onInGroupDragStart(e, parentGroupIdForDrag, childIdxInParent)
                  : undefined
            }
          >
            <DragIcon className={styles.filterGroupActionIcon} />
          </div>
        </div>
      </div>

      {!isEmpty && (
        <div
          ref={(el) => {
            if (el) groupContentRefs.current.set(group.id, el);
            else groupContentRefs.current.delete(group.id);
          }}
          className={styles.filterGroupContent}
        >
          {group.items.map((child, childIdx) => {
            if (isGroup(child)) {
              const nestedIsDragging =
                inGroupDrag?.groupId === group.id &&
                inGroupDrag?.fromIdx === childIdx;
              const nestedDragStyle = getInGroupDragStyle(group.id, childIdx);
              return (
                <div
                  key={child.id}
                  data-filter-row
                  className={
                    nestedIsDragging
                      ? styles.filterRowPlaceholder
                      : styles.filterGroupConditionRow
                  }
                  style={nestedDragStyle}
                >
                  <div className={styles.filterRowLeft}>
                    {childIdx === 0 ? (
                      <div className={styles.filterRowWhereText}>Where</div>
                    ) : childIdx === 1 ? (
                      <div
                        ref={(el) => {
                          if (el) groupConjunctionRefs.current.set(group.id, el);
                          else groupConjunctionRefs.current.delete(group.id);
                        }}
                        className={styles.filterRowConjunction}
                        onClick={() => onGroupConjunctionClick(group.id)}
                      >
                        <span className={styles.filterRowConjunctionText}>
                          {group.conjunction === "or" ? "or" : "and"}
                        </span>
                        <ChevronDownIcon className={styles.filterRowConjunctionChevron} />
                      </div>
                    ) : (
                      <div className={styles.filterRowWhereText}>
                        {group.conjunction === "or" ? "or" : "and"}
                      </div>
                    )}
                  </div>
                  <FilterGroupBlock
                    group={child}
                    depth={depth + 1}
                    rootIdx={null}
                    parentGroupIdForDrag={group.id}
                    childIdxInParent={childIdx}
                  />
                </div>
              );
            }
            return (
              <FilterConditionRow
                key={child.id}
                cond={child}
                idx={childIdx}
                parentConjunction={group.conjunction}
                isFirst={childIdx === 0}
                rootIdx={null}
                parentGroupId={group.id}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
