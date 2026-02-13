"use client";

import { api } from "~/trpc/react";
import { useGridStore } from "./grid-store";

export function useViewActions(tableId: string) {
  const activeViewId = useGridStore((s) => s.activeViewId);
  const saved = useGridStore((s) => s.savedFingerprint);
  const cur = useGridStore((s) => s.fingerprint);
  const markSaved = useGridStore((s) => s.markSaved);
  const markSortsSaved = useGridStore((s) => s.markSortsSaved);
  const markFiltersSaved = useGridStore((s) => s.markFiltersSaved);

  const search = useGridStore((s) => s.search);
  const filters = useGridStore((s) => s.filters);
  const filterConjunction = useGridStore((s) => s.filterConjunction);
  const filterTree = useGridStore((s) => s.filterTree);
  const sorts = useGridStore((s) => s.sorts);
  const permanentSorts = useGridStore((s) => s.permanentSorts);
  const autoSort = useGridStore((s) => s.autoSort);
  const hiddenColumnIds = useGridStore((s) => s.hiddenColumnIds);
  const columnOrderIds = useGridStore((s) => s.columnOrderIds);
  const rowOrderIds = useGridStore((s) => s.rowOrderIds);
  const rowHeightPreset = useGridStore((s) => s.rowHeightPreset);
  const wrapHeaders = useGridStore((s) => s.wrapHeaders);

  const isDirty = saved !== cur;

  const utils = api.useUtils();

  // Mutation to compute materialized ranks for saved sorted views
  const computeRanks = api.row.computeViewRanks.useMutation();

  const update = api.view.update.useMutation({
    onSuccess: async () => {
      markSortsSaved();
      markFiltersSaved();
      markSaved();
      await utils.view.list.invalidate({ tableId });

      // If the view has permanent sorts, compute materialized ranks
      // so that windowFetch can use Tier 2 (rank BETWEEN) for instant jumps.
      if (activeViewId && permanentSorts.length > 0) {
        computeRanks.mutate({
          tableId,
          viewId: activeViewId,
          sorts: permanentSorts,
        });
      }
    },
  });

  return {
    isDirty,
    save: () => {
      if (!activeViewId) return;
      // Persist the full view config including permanentSorts, autoSort, and rowOrderIds.
      // Omitting them would cause them to revert to defaults on save.
      update.mutate({
        viewId: activeViewId,
        config: {
          search,
          filters,
          filterConjunction,
          filterTree,
          sorts,
          permanentSorts,
          autoSort,
          hiddenColumnIds,
          columnOrderIds,
          rowOrderIds,
          rowHeightPreset,
          wrapHeaders,
        },
      });
    },
    saving: update.isPending,
  };
}
