// Restricted to the literal types we actually pass into `$queryRawUnsafe`.
export type SqlParam = string | number | boolean | null | Date;

// Escape an identifier or literal so that it can be safely embedded as a
// quoted value in raw SQL. Caller is responsible for validating that the
// underlying string (e.g. a columnId) is allow-listed before injection.
export function escapeLiteral(input: string): string {
  return input.replace(/'/g, "''");
}

// Escape special LIKE/ILIKE pattern characters so that user input is treated
// as a literal substring rather than a wildcard. Must be paired with
// `ESCAPE '\'` in the SQL.
export function escapeLikePattern(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}
