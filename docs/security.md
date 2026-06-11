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

Note on cost (verified Jun 2026): **Neither free tier can bill you.** Vercel's Hobby plan has no overage billing and cannot be configured to purchase extra usage — when a limit (bandwidth, function invocations, etc.) is hit, the project is **paused** until the next cycle. Neon's Free plan likewise never bills overages — when compute (100 CU-hours/mo), storage (0.5 GB), or egress (5 GB/mo) is exhausted, the project's compute is **suspended** (data is preserved). With no payment method on file, the worst-case outcome of any attack is **temporary downtime, not a charge.** The defenses below exist to keep the app *available* and to make abuse expensive, not to prevent billing (which is structurally impossible here).

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

- **Backends:** Upstash Redis (sliding window) when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set; otherwise a best-effort in-memory fixed-window fallback (single-instance only — see owner follow-ups).
- **Fail-open:** infrastructure errors (e.g. Redis down) never block requests; the limiter logs and allows.

## Abuse / cost ceilings

Tunable constants in [`src/server/api/limits.ts`](../src/server/api/limits.ts):

| Constant | Value | Purpose |
| --- | --- | --- |
| `MAX_ADD_MANY_PER_CALL` | 100,000 | Bounds a single bulk insert (matches the UI's bulk-add button) |
| `DEFAULT_ADD_MANY` | 1,000 | Safe default when `count` is omitted |
| `MAX_ROWS_PER_TABLE` | 2,000,000 | Application-level ceiling per table |
| `MAX_ROWS_PER_USER` | 10,000,000 | Application-level ceiling across all of one user's tables |

`row.addMany` checks both ceilings (using the materialized `rowCount`, so the check is sub-millisecond) before inserting and returns a friendly `BAD_REQUEST` when exceeded.

> **The binding limit on free Neon is storage, not these ceilings.** Neon's Free plan caps a project at **0.5 GB**, which is reached well before 2M rows (each row stores a JSONB `cells` blob + `searchText` + per-column B-tree index entries). When storage is exhausted Neon **suspends writes** (it does not bill — see the cost note above), so the app may start rejecting inserts before the application ceilings are hit. The ceilings above are a secondary guard, not the primary cost control. Lower them if you'd prefer a friendly `BAD_REQUEST` to appear before Neon's hard storage stop.

## Authorization (multi-tenant isolation)

- All mutations and queries verify ownership via `base: { ownerId: ctx.session.user.id }` (directly or through `table` / `view` relations).
- `viewId`-driven fast paths in `row.infinite`, `row.windowFetch`, and `findEdgeMatch` are scoped with `tableId: input.tableId` + `table: { base: { ownerId } }`. A foreign/guessed view ID falls through to the standard (already-scoped) query path — no error, no leak.

## Transport / headers

[`next.config.js`](../next.config.js) sets `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, and `Permissions-Policy` on all routes. A strict `Content-Security-Policy` is intentionally deferred (it needs per-request nonces for Next.js inline scripts; a wrong policy breaks the app) — see owner follow-ups.

## Dependencies

- `next` upgraded to `15.5.19` to close the Server-Components DoS advisories.
- Remaining `pnpm audit` entries are build-time only (`effect`, `defu`, `postcss` via the Prisma CLI) or non-applicable (`next-auth` email advisory — this app uses Google OAuth only, no email provider).

## What's verified vs. what's not

**Verified:** `tsc --noEmit`, full unit test suite (54/54), ESLint (no new issues), and a production `next build` all pass. Every raw-SQL sink has been enumerated and hardened.

**Not verified here:** a live end-to-end run against a real database + Google login (requires deploy secrets). The changes are standard middleware/query edits, so runtime risk is low — but confirm after deploy.

---

## Owner follow-ups

These items require production account access or deployment decisions:

1. Provision Upstash Redis before treating rate limiting as production-grade. Create a free database, set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel, then redeploy. Without this, Vercel serverless instances use only the in-memory fallback.
2. Smoke-test the deployed app while logged in: create a base, bulk-add rows, sort, search, and delete a column. Normal use should not show `TOO_MANY_REQUESTS`.
3. Tune limits only if normal usage trips them. Start with `queryDefault` in [`src/server/api/rateLimit.ts`](../src/server/api/rateLimit.ts); row ceilings live in [`src/server/api/limits.ts`](../src/server/api/limits.ts).
4. Add a nonce-backed `Content-Security-Policy` after Next.js inline scripts are accounted for.
5. Decide whether sign-up should remain open to any Google account. If the app becomes private, restrict the NextAuth `signIn` callback to an email allow-list.
6. Schedule cleanup for stale demo accounts and rows so the free-tier database does not slowly fill from normal demo traffic.
