# Airtable Engine

Airtable Engine is an Airtable-style spreadsheet built around one demanding case: keeping a million-row table responsive. It supports bases, tables, text and number fields, saved views, sorting, filtering, search, and keyboard-friendly cell editing without sending the full dataset to the browser.

At one million rows, a deep scrollbar jump puts real rows on screen in **403 ms median** and **578 ms p95** across 15 production-build runs. The request itself returns in **95 ms median**; the indexed PostgreSQL path is **0.2 ms** for a plain table and **1.1 ms** for a saved sort. [Methodology and full results →](docs/performance.md)

> **Live:** [airtable-engine.vercel.app](https://airtable-engine.vercel.app/) (Google sign-in)
>
> The bulk-add control is the quickest way to make a large table and try a [deep scrollbar jump](docs/screenshots.md#scrollbar-jump).

## What makes that work

- **Window-sized reads.** The browser and server exchange the rows around the viewport, not the table behind it.
- **Two fast jump paths.** Plain tables seek through `rowIndex`; saved sorts read precomputed ranks. Filters and ad-hoc sorts use a documented general fallback.
- **Local writes.** A floating-point row order lets inserts and reorders update one row instead of renumbering everything below it.
- **Plain PostgreSQL.** JSONB cells, expression indexes, keyset cursors, and a materialized rank table handle storage and search without a separate data service.
- **A bounded client.** Virtualization, a sparse jump cache, and scaled scroll coordinates keep DOM and memory use stable.

[Read the architecture →](docs/architecture.md)

## Run it locally

You need Node 20+, pnpm, Docker, and a Google OAuth client.

```bash
pnpm install
cp .env.example .env
./start-database.sh
pnpm prisma migrate dev
pnpm dev
```

`start-database.sh` starts PostgreSQL in Docker. The image tag is currently unpinned; if you already have Postgres, use that connection in `.env` instead. Google OAuth setup and the required variables are covered in [configuration.md](docs/configuration.md).

## Documentation

Start with the architecture, then follow whichever part you are interested in.


| Document                                     | What it covers                                        |
| -------------------------------------------- | ----------------------------------------------------- |
| [Screenshots](docs/screenshots.md)           | A short tour of the app                               |
| [Stack](docs/stack.md)                       | The main libraries and their roles                    |
| [Architecture](docs/architecture.md)         | The request path and the three ways to fetch a window |
| [Data model](docs/data-model.md)             | Row order, JSONB cells, counters, and saved ranks     |
| [Reading at scale](docs/reading-at-scale.md) | Scrolling, deep jumps, filters, and search            |
| [Writing at scale](docs/writing-at-scale.md) | Inserts, bulk loads, cell edits, and rank rebuilds    |
| [Query engine](docs/query-engine.md)         | The hand-written SQL and its safety rules             |
| [Client grid](docs/client-grid.md)           | Virtualization, jump caching, and optimistic edits    |
| [Performance](docs/performance.md)           | Measured query times and the benchmark setup          |
| [API reference](docs/api.md)                 | The tRPC routers and procedures                       |
| [Configuration](docs/configuration.md)       | Environment variables, limits, and local setup        |
| [Deployment](docs/deployment.md)             | Database and hosting notes                            |
| [Repo structure](docs/repo-structure.md)     | Where the main pieces live                            |

---

> **Origin.** This began as a solo technical assessment for [Lyra](https://www.lyratechnologies.ai/) ([certificate](https://www.lyratechnologies.ai/certificate/5TYDQNOY)). The original brief was an Airtable clone; the large-table read path, rank table, SQL builders, and jump cache were developed after that.
