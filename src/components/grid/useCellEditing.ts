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
  updateJumpCacheRow?: (rowId: string, updater: (row: RowItem) => RowItem) => void,
  getRowById?: (rowId: string) => RowItem | null,
  onMembershipChange?: (rowId: string, columnId: string, value: string | number | null) => void,
  onCellValueChange?: (
    rowId: string,
    columnId: string,
    oldValue: string | number | null,
    newValue: string | number | null,
  ) => void,
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

      // Resolve old value for onCellValueChange (from infinite data or jump cache)
      let oldVal: string | number | null = null;
      let foundInPrev = false;
      for (const page of prev?.pages ?? []) {
        const r = page.items.find((x: RowItem) => x.id === vars.rowId);
        if (r) {
          foundInPrev = true;
          const v = asCellRecord(r.cells)[vars.columnId];
          oldVal = v !== undefined && v !== null ? (v as string | number) : null;
          break;
        }
      }

      // Freeze pre-edit value into dependent (duplicate) columns
      const cols = utils.column.list.getData({ tableId });
      const dependentColIds = cols
        ?.filter((c: { sourceColumnId?: string | null }) => c.sourceColumnId === vars.columnId)
        .map((c: { id: string }) => c.id) ?? [];

      utils.row.infinite.setInfiniteData(rowQueryInput, (old): RowInfiniteData | undefined => {
        if (!old) return old;

        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((r) => {
              if (r.id !== vars.rowId) return r;

              const nextCells = { ...asCellRecord(r.cells) };

              // Freeze pre-edit value into dependent columns if not already set
              for (const depId of dependentColIds) {
                if (!Object.prototype.hasOwnProperty.call(nextCells, depId)) {
                  nextCells[depId] = nextCells[vars.columnId] ?? null;
                }
              }

              nextCells[vars.columnId] = (vars.value === null || vars.value === "") ? null : vars.value;

              return {
                ...r,
                cells: nextCells,
                updatedAt: new Date(),
              };
            }),
          })),
        };
      });

      if (!foundInPrev && updateJumpCacheRow) {
        if (onCellValueChange && getRowById) {
          const jumpRow = getRowById(vars.rowId);
          if (jumpRow) {
            const o = asCellRecord(jumpRow.cells)[vars.columnId];
            oldVal = o !== undefined && o !== null ? (o as string | number) : null;
            foundInPrev = true; // treat as found so the callback below fires
          }
        }

        updateJumpCacheRow(vars.rowId, (row) => {
          const nextCells = { ...asCellRecord(row.cells) };

          // Freeze pre-edit value into dependent columns
          for (const depId of dependentColIds) {
            if (!Object.prototype.hasOwnProperty.call(nextCells, depId)) {
              nextCells[depId] = nextCells[vars.columnId] ?? null;
            }
          }

          nextCells[vars.columnId] = (vars.value === null || vars.value === "") ? null : vars.value;
          return { ...row, cells: nextCells, updatedAt: new Date() };
        });
      }

      if (foundInPrev && onCellValueChange) {
        onCellValueChange(vars.rowId, vars.columnId, oldVal, vars.value);
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
      // Detect whether the edit could change row visibility or position
      const liveSortsActive = autoSort && sorts.length > 0;
      const permSortsActive = !autoSort && permanentSorts.length > 0;
      const hasFilters = filters.length > 0 || !!filterTree;
      const affectsMembership = !!search.trim() || hasFilters || liveSortsActive || permSortsActive;
      if (affectsMembership) {
        onMembershipChange?.(vars.rowId, vars.columnId, vars.value);
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
