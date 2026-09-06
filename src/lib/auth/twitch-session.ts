/**
 * Twitch token / follower evidence processing for the Auth.js jwt callback
 * (extracted from src/auth.ts in コミット B so it can be unit-tested with a
 * mocked fetch — 04 指示「実OAuth検証とモック検証を分けて報告する」).
 *
 * Invariants:
 *  - Everything the client sends to `useSession().update(data)` is treated as
 *    a *trigger* only (`data.trigger` ∈ {"follower-recheck","follower-ttl"}).
 *    Client-supplied isFollower / timestamps / ids are ignored.
 *  - Token repair (refresh) runs BEFORE any follower query.
 *  - A 401 from Twitch triggers one refresh + retry; a second 401 marks
 *    ReauthRequired. 400/401 on refresh are permanent; 429/5xx/timeouts are
 *    temporary and never overwrite the last successful follower result.
 *  - `followCheckedAt` moves only on a successful query (either outcome);
 *    `followAttemptedAt` moves on every attempt.
 *  - The whole update operation shares an 8s deadline.
 */
import type { JWT } from "next-auth/jwt";
import { checkIsFollower, validateTwitchToken } from "@/lib/twitch/follower-check";
import { FOLLOW_TTL_MS, FOLLOWS_SCOPE } from "./evaluate-access";

export const OPERATION_DEADLINE_MS = 8000;
export const TOKEN_VALIDATE_INTERVAL_MS = 60 * 60 * 1000; // Twitch: validate hourly
export const MANUAL_RECHECK_MIN_INTERVAL_MS = 5000;
/** During an outage, TTL-triggered attempts are spaced at least this far apart. */
export const TTL_RETRY_MIN_INTERVAL_MS = 5 * 60 * 1000;
const REFRESH_SKEW_SEC = 60;

export interface TwitchSessionDeps {
  fetch: typeof fetch;
  now: () => number;
  clientId: string;
  clientSecret: string;
  broadcasterId: string | undefined;
  followEnabled: boolean;
  /** Instance-local throttle for manual rechecks; return false to skip. */
  throttleManual: (userId: string) => Promise<boolean>;
  log?: (msg: string, ...rest: unknown[]) => void;
}

export interface JwtContext {
  account?: { access_token?: string; refresh_token?: string; expires_at?: number; expires_in?: number; scope?: string | string[] } | null;
  trigger?: "signIn" | "signUp" | "update" | string;
  updateHint?: unknown;
}

type RefreshResult = { ok: true } | { ok: false; permanent: boolean };

async function refreshTwitchToken(token: JWT, timeoutMs: number, deps: TwitchSessionDeps): Promise<RefreshResult> {
  if (!token.refresh_token) return { ok: false, permanent: true };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await deps.fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: deps.clientId,
        client_secret: deps.clientSecret,
        grant_type: "refresh_token",
        refresh_token: token.refresh_token,
      }),
      signal: ctrl.signal,
    });
    if (res.status === 400 || res.status === 401) return { ok: false, permanent: true };
    if (!res.ok) return { ok: false, permanent: false };
    const j = (await res.json()) as {
      access_token?: string; refresh_token?: string; expires_in?: number; scope?: string | string[];
    };
    if (!j.access_token) return { ok: false, permanent: false };
    token.access_token = j.access_token;
    token.refresh_token = j.refresh_token ?? token.refresh_token;
    token.expires_at = Math.floor(deps.now() / 1000) + (j.expires_in ?? 3600);
    if (j.scope) token.scope = Array.isArray(j.scope) ? j.scope.join(" ") : j.scope;
    return { ok: true };
  } catch {
    return { ok: false, permanent: false };
  } finally {
    clearTimeout(t);
  }
}

function tokenExpired(token: JWT, now: number): boolean {
  return !!token.expires_at && now >= (token.expires_at - REFRESH_SKEW_SEC) * 1000;
}

/** Repair an expired access token. Returns false when the identity cannot be used. */
export async function ensureFreshToken(token: JWT, deadline: number, deps: TwitchSessionDeps): Promise<boolean> {
  if (!token.access_token) {
    token.error = "RefreshTokenError";
    return false;
  }
  if (token.error === "RefreshTokenError" || token.error === "ReauthRequired") return false;
  if (!tokenExpired(token, deps.now())) {
    if (token.error === "TokenTemporaryError") delete token.error;
    return true;
  }
  const remaining = deadline - deps.now();
  if (remaining < 500) {
    token.error = "TokenTemporaryError";
    return false;
  }
  const r = await refreshTwitchToken(token, Math.min(3000, remaining), deps);
  if (r.ok) {
    if (token.error === "TokenTemporaryError") delete token.error;
    return true;
  }
  token.error = r.permanent ? "RefreshTokenError" : "TokenTemporaryError";
  return false;
}

export function readUpdateTrigger(hint: unknown): "follower-recheck" | "follower-ttl" | null {
  if (!hint || typeof hint !== "object") return null;
  const t = (hint as { trigger?: unknown }).trigger;
  return t === "follower-recheck" || t === "follower-ttl" ? t : null;
}

async function runFollowerCheck(token: JWT, deadline: number, allowRefreshRetry: boolean, deps: TwitchSessionDeps): Promise<void> {
  const now = deps.now();
  token.followAttemptedAt = now;
  const result = await checkIsFollower(token.access_token!, token.sub!, deps.broadcasterId!, {
    fetchImpl: deps.fetch,
    clientId: deps.clientId,
    now: deps.now,
    deadlineMs: Math.max(1000, deadline - now),
  });

  if (result.outcome === "following" || result.outcome === "not-following") {
    token.isFollower = result.outcome === "following";
    token.followCheckedAt = deps.now();
    token.followedAt = result.outcome === "following" ? result.followedAt : undefined;
    token.followBroadcasterId = deps.broadcasterId;
    token.followAttemptOutcome = result.outcome;
    if (token.error === "FollowCheckError") delete token.error;
    return;
  }

  if (result.outcome === "unauthorized") {
    if (allowRefreshRetry && token.refresh_token && deadline - deps.now() > 1500) {
      const r = await refreshTwitchToken(token, Math.min(3000, deadline - deps.now()), deps);
      if (r.ok) return runFollowerCheck(token, deadline, false, deps);
      token.error = r.permanent ? "RefreshTokenError" : "TokenTemporaryError";
    } else {
      token.error = "ReauthRequired";
    }
    token.followAttemptOutcome = "unauthorized";
    return;
  }

  // temporary-error: keep the last successful result untouched
  token.followAttemptOutcome = "temporary-error";
  if (!token.error) token.error = "FollowCheckError";
}

function applyValidation(token: JWT, v: { clientId: string; userId: string; scopes: string[] }, deps: TwitchSessionDeps): boolean {
  if (v.clientId !== deps.clientId || (token.sub && v.userId !== token.sub)) {
    token.error = "ReauthRequired";
    token.followAttemptOutcome = "unauthorized";
    return false;
  }
  token.scope = v.scopes.join(" ");
  token.tokenValidatedAt = deps.now();
  return true;
}

/** Hourly /oauth2/validate. Returns false when the token must not be used. */
async function validateIfDue(token: JWT, deadline: number, deps: TwitchSessionDeps): Promise<boolean> {
  const now = deps.now();
  if (token.tokenValidatedAt && now - token.tokenValidatedAt < TOKEN_VALIDATE_INTERVAL_MS) return true;
  if (deadline - now < 1000) return true;
  const v = await validateTwitchToken(token.access_token!, { fetchImpl: deps.fetch, timeoutMs: Math.min(3000, deadline - now) });
  if (!v.ok) {
    if (v.reason === "unauthorized") {
      const r = await refreshTwitchToken(token, Math.min(3000, deadline - deps.now()), deps);
      if (r.ok) {
        const v2 = await validateTwitchToken(token.access_token!, { fetchImpl: deps.fetch, timeoutMs: 2000 });
        if (v2.ok) return applyValidation(token, v2, deps);
      }
      token.error = r.ok ? "ReauthRequired" : r.permanent ? "RefreshTokenError" : "TokenTemporaryError";
      token.followAttemptOutcome = "unauthorized";
      return false;
    }
    return true; // temporary / bad-response → try again later
  }
  return applyValidation(token, v, deps);
}

export async function handleFollowerUpdate(
  token: JWT,
  mode: "follower-recheck" | "follower-ttl",
  deadline: number,
  deps: TwitchSessionDeps,
): Promise<void> {
  if (!deps.followEnabled) return; // A17: no queries when the path is off
  if (!deps.broadcasterId) {
    deps.log?.("[auth] AUTH_TWITCH_BROADCASTER_ID not set — follower judgement skipped");
    return;
  }
  if (!token.sub) return;

  const now = deps.now();
  const cacheMatches = token.followBroadcasterId === deps.broadcasterId;

  if (mode === "follower-ttl") {
    if (cacheMatches && typeof token.followCheckedAt === "number" && now - token.followCheckedAt < FOLLOW_TTL_MS) {
      return; // fresh enough
    }
    if (
      typeof token.followAttemptedAt === "number" &&
      now - token.followAttemptedAt < TTL_RETRY_MIN_INTERVAL_MS &&
      token.followAttemptOutcome === "temporary-error"
    ) {
      return; // outage backoff
    }
  } else {
    if (typeof token.followAttemptedAt === "number" && now - token.followAttemptedAt < MANUAL_RECHECK_MIN_INTERVAL_MS) {
      return; // throttle (JWT-local)
    }
    if (!(await deps.throttleManual(token.sub))) return;
  }

  if (!(await ensureFreshToken(token, deadline, deps))) return;
  if (!(await validateIfDue(token, deadline, deps))) return;
  if (!token.scope?.includes(FOLLOWS_SCOPE)) {
    token.error = "ReauthRequired";
    token.followAttemptOutcome = "unauthorized";
    return;
  }
  await runFollowerCheck(token, deadline, true, deps);
}

/**
 * The jwt callback body. Mutates and returns `token`.
 */
export async function processJwt(token: JWT, ctx: JwtContext, deps: TwitchSessionDeps): Promise<JWT> {
  const deadline = deps.now() + OPERATION_DEADLINE_MS;

  // ---------- Initial sign-in ----------
  if (ctx.account?.access_token) {
    const account = ctx.account;
    const accessToken = account.access_token!;
    token.access_token = accessToken;
    token.refresh_token = account.refresh_token;
    token.expires_at =
      account.expires_at ?? Math.floor(deps.now() / 1000) + (account.expires_in ?? 3600);
    const rawScope = account.scope;
    token.scope = Array.isArray(rawScope) ? rawScope.join(" ") : (rawScope ?? "");
    delete token.error;
    // Fresh identity: drop any evidence from a previous account on this browser.
    delete token.isFollower;
    delete token.followCheckedAt;
    delete token.followAttemptedAt;
    delete token.followAttemptOutcome;
    delete token.followBroadcasterId;
    delete token.followedAt;
    token.tokenValidatedAt = deps.now();

    try {
      const res = await deps.fetch("https://api.twitch.tv/helix/users", {
        headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": deps.clientId },
        signal: AbortSignal.timeout(3000),
      });
      const data = await res.json();
      const user = data?.data?.[0];
      if (user) {
        token.sub = user.id;
        token.name = user.display_name;
        token.login = user.login;
        token.picture = user.profile_image_url;
      }
    } catch (e) {
      deps.log?.("Twitch /helix/users error:", e);
    }

    try {
      if (deps.followEnabled && deps.broadcasterId && token.sub && token.scope?.includes(FOLLOWS_SCOPE)) {
        await runFollowerCheck(token, deadline, false, deps);
      }
    } catch (e) {
      deps.log?.("[auth] initial follower check failed:", e);
    }
    return token;
  }

  // ---------- Subsequent calls ----------
  try {
    await ensureFreshToken(token, deadline, deps);
    if (ctx.trigger === "update") {
      const mode = readUpdateTrigger(ctx.updateHint);
      if (mode) await handleFollowerUpdate(token, mode, deadline, deps);
    }
  } catch (e) {
    deps.log?.("[auth] jwt callback error:", e);
  }
  return token;
}
