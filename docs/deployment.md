# Deployment and configuration

The live app runs on Vercel with managed PostgreSQL. Any Node 20+ host can run the same build.

## Environment variables

| Variable             | Purpose                                          |
| -------------------- | ------------------------------------------------ |
| `DATABASE_URL`       | Application PostgreSQL connection                |
| `DIRECT_URL`         | Direct connection used by Prisma migrations      |
| `AUTH_SECRET`        | Session signing. Generate with `npx auth secret` |
| `AUTH_GOOGLE_ID`     | Google OAuth client id                           |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret                       |

The canonical template is [`.env.example`](../.env.example). Locally, both database URLs can be the same. Hosted setups normally use a pooler for `DATABASE_URL` and a direct connection for `DIRECT_URL`.

## Google OAuth

Create a web client in the [Google Cloud console](https://console.cloud.google.com/apis/credentials) and register:

```text
http://localhost:3000/api/auth/callback/google
https://your-domain.example/api/auth/callback/google
```

## Optional shared rate limits

Set both values to share counters across application instances:

```text
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Without them, the app uses process-local counters, which is suitable for development but not shared across serverless instances.

Request limits:

| Class            |            Value |
| ---------------- | ---------------: |
| Queries          | 600 per user/min |
| Normal mutations | 240 per user/min |
| Heavy mutations  |  15 per user/min |

Row caps:

| Scope                  |           Value |
| ---------------------- | --------------: |
| One `row.addMany` call |    100,000 rows |
| One table              |  2,000,000 rows |
| One user               | 10,000,000 rows |

## Build and start

```bash
pnpm build
pnpm start
```

The application build generates Prisma Client but does not connect to or migrate a database.
Run migrations as a separate, deliberate release step from a trusted environment:

```bash
# Review the target and pending migrations before changing the database.
pnpm db:migrate:status

# Runs the repository safety check before Prisma's production deploy command.
pnpm db:migrate:deploy
```

Take a database backup and review every pending migration before the deploy step. `DIRECT_URL`
is required for these migration commands, but it is not required by `pnpm build`. Do not run
the deploy command automatically for every application build or preview deployment.

### Destructive migration policy

`pnpm db:migrate:check` rejects data-deleting and destructive schema statements in new Prisma
migrations. The three February 2026 reset migrations remain in history because production
revisions containing them were successfully deployed; their exact checksums are recorded in
`prisma/migration-safety-baseline.json`. They are immutable historical exceptions, not examples
for future migrations.

Never add a data reset to `prisma/migrations` or extend the historical baseline for one. Keep
manual reset SQL outside automatic migration history, require an operator to select the target,
take a backup, and execute it separately. Removing or editing a migration that may already exist
in `_prisma_migrations` can break Prisma's deployment history.

## Development and long operations

`pnpm dev` adds a random 100 to 500 ms delay to each tRPC procedure. This exposes request waterfalls and optimistic UI bugs. The delay is absent from production builds, so development timings are not performance results.

At one million rows, field duplication took 82 seconds and a saved-rank build took 14.8 seconds. Check the host's function timeout before running either. Rank and permanent sort transactions allow up to 120 seconds. See [Scaling engine](scaling-engine.md).
