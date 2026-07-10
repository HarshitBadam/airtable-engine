# API reference

App requests travel over tRPC. Five routers group the procedures: `base`, `table`, `column`, `view`, and `row`. Their stored records are covered in [data-model.md](data-model.md). Zod validates inputs, and tRPC shares the resulting types with the client.

## HTTP routes

| Method    | Path                      | Purpose                                                      |
| --------- | ------------------------- | ------------------------------------------------------------ |
| GET, POST | `/api/auth/[...nextauth]` | NextAuth sign-in and OAuth callbacks                         |
| GET, POST | `/api/trpc/[trpc]`        | The tRPC fetch handler. Every procedure below is served here |

## Authentication and limits

Every procedure requires a session and ownership check before rate limiting. Heavy mutations cover bulk data, sort ranks, and field backfills. Limits are listed in [Deployment and configuration](deployment.md).

Procedures are named `{router}.{procedure}`, such as `row.windowFetch`. The routers live in [`src/server/api/routers/`](../src/server/api/routers/) and are assembled in [`root.ts`](../src/server/api/root.ts).

## `base`

Top-level workspaces owned by the signed-in user. Source: [`base.ts`](../src/server/api/routers/base.ts).

| Procedure     | Type     | Purpose                                                          |
| ------------- | -------- | ---------------------------------------------------------------- |
| `listMine`    | query    | The caller's bases, most-recently-opened first                   |
| `listStarred` | query    | Just the starred ones                                            |
| `getById`     | query    | A single base, or `NOT_FOUND`                                    |
| `create`      | mutation | Create a base from a client-supplied id and seed its first table |
| `rename`      | mutation | Rename                                                           |
| `toggleStar`  | mutation | Flip the star                                                    |
| `recordOpen`  | mutation | Stamp `lastOpenedAt` on navigation                               |
| `delete`      | mutation | Idempotent delete. Returns `null` if already gone                |

## `table`

Tables inside a base. Source: [`table.ts`](../src/server/api/routers/table.ts).

| Procedure    | Type     | Purpose                                                                      |
| ------------ | -------- | ---------------------------------------------------------------------------- |
| `listByBase` | query    | Tables in a base, empty list if the base is missing                          |
| `create`     | mutation | Create and seed a table. Returns `CONFLICT` for a duplicate name             |
| `rename`     | mutation | Rename. Returns `CONFLICT` for a duplicate name                              |
| `delete`     | mutation | Delete by table and base id. Returns `BAD_REQUEST` for the base's last table |

## `column`

Field definitions for a table. The current types are `TEXT` and `NUMBER`. Their storage is covered in [data-model.md](data-model.md). Source: [`column.ts`](../src/server/api/routers/column.ts).

| Procedure        | Type     | Purpose                                                                                |
| ---------------- | -------- | -------------------------------------------------------------------------------------- |
| `list`           | query    | Columns for a table, in `order`                                                        |
| `create`         | mutation | Add a column and update every view's column order. `sourceColumnId` starts duplication |
| `update`         | mutation | Rename or change number formatting                                                     |
| `backfill`       | mutation | Copy a source column's cells into a new one in batches during field duplication. Heavy |
| `ensureIndexes`  | mutation | Explicitly build a column's sort index. Row reads can also create it on demand         |
| `delete`         | mutation | Delete the column, clear its key from view configs and row cells                       |
| `removeFromView` | mutation | Remove a column from one view. The UI stores hidden column ids in the view config      |

## `view`

Saved configurations for filters, sort modes, hidden columns, and layout. The current grid treats search as ephemeral even though the shared config schema and row APIs support a search value. Source: [`view.ts`](../src/server/api/routers/view.ts).

| Procedure   | Type     | Purpose                                                         |
| ----------- | -------- | --------------------------------------------------------------- |
| `list`      | query    | Views for a table, each with its `config` and `ranksStale` flag |
| `create`    | mutation | New view with a validated config                                |
| `update`    | mutation | Rename or replace the config                                    |
| `duplicate` | mutation | Copy a view under an auto-incremented name                      |
| `delete`    | mutation | Delete, blocked if it is the last view                          |

## `row`

The read tiers and write behavior are explained in [Scaling engine](scaling-engine.md).

Read procedures:

| Procedure          | File                                                                               | Purpose                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `infinite`         | [`infiniteProcedure.ts`](../src/server/api/routers/row/infiniteProcedure.ts)       | Forward scroll through Tier 1/2/3 with keyset cursors. Does not use `OFFSET`. Limit 1 to 2000, default 1000            |
| `windowFetch`      | [`windowFetchProcedure.ts`](../src/server/api/routers/row/windowFetchProcedure.ts) | Positional jump through Tier 1/2/3. Accepts optional cursor anchors and count skipping. The current grid sends neither |
| `searchMatchCount` | [`searchProcedures.ts`](../src/server/api/routers/row/searchProcedures.ts)         | Count search-term occurrences across matching rows, plus any filters                                                   |
| `findEdgeMatch`    | [`searchProcedures.ts`](../src/server/api/routers/row/searchProcedures.ts)         | First or last match and its absolute position, for next/previous-match navigation                                      |

Writes, all mutations.

| Procedure            | File                                                                   | Purpose                                                                                                  |
| -------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `insertAt`           | [`rowMutations.ts`](../src/server/api/routers/row/rowMutations.ts)     | Insert above, below, or at end via a float midpoint                                                      |
| `duplicateAt`        | [`rowMutations.ts`](../src/server/api/routers/row/rowMutations.ts)     | Duplicate a row directly below it                                                                        |
| `reorder`            | [`rowMutations.ts`](../src/server/api/routers/row/rowMutations.ts)     | Drag-reorder via midpoint                                                                                |
| `delete`             | [`rowMutations.ts`](../src/server/api/routers/row/rowMutations.ts)     | Idempotent single-row delete                                                                             |
| `clearData`          | [`rowMutations.ts`](../src/server/api/routers/row/rowMutations.ts)     | Delete every row in a table. Heavy                                                                       |
| `updateCell`         | [`cellMutations.ts`](../src/server/api/routers/row/cellMutations.ts)   | Edit a cell and rebuild `searchText`                                                                     |
| `addMany`            | [`cellMutations.ts`](../src/server/api/routers/row/cellMutations.ts)   | Bulk insert up to 100,000 rows via `generate_series`. Heavy                                              |
| `computeViewRanks`   | [`sortProcedures.ts`](../src/server/api/routers/row/sortProcedures.ts) | Build `ViewRowRank` for a saved sort. Advisory-locked with a 120s timeout. Heavy                         |
| `applyPermanentSort` | [`sortProcedures.ts`](../src/server/api/routers/row/sortProcedures.ts) | Rewrite every `rowIndex` into sorted order. 120s timeout. The UI calls `computeViewRanks` instead. Heavy |

Shared ownership checks, count SQL, and cursor construction live in [`rowQueryHelpers.ts`](../src/server/api/routers/row/rowQueryHelpers.ts).
