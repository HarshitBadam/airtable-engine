/** Column descriptor passed to the filter panel. */
export interface FilterColumn {
  id: string;
  name: string;
  type: string;
}

/** Which sub-dropdown is currently open in the filter panel. */
export type SubDropdown =
  | { kind: "conjunction"; conditionId: string }
  | { kind: "field"; conditionId: string }
  | { kind: "operator"; conditionId: string }
  | { kind: "groupPlus"; groupId: string }
  | { kind: "groupConjunction"; groupId: string }
  | null;
