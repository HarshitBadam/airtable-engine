# Lyra Airtable — High-Performance Data Grid

A full-stack Airtable clone that handles **100K–1M+ rows** with sub-second interactions. Built with the T3 stack (Next.js 15, tRPC 11, Prisma 6, PostgreSQL), featuring a custom virtualized grid engine with data virtualization, optimistic mutations, and a three-tier query system.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
  - [The Core Problem](#the-core-problem)
  - [Data Layer (PostgreSQL + Prisma)](#data-layer-postgresql--prisma)
  - [Server Layer (tRPC)](#server-layer-trpc)
  - [Client Layer (React)](#client-layer-react)
  - [The Binding Insight](#the-binding-insight)
- [Tech Stack](#tech-stack)
- [Data Model](#data-model)
- [Backend — Query Engine](#backend--query-engine)
  - [Three-Tier Pagination (Infinite Scroll)](#three-tier-pagination-infinite-scroll)
  - [Three-Tier Window Fetch (Jump-to-Position)](#three-tier-window-fetch-jump-to-position)
  - [Float Midpoint Insertion](#float-midpoint-insertion)
  - [Atomic Row Index Counter](#atomic-row-index-counter)
  - [Bulk Inserts (100K rows)](#bulk-inserts-100k-rows)
  - [Precomputed View Ranks](#precomputed-view-ranks)
  - [Permanent Sort Materialization](#permanent-sort-materialization)
  - [Idempotent Mutations](#idempotent-mutations)
- [Frontend — Grid Engine](#frontend--grid-engine)
  - [Two-Layer Data Virtualization](#two-layer-data-virtualization)
  - [Jump Cache (Window Fetch)](#jump-cache-window-fetch)
  - [Scroll Direction Biasing](#scroll-direction-biasing)
  - [Virtualizer Scaling (1M+ Rows)](#virtualizer-scaling-1m-rows)
  - [Optimistic Mutations](#optimistic-mutations)
  - [Smart Cache Preservation](#smart-cache-preservation)
  - [Drag-and-Drop Reorder](#drag-and-drop-reorder)
- [Indexing & Query Optimizations](#indexing--query-optimizations)
- [Performance Summary](#performance-summary)
- [Development](#development)

---

## Architecture Overview

The system is split into three layers — a **PostgreSQL data layer**, a **tRPC server layer**, and a **React client layer** — each designed around a single constraint: the grid must feel instant at any scale, whether the user is on row 1 or row 999,000.

### The Core Problem

A traditional paginated table breaks down at scale in two directions. **Vertically**, `SELECT ... OFFSET 99000` forces PostgreSQL to scan and discard 99,000 rows just to serve a single page — that's O(N) per request, and it gets linearly worse the further the user scrolls. **Horizontally**, holding 100K+ row objects in browser memory collapses the React render loop — every state update diffs the entire array, and the DOM can't physically render that many nodes. The entire architecture exists to solve these two problems simultaneously.

### Data Layer (PostgreSQL + Prisma)

Each row is stored with four fields designed for scale:

- **`rowIndex: Float`** — Ordering field. Enables midpoint insertion (4.0 and 5.0 → 4.5). No existing row is ever shifted. Enforced by `@@unique([tableId, rowIndex])`.
- **`cells: JSONB`** — Schemaless cell storage (`{ [columnId]: value }`). Dynamic column addition without migrations.
- **`searchText: String`** — Denormalized concatenation of all cell values (delimited by `\u001F`). Single index scan for full-table `ILIKE` search.
- **`id: UUID`** — Database-generated via `gen_random_uuid()`.

The key schema insight is the float `rowIndex`. Integer-based ordering forces O(N) shifts on every insert — push every row after the insertion point up by one. Float ordering enables **midpoint insertion**: place a new row between 4.0 and 5.0 at 4.5, between 4.0 and 4.5 at 4.25, and so on. No existing row is ever touched. Combined with a unique constraint on `(tableId, rowIndex)`, this gives O(log N) inserts with guaranteed ordering consistency.

The `Table` model maintains two atomic counters. **`nextRowIndex`** is claimed via `UPDATE ... RETURNING` with row-level locking — two concurrent inserts can never claim the same slot, no retries needed. **`rowCount`** is incremented/decremented atomically alongside every row operation, avoiding `SELECT COUNT(*)` which is O(N) in PostgreSQL due to MVCC visibility checks.

For sorted views, a **`ViewRowRank`** junction table materializes positional ranks once (O(N) upfront cost). Every subsequent read then uses `rank BETWEEN` — an O(log N) B-tree seek instead of a live sort. This is the mechanism that makes jump-to-position in sorted views fast: position 99,000 is just `WHERE rank BETWEEN 99000 AND 100000`.

### Server Layer (tRPC)

The server exposes a single `row.ts` router. All queries are raw SQL for full control over execution plans. Its central design choice is a **three-tier query engine** — every read operation dynamically selects the fastest available SQL strategy:

| Tier | When | Strategy |
|------|------|----------|
| **1** | No sorts, no filters | `WHERE rowIndex > cursor` — simple B-tree seek |
| **2** | Saved view with fresh ranks | `JOIN ViewRowRank` — rank-based seek |
| **3** | Temporary sorts or filters | Lexicographic keyset cursor on sort columns |

The engine auto-selects the tier. If there are no sorts or filters, it takes the fast path with a simple `rowIndex` B-tree seek. If the user has a saved view with precomputed ranks, it joins against `ViewRowRank` for O(log N) positional access. If the user is applying temporary sorts or filters, it falls back to a live keyset cursor with a lexicographic multi-column predicate — still O(log N), still no `OFFSET`. The client never needs to know which tier is active.

All write operations use **float midpoint insertion** to guarantee zero row-shifting. Every mutation — insert, duplicate, reorder — computes `(prev + next) / 2` for the new position via a single `INSERT` or `UPDATE`. Bulk inserts reserve an atomic range on `nextRowIndex` and then fill it with `generate_series` in 25K-row batches. Deletes use `deleteMany` instead of `delete` for idempotency — a concurrent or duplicate delete returns `count: 0` instead of throwing. The result: every single-row mutation is O(log N) or better, and the only O(N) operations are bulk inserts and sort materialization — both explicit, user-initiated actions.

### Client Layer (React)

The frontend is built from three components. **`GridWorkspace`** is the orchestrator — it owns every mutation handler (+ button, delete, insert above/below, reorder, bulk add), manages focus and editing state, detects when the user scrolls into unloaded territory, and coordinates optimistic cache updates so the UI responds instantly before the server confirms. **`GridContainer`** runs the DOM virtualizer (`@tanstack/react-virtual`) and handles drag-and-drop — only ~20-30 actual DOM rows exist at any time, even with 1M rows in the table. **Zustand Store** (`grid-store.tsx`) holds all transient UI state: active cell, editing state, filter/sort configuration, view settings, column visibility, and dirty-tracking via fingerprinting for unsaved view changes.

These three components all feed into **`useGridRows`** — the data layer hook where the core frontend innovation lives. It maintains a **two-source data model**:

1. **Infinite Query** (`useInfiniteQuery`) — Sequential pages of 1,000 rows, loaded as the user scrolls down. Covers rows 0 → N.
2. **Jump Cache** (`Map<number, RowItem>`) — Random-access cache populated by `windowFetch` when the user drags the scrollbar to row 99K.

Every `getRowAtIndex(position)` call checks the infinite query first, then the jump cache. If neither has the data, a skeleton placeholder renders while a throttled, direction-biased fetch fires in the background. The cache evicts at 15K entries and clears automatically when query parameters (filters, sorts, search) change.

For datasets exceeding ~500K rows, the browser's maximum scroll container height (~16M pixels) becomes a hard limit. At 32px/row, that's ~500K rows max. The virtualizer handles this with **proportional index scaling** — it renders a capped number of virtual rows within the browser limit and maps virtual scroll positions to actual dataset positions via `Math.round(virtualIndex * (totalCount - 1) / (virtualCount - 1))`. The user scrolls through 1M+ rows smoothly without ever hitting the browser ceiling.

### The Binding Insight

The key insight binding everything together: the client never needs to hold more than ~15K rows in memory, the server never scans more than O(log N) rows per request (in the common case), and the database never shifts existing rows on insert. Every layer is designed to do **constant or logarithmic work** regardless of table size — and the few linear operations (bulk insert, rank materialization) are explicit, batched, and user-initiated.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| API | tRPC 11 (end-to-end typesafe) |
| Database | PostgreSQL + Prisma 6 |
| Auth | NextAuth 5 (Google OAuth) |
| State | Zustand (grid UI state) + TanStack Query (server cache) |
| Virtualization | @tanstack/react-virtual |
| Styling | Tailwind CSS 4 + CSS Modules |
| Validation | Zod |
| Testing | Playwright (E2E) |

---

## Data Model

```
Base (workspace)
 └── Table
      ├── Column (id, name, type: TEXT | NUMBER, order)
      ├── View (config: filters/sorts/hidden columns)
      │    └── ViewRowRank (precomputed sort positions)
      └── Row (UUID id, Float rowIndex, JSONB cells, searchText)
```

**Key design decisions:**

- **`rowIndex: Float`** — Enables O(1) midpoint insertion between any two rows (e.g., insert between 4.0 and 5.0 → 4.5). No shifting of existing rows ever needed.
- **`cells: JSONB`** — Schemaless cell storage. Each row stores `{ [columnId]: value }`. Supports dynamic column addition without migrations.
- **`searchText: String`** — Denormalized concatenation of all cell values (separated by `\u001F`). Enables fast `ILIKE` search across all columns with a single index scan.
- **`nextRowIndex: Int`** — Atomic counter on the Table model. Claimed via `UPDATE ... RETURNING` with row-level locking — guarantees unique indices under concurrent inserts.
- **`rowCount: Int`** — Maintained atomically. Avoids `SELECT COUNT(*)` which is O(N) in PostgreSQL.
- **`ViewRowRank`** — Precomputed positional ranks for sorted views. Enables O(log N) jump-to-position in sorted views via `rank BETWEEN`.

---

## Backend — Query Engine

All row operations live in `src/server/api/routers/row.ts`. Every query is raw SQL for control over execution plans. Every mutation avoids O(N) shifts.

### Three-Tier Pagination (Infinite Scroll)

The `infinite` query uses cursor-based pagination with three strategy tiers:

| Tier | Condition | Strategy | Complexity |
|------|-----------|----------|------------|
| **1** | No sorts, no filters, no search | `WHERE rowIndex > cursor ORDER BY rowIndex ASC` | O(log N) seek |
| **2** | Saved view with fresh ViewRowRank | `JOIN ViewRowRank` → `WHERE rank > cursor ORDER BY rank ASC` | O(log N) seek |
| **3** | Temporary sorts, filters, or search | Lexicographic keyset cursor on sort columns | O(log N) seek |

**Tier 1** is the fast path for unsorted views — a simple B-tree index seek on `(tableId, rowIndex)`.

**Tier 2** uses precomputed `ViewRowRank` entries. When a view's sort changes, ranks are materialized in the background. Pagination then uses `rank > cursor` — still O(log N). New rows that don't have a rank yet form an "unranked tail" that's appended after ranked rows, using an anti-join (`LEFT JOIN ViewRowRank ... WHERE vrr.rank IS NULL`).

**Tier 3** handles temporary/live sorts with a **multi-column keyset cursor**. The cursor stores `{ rowIndex, sortValues }`. The WHERE clause uses a lexicographic predicate:

```sql
-- For sorts: [colA ASC, colB DESC], cursor = (valA, valB, rowIndex)
WHERE (colA > valA)
   OR (colA = valA AND colB < valB)
   OR (colA = valA AND colB = valB AND rowIndex > cursorRowIndex)
```

This avoids `OFFSET` entirely — every page fetch is O(log N).

**Additional optimizations:**
- Auth check and data query run in parallel (`Promise.all`)
- `totalCount` uses the materialized `table.rowCount` (no `COUNT(*)`) when no filters are active
- `COUNT(*)` only computed on the first page when filters/search are active

### Three-Tier Window Fetch (Jump-to-Position)

The `windowFetch` query supports **random-access** into any position in the dataset. Used when the user drags the scrollbar to row 99,000.

| Tier | Condition | Strategy |
|------|-----------|----------|
| **1** | No sorts/filters | `ORDER BY rowIndex ASC OFFSET $2 LIMIT $3` |
| **2** | Fresh ViewRowRank | `WHERE rank BETWEEN start AND end` → O(log N) |
| **3** | Temporary sorts or stale ranks | `ORDER BY ... OFFSET $2 LIMIT $3` → O(offset) |

**Tier 2** is the key optimization: with precomputed ranks, jumping to position 99,000 is `WHERE rank BETWEEN 99000 AND 100000` — a B-tree range scan, O(log N). Without ranks, Tier 3 falls back to `OFFSET` which is O(offset).

### Float Midpoint Insertion

All row insertions use **float midpoint placement** — zero shifting of existing rows:

```
Insert above row 5.0 (prev = 4.0):
  newIndex = (4.0 + 5.0) / 2 = 4.5

Insert below row 5.0 (next = 6.0):
  newIndex = (5.0 + 6.0) / 2 = 5.5

Insert at end:
  newIndex = atomically claimed from nextRowIndex counter
```

**Complexity:** O(log N) for the `MAX`/`MIN` neighbour lookup + O(log N) for the B-tree INSERT. No existing rows are ever touched.

This strategy is used by `insertAt`, `duplicateAt`, and `reorder` mutations.

### Atomic Row Index Counter

For "insert at end" operations (the + button), the server uses an **atomic counter** on the `Table` model:

```sql
UPDATE "Table"
SET "nextRowIndex" = "nextRowIndex" + 1
WHERE "id" = $1
RETURNING "nextRowIndex" - 1 AS idx
```

This `UPDATE` takes a row-level lock, so two concurrent inserts can never claim the same slot. The claimed index is guaranteed unique — no race conditions, no retries.

### Bulk Inserts (100K rows)

The `addMany` mutation inserts up to 200K rows efficiently:

1. **Reserve range (atomic):** `UPDATE Table SET nextRowIndex += count, rowCount += count` — single row-level lock, O(1)
2. **Insert in 25K batches:** Each batch uses `generate_series` to produce rows in a single `INSERT ... SELECT` statement
3. **Cell generation:** `jsonb_build_object` constructs JSONB cells inline (e.g., `'Person ' || gs` for text columns)

**Why 25K batches?** Splitting reduces WAL (Write-Ahead Log) pressure and B-tree index maintenance contention per statement, improving throughput on tables with 500K+ existing rows.

**Result:** 100K rows insert in ~2-3 seconds.

### Precomputed View Ranks

When a view has sorts, `computeViewRanks` materializes the sorted positions:

```sql
INSERT INTO "ViewRowRank" (viewId, rank, rowId)
SELECT $1, ROW_NUMBER() OVER (ORDER BY ...), id
FROM "Row" WHERE "tableId" = $2
```

This is expensive (O(N)) but runs **once** when the sort is saved. Subsequent pagination uses `rank BETWEEN` — O(log N) per page.

**Failure safety:** Each step auto-commits. If materialization fails, `ranksStale` stays `true` and queries fall back to Tier 3 (live ORDER BY).

### Permanent Sort Materialization

`applyPermanentSort` rewrites all `rowIndex` values to match a sort order:

1. Phase 1: `SET rowIndex = -(ROW_NUMBER() OVER (...))` — negative values avoid unique constraint clashes
2. Phase 2: `SET rowIndex = -rowIndex` — flip back to positive
3. Update `nextRowIndex = rowCount + 1`

This converts a sorted view into the "natural" order, enabling Tier 1 pagination afterwards.

### Idempotent Mutations

- **Delete** uses `deleteMany` instead of `delete` — returns `count: 0` instead of throwing `P2025` if the row was already deleted (concurrent request, double-click). `rowCount` only decremented when `count > 0`.
- **Client-side guard** prevents double-delete via `deletingRowIds.has(rowId)` check.

---

## Frontend — Grid Engine

### Two-Layer Data Virtualization

The grid uses two complementary data sources:

1. **Infinite Query** (TanStack Query) — Sequential pages of 1,000 rows each, loaded on scroll via `fetchNextPage`. Covers rows 0 to ~N (where N is however far the user has scrolled).

2. **Jump Cache** (`Map<position, RowItem>`) — Random-access cache for positions beyond the infinite query. Populated by `windowFetch` when the user jumps to a distant position (e.g., row 99K via scrollbar drag).

```
Rows 0────────1000────────5000────────99000────────100000
     │ Infinite Query ────│          │ Jump Cache ─────│
     │ (sequential pages) │          │ (window fetch)  │
```

`getRowAtIndex(position)` checks the infinite query first, then the jump cache. If neither has the data, a skeleton row is rendered.

### Jump Cache (Window Fetch)

When the user scrolls beyond the infinite query range:

1. **Detection:** A `useEffect` watches `virtualItems`. When a visible item's `actualIndex >= rows.length` and `getRowAtIndex` returns null (skeleton), `triggerJumpFetch` fires.

2. **Fetch:** `doJumpFetch(offset)` calls the server's `windowFetch` with `offset` and `limit: 1000`. Results are stored in the jump cache at positions `[fetchOffset, fetchOffset + 999]`.

3. **Throttle:** A 200ms throttle with leading + trailing edge ensures at most 5 fetches/second during fast scrolling.

4. **Pre-fetch:** When the user nears the edge of a cached region (within 40 rows), a pre-fetch triggers for the adjacent window — the user never sees skeletons during smooth scrolling.

5. **Cache eviction:** When the cache exceeds 15,000 entries, it's cleared and re-populated from the current position.

### Scroll Direction Biasing

The fetch window is biased based on scroll direction:

- **Scrolling down:** 150 rows above + 850 rows below the trigger point
- **Scrolling up:** 700 rows above + 300 rows below

This ensures more data is fetched in the direction the user is heading, reducing skeleton appearances during directional scrolling.

### Virtualizer Scaling (1M+ Rows)

Browsers cap scroll containers at ~16M pixels. At 32px/row, that's ~500K rows max. For larger datasets:

- `MAX_SCROLL_HEIGHT = 15,000,000 px` → `maxVirtualRows ≈ 468K`
- When `totalCount > maxVirtualRows`, the virtualizer uses `virtualCount` (capped) instead of `totalCount`
- `mapToActualIndex(virtualIndex)` proportionally maps: `round(vi * (totalCount-1) / (virtualCount-1))`
- `mapToVirtualIndex(actualIndex)` does the inverse

The user can scroll through 1M+ rows smoothly — the scroll position is proportionally mapped to the actual dataset position.

### Optimistic Mutations

Every mutation updates the UI **synchronously before** the server responds:

**+ Button (Insert at End):**
1. Server creates the row (atomic `nextRowIndex` claim)
2. `onSuccess`: read latest `totalCount` from React Query cache (handles rapid clicks)
3. `addToJumpCache(totalCount, newRow)` — row is immediately renderable
4. `setInfiniteData` with `totalCount + 1` — virtualizer has room for the new row
5. Scroll to bottom + focus for editing
6. Background `invalidate()` syncs with server

**Delete:**
1. CSS slide-up animation (200ms)
2. Remove from infinite query cache + decrement `totalCount`
3. `removeFromJumpCache(rowId)` — shifts subsequent positions down by 1
4. Fire server mutation
5. `onSuccess`: lightweight invalidate (no cache clear)

**Insert Above/Below:**
1. Server creates row at float midpoint
2. `refreshRows(1)` — optimistic `totalCount + 1` + forced jump re-fetch
3. Focus new row for editing

### Smart Cache Preservation

`refreshRows()` is called after most mutations. It **does not clear the jump cache** — this is critical:

- Clearing would wipe out rows that were optimistically added (e.g., the + button row), causing them to disappear when an unrelated mutation (insert above/below, delete) triggers a refresh.
- Instead, a **forced jump fetch** (`triggerJumpFetch(offset, force=true)`) overwrites stale entries with fresh server data at the user's current scroll position.
- Sort/filter changes clear the cache via a separate `useEffect` (when `inputKey` changes).
- `refreshRows(rowCountDelta)` accepts an optimistic count adjustment so the virtualizer immediately reflects the new row count.

### Drag-and-Drop Reorder

Row reordering uses **server-side float midpoint placement**:

1. User drags a row to a new position
2. `handleReorderRow` resolves source and target rows via `getRowById` / `getRowAtIndex` (works across both infinite query and jump cache)
3. Server's `reorder` mutation finds neighbors at the target position and places the row at `(prev + next) / 2`
4. Single `UPDATE` — no shifting, O(log N)

**Key fix:** The drop index is clamped to `totalCount - 1` (not `rows.length - 1`), enabling correct drag-and-drop at any scroll position, even 99K rows away from the infinite query range.

---

## Indexing & Query Optimizations

Custom indexes are managed in `src/server/db/ensureColumnIndexes.ts`. Strategy: **one index per column** that serves sorts, filters, and keyset cursors — built proactively, expression-matched in every query, and cleaned up on deletion.

**1. Single Direction-Agnostic B-tree Index** — Replaced 5–6 indexes per column (ASC, DESC, filter, trigram) with one composite index: `(NULLIF(cells->>'col','') ASC NULLS FIRST, rowIndex ASC) INCLUDE(id) WHERE tableId = '...'`. Postgres scans it forward for ASC, backward for DESC. Partial (per-table) keeps it small; covering (`INCLUDE id`) enables Index-Only Scans for deferred joins.

**2. NULLIF Expression Matching** — Every filter, sort, and cursor predicate uses `NULLIF(cells->>'col','')` to exactly match the index expression. Without this, Postgres falls back to Seq Scan. Filter logic simplified: `is_empty` → `NULLIF(...) IS NULL`, `is_not_empty` → `NULLIF(...) IS NOT NULL`.

**3. NULL Ordering Convention** — Follows Airtable's NULL = -infinity: `ASC NULLS FIRST` / `DESC NULLS LAST`. The single `ASC NULLS FIRST` index scanned backwards gives `DESC NULLS LAST` — both directions served without re-sort.

**4. Tiebreaker Direction Matching** — The `rowIndex` tiebreaker now matches the first sort's direction (e.g., `DESC NULLS LAST, rowIndex DESC`), enabling a full backward index scan instead of requiring materialization.

**5. Index Cond Hint for Keyset Cursors** — OR-of-AND cursor predicates can't be pushed as B-tree Index Conds. A simple range bound on the first sort key (`expr >= cursorVal` for ASC) is prepended so Postgres seeks directly to the cursor position. Deep-offset jumps: ~53s → ~2-3s.

**6. Proactive Index Building** — Indexes are built at base/table/column creation time (outside the transaction, via `Promise.all`), not lazily on first sort. Race-safe via `CREATE INDEX IF NOT EXISTS` + error code `23505` detection. First sort is always instant.

**7. UNION ALL Index Matching** — OR-of-equals filter branches (e.g., `status = 'Done' OR status = 'Todo'`) use `NULLIF` expressions matching the index, with `SET LOCAL enable_bitmapscan = off` forcing Index Scan per branch. Merge Append stops lazily once enough rows are emitted.

**8. Index Cleanup on Deletion** — `dropColumnIndexesForTable()` drops all `ri_<tableId>_*` indexes before cascade-deleting rows, preventing per-row index maintenance (1M rows × N indexes).

**9. Duplicate Column Sort Redirect** — `validateAndResolveSorts()` transparently redirects sorts on unbackfilled duplicate columns to the source column, following chains if needed. Ensures sort indexes exist for resolved columns.

**10. Pool & Batch Tuning** — Connection pool bumped to 25 (concurrent index builds + queries). Bulk insert batches: 50K rows. Backfill batches: 50K with deadlock retry. Column delete: single `UPDATE ... WHERE cells ? 'col'` (no batching).

---

## Performance Summary

| Operation | Complexity | Strategy |
|-----------|-----------|----------|
| Scroll (sequential) | O(log N + limit) | Keyset cursor pagination |
| Jump to position (unsorted) | O(offset + limit) | OFFSET on rowIndex index |
| Jump to position (sorted view) | O(log N) | ViewRowRank `BETWEEN` |
| Insert at end (+) | O(log N) | Atomic nextRowIndex + B-tree insert |
| Insert above/below | O(log N) | Float midpoint + B-tree insert |
| Delete | O(1) | Idempotent deleteMany |
| Reorder (drag) | O(log N) | Float midpoint placement |
| Bulk insert (100K) | O(N) | generate_series + 50K batches |
| Sort materialization | O(N) | ROW_NUMBER() → ViewRowRank |
| Cell edit | O(1) | JSONB update |
| Search | O(N) | ILIKE on searchText |
| Filter | O(N) | JSONB expression indexes |

**Frontend rendering:** Only ~20-30 DOM rows exist at any time (TanStack Virtual). The infinite query holds ~1K rows per page. The jump cache holds up to 15K entries. Everything else is a skeleton placeholder.

---

## Development

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET

# Run database migrations
pnpm prisma migrate dev

# Generate Prisma client
pnpm prisma generate

# Start development server (Turbopack)
pnpm dev

# Open Prisma Studio
pnpm db:studio

# Run E2E tests
pnpm test:e2e
```

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Sign in/up pages
│   ├── bases/[baseId]/     # Base and table views
│   └── dashboard/          # Main dashboard
├── components/
│   ├── grid/               # Core grid system
│   │   ├── grid-store.tsx  # Zustand store (selection, filters, sorts, views)
│   │   ├── useGridRows.ts  # Data fetching (infinite query + jump cache)
│   │   ├── useCellEditing.ts
│   │   └── ui/
│   │       ├── GridWorkspace.tsx   # Main orchestrator (mutations, scroll, focus)
│   │       ├── GridContainer.tsx   # Virtualizer + drag-and-drop
│   │       ├── GridRow.tsx         # Individual row rendering
│   │       ├── GridBar.tsx         # Toolbar (search, filter, sort, views)
│   │       ├── FilterPanel.tsx     # Filter UI
│   │       ├── SortPanel.tsx       # Sort UI
│   │       └── ...
│   ├── bases/              # Base management UI
│   └── home/               # Landing page
├── server/
│   └── api/
│       ├── routers/
│       │   ├── row.ts      # Row CRUD, pagination, bulk ops (the big one)
│       │   ├── column.ts   # Column CRUD
│       │   ├── table.ts    # Table CRUD
│       │   ├── view.ts     # View CRUD and config
│       │   └── base.ts     # Base CRUD
│       └── trpc.ts         # tRPC context and middleware
├── shared/                 # Shared types and validation
├── hooks/                  # Custom React hooks
└── styles/                 # Global CSS and design tokens
```
