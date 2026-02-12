export type ViewConfig = {
  search: string;
  filters: Array<
    | { columnId: string; op: "gt" | "lt" | "gte" | "lte"; value: number }
    | { columnId: string; op: "is_empty" | "is_not_empty" }
    | { columnId: string; op: "contains" | "not_contains" | "equals" | "not_equals"; value: string }
  >;
  filterConjunction: "and" | "or";
  /** Tree-structured filters (condition groups). When present, takes precedence over flat filters. */
  filterTree?: {
    conjunction: "and" | "or";
    items: Array<unknown>;
  };
  sorts: Array<{ columnId: string; direction: "asc" | "desc"; type: "TEXT" | "NUMBER" }>;
  hiddenColumnIds: string[];
  columnOrderIds: string[];
};
