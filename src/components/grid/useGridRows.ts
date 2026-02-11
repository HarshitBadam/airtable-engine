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

  // Effective sorts: autoSort=true → live preview of UI sorts
  //                  autoSort=false → only persisted (saved) sorts drive the query
  const effectiveSorts = useGridStore((s) => s.autoSort ? s.sorts : s.savedSorts);

  const clearSelection = useGridStore((s) => s.clearSelection);

  const debouncedSearch = useDebouncedValue(search, 250);

  const input: RowInfiniteInput = useMemo(
    () => ({
      tableId,
      limit: 200,
      search: debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
      filters: filters.length ? filters : undefined,
      conjunction: filters.length ? filterConjunction : undefined,
      sorts: effectiveSorts.length > 0 ? effectiveSorts : undefined,
    }),
    [tableId, debouncedSearch, filters, filterConjunction, effectiveSorts],
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

  // Stabilise `rows` — flatMap creates a new array on every render; useMemo
  // ensures the reference only changes when the underlying query data changes.
  const rows = useMemo(
    () => q.data?.pages.flatMap((p) => p.items) ?? [],
    [q.data],
  );
  const totalCount: number = q.data?.pages?.[0]?.totalCount ?? 0;

  return { q, rows, totalCount, input, debouncedSearch };
}
