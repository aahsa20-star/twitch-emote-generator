/**
 * Twitch follower / token helpers (R1b rewrite, 実装設計 §5).
 *
 * Pure-ish functions: no JWT reads/writes. The caller (src/auth.ts) decides
 * how to persist outcomes. Every network call has a hard timeout so the
 * whole re-verification stays under the 8s operation deadline.
 *
 * API: GET https://api.twitch.tv/helix/channels/followed?user_id=&broadcaster_id=
 *      (scope `user:read:follows`; NOT "Get Channel Followers").
 *
 * Outcomes:
 *  - following / not-following : definitive answer from Twitch (success)
 *  - unauthorized              : 401 — token revoked / scope missing → re-auth
 *  - temporary-error           : 429 / 5xx / network / timeout — never treated
 *                                as "not following"; caller keeps last success
 */

export type FollowerCheckResult =
  | { outcome: "following"; followedAt?: string }
  | { outcome: "not-following" }
  | { outcome: "unauthorized" }
  | {
      outcome: "temporary-error";
      error: "rate-limited" | "network" | "server" | "timeout" | "bad-response";
      retryAfterSec?: number;
    };

export interface FollowerCheckOptions {
  fetchImpl?: typeof fetch;
  /** Overall budget for this call (default 8000ms). */
  deadlineMs?: number;
  /** Per-attempt timeout (default 3000ms). */
  attemptTimeoutMs?: number;
  /** Max attempts including the first (default 2). */
  maxAttempts?: number;
  clientId?: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function parseRetryAfter(res: Response): number | undefined {
  const v = res.headers.get("retry-after");
  if (!v) return undefined;
  const n = Number(v);
  if (Number.isFinite(n) && n >= 0) return Math.ceil(n);
  const date = Date.parse(v);
  if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  return undefined;
}

/**
 * Check whether `userId` follows `broadcasterId`.
 */
export async function checkIsFollower(
  userAccessToken: string,
  userId: string,
  broadcasterId: string,
  opts: FollowerCheckOptions = {},
): Promise<FollowerCheckResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? defaultSleep;
  const deadlineMs = opts.deadlineMs ?? 8000;
  const attemptTimeoutMs = opts.attemptTimeoutMs ?? 3000;
  const maxAttempts = opts.maxAttempts ?? 2;
  const clientId = opts.clientId ?? process.env.AUTH_TWITCH_ID ?? "";
  const started = now();

  const url =
    "https://api.twitch.tv/helix/channels/followed?user_id=" +
    encodeURIComponent(userId) +
    "&broadcaster_id=" +
    encodeURIComponent(broadcasterId);
  const headers = { Authorization: `Bearer ${userAccessToken}`, "Client-Id": clientId };

  let last: FollowerCheckResult = { outcome: "temporary-error", error: "network" };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const remaining = deadlineMs - (now() - started);
    if (remaining <= 0) return { outcome: "temporary-error", error: "timeout" };
    const timeout = Math.min(attemptTimeoutMs, remaining);

    try {
      const res = await fetchWithTimeout(fetchImpl, url, { headers }, timeout);

      if (res.status === 401) return { outcome: "unauthorized" };

      if (res.status === 429 || res.status >= 500) {
        const retryAfterSec = parseRetryAfter(res);
        last = {
          outcome: "temporary-error",
          error: res.status === 429 ? "rate-limited" : "server",
          retryAfterSec,
        };
      } else if (!res.ok) {
        // Other 4xx (e.g. 400 bad broadcaster id): not retryable, not a "no".
        return { outcome: "temporary-error", error: "bad-response" };
      } else {
        let json: unknown;
        try {
          json = await res.json();
        } catch {
          return { outcome: "temporary-error", error: "bad-response" };
        }
        const data = (json as { data?: Array<{ followed_at?: string; broadcaster_id?: string }> })?.data;
        if (!Array.isArray(data)) return { outcome: "temporary-error", error: "bad-response" };
        const hit = data.find((d) => !d.broadcaster_id || d.broadcaster_id === broadcasterId);
        return hit ? { outcome: "following", followedAt: hit.followed_at } : { outcome: "not-following" };
      }
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      last = { outcome: "temporary-error", error: aborted ? "timeout" : "network" };
    }

    if (attempt < maxAttempts) {
      const remainingAfter = deadlineMs - (now() - started);
      const wantWait = last.outcome === "temporary-error" && last.retryAfterSec !== undefined
        ? last.retryAfterSec * 1000
        : 500;
      if (wantWait > remainingAfter - attemptTimeoutMs / 2) {
        // Waiting would blow the deadline: report the retry hint instead.
        return last;
      }
      await sleep(Math.min(wantWait, 2000));
    }
  }
  return last;
}

export type TokenValidation =
  | { ok: true; clientId: string; userId: string; scopes: string[]; expiresInSec: number }
  | { ok: false; reason: "unauthorized" | "temporary-error" | "bad-response" };

/**
 * GET https://id.twitch.tv/oauth2/validate — Twitch requires apps to validate
 * user tokens hourly. Independent from the follower TTL (仕様書 §6).
 */
export async function validateTwitchToken(
  userAccessToken: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<TokenValidation> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchWithTimeout(
      fetchImpl,
      "https://id.twitch.tv/oauth2/validate",
      { headers: { Authorization: `OAuth ${userAccessToken}` } },
      opts.timeoutMs ?? 3000,
    );
    if (res.status === 401) return { ok: false, reason: "unauthorized" };
    if (!res.ok) return { ok: false, reason: "temporary-error" };
    const j = (await res.json()) as {
      client_id?: string; user_id?: string; scopes?: string[]; expires_in?: number;
    };
    if (!j || typeof j.client_id !== "string" || typeof j.user_id !== "string") {
      return { ok: false, reason: "bad-response" };
    }
    return {
      ok: true,
      clientId: j.client_id,
      userId: j.user_id,
      scopes: Array.isArray(j.scopes) ? j.scopes : [],
      expiresInSec: typeof j.expires_in === "number" ? j.expires_in : 0,
    };
  } catch {
    return { ok: false, reason: "temporary-error" };
  }
}
