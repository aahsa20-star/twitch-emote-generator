/**
 * Fixed-window rate limiter — in-memory, best effort (コミット A, 04 指示).
 *
 * Scope and limits (documented, not hidden):
 *  - Buckets live in the memory of ONE server instance. Serverless deployments
 *    run several instances; each has its own counters. A restart clears them.
 *    This is NOT a global limit and NOT persistent.
 *  - Keys are HMAC hashes of the caller-supplied value (e.g. IP). Raw values
 *    and passphrases are never stored.
 *  - Every bucket carries an absolute `expiresAt` (window end). Expired
 *    buckets are purged lazily; live buckets are never dropped because another
 *    bucket with a different window happened to roll over.
 *  - The map is capped (`MAX_BUCKETS`). When full and nothing has expired,
 *    the bucket with the earliest `expiresAt` is evicted so a new key can be
 *    admitted; eviction only ever loosens the limit for the evicted key.
 */
import "server-only";
import { createHmac, randomBytes } from "node:crypto";

export interface RateLimitOptions {
  /** Already-hashed bucket key (use `rateLimitKey`). */
  key: string;
  limit: number;
  windowSec: number;
  now?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
  hitCount: number;
  source: "memory";
}

export const MAX_BUCKETS = 10_000;

interface Bucket {
  windowStart: number;
  expiresAt: number;
  count: number;
}

const buckets = new Map<string, Bucket>();
let processKey: Buffer | null = null;

function hashingKey(): Buffer {
  const secret = process.env.PASSPHRASE_COOKIE_SECRET;
  if (secret) return createHmac("sha256", secret).update("rate-limit-v1", "utf8").digest();
  // No dedicated secret (dev): process-random key — hashes stay non-reversible.
  if (!processKey) processKey = randomBytes(32);
  return processKey;
}

/** Build an opaque bucket key: `${label}:${hmac(value)}`. */
export function rateLimitKey(label: string, value: string): string {
  const digest = createHmac("sha256", hashingKey()).update(value, "utf8").digest("base64url");
  return `${label}:${digest.slice(0, 43)}`;
}

/**
 * Client IP for rate limiting. On Vercel, `x-forwarded-for` is overwritten by
 * the platform (external values are not forwarded), so the first entry is the
 * trusted client address. Locally both headers may be absent → "unknown".
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

/** Drop every bucket whose window has ended. Returns the number removed. */
function purgeExpired(now: number): number {
  let removed = 0;
  for (const [k, b] of buckets) {
    if (b.expiresAt <= now) {
      buckets.delete(k);
      removed++;
    }
  }
  return removed;
}

/** Evict the bucket closest to expiry (only used when the map is full). */
function evictSoonest(): void {
  let victim: string | null = null;
  let soonest = Infinity;
  for (const [k, b] of buckets) {
    if (b.expiresAt < soonest) {
      soonest = b.expiresAt;
      victim = k;
    }
  }
  if (victim !== null) buckets.delete(victim);
}

/**
 * Consume one hit from the bucket. Counts every attempt (success or failure).
 * Synchronous under the hood: concurrent calls in one instance are serialized
 * by the event loop, so a burst can never exceed `limit` within one instance.
 */
export async function consumeRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const now = opts.now ?? Date.now();
  const windowMs = opts.windowSec * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const expiresAt = windowStart + windowMs;

  let bucket = buckets.get(opts.key);
  if (bucket && bucket.expiresAt <= now) {
    buckets.delete(opts.key);
    bucket = undefined;
  }

  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) {
      if (purgeExpired(now) === 0) evictSoonest();
    }
    bucket = { windowStart, expiresAt, count: 0 };
    buckets.set(opts.key, bucket);
  }

  bucket.count += 1;
  const allowed = bucket.count <= opts.limit;
  const retryAfterSec = allowed ? 0 : Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000));
  return { allowed, retryAfterSec, hitCount: bucket.count, source: "memory" };
}

/** Test / diagnostics hooks. */
export function _resetRateLimitMemory() {
  buckets.clear();
}
export function _rateLimitBucketCount(): number {
  return buckets.size;
}
