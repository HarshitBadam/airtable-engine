import { useMemo } from "react";
import { useLatestRef } from "~/hooks/useLatestRef";
import type { GridColumnDef } from "../../ui/GridRow";

const ROW_NUM_WIDTH = 83;

/**
 * Computes all frozen-column layout values from frozenColCount + visible column
 * widths. Owns the two mutable refs that the cell-overlay and keyboard hooks
 * read at paint time so those hooks never need to be re-created on layout
 * changes.
 */
export function useFreezeLayout({
  frozenColCount,
  visibleColumns,
  columnWidths,
  defaultColWidth,
}: {
  frozenColCount: number;
  visibleColumns: GridColumnDef[];
  columnWidths: Record<string, number>;
  defaultColWidth: number;
}) {
  const snapPositions = useMemo(() => {
    const positions = [ROW_NUM_WIDTH];
    const maxFrozen = Math.min(4, Math.max(0, visibleColumns.length - 1));
    let x = ROW_NUM_WIDTH;
    for (let i = 0; i < maxFrozen; i++) {
      x += columnWidths[visibleColumns[i]!.id] ?? defaultColWidth;
      positions.push(x);
    }
    return positions;
  }, [visibleColumns, columnWidths, defaultColWidth]);

  const frozenColumnCount = Math.min(frozenColCount, visibleColumns.length);
  const frozenColumnCountRef = useLatestRef(frozenColumnCount);

  const freezeWidth = useMemo(() => {
    let w = ROW_NUM_WIDTH;
    for (let i = 0; i < frozenColumnCount && i < visibleColumns.length; i++) {
      w += columnWidths[visibleColumns[i]!.id] ?? defaultColWidth;
    }
    return w;
  }, [frozenColumnCount, visibleColumns, columnWidths, defaultColWidth]);
  const freezeWidthRef = useLatestRef(freezeWidth);

  const frozenColumns = useMemo(
    () => visibleColumns.slice(0, frozenColumnCount),
    [visibleColumns, frozenColumnCount],
  );

  const scrollableColumns = useMemo(
    () => visibleColumns.slice(frozenColumnCount),
    [visibleColumns, frozenColumnCount],
  );

  const scrollableColumnsWidth = useMemo(() => {
    let w = 0;
    for (let i = frozenColumnCount; i < visibleColumns.length; i++) {
      w += columnWidths[visibleColumns[i]!.id] ?? defaultColWidth;
    }
    return w;
  }, [frozenColumnCount, visibleColumns, columnWidths, defaultColWidth]);

  return {
    snapPositions,
    frozenColumnCount,
    frozenColumnCountRef,
    freezeWidth,
    freezeWidthRef,
    frozenColumns,
    scrollableColumns,
    scrollableColumnsWidth,
  };
}
