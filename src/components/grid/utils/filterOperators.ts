export interface FilterOperatorOption {
  value: string;
  label: string;
}

export const TEXT_OPERATORS: FilterOperatorOption[] = [
  { value: "contains", label: "contains..." },
  { value: "not_contains", label: "does not contain..." },
  { value: "equals", label: "is..." },
  { value: "not_equals", label: "is not..." },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

export const NUMBER_OPERATORS: FilterOperatorOption[] = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "≠" },
  { value: "lt", label: "<" },
  { value: "gt", label: ">" },
  { value: "lte", label: "≤" },
  { value: "gte", label: "≥" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

export function getOperatorsForType(type: string): FilterOperatorOption[] {
  return type === "NUMBER" ? NUMBER_OPERATORS : TEXT_OPERATORS;
}

export function getDefaultOperator(type: string): string {
  return type === "NUMBER" ? "equals" : "contains";
}

export function operatorLabel(op: string, type: string): string {
  const ops = getOperatorsForType(type);
  return ops.find((o) => o.value === op)?.label ?? op;
}
