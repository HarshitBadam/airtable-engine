"use client";

import type { inferProcedureInput, inferProcedureOutput } from "@trpc/server";
import type { InfiniteData } from "@tanstack/react-query";

import { api } from "~/trpc/react";
import type { AppRouter } from "~/server/api/root";

import { useGridStore } from "./grid-store";
import type { RowInfiniteInput, RowItem } from "./useGridRows";
import { parseNumberInput } from "~/shared/numberUtils";
import type { NumberFormatConfig } from "~/shared/numberUtils";

type RowInfinitePage = inferProcedureOutput<AppRouter["row"]["infinite"]>;
type RowInfiniteCursor = RowInfinitePage["nextCursor"];
type RowInfiniteData = InfiniteData<RowInfinitePage, RowInfiniteCursor>;

type UpdateCellInput = inferProcedureInput<AppRouter["row"]["updateCell"]>;

function asCellRecord(cells: unknown): Record<string, unknown> {
  if (!cells || typeof cells !== "object") return {};
  return cells as Record<string, unknown>;
}

export function useCellEditing(
  tableId: string,
  rowQueryInput: RowInfiniteInput,
  /** Optimistically update a row in the jump cache (for rows beyond infinite scroll range). */
  updateJumpCacheRow?: (rowId: string, updater: (row: RowItem) => RowItem) => void,
  /** Called when a cell edit may have changed the row's position (sort) or
   *  membership (filter) in the current result set.  Receives the edited row's
   *  ID so the caller can do a *targeted* cache update (remove just that row)
   *  instead of nuking the entire jump cache. */
  onMembershipChange?: (rowId: string) => void,
) {
  const editingCell = useGridStore((s) => s.editingCell);
  const editorValue = useGridStore((s) => s.editorValue);
  const stopEditing = useGridStore((s) => s.stopEditing);

  const search = useGridStore((s) => s.search);
  const filters = useGridStore((s) => s.filters);
  const filterTree = useGridStore((s) => s.filterTree);
  const autoSort = useGridStore((s) => s.autoSort);
  const sorts = useGridStore((s) => s.sorts);
  const permanentSorts = useGridStore((s) => s.permanentSorts);

  const utils = api.useUtils();

  const mut = api.row.updateCell.useMutation({
    onMutate: async (vars: UpdateCellInput) => {
      await utils.row.infinite.cancel(rowQueryInput);

      const prev = utils.row.infinite.getInfiniteData(rowQueryInput);

      // 1. Optimistic update for infinite query pages
      utils.row.infinite.setInfiniteData(rowQueryInput, (old): RowInfiniteData | undefined => {
        if (!old) return old;

        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((r) => {
              if (r.id !== vars.rowId) return r;

              const nextCells = { ...asCellRecord(r.cells) };

              if (vars.value === null || vars.value === "") {
                delete nextCells[vars.columnId];
              } else {
                nextCells[vars.columnId] = vars.value;
              }

              return {
                ...r,
                cells: nextCells,
                updatedAt: new Date(),
              };
            }),
          })),
        };
      });

      // 2. Optimistic update for jump-cached rows (rows loaded via windowFetch)
      if (updateJumpCacheRow) {
        updateJumpCacheRow(vars.rowId, (row) => {
          const nextCells = { ...asCellRecord(row.cells) };
          if (vars.value === null || vars.value === "") {
            delete nextCells[vars.columnId];
          } else {
            nextCells[vars.columnId] = vars.value;
          }
          return { ...row, cells: nextCells, updatedAt: new Date() };
        });
      }

      return { prev };
    },

    onError: (_e, _v, ctx) => {
      if (ctx?.prev) {
        utils.row.infinite.setInfiniteData(rowQueryInput, ctx.prev);
      }
      // Note: jump cache rollback is not critical — a stale value will be
      // refreshed on next scroll or page navigation.
    },

    onSuccess: (_data, vars) => {
      // Detect whether the edit could change which rows are visible or
      // where they appear.  We must check:
      //   - search (client-side, but affects highlight counts)
      //   - filters / filterTree (server-side row membership)
      //   - live sorts (autoSort + sorts → row position changes)
      //   - permanent sorts (autoSort=false + permanentSorts → row position)
      const liveSortsActive = autoSort && sorts.length > 0;
      const permSortsActive = !autoSort && permanentSorts.length > 0;
      const hasFilters = filters.length > 0 || !!filterTree;
      const affectsMembership = !!search.trim() || hasFilters || liveSortsActive || permSortsActive;
      if (affectsMembership) {
        // Targeted: remove only the edited row from the jump cache,
        // then invalidate the infinite query.  This avoids nuking the
        // entire cache (which causes skeleton flash + rebuild storm for
        // all ~15K cached positions) while still removing the stale
        // entry that would otherwise cause duplicates or ghost rows.
        onMembershipChange?.(vars.rowId);
      }
    },
  });

  return {
    editingCell,
    editorValue,
    commit: (args: {
      rowId: string;
      columnId: string;
      columnType: "TEXT" | "NUMBER";
      /** Column's number format config (for allowNegative, etc.) — raw JSON from DB */
      numberConfig?: unknown;
    }) => {
      if (!editingCell) return;

      const raw = editorValue;
      let value: string | number | null = raw.trim() ? raw : null;

      if (args.columnType === "NUMBER") {
        if (value !== null) {
          // Use robust parsing: handles scientific notation (1e4), K/M/B suffixes,
          // various thousands separators, etc. Returns null for non-numeric input.
          const cfg = args.numberConfig as NumberFormatConfig | null | undefined;
          const allowNeg = cfg?.allowNegative ?? true;
          const parsed = parseNumberInput(raw, allowNeg);
          value = parsed; // null clears the cell if input isn't numeric
        }
      }

      mut.mutate({ tableId, rowId: args.rowId, columnId: args.columnId, value });
      stopEditing();
    },
    cancel: () => stopEditing(),
    saving: mut.isPending,
  };
}
