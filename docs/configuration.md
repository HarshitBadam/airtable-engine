# Configuration

Copy [`.env.example`](../.env.example) to `.env` before starting the app.

## Required values

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | The PostgreSQL connection used by the application |
| `DIRECT_URL` | The direct connection Prisma uses for migrations |
| `AUTH_SECRET` | Session signing; generate one with `npx auth secret` |
| `AUTH_GOOGLE_ID` | Google OAuth client id |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |

`DATABASE_URL` and the auth values are checked by [`src/env.js`](../src/env.js). `DIRECT_URL` is read by Prisma from [`schema.prisma`](../prisma/schema.prisma), so migration commands also need it.

For local Postgres, `DATABASE_URL` and `DIRECT_URL` can be the same. In production, the application URL can point at a pooler while `DIRECT_URL` points straight at the database.

Create the OAuth client in the [Google Cloud console](https://console.cloud.google.com/apis/credentials). Add this redirect URI for local development:

```text
http://localhost:3000/api/auth/callback/google
```

Add the same path on the production domain as a second redirect URI.

## Development latency

In development, the tRPC timing middleware adds a random 100–500 ms delay to each procedure. This is intentional: it makes request waterfalls and weak optimistic states visible on localhost. Database benchmarks bypass that middleware, so use the benchmark harness—not browser timing from `pnpm dev`—when measuring SQL changes.

## Optional rate-limit store

Set both of these to share rate-limit state between application instances:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

If either value is absent, the app uses an in-memory limiter. That is enough for local development. On a serverless deployment it resets on cold starts and each instance keeps separate state.

The current limits are:

| Request type | Limit |
| --- | ---: |
| Queries | 600 per minute |
| Normal mutations | 240 per minute |
| Heavy mutations | 15 per minute |

The heavy bucket covers bulk insert, clear-table, permanent sort, rank computation, and column backfill. Limiter infrastructure errors fail open; authentication and ownership checks still apply.

## Data limits

[`src/server/api/limits.ts`](../src/server/api/limits.ts) also places hard limits on stored rows:

| Limit | Value |
| --- | ---: |
| One `row.addMany` call | 100,000 rows |
| One table | 2,000,000 rows |
| One user | 10,000,000 rows |
