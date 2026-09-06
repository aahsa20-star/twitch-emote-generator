import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_BUCKETS,
  _rateLimitBucketCount,
  _resetRateLimitMemory,
  consumeRateLimit,
  getClientIp,
  rateLimitKey,
} from "./rate-limit";

const WINDOW = 900;
const LIMIT = 10;

describe("in-memory rate limit (コミット A / A19)", () => {
  beforeEach(() => _resetRateLimitMemory());

  it("enforces the limit per fixed window and reports retryAfter", async () => {
    const key = rateLimitKey("passphrase", "203.0.113.5");
    const now = Date.UTC(2026, 8, 5, 12, 0, 30);
    for (let i = 1; i <= LIMIT; i++) {
      const r = await consumeRateLimit({ key, limit: LIMIT, windowSec: WINDOW, now });
      expect(r.allowed).toBe(true);
      expect(r.hitCount).toBe(i);
    }
    const denied = await consumeRateLimit({ key, limit: LIMIT, windowSec: WINDOW, now });
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
    expect(denied.retryAfterSec).toBeLessThanOrEqual(WINDOW);
  });

  it("window boundary: last ms of the window still denies, first ms of the next allows", async () => {
    const key = rateLimitKey("passphrase", "203.0.113.6");
    const windowStart = Math.floor(Date.UTC(2026, 8, 5, 12, 0, 0) / (WINDOW * 1000)) * WINDOW * 1000;
    for (let i = 0; i < LIMIT; i++) await consumeRateLimit({ key, limit: LIMIT, windowSec: WINDOW, now: windowStart + 1000 });
    expect((await consumeRateLimit({ key, limit: LIMIT, windowSec: WINDOW, now: windowStart + WINDOW * 1000 - 1 })).allowed).toBe(false);
    expect((await consumeRateLimit({ key, limit: LIMIT, windowSec: WINDOW, now: windowStart + WINDOW * 1000 })).allowed).toBe(true);
  });

  it("concurrent attempts cannot exceed the limit", async () => {
    const key = rateLimitKey("passphrase", "198.51.100.7");
    const results = await Promise.all(Array.from({ length: 25 }, () => consumeRateLimit({ key, limit: LIMIT, windowSec: WINDOW, now: 1_000_000 })));
    expect(results.filter((r) => r.allowed)).toHaveLength(LIMIT);
  });

  it("keys are independent", async () => {
    const a = rateLimitKey("passphrase", "10.0.0.1");
    const b = rateLimitKey("passphrase", "10.0.0.2");
    for (let i = 0; i < LIMIT; i++) await consumeRateLimit({ key: a, limit: LIMIT, windowSec: WINDOW, now: 5 });
    expect((await consumeRateLimit({ key: a, limit: LIMIT, windowSec: WINDOW, now: 5 })).allowed).toBe(false);
    expect((await consumeRateLimit({ key: b, limit: LIMIT, windowSec: WINDOW, now: 5 })).allowed).toBe(true);
  });

  it("buckets with different windows do not evict each other while still valid", async () => {
    const now = 10_000_000;
    const short = rateLimitKey("follow", "u1");
    const long = rateLimitKey("passphrase", "ip1");
    for (let i = 0; i < LIMIT; i++) await consumeRateLimit({ key: long, limit: LIMIT, windowSec: WINDOW, now });
    await consumeRateLimit({ key: short, limit: 1, windowSec: 5, now });
    // 6 seconds later the short bucket expired, the long one must still deny.
    await consumeRateLimit({ key: short, limit: 1, windowSec: 5, now: now + 6000 });
    expect((await consumeRateLimit({ key: long, limit: LIMIT, windowSec: WINDOW, now: now + 6000 })).allowed).toBe(false);
  });

  it("cap: expired buckets are purged first, then the soonest-expiring is evicted", async () => {
    const now = 50_000_000;
    for (let i = 0; i < MAX_BUCKETS; i++) {
      await consumeRateLimit({ key: `k:${i}`, limit: 1, windowSec: WINDOW, now });
    }
    expect(_rateLimitBucketCount()).toBe(MAX_BUCKETS);
    // All expired → purge makes room without eviction.
    await consumeRateLimit({ key: "k:new", limit: 1, windowSec: WINDOW, now: now + WINDOW * 1000 });
    expect(_rateLimitBucketCount()).toBe(1);

    _resetRateLimitMemory();
    for (let i = 0; i < MAX_BUCKETS; i++) {
      await consumeRateLimit({ key: `k:${i}`, limit: 1, windowSec: i === 0 ? 5 : WINDOW, now });
    }
    // Nothing expired: the 5-second bucket (k:0) is the eviction victim.
    await consumeRateLimit({ key: "k:new", limit: 1, windowSec: WINDOW, now: now + 1000 });
    expect(_rateLimitBucketCount()).toBe(MAX_BUCKETS);
    const k0 = await consumeRateLimit({ key: "k:0", limit: 1, windowSec: 5, now: now + 1000 });
    expect(k0.hitCount).toBe(1); // re-created → limit loosened only for the evicted key
  });

  it("keys never contain the raw value", () => {
    const k = rateLimitKey("passphrase", "203.0.113.5");
    expect(k.startsWith("passphrase:")).toBe(true);
    expect(k).not.toContain("203.0.113.5");
  });

  it("getClientIp prefers x-forwarded-for first entry, then x-real-ip", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(getClientIp(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});
