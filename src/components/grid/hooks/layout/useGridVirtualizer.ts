"use client";

import { useRef, useEffect, useCallback } from "react";
import { useLatestRef } from "~/hooks/useLatestRef";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";

const MAX_SCROLL_HEIGHT = 15_000_000;

interface UseGridVirtualizerArgs {
  totalCount: number;
  dataRowHeight: number;
  gridScrollerRef: React.RefObject<HTMLDivElement | null>;
}

interface UseGridVirtualizerResult {
  virtualItems: VirtualItem[];
  virtualCount: number;
  isScaled: boolean;
  mapToActualIndex: (virtualIndex: number) => number;
  mapToVirtualIndex: (actualIndex: number) => number;
  mapToVirtualIndexRef: React.MutableRefObject<(n: number) => number>;
  totalVirtualSize: number;
}

export function useGridVirtualizer({
  totalCount,
  dataRowHeight,
  gridScrollerRef,
}: UseGridVirtualizerArgs): UseGridVirtualizerResult {
  const maxVirtualRows = Math.floor(MAX_SCROLL_HEIGHT / dataRowHeight);
  const virtualCount = Math.min(totalCount, maxVirtualRows);
  const isScaled = totalCount > maxVirtualRows;

  const mapToActualIndex = useCallback((virtualIndex: number): number => {
    if (!isScaled || virtualCount <= 1) return virtualIndex;
    return Math.round(virtualIndex * (totalCount - 1) / (virtualCount - 1));
  }, [isScaled, totalCount, virtualCount]);

  const mapToVirtualIndex = useCallback((actualIndex: number): number => {
    if (!isScaled || totalCount <= 1) return actualIndex;
    return Math.round(actualIndex * (virtualCount - 1) / (totalCount - 1));
  }, [isScaled, totalCount, virtualCount]);

  const mapToVirtualIndexRef = useLatestRef(mapToVirtualIndex);

  const rowVirtualizer = useVirtualizer({
    count: virtualCount,
    getScrollElement: () => gridScrollerRef.current,
    estimateSize: () => dataRowHeight,
    overscan: 15,
  });

  const prevDataRowHeightRef = useRef(dataRowHeight);
  useEffect(() => {
    const prevH = prevDataRowHeightRef.current;
    if (prevH !== dataRowHeight && prevH > 0) {
      const scroller = gridScrollerRef.current;
      if (scroller) {
        const ratio = scroller.scrollTop / prevH;
        scroller.scrollTop = ratio * dataRowHeight;
      }
    }
    prevDataRowHeightRef.current = dataRowHeight;
    rowVirtualizer.measure();
  }, [dataRowHeight, rowVirtualizer, gridScrollerRef]);

  return {
    virtualItems: rowVirtualizer.getVirtualItems(),
    virtualCount,
    isScaled,
    mapToActualIndex,
    mapToVirtualIndex,
    mapToVirtualIndexRef,
    totalVirtualSize: rowVirtualizer.getTotalSize(),
  };
}
