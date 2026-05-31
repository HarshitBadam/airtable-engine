"use client";

import { useEffect } from "react";
import { skipToken } from "@tanstack/react-query";
import { api } from "~/trpc/react";
import { useGridStore } from "~/components/grid/GridStore";
import type { RowInfiniteInput } from "../useGridRows";

interface UseSearchMatchCountArgs {
  tableId: string;
  debouncedSearch: string;
  rowQueryInput: RowInfiniteInput;
}

export interface UseSearchMatchCountResult {
  displayMatchCount: number;
  isSearchPending: boolean;
  search: string;
}

export function useSearchMatchCount({
  tableId,
  debouncedSearch,
  rowQueryInput,
}: UseSearchMatchCountArgs): UseSearchMatchCountResult {
  const search = useGridStore((s) => s.search);
  const findCountDelta = useGridStore((s) => s.findCountDelta);
  const resetFindCountDelta = useGridStore((s) => s.resetFindCountDelta);

  const activeSearchTermForCount = debouncedSearch.trim();
  const searchCountQ = api.row.searchMatchCount.useQuery(
    activeSearchTermForCount
      ? {
          tableId,
          search: activeSearchTermForCount,
          filters: rowQueryInput.filters,
          conjunction: rowQueryInput.conjunction,
          filterTree: rowQueryInput.filterTree,
        }
      : skipToken,
    { staleTime: 10_000, refetchOnWindowFocus: false },
  );

  const serverMatchCount: number = searchCountQ.data?.count ?? 0;

  // Reset the client-side delta whenever the server count refreshes (it now
  // incorporates any edits that happened since the last fetch).
  const searchCountUpdatedAt = searchCountQ.dataUpdatedAt;
  useEffect(() => {
    if (searchCountUpdatedAt) resetFindCountDelta();
  }, [searchCountUpdatedAt, resetFindCountDelta]);

  const displayMatchCount = Math.max(0, serverMatchCount + findCountDelta);
  const isSearchPending = search !== debouncedSearch || searchCountQ.isFetching;

  return { displayMatchCount, isSearchPending, search };
}
