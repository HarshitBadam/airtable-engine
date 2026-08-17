# Airtable Engine

Airtable Engine is a high-performance Airtable-style spreadsheet built to keep tables with millions of rows responsive, reaching sub-millisecond reads and millisecond row writes at a million rows. The browser holds only a small virtualized window while the server resolves every scroll position through a three-tier read path built on indexed keyset seeks, per-view row rank tables, JSONB rows, and cursor-anchored jumps.

> **Live:** [airtable-engine.vercel.app](https://airtable-engine.vercel.app/) (Google sign-in)
>
> The bulk-add control is the quickest way to create a large table and try a deep scrollbar jump. See the [product screenshots](docs/screenshots.md#scrollbar-jump).

Below are median latencies across 15 runs at one million records, for the various paths the grid depends on.


| Operation                                                 | Median latency |
| --------------------------------------------------------- | -------------- |
| Jump into an unsorted table (Tier 1, keyset seek)         | 0.2 ms         |
| Jump into a saved sorted view (Tier 2, precomputed ranks) | 1.2 ms         |
| Jump with an unsaved ad-hoc sort (Tier 3, cursor anchor)  | 48.9 ms        |
| Jump into a filtered view (Tier 3, cursor anchor)         | 76.9 ms        |
| Scroll one page (keyset)                                  | 0.2 ms         |
| Search, first page of matches                             | 15.3 ms        |


For contrast, that ad-hoc sort takes 3569 ms without the cursor anchor, and a naive OFFSET to the same position takes 103 ms. The read tiers are explained in [scaling engine](docs/scaling-engine.md), and p95 plus the 1K and 100K comparisons are in [full benchmark results](benchmark-results/latency-results.md).

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

| Feature | Engineering detail |
| --- | --- |
| **Deep scrolling** | A custom scrollbar maps pixel offset to a row index and fetches only that window on a composite index, with visited windows cached. |
| **Two sort modes** | A saved sort precomputes a per-view rank table for indexed jumps, and an unsaved ad-hoc sort anchors its jumps to a cursor over a JSONB expression index. |
| **Field duplication** | The new column points at its source field, so it is readable, sortable, and filterable while a batched backfill copies the JSONB keys behind it. |
| **Row order** | Rows carry fractional positions, so an insert or a drag is one midpoint write instead of a renumber. |
| **Field types** | Text and number fields share one JSONB cell store, and sorting either builds a typed expression index, collated for text and cast to double precision for numbers, so numbers sort by value rather than as text. Number fields add per-field decimal places, separators, and abbreviation, so 3456 shows as 3.5K and parses back on input. |
| **Filters** | Nested AND/OR groups compiled into a single parameterized query, anchored the same way as sorted views. |
| **Search** | Substring matching across all cells, with a live match count and previous or next navigation that resolves off-window matches server-side. |
| **Bases and views** | Bases group tables and surface starred and recently opened ones first, and each table carries multiple views whose filters, sort, column order, hidden fields, and row height all persist independently. |
| **Cell editing** | Keyboard-driven mutations optimistically patch both paginated query state and the jump cache, then roll back both on failure. |
| **Interface** | Every screen is a 1:1 recreation of Airtable's, matched by overlaying the original and hand-written with no component library underneath. |



## Documentation

Start with Architecture for the big picture, then Scaling engine for the read and write paths.


| Document                                           | What it covers                              |
| -------------------------------------------------- | ------------------------------------------- |
| [Screenshots](docs/screenshots.md)                 | A short tour of the app                     |
| [Architecture](docs/architecture.md)               | System layers, tiers, stack, and repository |
| [Scaling engine](docs/scaling-engine.md)           | Read and write paths with benchmark results |
| [Data model](docs/data-model.md)                   | Prisma schema, JSONB cells, ordering, ranks |
| [API reference](docs/api.md)                       | tRPC routers and procedures                 |
| [Deployment and configuration](docs/deployment.md) | Environment variables, limits, and hosting  |




## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).

---

> **Origin.** This project was originally built as a solo technical assessment for [Lyra](https://www.lyratechnologies.ai/) ([certificate](https://www.lyratechnologies.ai/certificate/5TYDQNOY)), based on a brief to build an Airtable clone.

