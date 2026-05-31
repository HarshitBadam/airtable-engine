/**
 * Narrow `cells` (typed as `unknown` because Prisma serializes it as JSON)
 * to a `Record<string, unknown>` for safe property access.
 */
export function asCellRecord(cells: unknown): Record<string, unknown> {
  return (cells ?? {}) as Record<string, unknown>;
}
