// Restricted to the literal types we actually pass into `$queryRawUnsafe`.
export type SqlParam = string | number | boolean | null | Date;

const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,191}$/;

/**
 * Validates that `input` is a safe database identifier (cuid, uuid, etc.).
 * Throws if the value contains any character outside [A-Za-z0-9_-] or
 * exceeds 191 chars — eliminating the entire SQL-injection surface for
 * interpolated identifiers.
 */
export function assertSafeId(input: string): string {
  if (!SAFE_ID_RE.test(input)) {
    throw new Error(
      `Unsafe SQL identifier rejected: ${JSON.stringify(input).slice(0, 80)}`,
    );
  }
  return input;
}

/**
 * Escapes a server-controlled identifier for embedding in a SQL single-quoted
 * literal. Validates the identifier format first via `assertSafeId`.
 */
export function escapeLiteral(input: string): string {
  return assertSafeId(input).replace(/'/g, "''");
}

// Must be paired with `ESCAPE '\'` in the SQL.
export function escapeLikePattern(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}
