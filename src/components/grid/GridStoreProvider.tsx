"use client";

import { useRef } from "react";
import { GridStoreCtx, createGridStore } from "~/components/grid/GridStore";

export function GridStoreProvider({ tableId, children }: { tableId: string; children: React.ReactNode }) {
  const ref = useRef<ReturnType<typeof createGridStore> | null>(null);
  ref.current ??= createGridStore(tableId);
  return <GridStoreCtx.Provider value={ref.current}>{children}</GridStoreCtx.Provider>;
}
