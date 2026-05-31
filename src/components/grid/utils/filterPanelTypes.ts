export interface FilterColumn {
  id: string;
  name: string;
  type: string;
}

export type SubDropdown =
  | { kind: "conjunction"; conditionId: string }
  | { kind: "field"; conditionId: string }
  | { kind: "operator"; conditionId: string }
  | { kind: "groupPlus"; groupId: string }
  | { kind: "groupConjunction"; groupId: string }
  | null;
