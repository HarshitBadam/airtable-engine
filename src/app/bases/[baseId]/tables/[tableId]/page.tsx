"use client";

import { use } from "react";
import { GridWorkspace } from "~/components/grid/ui/GridWorkspace";
import { GridStoreProvider } from "~/components/grid/grid-store";
import { api } from "~/trpc/react";

type PageProps = {
  params: Promise<{ baseId: string; tableId: string }>;
};

/**
 * When the URL has tableId="default", resolve it to the first real table
 * in the base before rendering the workspace.
 */
function ResolvedWorkspace({ baseId, tableId }: { baseId: string; tableId: string }) {
  const needsResolve = tableId === "default";

  const tablesQ = api.table.listByBase.useQuery(
    { baseId },
    { staleTime: 60_000, enabled: needsResolve },
  );

  // If we need to resolve "default" → real table ID
  if (needsResolve) {
    if (tablesQ.isLoading) {
      // Show the workspace shell immediately (empty) while resolving
      return null;
    }

    const resolvedId = tablesQ.data?.[0]?.id;

    if (!resolvedId) {
      return (
        <div style={{ color: "#333", padding: 40, fontFamily: "sans-serif" }}>
          No tables found for this base. Go back and try again.
        </div>
      );
    }

    return (
      <GridStoreProvider tableId={resolvedId}>
        <GridWorkspace baseId={baseId} tableId={resolvedId} />
      </GridStoreProvider>
    );
  }

  // tableId is already a real ID
  return (
    <GridStoreProvider tableId={tableId}>
      <GridWorkspace baseId={baseId} tableId={tableId} />
    </GridStoreProvider>
  );
}

export default function TablePage({ params }: PageProps) {
  const { baseId, tableId } = use(params);

  return <ResolvedWorkspace baseId={baseId} tableId={tableId} />;
}
