/**
 * Pure access evaluation — the single source of truth for
 * "is this request unlocked, and why?" (R1b → コミット B で猶予ルールを厳密化).
 *
 * No I/O, no clock reads, no cookies: every input is verified evidence passed
 * by the caller (`resolveAccess` on the server), plus an explicit `now`.
 *
 * Rules (04 指示「フォロー再確認の修正」):
 * - grants are OR-combined: follower OR passphrase OR emergency (TRIAL_MODE_ENABLED=false)
 * - a successful "following" result is valid for 24h.
 * - after 24h the stale result alone grants NOTHING. Only server-confirmed
 *   temporary-failure evidence (a re-verification attempted AFTER the last
 *   success, for the same user + broadcaster) extends the grant to at most
 *   48h after the last success. Without it the state is "pending": the
 *   creator stays mounted, protected operations wait for a recheck.
 * - a confirmed "not-following", a revoked/invalid token, or evidence for a
 *   different user / broadcaster never gets grace.
 * - evidence with missing ids, timestamps in the future, or checkedAt after
 *   attemptedAt is treated as absent.
 * - a valid passphrase is always OR-ed in; Twitch trouble never removes it.
 */

import type {
  AccessGrant,
  AccessSnapshot,
  AccessTier,
  FeatureFlags,
  FollowerEvidence,
  FollowerStatus,
  IdentityEvidence,
  PassphraseEvidence,
} from "@/types/auth";

export const FOLLOW_TTL_MS = 24 * 60 * 60 * 1000;
export const FOLLOW_GRACE_MS = 48 * 60 * 60 * 1000;
export const FOLLOWS_SCOPE = "user:read:follows";
/** Tolerated clock skew for evidence timestamps. */
const SKEW_MS = 60 * 1000;

export interface EvaluateAccessInput {
  flags: FeatureFlags;
  /** Unix ms. */
  now: number;
  passphrase: PassphraseEvidence;
  identity: IdentityEvidence;
  follower: FollowerEvidence;
  /** AUTH_TWITCH_BROADCASTER_ID; evidence for another broadcaster is ignored. */
  expectedBroadcasterId?: string;
}

interface FollowerResolution {
  status: FollowerStatus;
  granted: boolean;
  recheckDue: boolean;
  pending: boolean;
  graceUntil?: number;
  checkedAt?: number;
}

const NONE: FollowerResolution = { status: "unknown", granted: false, recheckDue: false, pending: false };

function validTimestamp(t: unknown, now: number): t is number {
  return typeof t === "number" && Number.isFinite(t) && t > 0 && t <= now + SKEW_MS;
}

function resolveFollower(input: EvaluateAccessInput): FollowerResolution {
  const { flags, now, identity, follower, expectedBroadcasterId } = input;

  if (!flags.FOLLOW_AUTH_ENABLED) {
    // A17: フォロー機能 OFF → 照会も CTA も止める（recheckDue=false）
    return NONE;
  }
  if (identity.status !== "authenticated") {
    const status: FollowerStatus =
      identity.status === "reauth-required" ? "reauth-required" : "unknown";
    return { ...NONE, status };
  }

  // Evidence must belong to this user and to the configured broadcaster.
  // Missing ids on either side = no evidence.
  const evidenceMatches =
    !!identity.userId &&
    !!follower.userId &&
    follower.userId === identity.userId &&
    (!expectedBroadcasterId || follower.broadcasterId === expectedBroadcasterId);
  if (!evidenceMatches) {
    return { ...NONE, recheckDue: true };
  }

  if (follower.lastAttemptOutcome === "unauthorized") {
    // Token explicitly failed at Twitch → re-authorization; no grace.
    return { ...NONE, status: "reauth-required" };
  }

  const hasSuccess = follower.lastOutcome !== undefined && validTimestamp(follower.checkedAt, now);
  const attemptedAt = validTimestamp(follower.attemptedAt, now) ? follower.attemptedAt : undefined;

  if (!hasSuccess) {
    const status: FollowerStatus =
      follower.lastAttemptOutcome === "temporary-error" ? "temporary-error" : "unknown";
    return { ...NONE, status, recheckDue: true };
  }

  const checkedAt = follower.checkedAt as number;
  const age = now - checkedAt;

  if (follower.lastOutcome === "not-following") {
    return { ...NONE, status: "not-following", recheckDue: age >= FOLLOW_TTL_MS, checkedAt };
  }

  // lastOutcome === "following"
  // Temporary-failure evidence counts only if the attempt happened after the
  // success it would extend (never a stale failure, never a client value).
  const tempFailureAfterSuccess =
    follower.lastAttemptOutcome === "temporary-error" &&
    attemptedAt !== undefined &&
    attemptedAt >= checkedAt;
  const graceUntil = checkedAt + FOLLOW_GRACE_MS;

  if (age < FOLLOW_TTL_MS) {
    return {
      status: tempFailureAfterSuccess ? "temporary-error" : "following",
      granted: true,
      recheckDue: false,
      pending: false,
      graceUntil,
      checkedAt,
    };
  }
  if (age < FOLLOW_GRACE_MS) {
    if (tempFailureAfterSuccess) {
      // Server-confirmed outage: keep the grant, keep retrying.
      return { status: "temporary-error", granted: true, recheckDue: true, pending: false, graceUntil, checkedAt };
    }
    // Stale success without outage evidence: withhold until re-verified.
    return { status: "following", granted: false, recheckDue: true, pending: true, checkedAt };
  }
  // Grace expired.
  return {
    status: tempFailureAfterSuccess ? "temporary-error" : "unknown",
    granted: false,
    recheckDue: true,
    pending: false,
    checkedAt,
  };
}

export function evaluateAccess(input: EvaluateAccessInput): AccessSnapshot {
  const { flags, now, passphrase, identity } = input;
  const grants: AccessGrant[] = [];

  const followerRes = resolveFollower(input);
  if (followerRes.granted) grants.push("follower");

  if (passphrase.valid && (passphrase.expiresAt === undefined || passphrase.expiresAt > now)) {
    grants.push("passphrase");
  }

  if (!flags.TRIAL_MODE_ENABLED) {
    // Explicit emergency release.
    grants.push("emergency");
  }

  const isUnlocked = grants.length > 0;
  const tier: AccessTier = isUnlocked ? "unlocked" : flags.SITE_LOCK_ENABLED ? "locked" : "trial";

  const scope = identity.scope ?? "";
  const needsReauth =
    identity.status === "reauth-required" ||
    (identity.status === "authenticated" && flags.FOLLOW_AUTH_ENABLED && !scope.includes(FOLLOWS_SCOPE));

  return {
    isUnlocked,
    tier,
    grants,
    identityStatus: identity.status,
    followerStatus: followerRes.status,
    followerCheckedAt: followerRes.checkedAt,
    followerGraceUntil: followerRes.granted ? followerRes.graceUntil : undefined,
    followerRecheckDue: followerRes.recheckDue,
    // A passphrase grant makes the pending state irrelevant for gating.
    followerPending: followerRes.pending && !isUnlocked,
    passphraseExpiresAt: grants.includes("passphrase") ? passphrase.expiresAt : undefined,
    needsReauth,
    siteGateEnabled: flags.SITE_LOCK_ENABLED,
    followEnabled: flags.FOLLOW_AUTH_ENABLED,
    user: identity.user ?? null,
    evaluatedAt: now,
  };
}
