"use client";

import { api } from "~/trpc/react";
import {
  getBaseColor,
  getBaseBorderColor,
  getBaseTextColor,
} from "~/components/bases/useBases";
import { useDocumentBranding } from "~/components/grid/hooks/useDocumentBranding";

/**
 * Fetches base metadata, derives brand colours, and sets the document title /
 * favicon via useDocumentBranding. Extracted from useGridWorkspace so the
 * branding concern is isolated from the main orchestrator.
 */
export function useGridBaseInfo({
  baseId,
  tables,
  activeTableId,
}: {
  baseId: string;
  tables: Array<{ id: string; name: string }>;
  activeTableId: string;
}) {
  const { data: base } = api.base.getById.useQuery(
    { id: baseId },
    { staleTime: 60_000 },
  );

  const baseColor = getBaseColor(baseId);
  const baseBorderColor = getBaseBorderColor(baseId);
  const baseTextColor = getBaseTextColor(baseId);
  const baseName = base?.name ?? "Loading...";

  const activeTableName =
    tables.find((t) => t.id === activeTableId)?.name ?? "Table";

  useDocumentBranding({
    baseName,
    tableName: activeTableName,
    baseColor,
    baseTextColor,
  });

  return { baseColor, baseBorderColor, baseTextColor, baseName };
}
