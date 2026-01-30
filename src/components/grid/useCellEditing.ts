"use client";

import type { inferProcedureInput, inferProcedureOutput } from "@trpc/server";
import type { InfiniteData } from "@tanstack/react-query";

import { api } from "~/trpc/react";
import type { AppRouter } from "~/server/api/root";

import { useGridStore } from "./grid-store";
import type { RowInfiniteInput } from "./useGridRows";

type RowInfinitePage = inferProcedureOutput<AppRouter["row"]["infinite"]>;
type RowInfiniteCursor = RowInfinitePage["nextCursor"];
type RowInfiniteData = InfiniteData<RowInfinitePage, RowInfiniteCursor>;

type UpdateCellInput = inferProcedureInput<AppRouter["row"]["updateCell"]>;

function asCellRecord(cells: unknown): Record<string, unknown> {
  if (!cells || typeof cells !== "object") return {};
  return cells as Record<string, unknown>;
}

export function useCellEditing(tableId: string, rowQueryInput: RowInfiniteInput) {
  const editingCell = useGridStore((s) => s.editingCell);
  const editorValue = useGridStore((s) => s.editorValue);
  const stopEditing = useGridStore((s) => s.stopEditing);

  const search = useGridStore((s) => s.search);
  const filters = useGridStore((s) => s.filters);
  const sort = useGridStore((s) => s.sort);

  const utils = api.useUtils();

  const mut = api.row.updateCell.useMutation({
    onMutate: async (vars: UpdateCellInput) => {
      await utils.row.infinite.cancel(rowQueryInput);

      const prev = utils.row.infinite.getInfiniteData(rowQueryInput);

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

      return { prev };
    },

    onError: (_e, _v, ctx) => {
      if (ctx?.prev) {
        utils.row.infinite.setInfiniteData(rowQueryInput, ctx.prev);
      }
    },

    onSuccess: async () => {
      const affectsMembership = !!search.trim() || filters.length > 0 || !!sort;
      if (affectsMembership) {
        await utils.row.infinite.invalidate(rowQueryInput);
      }
    },
  });

  return {
    editingCell,
    editorValue,
    commit: (args: { rowId: string; columnId: string; columnType: "TEXT" | "NUMBER" }) => {
      if (!editingCell) return;

      const raw = editorValue;
      let value: string | number | null = raw.trim() ? raw : null;

      if (args.columnType === "NUMBER") {
        if (value !== null) {
          const n = Number(raw);
          value = Number.isFinite(n) ? n : null;
        }
      }

      mut.mutate({ tableId, rowId: args.rowId, columnId: args.columnId, value });
      stopEditing();
    },
    cancel: () => stopEditing(),
    saving: mut.isPending,
  };
}
