# Deployment

The application needs a Node host and PostgreSQL. Vercel is the current host, but there is no Vercel-specific runtime code in the repository.

## Database connections

Use PostgreSQL with the `pgcrypto` and `pg_trgm` extensions available. The migrations enable both.

In production, `DATABASE_URL` should normally use the provider's pooled connection and `DIRECT_URL` its direct connection. Prisma uses the direct URL for migrations. Some poolers do not support the session behavior migration tools need.

For local work:

```bash
./start-database.sh
pnpm prisma migrate dev
```

The script starts the unpinned `postgres` container image using the connection in `.env`. Pin the image tag in `start-database.sh` if local and production versions must match exactly.

## Build

The package build script is:

```text
prisma migrate deploy && prisma generate && next build
```

Pending migrations therefore run before each production build. The build environment needs both database URLs and must be able to reach the database. If a hosting setup runs several builds concurrently, move `prisma migrate deploy` into a single release step to avoid competing migration jobs.

Start a built application with:

```bash
pnpm start
```

## Environment

Set the five required values from [configuration.md](configuration.md): two database URLs, the auth secret, and the two Google OAuth values. Add the production OAuth callback:

```text
https://your-domain.example/api/auth/callback/google
```

Upstash is optional, but recommended when the application can run on more than one instance. The in-memory fallback neither survives a cold start nor shares counters across instances.

## Request duration

Most requests are short. Two operations need more room:

- field duplication backfills the table in batches;
- saved-rank computation can keep a transaction open for up to 120 seconds.

Check the host's function-duration limit before running those operations on a million-row table. The database timings in [performance.md](performance.md) do not include network or platform overhead.

The application-level caps—100,000 rows per bulk call, 2,000,000 per table, and 10,000,000 per user—apply on every host.

## Repository-provided infrastructure

There is no Dockerfile, `vercel.json`, or deployment workflow. [`next.config.js`](../next.config.js) contains the security headers; the host, database backups, monitoring, and release workflow are left to the deployment environment.
