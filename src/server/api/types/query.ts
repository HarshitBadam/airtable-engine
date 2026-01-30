export type TextFilter =
  | { columnId: string; op: "is_empty" | "is_not_empty" }
  | { columnId: string; op: "contains" | "not_contains" | "equals"; value: string };

export type NumberFilter = { columnId: string; op: "gt" | "lt"; value: number };

export type Filter = TextFilter | NumberFilter;

export type Sort =
  | { columnId: string; direction: "asc" | "desc"; type: "TEXT" }
  | { columnId: string; direction: "asc" | "desc"; type: "NUMBER" };

export type ViewQuery = {
  search?: string;
  filters?: Filter[];
  sort?: Sort | null;
  hiddenColumnIds?: string[];
};
