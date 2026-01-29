export type ViewConfig = {
    search: string;
    filters: Array<
      | { columnId: string; op: "gt" | "lt"; value: number }
      | { columnId: string; op: "is_empty" | "is_not_empty" }
      | { columnId: string; op: "contains" | "not_contains" | "equals"; value: string }
    >;
    sort: null | { columnId: string; direction: "asc" | "desc" };
    hiddenColumnIds: string[];
  };
  