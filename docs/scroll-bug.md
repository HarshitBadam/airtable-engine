# Scroll Bug — Fast Scroll Exposes Grey Space

## Problem

When scrolling the grid up or down quickly (especially with macOS trackpad momentum), two issues appear:

1. **Grey space between rows**: Scrolling fast in either direction shows the grey `#F7F8FC` background of the scroll container where rendered rows should be. It looks like you've scrolled past the content.
2. **Elastic overscroll above row 1**: With enough momentum scrolling upward, you can scroll *above* the first record, showing grey space above it. This doesn't always happen — it requires momentum/inertia.

The user confirmed: **"it's the container moving, not the lines inside it."** The rows themselves aren't in a loading/skeleton state — the scroll container itself visually shifts, exposing its background.

## Architecture (relevant files)

| File | Role |
|------|------|
| `src/components/grid/hooks/layout/useGridVirtualizer.ts` | TanStack Virtual setup (`useVirtualizer`) — overscan, scroll element, row height |
| `src/components/grid/ui/GridContentArea.tsx` | Renders virtual rows with `position: absolute` + `translateY(vi.start)` |
| `src/components/grid/ui/GridContainer.module.css` | `.gridContentScroller` (the scroll container — `overflow-y: auto`) and `.gridContentScrollerInner` (inner content wrapper) |
| `src/components/grid/hooks/layout/useScrollSync.ts` | Wheel event handler — forwards horizontal scroll, has `preventDefault()` + manual `scrollTop` logic |
| `src/components/grid/hooks/layout/useVerticalScrollbar.ts` | Custom scrollbar thumb (passive `scroll` listener, drag handling) |
| `src/components/grid/hooks/views/useViewScrollPersistence.ts` | Saves/restores scroll position per view |
| `src/components/grid/hooks/rows/useInfiniteScroll.ts` | Pagination + jump cache prefetch based on virtual items |
| `src/components/grid/ui/GridWorkspace.module.css` | Parent layout (`.workspace`, `.gridArea`, `.gridContentWrapper` — all `overflow: hidden`) |
| `src/styles/globals.css` | Global styles — has `overscroll-behavior-y: none` on html/body |

### DOM hierarchy (scroll perspective)

```
.workspace (100vh, overflow: hidden)
  .mainArea (flex: 1, overflow: hidden)
    .contentArea (flex: 1)
      .gridArea (flex: 1, overflow: hidden)
        .gridContentWrapper (flex: 1, overflow: hidden)
          .gridContainer (flex: 1, overflow: hidden)
            .gridBody (flex: 1, position: relative, overflow: hidden)
              .gridContentScroller (position: absolute, top: headerHeight, overflow-y: auto) ← ONLY scrollable element
                .gridContentScrollerInner (position: relative, height: ~3.2M px for 100K rows)
                  [virtual rows — position: absolute, translateY(vi.start), contain: layout style paint]
```

### Virtualization details

- **Library**: `@tanstack/react-virtual` v3.13.18
- **Overscan**: 15 rows (default)
- **Row height**: fixed (32px default, configurable to 56/88/128)
- **Scroll container**: `.gridContentScroller` — native `overflow-y: auto`
- **Inner height**: `totalVirtualSize + DATA_ROW_HEIGHT + 103` (e.g. ~3,200,135px for 100K×32px)
- **Max scroll height cap**: 15,000,000px — rows are scaled if total exceeds this
- **Row positioning**: `position: absolute; transform: translateY(${vi.start}px); contain: layout style paint`

### Key CSS on `.gridContentScroller`

```css
.gridContentScroller {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  /* top: set via inline style (effectiveHeaderHeight) */
  overflow-y: auto;
  overflow-x: hidden;
  background: #F7F8FC;
  will-change: scroll-position;
  scrollbar-width: none; /* native scrollbar hidden, custom thumb used */
}
```

### Key wheel handler in `useScrollSync.ts`

```typescript
const handleScrollerWheel = (e: WheelEvent) => {
  if (e.deltaX !== 0) {
    e.preventDefault();
    if (hScroll) hScroll.scrollLeft += e.deltaX;
    scroller.scrollTop += e.deltaY;
  }
};
scroller.addEventListener("wheel", handleScrollerWheel, { passive: false });
```

This intercepts wheel events that have ANY horizontal component (deltaX !== 0). On macOS trackpads, most vertical swipes have tiny deltaX values, so this fires frequently during vertical scrolling. It calls `preventDefault()` (killing native inertia) and manually applies `scrollTop += deltaY`.

## What was tried (and failed)

### 1. Increase overscan (15 → 25, then 150)
**File**: `useGridVirtualizer.ts` line 50
**Theory**: More pre-rendered rows above/below viewport would prevent blank areas.
**Result**: No effect, even at overscan: 150 (4800px buffer each side). Confirmed this is NOT a virtualizer buffer issue.

### 2. Repeating row-stripe background on inner container
**File**: `GridContainer.module.css` `.gridContentScrollerInner`
**Theory**: Paint white+grey row stripes on the inner wrapper so blank areas during fast scroll look like empty rows.
**Result**: The gradient was visible below the last row in the empty area, making it look worse. Reverted.

### 3. `overscroll-behavior-y: none` on `.gridContentScroller`
**File**: `GridContainer.module.css`
**Theory**: Prevent macOS elastic overscroll bounce on the scroll container.
**Result**: No effect on the reported issues. The elastic bounce and grey space during fast scroll persisted.

### 4. `overscroll-behavior: none` (both axes) on scroller + html/body
**Files**: `GridContainer.module.css`, `globals.css`
**Theory**: Cover both x and y axes to prevent all overscroll behavior.
**Result**: No effect. Same issues.

### 5. Remove `preventDefault()` and manual `scrollTop` from wheel handler
**File**: `useScrollSync.ts`
**Theory**: The wheel handler was fighting native scroll by mixing manual `scrollTop += deltaY` with native inertia, causing the container to jank. Changed to only forward deltaX to hScrollbar, with `{ passive: true }`.
**Result**: No effect on the reported issues.

All changes were reverted. The codebase is back to its original state.

## Fix applied

Root cause: Chrome compositor **checkerboarding** of the scroll layer (not a
virtualizer render-window issue — confirmed by overscan 150 having no effect).
During a fast fling the compositor scrolls past tiles it hasn't rasterized yet
and paints the layer's backing-store background (`#F7F8FC` grey) between rows.

Two changes (both reversible):

1. **Removed `will-change: scroll-position`** from `.gridContentScroller`
   (`GridContainer.module.css`). On a ~3.2M px tall inner this property forces
   Chrome to composite the scroller and pre-rasterize tiles ahead of the fling,
   which is impossible at that size and *causes* the grey checkerboard. Default
   scrolling rasterizes in step with the scroll. Also added
   `overscroll-behavior: none` on the scroller to contain the macOS rubber-band.

2. **Rewrote the wheel handler** (`useScrollSync.ts`) to only intercept
   *horizontal-dominant* gestures (`|deltaX| > |deltaY|`) and to never touch
   `scrollTop`. Vertical scrolling is now 100% native, so Chrome owns the fling.
   The old handler `preventDefault()`-ed on any `deltaX !== 0` (true for most
   macOS trackpad vertical swipes) and re-applied `scrollTop += deltaY`, mixing
   manual and native scroll within one gesture.

### Result (tested 2026-06-11)

- **Overscroll above row 1: FIXED** by `overscroll-behavior: none` (confirms the
  new code is loaded).
- **Grey between rows: NOT fixed.** Removing `will-change` was insufficient.

This empirically confirms the cause is the **~3.2M px tall scroll layer itself**,
not the compositor hint. Chrome cannot rasterize tiles fast enough during a fling
on a layer that big, so it paints the layer background (grey) between rows. The
only real fix is to stop making the scroll layer that tall — i.e. the
transform-based windowed rendering below (or aggressively shrinking the scroll
layer via the existing index-scaling mechanism).

## Final fix (2026-06-11, branch `fix/transform-windowed-scroll`)

Replaced native vertical scrolling with **JS-driven transform-based windowing**
(the VS Code/Airtable approach). `.gridContentScroller` is now
`overflow-y: hidden`; a single JS offset (in `useGridVirtualizer`, exposed as a
`GridScrollController` via context) is the source of truth. Rows render at
`translateY(vi.start - offset)`, the inner is viewport-sized, so Chrome never
has a giant layer to rasterize → no checkerboard. Wheel events preventDefault
and feed deltaY to the offset (macOS momentum keeps firing wheel events during
inertia, so the fling still feels native). Everything that previously moved
"for free" inside the native scroller — selection overlay, add-row block, drop
indicator — is now repositioned by subtracting the offset and updates on every
offset change. The custom vertical scrollbar, view scroll persistence, row
refresh, add-row scroll-to-bottom, and drag-reorder autoscroll all go through
the controller instead of `scrollTop`. Index-scaling (MAX_SCROLL_HEIGHT) is
preserved on top of the windowing.

Note: per-row compositor layer promotion (`will-change: transform` on each
virtual row) was tested first as a cheaper fix and did NOT eliminate the flash.

## Hypotheses NOT yet tested (historical, superseded by the fix above)

1. **The `will-change: scroll-position` on the scroller** may be causing the browser to handle the 3.2M px tall content differently (tile rasterization issues). Removing it might help — or it might make things worse.

2. **The inner container height (~3.2M px)** may exceed Chrome's comfortable tile rasterization range. When scrolling fast, the browser can't rasterize tiles fast enough, showing the background. A "windowed" approach (short inner container + transform offset) instead of full virtual height might help, but would be a significant refactor.

3. **The wheel handler's `preventDefault()` interaction with native momentum** — while removing it didn't fix things in isolation, it might need to be combined with other changes. The mixing of manual and native scroll during a single gesture (deltaX fluctuates between 0 and non-0 within one trackpad swipe) is still suspicious.

4. **`-webkit-overflow-scrolling` or compositor layer promotion** on the inner container — but the CSS comments explicitly warn against creating a stacking context on `.gridContentScrollerInner` (would break selection overlay z-index).

5. **Replacing native scroll with transform-based positioning** — what VS Code and Airtable actually do. The scroll container would have a fixed height, content positioned via CSS transforms, and a custom scrollbar drives the virtual position. This is the nuclear option but would eliminate browser tile rasterization issues entirely.
