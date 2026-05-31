import { api } from "~/trpc/react";

export type ResolveTableIdResult =
  | { status: "loading" }
  | { status: "no-tables" }
  | { status: "resolved"; tableId: string };

export function useResolveTableId(baseId: string, tableId: string): ResolveTableIdResult {
  const needsResolve = tableId === "default";

  const tablesQ = api.table.listByBase.useQuery(
    { baseId },
    {
      staleTime: 60_000,
      enabled: needsResolve,
      retry: (failureCount) => failureCount < 20,
      retryDelay: 500,
      refetchInterval: (query) => {
        const data = query.state.data;
        return !data || data.length === 0 ? 500 : false;
      },
    },
  );

  if (!needsResolve) {
    return { status: "resolved", tableId };
  }

  const tables = tablesQ.data ?? [];
  if (tablesQ.isLoading || (tablesQ.isSuccess && tables.length === 0)) {
    return { status: "loading" };
  }

  const lastTableId =
    typeof window !== "undefined" ? localStorage.getItem(`base-lastTable-${baseId}`) : null;
  const resolvedId =
    lastTableId && tables.some((t) => t.id === lastTableId) ? lastTableId : tables[0]?.id;

  if (!resolvedId) {
    return { status: "no-tables" };
  }

  return { status: "resolved", tableId: resolvedId };
}
