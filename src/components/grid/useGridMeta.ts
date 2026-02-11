"use client";

import { api } from "~/trpc/react";
import { normalizeViewConfig } from "~/shared/grid";
import type { ViewConfig } from "~/shared/grid";
import { useGridStore } from "./grid-store";
import { useEffect } from "react";

/**
 * Ensure columnOrderIds is populated and in sync with actual table columns.
 * - If empty, use table column order.
 * - Append any new columns not yet in the order list.
 * - Remove stale ids (columns that no longer exist).
 */
export function reconcileColumnOrder(
  config: ViewConfig,
  tableColumnIds: string[],
): ViewConfig {
  let order = config.columnOrderIds.length
    ? config.columnOrderIds
    : tableColumnIds;

  // Append new columns that aren't in the order list yet
  for (const id of tableColumnIds) {
    if (!order.includes(id)) {
      order = [...order, id];
    }
  }

  // Remove stale column ids that no longer exist in the table
  const tableIdSet = new Set(tableColumnIds);
  order = order.filter((id) => tableIdSet.has(id));

  // Also clean stale ids from hiddenColumnIds
  const hiddenColumnIds = config.hiddenColumnIds.filter((id) =>
    tableIdSet.has(id),
  );

  return { ...config, columnOrderIds: order, hiddenColumnIds };
}

export function useGridMeta(tableId: string) {
  const viewsQ = api.view.list.useQuery({ tableId }, { staleTime: 60_000 });
  const colsQ = api.column.list.useQuery({ tableId }, { staleTime: 60_000 });

  const initialized = useGridStore((s) => s.initialized);
  const initializeFromView = useGridStore((s) => s.initializeFromView);

  useEffect(() => {
    if (initialized) return;
    const first = viewsQ.data?.[0];
    if (!first) return;
    const cols = colsQ.data;
    if (!cols) return;

    const config = normalizeViewConfig(first.config);
    const tableColumnIds = cols.map((c) => c.id);
    const reconciledConfig = reconcileColumnOrder(config, tableColumnIds);

    initializeFromView(first.id, reconciledConfig);
  }, [initialized, viewsQ.data, colsQ.data, initializeFromView]);

  return { viewsQ, colsQ };
}
