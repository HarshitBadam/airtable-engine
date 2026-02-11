export type ViewConfig = {
  search: string;
  filters: Array<
    | { columnId: string; op: "gt" | "lt" | "gte" | "lte"; value: number }
    | { columnId: string; op: "is_empty" | "is_not_empty" }
    | { columnId: string; op: "contains" | "not_contains" | "equals" | "not_equals"; value: string }
  >;
  filterConjunction: "and" | "or";
  sorts: Array<{ columnId: string; direction: "asc" | "desc"; type: "TEXT" | "NUMBER" }>;
  hiddenColumnIds: string[];
  columnOrderIds: string[];
};
