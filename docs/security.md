# Security

> **TL;DR** — Raw SQL is safe (values parameterized, identifiers run through an `assertSafeId` allow-list). Abuse/cost is bounded by per-call, per-table, and per-account row ceilings plus per-user rate limiting on every tRPC procedure. Cross-tenant access is blocked by ownership-scoped queries. Security headers are set. **One manual step remains: provision Upstash Redis so rate limiting is distributed in production.**

This app is a public-facing portfolio/demo: anyone with a Google account can sign in and use it. That means "authenticated user" effectively equals "anyone on the internet," so the defenses below assume an untrusted, signed-in caller.

## Threat model

| Concern | Risk on free-tier (Vercel + free Postgres) | Status |
| --- | --- | --- |
| SQL injection (raw SQL via `$queryRawUnsafe`) | DB compromise / data theft | Mitigated |
| Mass-spike / request flooding | App + DB degradation (DoS) | Mitigated (rate limiting) |
| Database storage exhaustion (row flooding) | DB suspension / cost | Mitigated (row ceilings) |
| Cross-tenant data access (IDOR) | One user reading another's data | Mitigated (ownership scoping) |
| Known dependency CVEs | DoS / misc | Patched (Next.js upgraded) |
| Missing security headers | Clickjacking / MIME sniffing | Mitigated |

Note on cost: Vercel's Hobby tier does **not** bill overages — it throttles/pauses. The real cost lever is the **database** provider's free-tier storage/compute being exhausted, which the row ceilings below are designed to prevent.

## SQL injection

All raw SQL lives under `src/server/sql/` and the row/column routers. Two rules hold everywhere:

1. **Values are always parameterized** (`$1, $2, …` passed to `$queryRawUnsafe`). Search strings, filter values, sort values, cursors — never string-interpolated.
2. **Identifiers** (`tableId`, `columnId`, `viewId`) that must be interpolated go through `assertSafeId` in [`src/server/sql/escape.ts`](../src/server/sql/escape.ts), which enforces `^[A-Za-z0-9_-]{1,191}$` and throws otherwise. `escapeLiteral` wraps `assertSafeId`, so every existing call site is covered. Column IDs are *additionally* validated against the table before use (`validateAndResolveSorts` / `validateAndResolveFilters`).

This removes the entire injection surface for interpolated identifiers rather than relying on Postgres's `standard_conforming_strings` default.

## Rate limiting

Every `protectedProcedure` passes through a rate-limit middleware ([`src/server/api/trpc.ts`](../src/server/api/trpc.ts) + [`src/server/api/rateLimit.ts`](../src/server/api/rateLimit.ts)), keyed by user ID (IP fallback). Limits are tuned so a fast human never trips them but scripts do:

| Bucket | Limit | Applies to |
| --- | --- | --- |
| `mutationHeavy` | 15 / min | `row.addMany`, `row.clearData`, `row.applyPermanentSort`, `row.computeViewRanks`, `column.backfill` |
| `mutationDefault` | 240 / min | all other writes (cell edits, create/delete/rename, …) |
| `queryDefault` | 600 / min | all reads (infinite scroll, search, lists) |

- **Backends:** Upstash Redis (sliding window) when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set; otherwise a best-effort in-memory fixed-window fallback (single-instance only — see TODOs).
- **Fail-open:** infrastructure errors (e.g. Redis down) never block requests; the limiter logs and allows.

## Abuse / cost ceilings

Tunable constants in [`src/server/api/limits.ts`](../src/server/api/limits.ts):

| Constant | Value | Purpose |
| --- | --- | --- |
| `MAX_ADD_MANY_PER_CALL` | 100,000 | Bounds a single bulk insert (matches the UI's bulk-add button) |
| `DEFAULT_ADD_MANY` | 1,000 | Safe default when `count` is omitted |
| `MAX_ROWS_PER_TABLE` | 500,000 | Hard ceiling per table |
| `MAX_ROWS_PER_USER` | 1,000,000 | Hard ceiling across all of one user's tables |

`row.addMany` checks both ceilings (using the materialized `rowCount`, so the check is sub-millisecond) before inserting and returns a friendly `BAD_REQUEST` when exceeded.

## Authorization (multi-tenant isolation)

- All mutations and queries verify ownership via `base: { ownerId: ctx.session.user.id }` (directly or through `table` / `view` relations).
- `viewId`-driven fast paths in `row.infinite`, `row.windowFetch`, and `findEdgeMatch` are scoped with `tableId: input.tableId` + `table: { base: { ownerId } }`. A foreign/guessed view ID falls through to the standard (already-scoped) query path — no error, no leak.

## Transport / headers

[`next.config.js`](../next.config.js) sets `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, and `Permissions-Policy` on all routes. A strict `Content-Security-Policy` is intentionally deferred (it needs per-request nonces for Next.js inline scripts; a wrong policy breaks the app) — see TODOs.

## Dependencies

- `next` upgraded to `15.5.19` to close the Server-Components DoS advisories.
- Remaining `pnpm audit` entries are build-time only (`effect`, `defu`, `postcss` via the Prisma CLI) or non-applicable (`next-auth` email advisory — this app uses Google OAuth only, no email provider).

## What's verified vs. what's not

**Verified:** `tsc --noEmit`, full unit test suite (54/54), ESLint (no new issues), and a production `next build` all pass. Every raw-SQL sink has been enumerated and hardened.

**Not verified here:** a live end-to-end run against a real database + Google login (requires deploy secrets). The changes are standard middleware/query edits, so runtime risk is low — but confirm after deploy.

---

## TODO — owner action items

These require account access / decisions only the owner can make:

- [ ] **Provision Upstash Redis (highest priority).** Without it, rate limiting uses the in-memory fallback, which on Vercel serverless is weak (per-instance, ephemeral). This is the gap between "best-effort" and "production-grade."
  1. Create a free database at [console.upstash.com](https://console.upstash.com).
  2. In the Vercel project, set env vars `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
  3. Redeploy. (See [`.env.example`](../.env.example) for local setup.)
- [ ] **Smoke-test after deploy while logged in:** create a base, bulk-add rows, sort, search, delete a column — confirm no `TOO_MANY_REQUESTS` toasts appear during normal use.
- [ ] **Tune limits if needed.** If a normal session ever trips a limit, adjust the numbers in `src/server/api/rateLimit.ts` (the read bucket, `queryDefault` = 600/min, is the most likely to need raising). Row ceilings live in `src/server/api/limits.ts`.
- [ ] **(Optional) Add a Content-Security-Policy** with Next.js nonce support once inline scripts are accounted for.
- [ ] **(Optional) Decide on sign-up scope.** Sign-up is open to any Google account by design (portfolio). If it ever becomes private, restrict the NextAuth `signIn` callback to an email allow-list.
- [ ] **(Optional) Schedule cleanup of stale demo data** (old/inactive accounts and their rows) so the free-tier database doesn't slowly fill from normal demo traffic.
