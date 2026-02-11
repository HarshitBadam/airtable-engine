"use client";

import { useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { useGridStore } from "./grid-store";

/**
 * Step 6 (Recommended):
 * When the user starts sorting (and later, filtering), ensure DB indexes exist
 * for the involved column(s). This makes "1M rows" believable.
 *
 * - Dedupe: only once per columnId per session
 * - Fire-and-forget: does not block UI
 */
export function useEnsureIndexes(tableId: string) {
  // Only ensure indexes for sorts that are actually applied to the query
  const effectiveSorts = useGridStore((s) => s.autoSort ? s.sorts : s.savedSorts);

  const ensure = api.column.ensureIndexes.useMutation();
  const ensured = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (effectiveSorts.length === 0) return;

    for (const sort of effectiveSorts) {
      const columnId = sort.columnId;
      if (ensured.current.has(columnId)) continue;

      ensured.current.add(columnId);
      ensure.mutate({ tableId, columnId });
    }
  }, [effectiveSorts, tableId, ensure]);
}
