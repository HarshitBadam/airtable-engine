"use client";

import { api } from "~/trpc/react";
import { useDebouncedValue } from "~/hooks/useDebouncedValue";
import { useGridStore } from "./grid-store";
import { useMemo, useEffect } from "react";

export function useGridRows(tableId: string) {
  const search = useGridStore((s) => s.search);
  const filters = useGridStore((s) => s.filters);
  const sort = useGridStore((s) => s.sort);
  const fingerprint = useGridStore((s) => s.fingerprint);
  const clearSelection = useGridStore((s) => s.clearSelection);

  const debouncedSearch = useDebouncedValue(search, 250);

  const input = useMemo(
    () => ({
      tableId,
      limit: 200,
      search: debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
      filters: filters.length ? filters : undefined,
      sort: sort ?? undefined,
    }),
    [tableId, debouncedSearch, filters, sort],
  );

  useEffect(() => {
    clearSelection();
  }, [fingerprint, clearSelection]);

  const q = api.row.infinite.useInfiniteQuery(input, {
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  const totalCount = q.data?.pages?.[0]?.totalCount ?? 0;

  return { q, rows, totalCount, input };
}
