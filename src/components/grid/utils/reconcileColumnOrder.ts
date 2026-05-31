import type { ViewConfig } from "~/shared/grid";

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

  const tableIdSet = new Set(tableColumnIds);
  order = order.filter((id) => tableIdSet.has(id));

  const hiddenColumnIds = config.hiddenColumnIds.filter((id) =>
    tableIdSet.has(id),
  );

  return { ...config, columnOrderIds: order, hiddenColumnIds };
}
