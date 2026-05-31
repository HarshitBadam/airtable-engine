"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGridStore } from "~/components/grid/GridStore";
import { api } from "~/trpc/react";
import { useLatestRef } from "~/hooks/useLatestRef";
import type { Filter, FilterTree, Sort } from "~/shared/grid";

interface ColumnLite {
  id: string;
}

interface RowLite {
  id: string;
  cells: unknown;
}

interface RowQueryInput {
  filters?: Filter[];
  conjunction?: "and" | "or";
  filterTree?: FilterTree;
  sorts?: Sort[];
  viewId?: string;
}

interface LocalMatch {
  rowPos: number;
  colId: string;
  occurrenceIndex: number;
}

interface UseFindInViewArgs {
  tableId: string;
  activeSearchTerm: string;
  visibleColumns: readonly ColumnLite[];
  rows: readonly RowLite[];
  jumpCache: ReadonlyMap<number, RowLite>;
  totalCount: number | null | undefined;
  displayMatchCount: number;
  rowQueryInput: RowQueryInput;
  getRowAtIndex: (index: number) => { id: string } | undefined | null;
  triggerJumpFetch: (offset: number, force?: boolean) => void;
  scrollCellIntoView: (colIdx: number, rowIdx: number) => void;
}

export interface UseFindInViewResult {
  handleNextMatch: () => void;
  handlePrevMatch: () => void;
  currentMatchIdx: number;
}

/**
 * Client-side find-in-view: scans loaded rows + jump cache for substring
 * matches and exposes next/prev navigation. Wraps to the server `findEdgeMatch`
 * RPC when the user pages past the loaded range.
 */
export function useFindInView({
  tableId,
  activeSearchTerm,
  visibleColumns,
  rows,
  jumpCache,
  totalCount,
  displayMatchCount,
  rowQueryInput,
  getRowAtIndex,
  triggerJumpFetch,
  scrollCellIntoView,
}: UseFindInViewArgs): UseFindInViewResult {
  const utils = api.useUtils();
  const setFindCurrentMatch = useGridStore((s) => s.setFindCurrentMatch);

  const localMatches = useMemo<LocalMatch[]>(() => {
    if (!activeSearchTerm) return [];
    const termLower = activeSearchTerm.toLowerCase();
    const matches: LocalMatch[] = [];

    const scanRow = (rowPos: number, cells: Record<string, unknown>) => {
      for (const col of visibleColumns) {
        const val = cells[col.id];
        if (val == null) continue;
        const strVal =
          typeof val === "object" && val !== null
            ? JSON.stringify(val)
            : String(val as string | number | boolean);
        const strLower = strVal.toLowerCase();
        let searchPos = 0;
        let occ = 0;
        while (searchPos <= strLower.length - termLower.length) {
          const idx = strLower.indexOf(termLower, searchPos);
          if (idx === -1) break;
          matches.push({ rowPos, colId: col.id, occurrenceIndex: occ });
          searchPos = idx + termLower.length;
          occ++;
        }
      }
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      scanRow(i, (row.cells ?? {}) as Record<string, unknown>);
    }

    const sortedJumpEntries = [...jumpCache.entries()].sort(([a], [b]) => a - b);
    for (const [pos, row] of sortedJumpEntries) {
      if (pos < rows.length) continue;
      scanRow(pos, (row.cells ?? {}) as Record<string, unknown>);
    }

    return matches;
  }, [activeSearchTerm, rows, jumpCache, visibleColumns]);

  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  useEffect(() => {
    setCurrentMatchIdx(0);
  }, [activeSearchTerm]);

  useEffect(() => {
    if (localMatches.length > 0) {
      setCurrentMatchIdx((prev) => (prev >= localMatches.length ? 0 : prev));
    }
  }, [localMatches.length]);

  // Skip duplicate sync work when the effect re-fires due to referential
  // (but not semantic) dependency changes.
  const prevMatchKeyRef = useRef<string | null>(null);

  // Set when the user wraps past the first/last loaded match and we need
  // to fetch a distant page from the backend.
  const pendingWrapNavRef = useRef<{
    rowId: string;
    absolutePosition: number;
    direction: "first" | "last";
  } | null>(null);

  useEffect(() => {
    if (!activeSearchTerm || localMatches.length === 0) {
      if (prevMatchKeyRef.current !== null) {
        prevMatchKeyRef.current = null;
        setFindCurrentMatch(null);
      }
      return;
    }

    const match = localMatches[currentMatchIdx];
    if (!match) return;

    const matchKey = `${match.rowPos}:${match.colId}:${match.occurrenceIndex}`;
    if (matchKey === prevMatchKeyRef.current) return;
    prevMatchKeyRef.current = matchKey;

    const row = getRowAtIndex(match.rowPos);
    if (row) {
      setFindCurrentMatch({ rowId: row.id, columnId: match.colId, occurrenceIndex: match.occurrenceIndex });
      const colIdx = visibleColumns.findIndex((c) => c.id === match.colId);
      if (colIdx !== -1) scrollCellIntoView(colIdx, match.rowPos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatchIdx, activeSearchTerm, localMatches, visibleColumns, getRowAtIndex, setFindCurrentMatch]);

  // Resolve pending wrap-around navigation once the target row appears
  // in localMatches (the windowFetch loaded the page containing it).
  useEffect(() => {
    const pending = pendingWrapNavRef.current;
    if (!pending) return;

    let targetIdx: number | null = null;
    for (let i = 0; i < localMatches.length; i++) {
      const m = localMatches[i];
      if (!m) continue;
      const row = getRowAtIndex(m.rowPos);
      if (row?.id === pending.rowId) {
        if (pending.direction === "first") {
          targetIdx = i;
          break;
        }
        targetIdx = i;
      }
    }

    if (targetIdx !== null) {
      setCurrentMatchIdx(targetIdx);
      pendingWrapNavRef.current = null;
    }
  }, [localMatches, jumpCache, getRowAtIndex]);

  const doWrapNavigation = useCallback(
    (direction: "first" | "last") => {
      if (pendingWrapNavRef.current) return;
      void (async () => {
        try {
          const result = await utils.row.findEdgeMatch.fetch({
            tableId,
            search: activeSearchTerm,
            edge: direction,
            filters: rowQueryInput.filters,
            conjunction: rowQueryInput.conjunction,
            filterTree: rowQueryInput.filterTree,
            sorts: rowQueryInput.sorts,
            viewId: rowQueryInput.viewId,
            totalCount: totalCount ?? undefined,
          });
          if (!result.rowId || result.absolutePosition == null) return;

          const scanStart = direction === "first" ? 0 : localMatches.length - 1;
          const scanEnd = direction === "first" ? localMatches.length : -1;
          const scanStep = direction === "first" ? 1 : -1;
          for (let i = scanStart; i !== scanEnd; i += scanStep) {
            const m = localMatches[i];
            if (!m) continue;
            const row = getRowAtIndex(m.rowPos);
            if (row?.id === result.rowId) {
              setCurrentMatchIdx(i);
              return;
            }
          }

          pendingWrapNavRef.current = {
            rowId: result.rowId,
            absolutePosition: result.absolutePosition,
            direction,
          };
          triggerJumpFetch(result.absolutePosition, true);
        } catch {
          // Silently fail — user can retry navigation.
        }
      })();
    },
    [utils, tableId, activeSearchTerm, rowQueryInput, totalCount, localMatches, getRowAtIndex, triggerJumpFetch],
  );

  // Lets handlers check boundary conditions without depending on currentMatchIdx
  // (which would re-create the callback on every match step).
  const currentMatchIdxRef = useLatestRef(currentMatchIdx);

  const handleNextMatch = useCallback(() => {
    if (!activeSearchTerm) return;

    if (localMatches.length === 0) {
      if (displayMatchCount > 0) doWrapNavigation("first");
      return;
    }

    setCurrentMatchIdx((prev) => {
      if (prev < localMatches.length - 1) return prev + 1;
      if (displayMatchCount <= localMatches.length) return 0;
      return prev;
    });

    if (currentMatchIdxRef.current >= localMatches.length - 1 && displayMatchCount > localMatches.length) {
      doWrapNavigation("first");
    }
  }, [activeSearchTerm, localMatches, displayMatchCount, doWrapNavigation]);

  const handlePrevMatch = useCallback(() => {
    if (!activeSearchTerm) return;

    if (localMatches.length === 0) {
      if (displayMatchCount > 0) doWrapNavigation("last");
      return;
    }

    setCurrentMatchIdx((prev) => {
      if (prev > 0) return prev - 1;
      if (displayMatchCount <= localMatches.length) return localMatches.length - 1;
      return prev;
    });

    if (currentMatchIdxRef.current <= 0 && displayMatchCount > localMatches.length) {
      doWrapNavigation("last");
    }
  }, [activeSearchTerm, localMatches, displayMatchCount, doWrapNavigation]);

  return { handleNextMatch, handlePrevMatch, currentMatchIdx };
}
