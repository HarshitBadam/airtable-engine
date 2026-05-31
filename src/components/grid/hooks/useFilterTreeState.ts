import { useState, useEffect, useRef, useCallback } from "react";
import { useGridStore, type FilterConditionUI } from "~/components/grid/GridStore";
import type { FilterTreeItem as BackendFilterTreeItem } from "~/shared/grid";
import {
  type FilterTreeItem,
  isGroup,
  flattenToConditions,
  buildBackendFilterTree,
  hasGroups,
  hasNestedGroups,
  updateConditionInTree,
  removeItemFromTree,
  addChildToGroup,
  toggleGroupConjunction,
} from "~/components/grid/utils/filterTree";
import { getDefaultOperator } from "~/components/grid/utils/filterOperators";
import type { FilterColumn } from "~/components/grid/utils/filterPanelTypes";

interface UseFilterTreeStateParams {
  columns: FilterColumn[];
}

export function useFilterTreeState({ columns }: UseFilterTreeStateParams) {
  const storeConditions = useGridStore((s) => s.filterConditions) ?? [];
  const setConditions = useGridStore((s) => s.setFilterConditions);
  const setFilters = useGridStore((s) => s.setFilters);
  const setFilterConjunction = useGridStore((s) => s.setFilterConjunction);
  const setFilterTree = useGridStore((s) => s.setFilterTree);
  const savedFilterTree = useGridStore((s) => s.filterTree);

  // This runs on the "no groups" path; the tree path sets filters directly via buildBackendFilterTree.
  useEffect(() => {
    const colTypeMap = new Map(columns.map((c) => [c.id, c.type]));
    const conjunction: "and" | "or" =
      storeConditions.length >= 2 ? (storeConditions[1]?.conjunction ?? "and") : "and";

    const backendFilters: Array<
      | { columnId: string; op: "is_empty" | "is_not_empty" }
      | { columnId: string; op: "contains" | "not_contains" | "equals" | "not_equals"; value: string }
      | { columnId: string; op: "gt" | "lt" | "gte" | "lte"; value: number }
    > = [];

    for (const cond of storeConditions) {
      const colType = colTypeMap.get(cond.columnId);
      if (!colType) continue;
      const op = cond.operator;
      if (op === "is_empty" || op === "is_not_empty") {
        backendFilters.push({ columnId: cond.columnId, op });
        continue;
      }
      if (op === "contains" || op === "not_contains" || op === "equals" || op === "not_equals") {
        if (cond.value.trim() === "") continue;
        backendFilters.push({ columnId: cond.columnId, op, value: cond.value });
        continue;
      }
      if (op === "gt" || op === "lt" || op === "gte" || op === "lte") {
        const num = Number(cond.value);
        if (cond.value.trim() === "" || !Number.isFinite(num)) continue;
        backendFilters.push({ columnId: cond.columnId, op, value: num });
        continue;
      }
    }

    setFilters(backendFilters);
    setFilterConjunction(conjunction);
  }, [storeConditions, columns, setFilters, setFilterConjunction]);

  const [rootItems, setRootItems] = useState<FilterTreeItem[]>([]);
  const [rootConjunction, setRootConjunction] = useState<"and" | "or">("and");
  const groupInitRef = useRef(false);

  // One-time restore: prefer savedFilterTree (has groups), fall back to flat conditions.
  useEffect(() => {
    if (groupInitRef.current) return;
    groupInitRef.current = true;

    if (savedFilterTree && savedFilterTree.items.length > 0) {
      let counter = 0;
      const restoreItem = (item: BackendFilterTreeItem): FilterTreeItem => {
        if (item.kind === "group") {
          return {
            kind: "group",
            id: `restored-group-${counter++}-${Date.now()}`,
            conjunction: item.conjunction,
            items: item.items.map(restoreItem),
          };
        }
        return {
          kind: "condition",
          id: `restored-${counter++}-${Date.now()}`,
          columnId: item.columnId,
          operator: item.op,
          value: item.value !== undefined ? String(item.value) : "",
        };
      };
      setRootItems(savedFilterTree.items.map(restoreItem));
      setRootConjunction(savedFilterTree.conjunction);
      return;
    }

    if (storeConditions.length > 0) {
      setRootItems(
        storeConditions.map((c) => ({
          kind: "condition" as const,
          id: c.id,
          columnId: c.columnId,
          operator: c.operator,
          value: c.value,
        })),
      );
      if (storeConditions.length >= 2) {
        setRootConjunction(storeConditions[1]?.conjunction ?? "and");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!groupInitRef.current) return;

    const flat = flattenToConditions(rootItems, rootConjunction);
    const uiConditions: FilterConditionUI[] = flat.map((c, i) => ({
      ...c,
      conjunction: i === 0 ? "and" : rootConjunction,
    }));
    setConditions(uiConditions);

    const colTypeMap = new Map(columns.map((c) => [c.id, c.type]));
    if (hasGroups(rootItems)) {
      const tree = buildBackendFilterTree(rootItems, rootConjunction, colTypeMap);
      setFilterTree(tree);
    } else {
      setFilterTree(undefined);
    }
  }, [rootItems, rootConjunction, columns, setConditions, setFilterTree]);

  const addCondition = useCallback(() => {
    const defaultCol = columns[0];
    const defaultOp = defaultCol ? getDefaultOperator(defaultCol.type) : "contains";
    setRootItems((prev) => [
      ...prev,
      {
        kind: "condition" as const,
        id: crypto.randomUUID(),
        columnId: defaultCol?.id ?? "",
        operator: defaultOp,
        value: "",
      },
    ]);
  }, [columns]);

  const removeCondition = useCallback((id: string) => {
    setRootItems((prev) => removeItemFromTree(prev, id));
  }, []);

  const updateValue = useCallback((id: string, value: string) => {
    setRootItems((prev) => updateConditionInTree(prev, id, (c) => ({ ...c, value })));
  }, []);

  const updateField = useCallback((id: string, columnId: string, columnType: string) => {
    setRootItems((prev) =>
      updateConditionInTree(prev, id, (c) => ({
        ...c,
        columnId,
        operator: getDefaultOperator(columnType),
        value: "",
      })),
    );
  }, []);

  const updateOperator = useCallback((id: string, operator: string) => {
    setRootItems((prev) => updateConditionInTree(prev, id, (c) => ({ ...c, operator })));
  }, []);

  const addRootGroup = useCallback(() => {
    setRootItems((prev) => [
      ...prev,
      {
        kind: "group" as const,
        id: crypto.randomUUID(),
        conjunction: "or",
        items: [],
      },
    ]);
  }, []);

  const removeGroup = useCallback((id: string) => {
    setRootItems((prev) => removeItemFromTree(prev, id));
  }, []);

  const addConditionToGroup = useCallback(
    (groupId: string) => {
      const defaultCol = columns[0];
      const defaultOp = defaultCol ? getDefaultOperator(defaultCol.type) : "contains";
      setRootItems((prev) =>
        addChildToGroup(prev, groupId, {
          kind: "condition" as const,
          id: crypto.randomUUID(),
          columnId: defaultCol?.id ?? "",
          operator: defaultOp,
          value: "",
        }),
      );
    },
    [columns],
  );

  const addNestedGroupToGroup = useCallback((parentGroupId: string) => {
    setRootItems((prev) =>
      addChildToGroup(prev, parentGroupId, {
        kind: "group" as const,
        id: crypto.randomUUID(),
        conjunction: "and",
        items: [],
      }),
    );
  }, []);

  const handleToggleGroupConjunction = useCallback((groupId: string) => {
    setRootItems((prev) => toggleGroupConjunction(prev, groupId));
  }, []);

  const setGroupConjunction = useCallback((groupId: string, conjunction: "and" | "or") => {
    setRootItems((prev) => {
      const doSet = (items: FilterTreeItem[]): FilterTreeItem[] =>
        items.map((it) => {
          if (isGroup(it) && it.id === groupId) return { ...it, conjunction };
          if (isGroup(it)) return { ...it, items: doSet(it.items) };
          return it;
        });
      return doSet(prev);
    });
  }, []);

  return {
    rootItems,
    setRootItems,
    rootConjunction,
    setRootConjunction,
    hasAnyItems: rootItems.length > 0,
    panelHasGroups: hasGroups(rootItems),
    panelHasNestedGroups: hasNestedGroups(rootItems),
    addCondition,
    removeCondition,
    updateValue,
    updateField,
    updateOperator,
    addRootGroup,
    removeGroup,
    addConditionToGroup,
    addNestedGroupToGroup,
    handleToggleGroupConjunction,
    setGroupConjunction,
  };
}
