import { describe, expect, it, vi } from "vitest";
import { checkIsFollower, validateTwitchToken } from "./follower-check";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const noSleep = async () => {};

describe("checkIsFollower (A07 / A10 / A11)", () => {
  it("returns following with followed_at", async () => {
    const fetchImpl = vi.fn(async () => json(200, { data: [{ broadcaster_id: "1", followed_at: "2026-01-01T00:00:00Z" }] }));
    const r = await checkIsFollower("tok", "u", "1", { fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep });
    expect(r).toEqual({ outcome: "following", followedAt: "2026-01-01T00:00:00Z" });
    const url = (fetchImpl.mock.calls[0] as unknown as [string])[0];
    expect(url).toContain("/helix/channels/followed?user_id=u&broadcaster_id=1");
  });

  it("returns not-following on empty data (definitive)", async () => {
    const fetchImpl = vi.fn(async () => json(200, { data: [] }));
    expect(await checkIsFollower("tok", "u", "1", { fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep })).toEqual({ outcome: "not-following" });
  });

  it("401 → unauthorized without retry", async () => {
    const fetchImpl = vi.fn(async () => json(401, {}));
    expect(await checkIsFollower("tok", "u", "1", { fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep })).toEqual({ outcome: "unauthorized" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("429 then 200 → retries once and succeeds", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json(429, {}, { "retry-after": "1" }))
      .mockResolvedValueOnce(json(200, { data: [{ broadcaster_id: "1" }] }));
    const r = await checkIsFollower("tok", "u", "1", { fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep });
    expect(r.outcome).toBe("following");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("5xx twice → temporary-error, never not-following", async () => {
    const fetchImpl = vi.fn(async () => json(503, {}));
    const r = await checkIsFollower("tok", "u", "1", { fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep });
    expect(r).toMatchObject({ outcome: "temporary-error", error: "server" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("network failure → temporary-error network", async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError("fetch failed"); });
    const r = await checkIsFollower("tok", "u", "1", { fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep });
    expect(r).toMatchObject({ outcome: "temporary-error", error: "network" });
  });

  it("hanging request → timeout within the attempt budget", async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }));
    const start = Date.now();
    const r = await checkIsFollower("tok", "u", "1", { fetchImpl: fetchImpl as unknown as typeof fetch, attemptTimeoutMs: 30, deadlineMs: 100, sleep: noSleep });
    expect(r).toMatchObject({ outcome: "temporary-error", error: "timeout" });
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it("does not wait past the deadline when Retry-After is large", async () => {
    const fetchImpl = vi.fn(async () => json(429, {}, { "retry-after": "120" }));
    const sleep = vi.fn(async () => {});
    const r = await checkIsFollower("tok", "u", "1", { fetchImpl: fetchImpl as unknown as typeof fetch, sleep, deadlineMs: 8000 });
    expect(r).toMatchObject({ outcome: "temporary-error", error: "rate-limited", retryAfterSec: 120 });
    expect(sleep).not.toHaveBeenCalled();
  });

  it("malformed JSON → temporary-error bad-response", async () => {
    const fetchImpl = vi.fn(async () => new Response("not json", { status: 200 }));
    const r = await checkIsFollower("tok", "u", "1", { fetchImpl: fetchImpl as unknown as typeof fetch, sleep: noSleep });
    expect(r).toMatchObject({ outcome: "temporary-error", error: "bad-response" });
  });
});

describe("validateTwitchToken", () => {
  it("parses a valid response", async () => {
    const fetchImpl = vi.fn(async () => json(200, { client_id: "cid", user_id: "u", scopes: ["user:read:follows"], expires_in: 100 }));
    expect(await validateTwitchToken("tok", { fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual({ ok: true, clientId: "cid", userId: "u", scopes: ["user:read:follows"], expiresInSec: 100 });
  });
  it("401 → unauthorized; network → temporary-error", async () => {
    expect(await validateTwitchToken("tok", { fetchImpl: (async () => json(401, {})) as unknown as typeof fetch })).toEqual({ ok: false, reason: "unauthorized" });
    expect(await validateTwitchToken("tok", { fetchImpl: (async () => { throw new Error("x"); }) as unknown as typeof fetch })).toEqual({ ok: false, reason: "temporary-error" });
  });
});
