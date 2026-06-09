/**
 * Tunable safety limits for free-tier hosting (Vercel + free Postgres).
 *
 * These constants prevent authenticated users from exhausting the database
 * via unbounded bulk inserts. Adjust as needed if upgrading to a paid tier.
 */

/**
 * Max rows a single addMany call can insert. Down from 200k. Kept at 100k to
 * match the client's "bulk add" button (useRowMutations.ts passes 100_000), so
 * the demo UX is unchanged. The REAL cost protection is the per-table / per-user
 * ceilings below plus the 15/min rate limit on this endpoint — those bound total
 * storage regardless of per-call size.
 */
export const MAX_ADD_MANY_PER_CALL = 100_000;

/** Default row count when the client omits the `count` parameter (direct API use). */
export const DEFAULT_ADD_MANY = 1_000;

/** Hard ceiling on rows in a single table. Prevents one table from consuming the entire DB. */
export const MAX_ROWS_PER_TABLE = 2_000_000;

/** Hard ceiling on total rows across all tables owned by one user. */
export const MAX_ROWS_PER_USER = 10_000_000;
