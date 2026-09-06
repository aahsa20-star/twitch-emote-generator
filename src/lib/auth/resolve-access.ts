/**
 * Server-side access resolution (実装設計 §1 / §6).
 *
 * Order matters:
 *  1. feature flags (env)
 *  2. signed passphrase cookie — offline, no DB / no Twitch
 *  3. Twitch identity + follower evidence — only when a session getter is
 *     supplied; failures degrade to identityStatus="unavailable" and never
 *     take away a valid passphrase grant.
 *
 * `auth()` itself may perform a token refresh; that is Auth.js behaviour and
 * is bounded by the caller's context. This function never calls Twitch's
 * follower API — re-verification happens only through the persisted
 * `useSession().update()` path (see src/auth.ts).
 */
import "server-only";
import type { Session } from "next-auth";
import type {
  AccessSnapshot,
  FeatureFlags,
  FollowerEvidence,
  IdentityEvidence,
  PassphraseEvidence,
} from "@/types/auth";
import { getFeatureFlags } from "./feature-flags";
import { evaluateAccess } from "./evaluate-access";
import { getPassphraseConfig, verifyPassphraseToken } from "./passphrase-token";

export interface ResolveAccessOptions {
  /** Raw value of the `emote-access-v1` cookie, if any. */
  accessCookie: string | undefined;
  /** Session getter (e.g. `auth`). Omit to evaluate the passphrase path only. */
  getSession?: () => Promise<Session | null>;
  /**
   * When true and the passphrase grant is valid, the session is not resolved
   * (identityStatus="anonymous"). Use for the gate decision on page.tsx where
   * a Twitch hiccup must not delay a passphrase user (仕様書 §7).
   */
  skipSessionWhenPassphraseValid?: boolean;
  flags?: FeatureFlags;
  now?: number;
}

export function passphraseEvidenceFromCookie(
  cookieValue: string | undefined,
  now: number,
): PassphraseEvidence {
  const cfg = getPassphraseConfig();
  if (!cfg.ok) return { valid: false };
  const v = verifyPassphraseToken(cookieValue, cfg.key, now);
  return v.ok ? { valid: true, expiresAt: v.expiresAtMs } : { valid: false };
}

export function evidenceFromSession(session: Session | null | undefined): {
  identity: IdentityEvidence;
  follower: FollowerEvidence;
} {
  const u = session?.user;
  if (!u?.id) {
    return { identity: { status: "anonymous" }, follower: {} };
  }
  const reauth = u.error === "RefreshTokenError" || u.error === "ReauthRequired";
  const identity: IdentityEvidence = {
    status: reauth ? "reauth-required" : "authenticated",
    userId: u.id,
    scope: u.scope ?? "",
    error: u.error,
    user: { name: u.name ?? null, image: u.image ?? null, login: u.login ?? null },
  };
  const follower: FollowerEvidence = {
    lastOutcome:
      typeof u.followCheckedAt === "number" ? (u.isFollower ? "following" : "not-following") : undefined,
    checkedAt: typeof u.followCheckedAt === "number" ? u.followCheckedAt : undefined,
    attemptedAt: typeof u.followAttemptedAt === "number" ? u.followAttemptedAt : undefined,
    lastAttemptOutcome: u.followAttemptOutcome,
    broadcasterId: u.followBroadcasterId,
    userId: u.id,
  };
  return { identity, follower };
}

export async function resolveAccess(opts: ResolveAccessOptions): Promise<AccessSnapshot> {
  const now = opts.now ?? Date.now();
  const flags = opts.flags ?? getFeatureFlags();
  const passphrase = passphraseEvidenceFromCookie(opts.accessCookie, now);

  let identity: IdentityEvidence = { status: "anonymous" };
  let follower: FollowerEvidence = {};

  const skipSession = opts.skipSessionWhenPassphraseValid && passphrase.valid;
  if (opts.getSession && !skipSession) {
    try {
      const session = await opts.getSession();
      ({ identity, follower } = evidenceFromSession(session));
    } catch (e) {
      console.error("[resolve-access] session unavailable:", e instanceof Error ? e.message : e);
      identity = { status: "unavailable" };
    }
  }

  return evaluateAccess({
    flags,
    now,
    passphrase,
    identity,
    follower,
    expectedBroadcasterId: process.env.AUTH_TWITCH_BROADCASTER_ID || undefined,
  });
}
