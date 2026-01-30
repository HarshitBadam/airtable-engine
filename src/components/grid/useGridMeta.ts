"use client";

import { api } from "~/trpc/react";
import { normalizeViewConfig } from "~/shared/grid";
import { useGridStore } from "./grid-store";
import { useEffect } from "react";

export function useGridMeta(tableId: string) {
  const viewsQ = api.view.list.useQuery({ tableId }, { staleTime: 60_000 });
  const colsQ = api.column.list.useQuery({ tableId }, { staleTime: 60_000 });

  const initialized = useGridStore((s) => s.initialized);
  const initializeFromView = useGridStore((s) => s.initializeFromView);

  useEffect(() => {
    if (initialized) return;
    const first = viewsQ.data?.[0];
    if (!first) return;

    initializeFromView(first.id, normalizeViewConfig(first.config));
  }, [initialized, viewsQ.data, initializeFromView]);

  return { viewsQ, colsQ };
}
