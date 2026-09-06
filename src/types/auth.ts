/**
 * Authentication / access-control shared types (R1b: フォロー解放 + 署名付き合言葉).
 *
 * - `AccessSnapshot` is the PUBLIC, client-safe access state. It never carries
 *   tokens, secrets, cookie values or the passphrase digest.
 * - `*Evidence` types are the verified server-side inputs to the pure
 *   `evaluateAccess()` (src/lib/auth/evaluate-access.ts).
 * - `FeatureFlags` is the env-var killswitch evaluation result.
 * - The `next-auth` / `next-auth/jwt` module augmentations persist Twitch
 *   tokens and follower evidence in the JWT (HttpOnly, encrypted cookie).
 */

import type { DefaultSession } from "next-auth";
import "next-auth/jwt";

/** Result of the most recent follower judgement, as shown to the UI. */
export type FollowerStatus =
  | "following"
  | "not-following"
  | "unknown"
  | "temporary-error"
  | "reauth-required";

/** Twitch identity (本人認証) state, independent from access grants. */
export type IdentityStatus =
  | "anonymous"
  | "authenticated"
  | "unavailable"
  | "reauth-required";

/** Why the creator/download surface is unlocked. */
export type AccessGrant = "follower" | "passphrase" | "emergency";

/**
 * Coarse tier:
 * - "unlocked": at least one grant → full creator + downloads
 * - "locked":   SITE_LOCK_ENABLED and no grant → SiteGate only
 * - "trial":    SITE_LOCK_ENABLED=false and no grant → legacy trial restrictions
 */
export type AccessTier = "unlocked" | "locked" | "trial";

/** Error markers persisted in the JWT and surfaced to the client. */
/**
 * - RefreshTokenError : refresh token rejected → re-login required
 * - ReauthRequired    : Twitch reported the token invalid / wrong client / scope → re-login
 * - TokenTemporaryError: refresh / validate could not complete (network) → retry later
 * - FollowCheckError  : follower query temporarily failed; last success kept
 */
export type SessionError =
  | "RefreshTokenError"
  | "ReauthRequired"
  | "TokenTemporaryError"
  | "FollowCheckError";

/**
 * Public access snapshot returned by `GET /api/access` and passed from the
 * Server Component (page.tsx) to the client as initial state.
 */
export interface AccessSnapshot {
  isUnlocked: boolean;
  tier: AccessTier;
  grants: AccessGrant[];
  identityStatus: IdentityStatus;
  followerStatus: FollowerStatus;
  /** Unix ms of the last SUCCESSFUL follower query (either outcome). */
  followerCheckedAt?: number;
  /** Unix ms until which a temporary Twitch outage keeps the follower grant. */
  followerGraceUntil?: number;
  /** True when the client should trigger a TTL re-verification (24h elapsed / unknown). */
  followerRecheckDue: boolean;
  /**
   * True when the last confirmed result was "following" but it is older than
   * 24h and no server-confirmed temporary-failure evidence exists yet: the
   * grant is withheld ("確認中") until a re-verification completes. The
   * creator UI stays mounted; protected operations wait for the recheck.
   */
  followerPending: boolean;
  /** Unix ms when the passphrase cookie expires (only when the grant is present). */
  passphraseExpiresAt?: number;
  /** Logged-in session lacks `user:read:follows` or the token needs re-authorization. */
  needsReauth: boolean;
  siteGateEnabled: boolean;
  followEnabled: boolean;
  /** Public profile for display. Never contains tokens. */
  user?: { name?: string | null; image?: string | null; login?: string | null } | null;
  /** Server clock (Unix ms) at evaluation time; lets the client show relative times. */
  evaluatedAt: number;
}

/** Verified passphrase-cookie evidence (output of verifyPassphraseToken). */
export interface PassphraseEvidence {
  valid: boolean;
  expiresAt?: number;
}

/** Verified Twitch identity evidence (derived from the Auth.js session). */
export interface IdentityEvidence {
  status: IdentityStatus;
  userId?: string;
  scope?: string;
  error?: SessionError;
  user?: { name?: string | null; image?: string | null; login?: string | null } | null;
}

/** Follower evidence (derived from the JWT; all fields server-written). */
export interface FollowerEvidence {
  /** Outcome of the last SUCCESSFUL query. */
  lastOutcome?: "following" | "not-following";
  /** Unix ms of the last successful query. */
  checkedAt?: number;
  /** Unix ms of the last attempted query (success or failure). */
  attemptedAt?: number;
  /** Outcome of the last attempt (may differ from lastOutcome when it failed). */
  lastAttemptOutcome?: "following" | "not-following" | "temporary-error" | "unauthorized";
  /** Broadcaster id the evidence was computed against. */
  broadcasterId?: string;
  /** Twitch user id the evidence belongs to. */
  userId?: string;
}

/**
 * Environment-driven killswitches. Evaluated server-side via
 * `getFeatureFlags()` in `src/lib/auth/feature-flags.ts`.
 */
export interface FeatureFlags {
  /** fix14: サイト全体ロック。true で未解放の新規アクセスは SiteGate。 */
  SITE_LOCK_ENABLED: boolean;
  /** false = 明示的な全解放（緊急設定）。本人認証が必要な操作の認証は外れない。 */
  TRIAL_MODE_ENABLED: boolean;
  /** true でフォロー経路を許可。false なら合言葉経路のみ（照会・CTA も停止）。 */
  FOLLOW_AUTH_ENABLED: boolean;
  /** @deprecated 現コードで実効なし。互換のため読み取るだけ。 */
  PREMIUM_LOCK_ENABLED: boolean;
  /** false = アプリの保存権限ゲートのみ解除。入力検証は維持。 */
  DOWNLOAD_LOCK_ENABLED: boolean;
}

/**
 * next-auth Session augmentation: the client-visible user object.
 * access_token / refresh_token are NEVER exposed here.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      login?: string;
      /** Last successful follower outcome (false when unknown). */
      isFollower: boolean;
      followerStatus: FollowerStatus;
      followCheckedAt?: number;
      followAttemptedAt?: number;
      followAttemptOutcome?: "following" | "not-following" | "temporary-error" | "unauthorized";
      followBroadcasterId?: string;
      scope: string;
      error?: SessionError;
    } & DefaultSession["user"];
  }
}

/**
 * next-auth JWT augmentation. JWT lives only in an HttpOnly encrypted cookie;
 * never expose `access_token` / `refresh_token` through the session.
 */
declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    name?: string;
    login?: string;
    picture?: string;

    // OAuth tokens (server-only)
    access_token?: string;
    refresh_token?: string;
    /** Unix epoch seconds when access_token expires. */
    expires_at?: number;
    /** Space-separated granted scope string from Twitch. */
    scope?: string;
    /** Unix ms of the last successful /oauth2/validate. */
    tokenValidatedAt?: number;

    // Follower evidence (server-written only)
    /** Outcome of the last successful query. */
    isFollower?: boolean;
    /** Unix ms of the last successful query. */
    followCheckedAt?: number;
    /** Unix ms of the last attempted query. */
    followAttemptedAt?: number;
    followAttemptOutcome?: "following" | "not-following" | "temporary-error" | "unauthorized";
    followBroadcasterId?: string;
    /** ISO 8601 string from Twitch (when isFollower=true). */
    followedAt?: string;

    // Error states
    error?: SessionError;
  }
}
