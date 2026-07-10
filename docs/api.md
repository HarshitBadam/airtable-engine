# API reference

The browser uses tRPC rather than a public REST API. Procedure inputs are validated with Zod and their types are shared with the client.

## HTTP routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET, POST | `/api/auth/[...nextauth]` | NextAuth sign-in and OAuth callbacks |
| GET, POST | `/api/trpc/[trpc]` | The tRPC fetch handler. Every procedure below is served here |

## Authentication and limits

Every procedure is a `protectedProcedure`. The middleware checks the session first, then rate-limits the call by user id. An unauthenticated request returns `UNAUTHORIZED`.

Queries allow 600 calls per minute, normal mutations 240, and heavy mutations 15. The heavy set is `row.addMany`, `row.clearData`, `row.applyPermanentSort`, `row.computeViewRanks`, and `column.backfill`. [Configuration](configuration.md) covers the shared and in-memory limiter backends.

The routers live in [`src/server/api/routers/`](../src/server/api/routers/) and are assembled in [`root.ts`](../src/server/api/root.ts).

## base

Top-level workspaces owned by one user.

| Procedure | Type | Purpose |
| --- | --- | --- |
| `listMine` | query | The caller's bases, most-recently-opened first |
| `listStarred` | query | Just the starred ones |
| `getById` | query | A single base, or `NOT_FOUND` |
| `create` | mutation | Create a base and seed its first table |
| `rename` | mutation | Rename |
| `toggleStar` | mutation | Flip the star |
| `recordOpen` | mutation | Stamp `lastOpenedAt` on navigation |
| `delete` | mutation | Delete, idempotent, returns `null` if already gone |

## table

Tables inside a base.

| Procedure | Type | Purpose |
| --- | --- | --- |
| `listByBase` | query | Tables in a base, empty list if the base is missing |
| `create` | mutation | Create and seed a table |
| `rename` | mutation | Rename |
| `delete` | mutation | Delete, blocked if it is the base's last table |

## column

Fields. The current types are `TEXT` and `NUMBER`.

| Procedure | Type | Purpose |
| --- | --- | --- |
| `list` | query | Columns for a table, in `order` |
| `create` | mutation | Add a column, updates every view's column order, can duplicate from `sourceColumnId` |
| `update` | mutation | Rename or change number formatting |
| `backfill` | mutation | Copy a source column's cells into a new one, in batches (field duplication). Heavy |
| `ensureIndexes` | mutation | Build the on-demand sort index for a column |
| `delete` | mutation | Delete the column, clear its key from view configs and row cells |
| `removeFromView` | mutation | Remove a column from one view. Server-side. The UI hides columns client-side instead |

## view

Saved configurations: filters, sort, search, hidden columns, column order.

| Procedure | Type | Purpose |
| --- | --- | --- |
| `list` | query | Views for a table, each with its `config` and `ranksStale` flag |
| `create` | mutation | New view |
| `update` | mutation | Rename or replace the config |
| `duplicate` | mutation | Copy a view under an auto-incremented name |
| `delete` | mutation | Delete, blocked if it is the last view |

## row

Row reads are covered in [reading at scale](reading-at-scale.md); mutations are covered in [writing at scale](writing-at-scale.md).

Read procedures:

| Procedure | File | Purpose |
| --- | --- | --- |
| `infinite` | [`infiniteProcedure.ts`](../src/server/api/routers/row/infiniteProcedure.ts) | Keyset forward scroll, no `OFFSET`. Limit 1 to 2000, default 1000 |
| `windowFetch` | [`windowFetchProcedure.ts`](../src/server/api/routers/row/windowFetchProcedure.ts) | Positional jump. Picks Tier 1/2/3, honors cursor anchors and `skipCount` |
| `searchMatchCount` | [`searchProcedures.ts`](../src/server/api/routers/row/searchProcedures.ts) | Count rows matching a search term, plus any filters |
| `findEdgeMatch` | [`searchProcedures.ts`](../src/server/api/routers/row/searchProcedures.ts) | First or last match and its absolute position, for next/previous-match navigation |

Writes, all mutations.

| Procedure | File | Purpose |
| --- | --- | --- |
| `insertAt` | [`rowMutations.ts`](../src/server/api/routers/row/rowMutations.ts) | Insert above, below, or at end via a float midpoint |
| `duplicateAt` | [`rowMutations.ts`](../src/server/api/routers/row/rowMutations.ts) | Duplicate a row directly below it |
| `reorder` | [`rowMutations.ts`](../src/server/api/routers/row/rowMutations.ts) | Drag-reorder via midpoint |
| `delete` | [`rowMutations.ts`](../src/server/api/routers/row/rowMutations.ts) | Idempotent single-row delete |
| `clearData` | [`rowMutations.ts`](../src/server/api/routers/row/rowMutations.ts) | Delete every row in a table. Heavy |
| `updateCell` | [`cellMutations.ts`](../src/server/api/routers/row/cellMutations.ts) | Edit a cell and rebuild `searchText` |
| `addMany` | [`cellMutations.ts`](../src/server/api/routers/row/cellMutations.ts) | Bulk insert up to 100,000 rows via `generate_series`. Heavy |
| `computeViewRanks` | [`sortProcedures.ts`](../src/server/api/routers/row/sortProcedures.ts) | Build `ViewRowRank` for a saved sort, advisory-locked, 120s timeout. Heavy |
| `applyPermanentSort` | [`sortProcedures.ts`](../src/server/api/routers/row/sortProcedures.ts) | Rewrite every `rowIndex` into sorted order. Server-side. The UI uses `computeViewRanks` instead. Heavy |

Shared ownership checks, count SQL, and cursor construction live in [`rowQueryHelpers.ts`](../src/server/api/routers/row/rowQueryHelpers.ts).
