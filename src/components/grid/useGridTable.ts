"use client";

import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import { useGridStore } from "./grid-store";
import type { RowItem } from "./useGridRows";

export interface DbColumn {
  id: string;
  name: string;
  type: string;
  config?: unknown;
}

const columnHelper = createColumnHelper<RowItem>();

/** TanStack Table wrapper managing column definitions, visibility, and ordering. */
export function useGridTable(dbColumns: DbColumn[], data: RowItem[]) {
  const hiddenColumnIds = useGridStore((s) => s.hiddenColumnIds);
  const columnOrderIds = useGridStore((s) => s.columnOrderIds);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: ColumnDef<RowItem, any>[] = useMemo(() => {
    return dbColumns.map((col) =>
      columnHelper.accessor(
        (row) => {
          const cells = row.cells as Record<string, unknown> | null;
          if (!cells) return "";
          const val = cells[col.id];
          if (val === null || val === undefined) return "";
          if (typeof val === "string") return val;
          if (typeof val === "number" || typeof val === "boolean") return String(val);
          try { return JSON.stringify(val); } catch { return ""; }
        },
        {
          id: col.id,
          header: col.name,
          meta: {
            type: col.type,
            config: col.config,
          },
        },
      ),
    );
  }, [dbColumns]);

  const columnVisibility: VisibilityState = useMemo(() => {
    const vis: VisibilityState = {};
    for (const col of dbColumns) {
      vis[col.id] = !hiddenColumnIds.includes(col.id);
    }
    return vis;
  }, [dbColumns, hiddenColumnIds]);

  const columnOrder = useMemo(() => {
    if (columnOrderIds.length > 0) return columnOrderIds;
    return dbColumns.map((c) => c.id);
  }, [columnOrderIds, dbColumns]);

  const table = useReactTable({
    data,
    columns,
    state: {
      columnVisibility,
      columnOrder,
    },
    getCoreRowModel: getCoreRowModel(),
  });

  return table;
}
