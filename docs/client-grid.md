# The client grid

> **TL;DR** — The grid renders only visible rows, caps virtual scroll height under the browser's pixel ceiling and maps virtual↔actual indices, serves rows from two sources (a contiguous infinite query plus a sparse jump cache) behind one accessor, and keeps edits optimistic in Zustand while TanStack Query owns server data.

The client turns sub-second server windows (see [reading at scale](./reading-at-scale.md)) into a spreadsheet feel: smooth scrolling of a million rows, scrollbar jumps anywhere, instant edit feedback, bounded memory. This doc covers [`src/components/grid/`](../src/components/grid/).

## Virtualization and the scroll-height ceiling

The grid renders only the viewport rows plus a small overscan via `@tanstack/react-virtual` ([`useGridVirtualizer.ts`](../src/components/grid/hooks/layout/useGridVirtualizer.ts)), keeping the DOM small. The complication is the scroll container.

A naive list sets scroll height to `totalCount * rowHeight`. At a million rows that's tens of millions of pixels — past the browser cap (~15–33 M px depending on engine), scrolling becomes imprecise or stops mapping to rows at all.

The grid caps the virtual height at `MAX_SCROLL_HEIGHT` (15,000,000 px) and scales when the table is taller than that:

```ts
const maxVirtualRows = Math.floor(MAX_SCROLL_HEIGHT / dataRowHeight);
const virtualCount   = Math.min(totalCount, maxVirtualRows);
const isScaled       = totalCount > maxVirtualRows;
```

When scaled, the scrollbar addresses `virtualCount` virtual rows and the grid maps between virtual and actual positions linearly:

```ts
actual  = round(virtual * (totalCount  - 1) / (virtualCount - 1));
virtual = round(actual  * (virtualCount - 1) / (totalCount  - 1));
```

Below the cap the two index spaces are identical (no-op mapping). Changing row height reapplies the old scroll ratio to preserve position.

## Two data sources behind one index

The grid asks "what row is at absolute index N?" through a single accessor, `getRowAtIndex`, which reads from two sources ([`useJumpCache.ts`](../src/components/grid/hooks/useJumpCache.ts)):

```ts
function getRowAtIndex(i) {
  if (i < rows.length) return rows[i];      // contiguous infinite-query pages from the top
  return jumpCache.get(i) ?? null;          // sparse far-window cache
}
```

- **The infinite query** (TanStack Query) holds contiguous pages from the top of the table, growing as the user scrolls down normally. This covers the common case.
- **The jump cache** is a `Map<absoluteIndex, Row>` for windows far from the top, where loading every intervening page would be wasteful. When the user drags the scrollbar to row 700,000, the grid fetches just that window via `windowFetch` and stores it by absolute index.

A missing index renders a skeleton row and triggers a fetch. The result fills in when it arrives, so a fast scrollbar drag shows placeholders briefly rather than blocking.

## Keeping the jump cache fast and correct

The jump cache is the trickiest client state: fetches are async, the user keeps scrolling, and rows can be edited mid-flight. Several mechanisms keep it honest:

- **Throttled, direction-aware fetching.** Jump fetches are throttled to 200ms, and the fetched window is biased toward where the user is heading (more rows ahead when scrolling down, more behind when scrolling up), so the prefetch lands where the next frame will need it.
- **A generation counter.** Each fetch captures the cache "generation" at start. Anything that invalidates the cache (a filter, sort, or search change) bumps the generation, and a fetch whose generation no longer matches on arrival is discarded. This prevents a slow in-flight response from overwriting fresh data.
- **A bounded size.** The cache is capped (around 15,000 entries). When it overflows it is cleared, so memory stays flat no matter how much the user jumps around.
- **Protected rows.** A row inserted optimistically is marked protected so an incoming `windowFetch` does not clobber its position before the server has caught up. Protection is released once the row shows up in the authoritative infinite-query pages.

## State: Zustand for UI, TanStack Query for data

The two kinds of state are kept separate.

- **TanStack Query** owns server data: the infinite query pages, cache invalidation, and refetching. It is the source of truth for what is in the database.
- **Zustand** ([`GridStore.tsx`](../src/components/grid/GridStore.tsx)) owns UI state: selection, editing cell, view config, column sizing. Synchronous updates keep the grid responsive while network requests are in flight.

Edits are optimistic: applied immediately in Zustand, reconciled in the background. Failed mutations roll back.

## The API boundary

The client talks to the server through tRPC ([`src/trpc/react.tsx`](../src/trpc/react.tsx)) — every call is end-to-end typed; a changed procedure signature is a compile error, not a runtime surprise. Two pieces of setup matter:

- **`httpBatchStreamLink` with superjson.** Concurrent calls in the same tick coalesce into one HTTP request; responses stream back as they resolve rather than waiting for the slowest. On a grid firing several queries at once (rows, count, view metadata), fast results paint first. superjson preserves `Date` and other types across the wire.
- **Centralized error handling.** A global `MutationCache` handler surfaces failures as toasts so call sites don't each reimplement error UI.

## Perceived performance

The grid is built so the user never waits on the network for feedback: selection and editing update synchronously, inserts and edits are optimistic, far-window jumps show skeletons immediately, and prefetching is biased toward scroll direction. Each of these hides real latency, which is what makes a million-row grid feel local.
