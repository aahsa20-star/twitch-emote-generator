import { describe, expect, it, vi } from "vitest";
import type { JWT } from "next-auth/jwt";
import { FOLLOW_TTL_MS } from "./evaluate-access";
import { processJwt, type TwitchSessionDeps } from "./twitch-session";

const BID = "777";
const NOW0 = Date.UTC(2026, 8, 7, 12, 0, 0);

type Route = (init?: RequestInit) => Response | Promise<Response>;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function makeDeps(routes: Record<string, Route>, o: Partial<TwitchSessionDeps> = {}) {
  let now = NOW0;
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const key = Object.keys(routes).find((k) => u.startsWith(k));
    calls.push(u);
    if (!key) throw new Error("unexpected url " + u);
    return routes[key](init);
  });
  const deps: TwitchSessionDeps = {
    fetch: fetchImpl as unknown as typeof fetch,
    now: () => now,
    clientId: "cid",
    clientSecret: "sec",
    broadcasterId: BID,
    followEnabled: true,
    throttleManual: async () => true,
    ...o,
  };
  return { deps, calls, advance: (ms: number) => { now += ms; }, fetchImpl };
}

const HELIX_FOLLOWED = "https://api.twitch.tv/helix/channels/followed";
const VALIDATE = "https://id.twitch.tv/oauth2/validate";
const TOKEN = "https://id.twitch.tv/oauth2/token";

function baseToken(o: Partial<JWT> = {}): JWT {
  return {
    sub: "u1",
    access_token: "at-old",
    refresh_token: "rt",
    expires_at: Math.floor(NOW0 / 1000) + 3600,
    scope: "openid user:read:email user:read:follows",
    tokenValidatedAt: NOW0,
    ...o,
  } as JWT;
}

describe("processJwt — update triggers (A10 / A11 / A12 / 04 指示)", () => {
  it("manual recheck with an EXPIRED token repairs it first, then queries with the new token (A11)", async () => {
    let refreshed = false;
    const { deps, calls } = makeDeps({
      [TOKEN]: () => { refreshed = true; return json(200, { access_token: "at-new", refresh_token: "rt2", expires_in: 3600 }); },
      [HELIX_FOLLOWED]: (init) => {
        const auth = (init?.headers as Record<string, string>)?.Authorization;
        return auth === "Bearer at-new" ? json(200, { data: [{ broadcaster_id: BID, followed_at: "2026-01-01T00:00:00Z" }] }) : json(401, {});
      },
    });
    const token = baseToken({ expires_at: Math.floor(NOW0 / 1000) - 10 });
    await processJwt(token, { trigger: "update", updateHint: { trigger: "follower-recheck" } }, deps);
    expect(refreshed).toBe(true);
    expect(calls.indexOf(TOKEN)).toBeLessThan(calls.findIndex((c) => c.startsWith(HELIX_FOLLOWED)));
    expect(token.access_token).toBe("at-new");
    expect(token.isFollower).toBe(true);
    expect(token.followCheckedAt).toBe(NOW0);
    expect(token.followBroadcasterId).toBe(BID);
    expect(token.error).toBeUndefined();
  });

  it("401 on the follower query → one refresh + retry; second 401 → ReauthRequired, no grace evidence", async () => {
    let n = 0;
    const { deps } = makeDeps({
      [TOKEN]: () => json(200, { access_token: "at-new", expires_in: 3600 }),
      [HELIX_FOLLOWED]: () => { n++; return json(401, {}); },
    });
    const token = baseToken({ isFollower: true, followCheckedAt: NOW0 - 1000, followBroadcasterId: BID });
    await processJwt(token, { trigger: "update", updateHint: { trigger: "follower-recheck" } }, deps);
    expect(n).toBe(2);
    expect(token.error).toBe("ReauthRequired");
    expect(token.followAttemptOutcome).toBe("unauthorized");
    // last success untouched
    expect(token.followCheckedAt).toBe(NOW0 - 1000);
  });

  it("permanent refresh failure (400) → RefreshTokenError, no query", async () => {
    const { deps, calls } = makeDeps({
      [TOKEN]: () => json(400, { message: "Invalid refresh token" }),
      [HELIX_FOLLOWED]: () => json(200, { data: [] }),
    });
    const token = baseToken({ expires_at: Math.floor(NOW0 / 1000) - 10 });
    await processJwt(token, { trigger: "update", updateHint: { trigger: "follower-recheck" } }, deps);
    expect(token.error).toBe("RefreshTokenError");
    expect(calls.some((c) => c.startsWith(HELIX_FOLLOWED))).toBe(false);
  });

  it("temporary refresh failure (503) → TokenTemporaryError, retryable, no query", async () => {
    const { deps } = makeDeps({ [TOKEN]: () => json(503, {}), [HELIX_FOLLOWED]: () => json(200, { data: [] }) });
    const token = baseToken({ expires_at: Math.floor(NOW0 / 1000) - 10 });
    await processJwt(token, { trigger: "update", updateHint: { trigger: "follower-recheck" } }, deps);
    expect(token.error).toBe("TokenTemporaryError");
  });

  it("temporary follower failure keeps the last success and records attemptedAt (grace evidence)", async () => {
    const { deps, advance } = makeDeps({ [HELIX_FOLLOWED]: () => json(503, {}) });
    const token = baseToken({ isFollower: true, followCheckedAt: NOW0 - 25 * 3600_000, followAttemptedAt: NOW0 - 25 * 3600_000, followAttemptOutcome: "following", followBroadcasterId: BID });
    advance(0);
    await processJwt(token, { trigger: "update", updateHint: { trigger: "follower-ttl" } }, deps);
    expect(token.isFollower).toBe(true);
    expect(token.followCheckedAt).toBe(NOW0 - 25 * 3600_000);
    expect(token.followAttemptedAt).toBe(NOW0);
    expect(token.followAttemptOutcome).toBe("temporary-error");
    expect(token.error).toBe("FollowCheckError");
  });

  it("confirmed not-following overwrites a previous following result immediately", async () => {
    const { deps } = makeDeps({ [HELIX_FOLLOWED]: () => json(200, { data: [] }) });
    const token = baseToken({ isFollower: true, followCheckedAt: NOW0 - 60_000, followAttemptedAt: NOW0 - 60_000, followBroadcasterId: BID });
    await processJwt(token, { trigger: "update", updateHint: { trigger: "follower-recheck" } }, deps);
    expect(token.isFollower).toBe(false);
    expect(token.followCheckedAt).toBe(NOW0);
    expect(token.followAttemptOutcome).toBe("not-following");
  });

  it("forged update payload (isFollower / checkedAt / sub) is ignored — only the trigger matters (A12)", async () => {
    const { deps } = makeDeps({ [HELIX_FOLLOWED]: () => json(200, { data: [] }) });
    const token = baseToken({ isFollower: false, followCheckedAt: NOW0 - 60_000, followAttemptedAt: NOW0 - 60_000, followBroadcasterId: BID });
    await processJwt(
      token,
      { trigger: "update", updateHint: { trigger: "follower-recheck", isFollower: true, followCheckedAt: NOW0 + 9e9, sub: "attacker", user: { isFollower: true } } },
      deps,
    );
    expect(token.sub).toBe("u1");
    expect(token.isFollower).toBe(false);
    expect(token.followCheckedAt).toBe(NOW0);
  });

  it("unknown trigger values do nothing", async () => {
    const { deps, calls } = makeDeps({ [HELIX_FOLLOWED]: () => json(200, { data: [] }) });
    const token = baseToken();
    await processJwt(token, { trigger: "update", updateHint: { trigger: "evil", isFollower: true } }, deps);
    await processJwt(token, { trigger: "update", updateHint: "follower-recheck" }, deps);
    expect(calls).toHaveLength(0);
  });

  it("TTL trigger: fresh (<24h) evidence → no query; stale (≥24h) → query", async () => {
    const { deps, calls } = makeDeps({ [HELIX_FOLLOWED]: () => json(200, { data: [{ broadcaster_id: BID }] }) });
    const fresh = baseToken({ isFollower: true, followCheckedAt: NOW0 - FOLLOW_TTL_MS + 1000, followBroadcasterId: BID });
    await processJwt(fresh, { trigger: "update", updateHint: { trigger: "follower-ttl" } }, deps);
    expect(calls).toHaveLength(0);
    const stale = baseToken({ isFollower: true, followCheckedAt: NOW0 - FOLLOW_TTL_MS, followBroadcasterId: BID });
    await processJwt(stale, { trigger: "update", updateHint: { trigger: "follower-ttl" } }, deps);
    expect(calls.filter((c) => c.startsWith(HELIX_FOLLOWED))).toHaveLength(1);
    expect(stale.followCheckedAt).toBe(NOW0);
  });

  it("TTL trigger during an outage backs off (no retry loop within 5 minutes)", async () => {
    const { deps, calls, advance } = makeDeps({ [HELIX_FOLLOWED]: () => json(503, {}) });
    const token = baseToken({ isFollower: true, followCheckedAt: NOW0 - 30 * 3600_000, followBroadcasterId: BID });
    const helix = () => calls.filter((c) => c.startsWith(HELIX_FOLLOWED)).length;
    await processJwt(token, { trigger: "update", updateHint: { trigger: "follower-ttl" } }, deps);
    const afterFirst = helix(); // one operation = up to 2 fetch attempts (retry on 5xx)
    expect(afterFirst).toBeGreaterThanOrEqual(1);
    expect(afterFirst).toBeLessThanOrEqual(2);
    advance(60_000);
    await processJwt(token, { trigger: "update", updateHint: { trigger: "follower-ttl" } }, deps);
    expect(helix()).toBe(afterFirst); // backoff: no new operation within 5 minutes
    advance(5 * 60_000);
    await processJwt(token, { trigger: "update", updateHint: { trigger: "follower-ttl" } }, deps);
    expect(helix()).toBeGreaterThan(afterFirst);
  });

  it("manual recheck is throttled to one per 5 seconds (JWT-local + shared throttle)", async () => {
    const { deps, calls, advance } = makeDeps({ [HELIX_FOLLOWED]: () => json(200, { data: [] }) });
    const token = baseToken();
    await processJwt(token, { trigger: "update", updateHint: { trigger: "follower-recheck" } }, deps);
    advance(1000);
    await processJwt(token, { trigger: "update", updateHint: { trigger: "follower-recheck" } }, deps);
    expect(calls.filter((c) => c.startsWith(HELIX_FOLLOWED))).toHaveLength(1);
    const throttled = makeDeps({ [HELIX_FOLLOWED]: () => json(200, { data: [] }) }, { throttleManual: async () => false });
    const t2 = baseToken();
    await processJwt(t2, { trigger: "update", updateHint: { trigger: "follower-recheck" } }, throttled.deps);
    expect(throttled.calls).toHaveLength(0);
  });

  it("hourly validation: wrong client_id / user_id → ReauthRequired; scope from validate is authoritative", async () => {
    const bad = makeDeps({ [VALIDATE]: () => json(200, { client_id: "other", user_id: "u1", scopes: ["user:read:follows"] }) });
    const t1 = baseToken({ tokenValidatedAt: NOW0 - 2 * 3600_000 });
    await processJwt(t1, { trigger: "update", updateHint: { trigger: "follower-recheck" } }, bad.deps);
    expect(t1.error).toBe("ReauthRequired");

    const noScope = makeDeps({ [VALIDATE]: () => json(200, { client_id: "cid", user_id: "u1", scopes: ["openid"] }), [HELIX_FOLLOWED]: () => json(200, { data: [] }) });
    const t2 = baseToken({ tokenValidatedAt: NOW0 - 2 * 3600_000 });
    await processJwt(t2, { trigger: "update", updateHint: { trigger: "follower-recheck" } }, noScope.deps);
    expect(t2.error).toBe("ReauthRequired");
    expect(noScope.calls.some((c) => c.startsWith(HELIX_FOLLOWED))).toBe(false);
  });

  it("followEnabled=false performs no Twitch calls (A17)", async () => {
    const { deps, calls } = makeDeps({ [HELIX_FOLLOWED]: () => json(200, { data: [] }) }, { followEnabled: false });
    const token = baseToken();
    await processJwt(token, { trigger: "update", updateHint: { trigger: "follower-recheck" } }, deps);
    expect(calls).toHaveLength(0);
  });

  it("sign-in for a different account drops previous evidence", async () => {
    const { deps } = makeDeps({
      "https://api.twitch.tv/helix/users": () => json(200, { data: [{ id: "u2", display_name: "B", login: "b" }] }),
      [HELIX_FOLLOWED]: () => json(200, { data: [] }),
    });
    const token = baseToken({ isFollower: true, followCheckedAt: NOW0 - 1000, followBroadcasterId: BID });
    await processJwt(token, { account: { access_token: "at2", refresh_token: "rt2", expires_at: Math.floor(NOW0 / 1000) + 3600, scope: "openid user:read:follows" }, trigger: "signIn" }, deps);
    expect(token.sub).toBe("u2");
    expect(token.isFollower).toBe(false);
    expect(token.followCheckedAt).toBe(NOW0);
  });
});
