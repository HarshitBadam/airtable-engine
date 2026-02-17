/**
 * Module-level tracker for base IDs that are pending deletion.
 *
 * When a user confirms a delete, the ID is added here immediately
 * (inside onMutate).  Any query result — whether from an optimistic
 * cache hit or a fresh server fetch — is filtered through
 * `filterPendingDeletes` so the base never "flashes back" on the
 * dashboard while the backend cascade-delete is still in-flight.
 *
 * The ID is removed in onSettled (after the mutation fully resolves).
 */

const pending = new Set<string>();

export function markPendingDelete(id: string): void {
  pending.add(id);
}

export function clearPendingDelete(id: string): void {
  pending.delete(id);
}

export function filterPendingDeletes<T extends { id: string }>(
  items: T[],
): T[] {
  if (pending.size === 0) return items;
  return items.filter((item) => !pending.has(item.id));
}
