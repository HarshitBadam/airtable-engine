"use client";

import { use } from "react";
import { GridWorkspace } from "~/components/grid/ui/GridWorkspace";
import { GridStoreProvider } from "~/components/grid/grid-store";
import { api } from "~/trpc/react";

type PageProps = {
  params: Promise<{ baseId: string; tableId: string }>;
};

/** Airtable-style loading skeleton for the base view */
function BaseLoadingSkeleton() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "row",
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      background: "#fff",
      fontFamily: '-apple-system, system-ui, "system-ui", "Segoe UI", Roboto, sans-serif',
      fontSize: 13,
      color: "rgb(29, 31, 37)",
    }}>
      {/* Sidebar rail */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: 56,
        height: "100%",
        padding: "16px 8px",
        boxSizing: "border-box",
        borderRight: "1px solid rgba(0,0,0,0.1)",
        background: "#fff",
        flexShrink: 0,
      }} />
      {/* Main area */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          height: 56,
          borderBottom: "1px solid rgba(0,0,0,0.1)",
          background: "#fff",
          flexShrink: 0,
        }} />
        {/* Sub-header bar */}
        <div style={{
          height: 48,
          borderBottom: "1px solid rgba(0,0,0,0.1)",
          background: "#fff",
          flexShrink: 0,
        }} />
        {/* Main content area with spinner */}
        <main style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F6F8FC",
          position: "relative",
        }}>
          <svg
            width="16.2"
            height="16.2"
            viewBox="0 0 54 54"
            style={{
              shapeRendering: "geometricPrecision",
              animation: "spinScale 1.8s cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite",
            }}
          >
            <g>
              <path d="M10.9,48.6c-1.6-1.3-2-3.6-0.7-5.3c1.3-1.6,3.6-2.1,5.3-0.8c0.8,0.5,1.5,1.1,2.4,1.5c7.5,4.1,16.8,2.7,22.8-3.4c1.5-1.5,3.8-1.5,5.3,0c1.4,1.5,1.4,3.9,0,5.3c-8.4,8.5-21.4,10.6-31.8,4.8C13,50.1,11.9,49.3,10.9,48.6z" fill="#616670" />
              <path d="M53.6,31.4c-0.3,2.1-2.3,3.5-4.4,3.2c-2.1-0.3-3.4-2.3-3.1-4.4c0.2-1.1,0.2-2.2,0.2-3.3c0-8.7-5.7-16.2-13.7-18.5c-2-0.5-3.2-2.7-2.6-4.7s2.6-3.2,4.7-2.6C46,4.4,53.9,14.9,53.9,27C53.9,28.5,53.8,30,53.6,31.4z" fill="#616670" />
              <path d="M16.7,1.9c1.9-0.8,4.1,0.2,4.8,2.2s-0.2,4.2-2.1,5c-7.2,2.9-12,10-12,18.1c0,1.6,0.2,3.2,0.6,4.7c0.5,2-0.7,4.1-2.7,4.6c-2,0.5-4-0.7-4.5-2.8C0.3,31.5,0,29.3,0,27.1C0,15.8,6.7,5.9,16.7,1.9z" fill="#616670" />
            </g>
          </svg>
          <style>{`
            @keyframes spinScale {
              0% { transform: rotate(0deg) scale(1); }
              50% { transform: rotate(360deg) scale(1.15); }
              100% { transform: rotate(720deg) scale(1); }
            }
          `}</style>
        </main>
      </div>
    </div>
  );
}

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
      return <BaseLoadingSkeleton />;
    }

    // Prefer last-visited table for this base, fall back to first table
    const lastTableId = typeof window !== "undefined"
      ? localStorage.getItem(`base-lastTable-${baseId}`)
      : null;
    const tables = tablesQ.data ?? [];
    const resolvedId = (lastTableId && tables.some(t => t.id === lastTableId))
      ? lastTableId
      : tables[0]?.id;

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
