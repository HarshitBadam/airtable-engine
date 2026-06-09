import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Bucket configuration
// ---------------------------------------------------------------------------

export type RateBucket = "mutationHeavy" | "mutationDefault" | "queryDefault";

/**
 * Per-user limits tuned so a fast human never hits them but automated scripts
 * are throttled. All windows are sliding (Upstash) or fixed (in-memory
 * fallback).
 *
 * mutationHeavy  – bulk / full-table mutations (addMany, clearData, …)
 * mutationDefault – all other write operations (updateCell, create, delete, …)
 * queryDefault   – reads (infinite scroll, search helpers, list, …)
 */
const BUCKET_CONFIG: Record<RateBucket, { maxRequests: number; windowSeconds: number }> = {
  mutationHeavy: { maxRequests: 15, windowSeconds: 60 },
  mutationDefault: { maxRequests: 240, windowSeconds: 60 },
  queryDefault: { maxRequests: 600, windowSeconds: 60 },
};

// ---------------------------------------------------------------------------
// Upstash (production) backend — used when env vars are present
// ---------------------------------------------------------------------------

function createUpstashLimiters(): Record<RateBucket, Ratelimit> | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redis = new Redis({ url, token });

  const make = (bucket: RateBucket): Ratelimit => {
    const { maxRequests, windowSeconds } = BUCKET_CONFIG[bucket];
    return new Ratelimit({
      redis,
      prefix: `lyra-rl:${bucket}`,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
      analytics: false,
    });
  };

  return {
    mutationHeavy: make("mutationHeavy"),
    mutationDefault: make("mutationDefault"),
    queryDefault: make("queryDefault"),
  };
}

// ---------------------------------------------------------------------------
// In-memory (dev / fallback) backend — best-effort, single-instance only
// ---------------------------------------------------------------------------

interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();

let warnedOnce = false;

function memoryCheck(key: string, bucket: RateBucket): { success: boolean } {
  if (!warnedOnce) {
    console.warn(
      "[rate-limit] Upstash env vars not configured — using best-effort " +
        "in-memory rate limiting. This does NOT survive across serverless " +
        "invocations. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN " +
        "for production-grade distributed limiting.",
    );
    warnedOnce = true;
  }

  const { maxRequests, windowSeconds } = BUCKET_CONFIG[bucket];
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const storeKey = `${bucket}:${key}`;

  const entry = memoryStore.get(storeKey);
  if (!entry || now >= entry.resetAt) {
    memoryStore.set(storeKey, { count: 1, resetAt: now + windowMs });
    return { success: true };
  }

  entry.count += 1;
  if (entry.count > maxRequests) {
    return { success: false };
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let upstashLimiters: Record<RateBucket, Ratelimit> | null | undefined;

/**
 * Check whether `identifier` (typically `user.id`) is within the rate limit
 * for the given `bucket`. Never throws — returns `{ success: true }` on
 * infrastructure errors (fail-open).
 */
export async function checkRateLimit(
  identifier: string,
  bucket: RateBucket,
): Promise<{ success: boolean }> {
  try {
    // Lazy-init so env vars are read once, at first call
    if (upstashLimiters === undefined) {
      upstashLimiters = createUpstashLimiters();
    }

    if (upstashLimiters) {
      const { success } = await upstashLimiters[bucket].limit(identifier);
      return { success };
    }

    return memoryCheck(identifier, bucket);
  } catch (err) {
    // Fail-open: limiter infra errors must never block requests
    console.error("[rate-limit] Infrastructure error — allowing request:", err);
    return { success: true };
  }
}
