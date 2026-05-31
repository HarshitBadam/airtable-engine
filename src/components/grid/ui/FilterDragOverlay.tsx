import React from "react";
import { createPortal } from "react-dom";
import styles from "./FilterPanel.module.css";
import {
  type FilterTreeItem,
  type FilterTreeGroup,
  isGroup,
} from "~/components/grid/utils/filterTree";
import { operatorLabel } from "~/components/grid/utils/filterOperators";
import { ChevronDownIcon, TrashIcon, DragIcon, PlusIcon } from "./FilterIcons";

export interface FilterDragOverlayProps {
  rootItems: FilterTreeItem[];
  dragIndex: number | null;
  dragPos: { x: number; y: number } | null;
  itemRectsRef: React.MutableRefObject<DOMRect[]>;
  groupBoxRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  inGroupDrag: { groupId: string; fromIdx: number; overIdx: number } | null;
  inGroupDragPos: { x: number; y: number } | null;
  inGroupItemRectsRef: React.MutableRefObject<DOMRect[]>;
  groupContentRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  getColumnName: (columnId: string) => string;
  getColumnType: (columnId: string) => string;
}

function GroupGhostHeader({ group }: { group: FilterTreeGroup }) {
  const headerText =
    group.items.length === 0
      ? "Drag conditions here to add them to this group"
      : group.conjunction === "or"
        ? "Any of the following are true..."
        : "All of the following are true...";

  return (
    <div className={styles.filterGroupHeader}>
      <span className={styles.filterGroupHeaderText}>{headerText}</span>
      <div className={styles.filterGroupActions}>
        <div className={styles.filterGroupActionBtn}>
          <PlusIcon className={styles.filterGroupActionIcon} />
        </div>
        <div className={styles.filterGroupActionBtn}>
          <TrashIcon className={styles.filterGroupActionIcon} />
        </div>
        <div className={styles.filterGroupActionBtn} style={{ cursor: "grabbing" }}>
          <DragIcon className={styles.filterGroupActionIcon} />
        </div>
      </div>
    </div>
  );
}

function findGroupById(
  items: FilterTreeItem[],
  id: string,
): FilterTreeGroup | undefined {
  for (const it of items) {
    if (isGroup(it)) {
      if (it.id === id) return it;
      const found = findGroupById(it.items, id);
      if (found) return found;
    }
  }
  return undefined;
}

const LEFT_COL_WIDTH = 72;

export function FilterDragOverlay({
  rootItems,
  dragIndex,
  dragPos,
  itemRectsRef,
  groupBoxRefs,
  inGroupDrag,
  inGroupDragPos,
  inGroupItemRectsRef,
  groupContentRefs,
  getColumnName,
  getColumnType,
}: FilterDragOverlayProps) {
  const rootOverlay = (() => {
    if (dragIndex === null || !dragPos || !rootItems[dragIndex]) return null;
    const draggedItem = rootItems[dragIndex];
    const baseRect = itemRectsRef.current[dragIndex];

    if (isGroup(draggedItem)) {
      const groupBoxEl = groupBoxRefs.current.get(draggedItem.id);
      const gRect = groupBoxEl?.getBoundingClientRect();
      return createPortal(
        <div
          className={styles.filterRowDragging}
          style={{
            left: gRect?.left ?? baseRect?.left ?? 0,
            top: dragPos.y - (gRect?.height ?? 40) / 2,
            width: gRect?.width ?? 568,
            height: gRect?.height ?? 40,
            opacity: 0.9,
          }}
        >
          <div
            className={styles.filterGroupBox}
            style={{ pointerEvents: "none", margin: 0, width: "100%" }}
          >
            <GroupGhostHeader group={draggedItem} />
          </div>
        </div>,
        document.body,
      );
    }

    const cond = draggedItem;
    return createPortal(
      <div
        className={styles.filterRowDragging}
        style={{
          left: (baseRect?.left ?? 0) + LEFT_COL_WIDTH,
          top: dragPos.y - 16,
          width: (baseRect?.width ?? 558) - LEFT_COL_WIDTH,
          height: 32,
        }}
      >
        <div className={styles.filterRowRight} style={{ border: "none" }}>
          <div className={styles.filterRowDropdown} style={{ pointerEvents: "none" }}>
            <span className={styles.filterRowDropdownText}>{getColumnName(cond.columnId)}</span>
            <ChevronDownIcon className={styles.filterRowDropdownChevron} />
          </div>
          <div className={styles.filterRowOperatorDropdown} style={{ pointerEvents: "none" }}>
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
            readOnly
            tabIndex={-1}
          />
          <div className={styles.filterRowTrashButton} style={{ pointerEvents: "none" }}>
            <TrashIcon className={styles.filterRowTrashIcon} />
          </div>
          <div className={styles.filterRowDragHandle} style={{ cursor: "grabbing" }}>
            <DragIcon className={styles.filterRowDragIcon} />
          </div>
        </div>
      </div>,
      document.body,
    );
  })();

  const inGroupOverlay = (() => {
    if (!inGroupDrag || !inGroupDragPos) return null;

    const parentGroup = findGroupById(rootItems, inGroupDrag.groupId);
    if (!parentGroup) return null;
    const child = parentGroup.items[inGroupDrag.fromIdx];
    if (!child) return null;

    const containerEl = groupContentRefs.current.get(inGroupDrag.groupId);
    const childEls = containerEl?.querySelectorAll<HTMLDivElement>("[data-filter-row]");
    const childRect = childEls?.[inGroupDrag.fromIdx]?.getBoundingClientRect();

    if (isGroup(child)) {
      const gBoxEl = groupBoxRefs.current.get(child.id);
      const gR = gBoxEl?.getBoundingClientRect();
      return createPortal(
        <div
          className={styles.filterRowDragging}
          style={{
            left: gR?.left ?? childRect?.left ?? 0,
            top: inGroupDragPos.y - (gR?.height ?? 40) / 2,
            width: gR?.width ?? 568,
            height: gR?.height ?? 40,
            opacity: 0.9,
          }}
        >
          <div
            className={styles.filterNestedGroupBox}
            style={{ pointerEvents: "none", margin: 0, width: "100%" }}
          >
            <GroupGhostHeader group={child} />
          </div>
        </div>,
        document.body,
      );
    }

    const cond = child;
    return createPortal(
      <div
        className={styles.filterRowDragging}
        style={{
          left: (childRect?.left ?? 0) + LEFT_COL_WIDTH,
          top: inGroupDragPos.y - 16,
          width: (childRect?.width ?? 500) - LEFT_COL_WIDTH,
          height: 32,
        }}
      >
        <div className={styles.filterRowRight} style={{ border: "none" }}>
          <div className={styles.filterRowDropdown} style={{ pointerEvents: "none" }}>
            <span className={styles.filterRowDropdownText}>{getColumnName(cond.columnId)}</span>
            <ChevronDownIcon className={styles.filterRowDropdownChevron} />
          </div>
          <div className={styles.filterRowOperatorDropdown} style={{ pointerEvents: "none" }}>
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
            readOnly
            tabIndex={-1}
          />
          <div className={styles.filterRowTrashButton} style={{ pointerEvents: "none" }}>
            <TrashIcon className={styles.filterRowTrashIcon} />
          </div>
          <div className={styles.filterRowDragHandle} style={{ cursor: "grabbing" }}>
            <DragIcon className={styles.filterRowDragIcon} />
          </div>
        </div>
      </div>,
      document.body,
    );
  })();

  return (
    <>
      {rootOverlay}
      {inGroupOverlay}
    </>
  );
}
