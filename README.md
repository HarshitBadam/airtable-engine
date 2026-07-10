# Airtable Engine

Airtable Engine is an Airtable-style spreadsheet designed to keep tables with millions of rows responsive. It supports bases, tables, and views with text and number fields, along with sorting, filtering, search, and keyboard-friendly cell editing. It does this without sending the full dataset to the browser.

> **Live:** [airtable-engine.vercel.app](https://airtable-engine.vercel.app/) (Google sign-in)
>
> The bulk-add control is the quickest way to create a large table and try a deep scrollbar jump. See the [product snapshots](docs/screenshots.md#scrollbar-jump).

At one million rows, a deep scrollbar jump brings real rows to the screen in **403 ms median** and **578 ms p95** across 15 production-build runs. The request completes in **95 ms median** and **130 ms p95**. PostgreSQL takes **0.2 ms median** for a plain-table seek and **1.1 ms median** for a saved-rank lookup. An unanchored ad-hoc sort takes **1.22 s median**. See the [scaling engine](docs/scaling-engine.md) and [full benchmark results](benchmark-results/latency-results.md).

---

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

---

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

---

> **Origin.** This began as a solo technical assessment for [Lyra](https://www.lyratechnologies.ai/) ([certificate](https://www.lyratechnologies.ai/certificate/5TYDQNOY)). The original brief was an Airtable clone; the large-table read path, rank table, SQL builders, and jump cache were developed after that.
