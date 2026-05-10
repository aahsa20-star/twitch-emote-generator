/**
 * Authentication-related shared types for fix7 follower auth.
 *
 * - `AccessState` is the resolved gating state used by all UI / API code.
 * - `FeatureFlags` is the env-var killswitch evaluation result.
 * - The `next-auth/jwt` module augmentation persists Twitch tokens and the
 *   isFollower judgement in the JWT (HttpOnly cookie, server-only).
 */

import "next-auth/jwt";

/**
 * Resolved access state for a request.
 *
 * Computed by `evaluateAccess(session, flags)` in `src/lib/auth/premium.ts`.
 * UI components should consume this via `useSession()` + a small helper hook;
 * server code should call `evaluateAccess` directly.
 */
export interface AccessState {
  /** true if any premium gating path resolves (follower / passphrase / killswitch). */
  isPremium: boolean;
  /** Coarse tier label for UI branching. */
  tier: "trial" | "premium";
  /** Why the access state resolved to its current value. */
  reason: "follower" | "passphrase" | "trial" | "killswitch-disabled";
  /** True when the session lacks the new follower scope (legacy session pre-fix7). */
  needsReauth: boolean;
  /** True when a Twitch session is active (regardless of premium status). */
  isLoggedIn: boolean;
  /** Twitch follower judgement against AUTH_TWITCH_BROADCASTER_ID. */
  isFollower: boolean;
  /** PASSPHRASE-derived premium status (legacy compat). */
  isSubscribed: boolean;
}

/**
 * Environment-driven killswitches. Evaluated server-side via
 * `getFeatureFlags()` in `src/lib/auth/feature-flags.ts`.
 *
 * All four are independent. The most common emergency move is to flip
 * `DOWNLOAD_LOCK_ENABLED=false` first; `TRIAL_MODE_ENABLED=false` is the
 * full retreat that releases every gated feature.
 */
export interface FeatureFlags {
  /** Master killswitch for trial-mode restrictions. false = everyone is premium. */
  TRIAL_MODE_ENABLED: boolean;
  /** Master killswitch for follower-judgement code paths. */
  FOLLOW_AUTH_ENABLED: boolean;
  /** Lock the legacy subscriber-only features (animations, frames, custom border). */
  PREMIUM_LOCK_ENABLED: boolean;
  /** Lock 56/112px PNG and all GIF downloads behind premium. */
  DOWNLOAD_LOCK_ENABLED: boolean;
}

/**
 * next-auth JWT augmentation. JWT lives only in HttpOnly + signed cookie;
 * never expose `access_token` / `refresh_token` to the client through session.
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

    // Follower judgement
    isFollower?: boolean;
    /** Unix epoch ms when isFollower was last computed. */
    followCheckedAt?: number;
    /** ISO 8601 string from Twitch (when isFollower=true). */
    followedAt?: string;

    // Error states
    error?: "RefreshTokenError" | "FollowCheckError";
  }
}
