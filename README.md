# Lyra Take Home Assessment - Airtable Data Grid (T3 Stack)

This project is **still in active development**.

---

## Current Scope

- Authentication flows implemented (Google OAuth)
- Core backend data layer implemented
- Query engine designed to scale from small datasets to 100k–1M rows

The frontend grid UI is intentionally incomplete at this stage.

---

## Architecture Overview

### Data Model (PostgreSQL + Prisma)

- `Base` → `Table` → `Column`, `View`, `Row`
- Rows store dynamic schema in `JSONB` (`cells`)
- Stable ordering via `rowIndex`
- Derived `searchText` column for efficient full-table search

Views persist query configuration:
- search
- filters
- sort
- hidden columns

---

## Query Engine Features

### Infinite Scrolling
- Keyset pagination (no OFFSET)
- Cursor-based paging using `rowIndex`
- Works correctly with filtering and sorting

### Bulk Inserts
- Insert up to 100k rows in a single SQL statement
- Uses Postgres `generate_series`
- Atomic reservation of row index ranges

### Cell Editing
- Updates JSONB cell values
- Keeps derived `searchText` in sync
- Safe handling of dynamic values

### Search
- Database-level search across all cells
- Case-insensitive (`ILIKE`)
- Backed by trigram GIN index

### Filters
- Text and numeric operators (`contains`, `equals`, `gt`, `lt`, `is_empty`, etc.)
- Implemented in SQL (not client-side)
- Filter columns validated against table schema

### Sorting
- Database-level sorting on dynamic JSONB columns
- Stable ordering with deterministic tie-breaker
- Cursor includes sort value + row index to avoid duplicates or skips

---

## Performance Strategy

- No OFFSET pagination
- No client-side filtering or sorting
- Expression indexes on JSONB columns
- Indexes created on-demand per column
- Query shapes designed to remain index-friendly

---

## Tech Stack

- Next.js (App Router)
- tRPC
- Prisma + PostgreSQL
- NextAuth
- Tailwind CSS

---

## Development

```bash
pnpm install
pnpm prisma migrate dev
pnpm dev
