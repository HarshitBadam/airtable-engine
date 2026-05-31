import type { FilterConditionUI } from "~/components/grid/GridStore";
import type {
  FilterTree as BackendFilterTree,
  FilterTreeItem as BackendFilterTreeItem,
} from "~/shared/grid";

export type FilterTreeCondition = {
  kind: "condition";
  id: string;
  columnId: string;
  operator: string;
  value: string;
};

export type FilterTreeGroup = {
  kind: "group";
  id: string;
  // "or" surfaces in the UI as "Any of the following are true…"
  conjunction: "and" | "or";
  items: FilterTreeItem[];
};

export type FilterTreeItem = FilterTreeCondition | FilterTreeGroup;

export function isGroup(item: FilterTreeItem): item is FilterTreeGroup {
  return item.kind === "group";
}

export function flattenToConditions(
  items: FilterTreeItem[],
  conjunction: "and" | "or",
): FilterConditionUI[] {
  const result: FilterConditionUI[] = [];
  for (const item of items) {
    if (isGroup(item)) {
      result.push(...flattenToConditions(item.items, item.conjunction));
    } else {
      result.push({
        id: item.id,
        columnId: item.columnId,
        operator: item.operator,
        value: item.value,
        conjunction,
      });
    }
  }
  return result;
}

/**
 * Convert the UI tree to the backend FilterTree shape. Strips UI-only fields
 * and drops conditions that are not yet usable (missing column, empty value for
 * valued operators, or non-numeric input for numeric operators).
 */
export function buildBackendFilterTree(
  items: FilterTreeItem[],
  rootConjunction: "and" | "or",
  columns: Map<string, string>,
): BackendFilterTree | undefined {
  function convertItem(item: FilterTreeItem): BackendFilterTreeItem | null {
    if (isGroup(item)) {
      const children = item.items
        .map(convertItem)
        .filter((x): x is BackendFilterTreeItem => x !== null);
      if (children.length === 0) return null;
      return { kind: "group", conjunction: item.conjunction, items: children };
    }

    const cond = item;
    if (!cond.columnId || !columns.has(cond.columnId)) return null;

    const op = cond.operator;

    if (op === "is_empty" || op === "is_not_empty") {
      return { kind: "condition", columnId: cond.columnId, op };
    }

    if (op === "contains" || op === "not_contains" || op === "equals" || op === "not_equals") {
      if (cond.value.trim() === "") return null;
      return { kind: "condition", columnId: cond.columnId, op, value: cond.value };
    }

    if (op === "gt" || op === "lt" || op === "gte" || op === "lte") {
      const num = Number(cond.value);
      if (cond.value.trim() === "" || !Number.isFinite(num)) return null;
      return { kind: "condition", columnId: cond.columnId, op, value: num };
    }

    return null;
  }

  const converted = items
    .map(convertItem)
    .filter((x): x is BackendFilterTreeItem => x !== null);

  if (converted.length === 0) return undefined;

  return { conjunction: rootConjunction, items: converted };
}

export function hasGroups(items: FilterTreeItem[]): boolean {
  return items.some(isGroup);
}

export function hasNestedGroups(items: FilterTreeItem[]): boolean {
  return items.some((item) => isGroup(item) && item.items.some(isGroup));
}

export function updateConditionInTree(
  items: FilterTreeItem[],
  id: string,
  updater: (c: FilterTreeCondition) => FilterTreeCondition,
): FilterTreeItem[] {
  return items.map((item) => {
    if (isGroup(item)) {
      return { ...item, items: updateConditionInTree(item.items, id, updater) };
    }
    return item.id === id ? updater(item) : item;
  });
}

export function removeItemFromTree(
  items: FilterTreeItem[],
  id: string,
): FilterTreeItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) =>
      isGroup(item)
        ? { ...item, items: removeItemFromTree(item.items, id) }
        : item,
    );
}

export function addChildToGroup(
  items: FilterTreeItem[],
  groupId: string,
  child: FilterTreeItem,
): FilterTreeItem[] {
  return items.map((item) => {
    if (isGroup(item)) {
      if (item.id === groupId) {
        return { ...item, items: [...item.items, child] };
      }
      return { ...item, items: addChildToGroup(item.items, groupId, child) };
    }
    return item;
  });
}

export function toggleGroupConjunction(
  items: FilterTreeItem[],
  groupId: string,
): FilterTreeItem[] {
  return items.map((item) => {
    if (isGroup(item)) {
      if (item.id === groupId) {
        return { ...item, conjunction: item.conjunction === "and" ? "or" : "and" };
      }
      return { ...item, items: toggleGroupConjunction(item.items, groupId) };
    }
    return item;
  });
}
