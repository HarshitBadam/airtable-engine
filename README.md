# Airtable Engine

Airtable Engine is a high-performance Airtable-style spreadsheet built to keep tables with millions of rows responsive, achieving sub-millisecond read latency and millisecond row-write latency at million-row scale. The browser holds only a small virtualized window while the server resolves every scroll position through a three-tier read path built on indexed keyset seeks, per-view row rank tables, JSONB rows, and cursor-anchored jumps.

> **Live:** [airtable-engine.vercel.app](https://airtable-engine.vercel.app/) (Google sign-in)
>
> The bulk-add control is the quickest way to create a large table and try a deep scrollbar jump.

Below are median latencies across 15 runs at one million records, for the various paths the grid depends on.


| Operation                                                 | Median latency |
| --------------------------------------------------------- | -------------- |
| Jump into an unsorted table (Tier 1, keyset seek)         | 0.2 ms         |
| Jump into a saved sorted view (Tier 2, precomputed ranks) | 1.2 ms         |
| Jump with an unsaved ad-hoc sort (Tier 3, cursor anchor)  | 48.9 ms        |
| Jump into a filtered view (Tier 3, cursor anchor)         | 76.9 ms        |
| Scroll one page (keyset)                                  | 0.2 ms         |
| Search, first page of matches                             | 15.3 ms        |


For contrast, adding a cursor anchor reduces an ad-hoc sorted jump from 3,569 ms to 48.9 ms, a 73x improvement. At the same depth, Tier 1's indexed keyset seek completes an unsorted jump in 0.2 ms, compared with 103 ms using naive `OFFSET` pagination, a 515x improvement. The read tiers are explained in [scaling engine](docs/scaling-engine.md), with p95 and the 1K and 100K comparisons in [full benchmark results](benchmark-results/latency-results.md).

<details open>
<summary><strong>Product walkthrough</strong></summary>

### Bases dashboard

![Bases dashboard with starred and recently opened items](docs/screenshots/dashboard.png)

Bases can be starred, and recently opened work stays immediately accessible from the dashboard.

### Grid at scale

![Airtable-style grid containing one million records](docs/screenshots/grid-at-scale.png)

The grid fetches and renders only the visible window while preserving direct access to all 1,000,025 records.

### Nested filters

![Nested filter groups with AND and OR conditions](docs/screenshots/nested-filters.png)

Filter groups combine text and number conditions through nested AND/OR logic, with matching rows updated in place.

### Saved views and sorting

![A saved view with its sort configuration open](docs/screenshots/saved-view-sort.png)

Each view retains its own configuration, while saved sorts are committed for rank-backed jumps through the result set.

### Search

![Find-in-view with a highlighted match and result navigation](docs/screenshots/search.png)

Find-in-view highlights the active result, reports the full match count, and navigates to matches outside the loaded window.

### Cell editing

![A cell being edited inside the million-record grid](docs/screenshots/cell-editing.png)

Keyboard-driven edits appear in the local grid immediately while the mutation completes in the background.

</details>

## Run it locally

You need Node 20+, pnpm, Docker, and a Google OAuth client.

```bash
# Install dependencies
pnpm install

# Configure the app
cp .env.example .env

# Start PostgreSQL and apply the schema
./start-database.sh
pnpm prisma migrate dev

# Start the app
pnpm dev
```

`start-database.sh` starts PostgreSQL in Docker. The image tag is currently unpinned; if you already have Postgres, use that connection in `.env` instead. Google OAuth setup and the required variables are covered in [deployment.md](docs/deployment.md).

## Notable features


| Feature               | Engineering detail                                                                                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Deep scrolling**    | A custom scrollbar maps pixel offset to a row index and fetches only that window on a composite index, with visited windows cached.                                                                                                                                                                                                        |
| **Two sort modes**    | A saved sort precomputes a per-view rank table for indexed jumps, and an unsaved ad-hoc sort anchors its jumps to a cursor over a JSONB expression index.                                                                                                                                                                                  |
| **Field duplication** | The new column points at its source field, so it is readable, sortable, and filterable while a batched backfill copies the JSONB keys behind it.                                                                                                                                                                                           |
| **Row order**         | Rows carry fractional positions, so an insert or a drag is one midpoint write instead of a renumber.                                                                                                                                                                                                                                       |
| **Field types**       | Text and number fields share one JSONB cell store, and sorting either builds a typed expression index, collated for text and cast to double precision for numbers, so numbers sort by value rather than as text. Number fields add per-field decimal places, separators, and abbreviation, so 3456 shows as 3.5K and parses back on input. |
| **Filters**           | Nested AND/OR groups compiled into a single parameterized query, anchored the same way as sorted views.                                                                                                                                                                                                                                    |
| **Search**            | Substring matching across all cells, with a live match count and previous or next navigation that resolves off-window matches server-side.                                                                                                                                                                                                 |
| **Bases and views**   | Bases group tables and surface starred and recently opened ones first, and each table carries multiple views whose filters, sort, column order, hidden fields, and row height all persist independently.                                                                                                                                   |
| **Cell editing**      | Keyboard-driven mutations optimistically patch both paginated query state and the jump cache. Failed writes restore paginated state, while cached jump windows refresh on the next navigation.                                                                                                                                             |
| **Interface**         | Every screen is a 1:1 recreation of Airtable's, matched by overlaying the original and hand-written with no component library underneath.                                                                                                                                                                                                  |


## Documentation

Start with Architecture for the big picture, then Scaling engine for the read and write paths.


| Document                                           | What it covers                              |
| -------------------------------------------------- | ------------------------------------------- |
| [Architecture](docs/architecture.md)               | System layers, tiers, stack, and repository |
| [Scaling engine](docs/scaling-engine.md)           | Read and write paths with benchmark results |
| [Data model](docs/data-model.md)                   | Prisma schema, JSONB cells, ordering, ranks |
| [API reference](docs/api.md)                       | tRPC routers and procedures                 |
| [Deployment and configuration](docs/deployment.md) | Environment variables, limits, and hosting  |


## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).

---

> **Origin.** This project was originally built as a solo technical assessment for [Lyra](https://www.lyratechnologies.ai/), based on a brief to build an Airtable clone.

