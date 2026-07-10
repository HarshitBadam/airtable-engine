# Stack

This is the dependency map. Design details are in [architecture.md](architecture.md).

## Application

- **Next.js 15**, App Router, with **React 19**
- **TypeScript** in strict mode
- **CSS Modules** with custom global tokens and reset styles
- **sonner** for toast notifications

## Client data and grid

- **TanStack Query** for server data, invalidation, and infinite pages
- **Zustand** for synchronous selection and editing state
- **TanStack Virtual** for row virtualization
- **TanStack Table** for the column model

The split between query data and interaction state is described in [client-grid.md](client-grid.md).

## API and validation

- **tRPC 11** for the browser/server boundary
- **superjson** for values such as `Date`
- **Zod** for procedure inputs and shared view configuration

## Database

- **PostgreSQL** for application data; the committed benchmark was run on 17.7
- **Prisma 6** for the schema, migrations, generated client, and routine queries
- Hand-written PostgreSQL for row windows and bulk operations
- `pgcrypto` for database-generated row UUIDs
- `pg_trgm` installed by migration, though no active trigram index is currently maintained

There is no separate search service or server-side row cache. PostgreSQL serves the read path directly. TanStack Query still caches fetched data in the browser.

## Auth and rate limiting

- **NextAuth 5** with Google OAuth
- Prisma's NextAuth adapter for database sessions
- **Upstash Redis** for shared rate limits, with an in-memory local fallback

## Tests and benchmarks

- **Vitest** for unit tests, including the SQL builders
- **Playwright** for browser tests
- Repository scripts for latency, batch-size, offset-depth, and concurrency checks
