"use client";

import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { api } from "~/trpc/react";
import { buildJumpFetchRequest } from "./jumpFetchRequest";
import type { RowInfiniteInput, RowItem } from "./useGridRows";

interface UseJumpFetchArgs {
  tableId: string;
  rows: RowItem[];
  rowQueryInput: RowInfiniteInput;
  jumpCacheRef: MutableRefObject<Map<number, RowItem>>;
  jumpCacheGenRef: MutableRefObject<number>;
  protectedRowIdsRef: MutableRefObject<Set<string>>;
  setJumpCache: Dispatch<SetStateAction<Map<number, RowItem>>>;
}

export function useJumpFetch({
  tableId,
  rows,
  rowQueryInput,
  jumpCacheRef,
  jumpCacheGenRef,
  protectedRowIdsRef,
  setJumpCache,
}: UseJumpFetchArgs): (
  offset: number,
  force?: boolean,
  allowAnchor?: boolean,
) => void {
  const utils = api.useUtils();
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFiredRef = useRef(0);
  const pendingJumpRef = useRef<{
    offset: number;
    allowAnchor: boolean;
  } | null>(null);
  const scrollDirectionRef = useRef<"up" | "down">("down");
  const prevTriggerOffsetRef = useRef(0);
  const { filters, conjunction, filterTree, sorts, viewId } = rowQueryInput;

  const fetchWindow = useCallback(
    async (rawOffset: number, allowAnchor: boolean) => {
      const fetchOffset = Math.max(
        0,
        rawOffset - (scrollDirectionRef.current === "up" ? 700 : 150),
      );
      if (!allowAnchor) jumpCacheGenRef.current += 1;
      const generation = jumpCacheGenRef.current;

      try {
        const request = buildJumpFetchRequest({
          tableId,
          offset: fetchOffset,
          limit: 1000,
          allowAnchor,
          rows,
          jumpCache: jumpCacheRef.current,
          protectedRowIds: protectedRowIdsRef.current,
          query: {
            filters,
            conjunction,
            filterTree,
            sorts,
            viewId,
          },
        });
        const result = await utils.row.windowFetch.fetch(request);

        setJumpCache((previous) => {
          if (jumpCacheGenRef.current !== generation) return previous;

          const protectedIds = protectedRowIdsRef.current;
          const next = allowAnchor
            ? new Map(previous)
            : new Map(
                [...previous].filter(([, row]) => protectedIds.has(row.id)),
              );
          if (next.size > 15_000) {
            const protectedRows = [...next].filter(([, row]) =>
              protectedIds.has(row.id),
            );
            next.clear();
            for (const [index, row] of protectedRows) next.set(index, row);
          }

          (result.items as RowItem[]).forEach((item, index) => {
            const cacheIndex = fetchOffset + index;
            const existing = next.get(cacheIndex);
            if (!existing || !protectedIds.has(existing.id)) {
              next.set(cacheIndex, item);
            }
          });
          return next;
        });
      } catch (error) {
        console.error("windowFetch error:", error);
      }
    },
    [
      conjunction,
      filterTree,
      filters,
      jumpCacheGenRef,
      jumpCacheRef,
      protectedRowIdsRef,
      rows,
      setJumpCache,
      sorts,
      tableId,
      utils,
      viewId,
    ],
  );

  return useCallback(
    (offset: number, force = false, allowAnchor = true) => {
      if (offset < rows.length) return;
      if (!force && jumpCacheRef.current.has(offset)) return;

      if (offset < prevTriggerOffsetRef.current) {
        scrollDirectionRef.current = "up";
      } else if (offset > prevTriggerOffsetRef.current) {
        scrollDirectionRef.current = "down";
      }
      prevTriggerOffsetRef.current = offset;
      pendingJumpRef.current = { offset, allowAnchor };

      const now = Date.now();
      const elapsed = now - lastFiredRef.current;
      if (elapsed >= 200) {
        lastFiredRef.current = now;
        if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
        void fetchWindow(offset, allowAnchor);
      }

      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
      jumpTimerRef.current = setTimeout(() => {
        const pending = pendingJumpRef.current;
        if (pending === null) return;
        if (
          pending.offset === offset &&
          pending.allowAnchor === allowAnchor &&
          elapsed >= 200
        ) {
          return;
        }
        lastFiredRef.current = Date.now();
        void fetchWindow(pending.offset, pending.allowAnchor);
      }, 200);
    },
    [fetchWindow, jumpCacheRef, rows.length],
  );
}
