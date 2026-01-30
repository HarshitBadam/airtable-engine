"use client";

import { api } from "~/trpc/react";
import { useGridStore } from "./grid-store";

export function useViewActions(tableId: string) {
  const activeViewId = useGridStore((s) => s.activeViewId);
  const saved = useGridStore((s) => s.savedFingerprint);
  const cur = useGridStore((s) => s.fingerprint);
  const markSaved = useGridStore((s) => s.markSaved);

  const search = useGridStore((s) => s.search);
  const filters = useGridStore((s) => s.filters);
  const sort = useGridStore((s) => s.sort);
  const hiddenColumnIds = useGridStore((s) => s.hiddenColumnIds);

  const isDirty = saved !== cur;

  const utils = api.useUtils();
  const update = api.view.update.useMutation({
    onSuccess: async () => {
      markSaved();
      await utils.view.list.invalidate({ tableId });
    },
  });

  return {
    isDirty,
    save: () => {
      if (!activeViewId) return;
      update.mutate({ viewId: activeViewId, config: { search, filters, sort, hiddenColumnIds } });
    },
    saving: update.isPending,
  };
}
