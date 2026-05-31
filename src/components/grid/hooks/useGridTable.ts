"use client";

import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import { useGridStore } from "../GridStore";
import type { RowItem } from "./useGridRows";

/** Column info from the database */
export interface DbColumn {
  id: string;
  name: string;
  type: string;
  config?: unknown;
}

const columnHelper = createColumnHelper<RowItem>();

/**
 * Thin TanStack Table wrapper that manages column definitions, visibility,
 * and ordering from the Zustand grid store. The actual cell rendering still
 * happens in our custom GridRow component — this hook primarily satisfies the
 * spec requirement of using @tanstack/react-table and provides a proper
 * column model that can drive flexRender for cell content.
 */
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
    // We manage visibility and ordering externally via Zustand store,
    // so we provide these as controlled state (no onColumnVisibilityChange etc.)
  });

  return table;
}
