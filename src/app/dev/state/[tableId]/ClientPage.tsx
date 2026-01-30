"use client";

import { GridStoreProvider, useGridStore } from "~/components/grid/grid-store";
import { useGridMeta } from "~/components/grid/useGridMeta";
import { useGridRows } from "~/components/grid/useGridRows";
import { useViewActions } from "~/components/grid/useViewActions";

function Inner({ tableId }: { tableId: string }) {
  const { viewsQ, colsQ } = useGridMeta(tableId);
  const { q, rows, totalCount, input } = useGridRows(tableId);
  const view = useViewActions(tableId);

  const search = useGridStore((s) => s.search);
  const setSearch = useGridStore((s) => s.setSearch);

  if (viewsQ.isLoading || colsQ.isLoading) return <div>Loading meta…</div>;
  if (viewsQ.isError || colsQ.isError) return <div>Failed loading meta.</div>;

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <h1>Grid State Harness</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          style={{ padding: 8, width: 320 }}
        />
        <button disabled={!view.isDirty || view.saving} onClick={view.save}>
          Save view
        </button>
        <span>Dirty: {String(view.isDirty)}</span>
      </div>

      <div>
        <div>Rows loaded: {rows.length}</div>
        <div>Total count: {totalCount}</div>
        <div>Fetching: {String(q.isFetching)}</div>
      </div>

      <pre
        style={{
          background: "#111",
          color: "#0f0",
          padding: 12,
          overflow: "auto",
        }}
      >
        {JSON.stringify(
          {
            input,
            firstRow: rows[0] ?? null,
            columns: colsQ.data ?? [],
            views: viewsQ.data ?? [],
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}

export default function ClientPage({ tableId }: { tableId: string }) {
  return (
    <GridStoreProvider tableId={tableId}>
      <Inner tableId={tableId} />
    </GridStoreProvider>
  );
}
