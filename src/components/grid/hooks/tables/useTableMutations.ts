"use client";

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "~/trpc/react";
import type { useRouter } from "next/navigation";

const PENDING_RENAME_KEY = "grid:pendingRenameTableId";

export function takePendingRenameTableId(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(PENDING_RENAME_KEY);
  if (value) window.sessionStorage.removeItem(PENDING_RENAME_KEY);
  return value;
}

export function setPendingRenameTableId(id: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PENDING_RENAME_KEY, id);
}

interface TableItem {
  id: string;
  name: string;
}

interface UseTableMutationsProps {
  baseId: string;
  tableId: string;
  router: ReturnType<typeof useRouter>;
  utils: ReturnType<typeof api.useUtils>;
}

export function useTableMutations({
  baseId,
  tableId,
  router,
  utils,
}: UseTableMutationsProps) {
  const queryClient = useQueryClient();
  const activeTableId = tableId;

  const tablesQuery = api.table.listByBase.useQuery(
    { baseId },
    { staleTime: 30_000 },
  );
  const tables: TableItem[] = useMemo(
    () => (tablesQuery.data ?? []).map((t) => ({ id: t.id, name: t.name })),
    [tablesQuery.data],
  );

  const createTableMut = api.table.create.useMutation({
    onSuccess: async (result) => {
      await utils.table.listByBase.invalidate({ baseId });
      setPendingRenameTableId(result.table.id);
      router.push(`/bases/${baseId}/tables/${result.table.id}`);
    },
  });

  const renameTableMut = api.table.rename.useMutation({
    onSuccess: () => utils.table.listByBase.invalidate({ baseId }),
  });

  const deleteTableMut = api.table.delete.useMutation({
    onSuccess: () => {
      void utils.table.listByBase.invalidate({ baseId });
    },
    onError: () => {
      void utils.table.listByBase.invalidate({ baseId });
    },
  });

  const clearDataMut = api.row.clearData.useMutation({
    onSuccess: () => {
      void utils.row.infinite.invalidate();
    },
    onError: () => {
      void utils.row.infinite.invalidate();
    },
  });

  const handleAddTable = () => {
    const existingNames = new Set(tables.map((t) => t.name));
    let num = tables.length + 1;
    let newName = `Table ${num}`;
    while (existingNames.has(newName)) {
      num++;
      newName = `Table ${num}`;
    }
    createTableMut.mutate({ baseId, name: newName });
  };

  const renameTable = (name: string) => {
    renameTableMut.mutate({ id: activeTableId, name });
  };

  const clearData = async () => {
    await utils.row.infinite.cancel();

    queryClient.setQueriesData<{
      pages: { items: unknown[]; totalCount: number; nextCursor: unknown }[];
      pageParams: unknown[];
    }>(
      {
        queryKey: [["row", "infinite"]],
        predicate: (query) => {
          const key = query.queryKey as [
            string[],
            { input?: { tableId?: string } },
          ];
          return key[1]?.input?.tableId === activeTableId;
        },
      },
      (old) => {
        if (!old) return old;
        return {
          pages: [{ items: [], totalCount: 0, nextCursor: undefined }],
          pageParams: [old.pageParams[0]],
        };
      },
    );

    clearDataMut.mutate({ tableId: activeTableId });
  };

  const deleteTable = () => {
    if (tables.length <= 1) return;
    const remaining = tables.filter((t) => t.id !== activeTableId);
    router.push(`/bases/${baseId}/tables/${remaining[0]!.id}`);
    void utils.table.listByBase.cancel({ baseId });
    utils.table.listByBase.setData({ baseId }, (old) =>
      old ? old.filter((t) => t.id !== activeTableId) : old,
    );
    deleteTableMut.mutate({ id: activeTableId, baseId });
  };

  return {
    tables,
    activeTableId,
    handleAddTable,
    renameTable,
    clearData,
    deleteTable,
  };
}
