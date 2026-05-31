// Restricted to the literal types we actually pass into `$queryRawUnsafe`.
export type SqlParam = string | number | boolean | null | Date;

// Caller is responsible for validating that the underlying string
// (e.g. a columnId) is allow-listed before injection.
export function escapeLiteral(input: string): string {
  return input.replace(/'/g, "''");
}

// Must be paired with `ESCAPE '\'` in the SQL.
export function escapeLikePattern(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}
