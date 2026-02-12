"use client";

import { useEffect, useMemo } from "react";
import type { inferProcedureInput } from "@trpc/server";
import { keepPreviousData } from "@tanstack/react-query";

import { api } from "~/trpc/react";
import { useDebouncedValue } from "~/hooks/useDebouncedValue";
import type { AppRouter } from "~/server/api/root";

import { useGridStore } from "./grid-store";

export type RowInfiniteInput = inferProcedureInput<AppRouter["row"]["infinite"]>;

export function useGridRows(tableId: string) {
  const search = useGridStore((s) => s.search);
  const filters = useGridStore((s) => s.filters);
  const filterConjunction = useGridStore((s) => s.filterConjunction);
  const filterTree = useGridStore((s) => s.filterTree);

  // Which sorts drive the query?
  // autoSort=true  + sorts exist → use sorts (live preview, orange indicators)
  // autoSort=true  + sorts empty → fall back to permanentSorts (base order)
  // autoSort=false              → always permanentSorts (entries are just staged)
  const effectiveSorts = useGridStore((s) =>
    (s.autoSort && s.sorts.length > 0) ? s.sorts : s.permanentSorts,
  );

  const clearSelection = useGridStore((s) => s.clearSelection);

  const debouncedSearch = useDebouncedValue(search, 250);

  const input: RowInfiniteInput = useMemo(
    () => ({
      tableId,
      limit: 200,
      search: debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
      // When filterTree is present, send it instead of flat filters
      filters: !filterTree && filters.length ? filters : undefined,
      conjunction: !filterTree && filters.length ? filterConjunction : undefined,
      filterTree: filterTree ?? undefined,
      sorts: effectiveSorts.length > 0 ? effectiveSorts : undefined,
    }),
    [tableId, debouncedSearch, filters, filterConjunction, filterTree, effectiveSorts],
  );

  // Clear cell selection whenever the actual query parameters change.
  // Uses value-based comparison (JSON string) so referential identity
  // of the `input` object doesn't cause false positives.
  const inputKey = JSON.stringify(input);
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey]);

  const q = api.row.infinite.useInfiniteQuery(input, {
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    // Keep showing the previous rows while the new filtered/sorted query loads.
    // This prevents the "flash to empty" lag when filters/sorts change.
    placeholderData: keepPreviousData,
  });

  // Per-view row ordering: when the user has manually reordered rows via drag,
  // rowOrderIds defines the display order. We apply it client-side.
  const rowOrderIds = useGridStore((s) => s.rowOrderIds);

  // Stabilise `rows` — flatMap creates a new array on every render; useMemo
  // ensures the reference only changes when the underlying query data changes.
  // If the view has a custom rowOrderIds, reorder the rows accordingly.
  const rows = useMemo(() => {
    const flat = q.data?.pages.flatMap((p) => p.items) ?? [];

    // Only apply custom row order when:
    // 1. rowOrderIds is non-empty (user has manually reordered)
    // 2. No sorts or search are active (custom order only applies in natural view)
    if (rowOrderIds.length === 0 || effectiveSorts.length > 0 || debouncedSearch.trim()) {
      return flat;
    }

    // Build a map for O(1) lookup
    const rowMap = new Map(flat.map((r) => [r.id, r]));

    // Reorder: known rows first (in custom order), then any new rows at the end
    const ordered: typeof flat = [];
    const seen = new Set<string>();

    for (const id of rowOrderIds) {
      const r = rowMap.get(id);
      if (r) {
        ordered.push(r);
        seen.add(id);
      }
    }

    // Append rows not in the custom order (newly added rows)
    for (const r of flat) {
      if (!seen.has(r.id)) {
        ordered.push(r);
      }
    }

    return ordered;
  }, [q.data, rowOrderIds, effectiveSorts.length, debouncedSearch]);

  const totalCount: number = q.data?.pages?.[0]?.totalCount ?? 0;

  return { q, rows, totalCount, input, debouncedSearch };
}
