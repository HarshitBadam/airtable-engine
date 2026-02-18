"use client";

import { api } from "~/trpc/react";
import { normalizeViewConfig } from "~/shared/grid";
import type { ViewConfig } from "~/shared/grid";
import { useGridStore } from "./grid-store";
import { useEffect } from "react";

/**
 * Ensure columnOrderIds is populated and in sync with actual table columns.
 * - If empty, use table column order.
 * - Append any new columns not yet in the order list (columns are table-level).
 * - Remove stale ids (columns that no longer exist).
 */
export function reconcileColumnOrder(
  config: ViewConfig,
  tableColumnIds: string[],
): ViewConfig {
  let order = config.columnOrderIds.length
    ? config.columnOrderIds
    : tableColumnIds;

  // Append new table columns that aren't yet in the view's order.
  // Column creation is table-level: new columns appear in ALL views.
  // This handles the case where the server-side update to ALL views'
  // columnOrderIds hasn't been fetched yet by the client.
  const existingSet = new Set(order);
  const newCols = tableColumnIds.filter((id) => !existingSet.has(id));
  if (newCols.length > 0) {
    order = [...order, ...newCols];
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
