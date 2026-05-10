/**
 * Premium gating evaluation — the single source of truth for "can this
 * user use feature X?" used by every UI component and the server-side
 * download-check API.
 *
 * Inputs are passed explicitly to keep this pure and testable:
 * - `session`: Twitch session (next-auth). May be null when logged out.
 * - `isSubscribed`: PASSPHRASE-derived legacy premium flag. Source-of-truth
 *   varies by caller (localStorage on client, signed cookie on server).
 *   Caller is responsible for resolving and passing it in.
 * - `flags`: FeatureFlags from `getFeatureFlags()` (server-only env eval).
 *
 * The PASSPHRASE/server-cookie integration is intentionally NOT inlined
 * here — it lives at the call site so this function stays a pure
 * "given inputs A, B, C, what tier?" decision.
 */

import type { Session } from "next-auth";
import type { AccessState, FeatureFlags } from "@/types/auth";

export interface EvaluateAccessArgs {
  session: Session | null | undefined;
  /** PASSPHRASE-validated premium flag (legacy compat). */
  isSubscribed: boolean;
  flags: FeatureFlags;
}

/**
 * Resolve the access state for the given inputs.
 *
 * Killswitch precedence:
 *   1. TRIAL_MODE_ENABLED=false → everyone is premium (full retreat)
 *   2. FOLLOW_AUTH_ENABLED=false → ignore follower judgement, fall back to
 *      PASSPHRASE-only path
 *   3. Normal: isPremium = isFollower || isSubscribed
 *
 * needsReauth detection:
 *   A logged-in user whose JWT does NOT contain `user:read:follows` scope
 *   (legacy session pre-fix7) needs to re-authenticate to enable follower
 *   judgement. UI surfaces this via ReauthBanner.
 */
export function evaluateAccess(args: EvaluateAccessArgs): AccessState {
  const { session, isSubscribed, flags } = args;
  const isLoggedIn = !!session?.user;

  // Pull follower fields from session (auth.ts session callback exposes these)
  const sessionUser = session?.user as
    | (Session["user"] & {
        isFollower?: boolean;
        scope?: string;
        error?: string;
      })
    | undefined;
  const sessionFollower = sessionUser?.isFollower ?? false;
  const sessionScope = sessionUser?.scope ?? "";
  const isFollower = flags.FOLLOW_AUTH_ENABLED ? sessionFollower : false;

  // Stale session detection: logged in but lacks the new scope
  const hasFollowsScope = sessionScope.includes("user:read:follows");
  const needsReauth = isLoggedIn && !hasFollowsScope;

  // Killswitch 1: full retreat — everyone gets premium UI
  if (!flags.TRIAL_MODE_ENABLED) {
    return {
      isPremium: true,
      tier: "premium",
      reason: "killswitch-disabled",
      needsReauth,
      isLoggedIn,
      isFollower,
      isSubscribed,
    };
  }

  // Normal evaluation: OR of follower AND passphrase
  const isPremium = isFollower || isSubscribed;
  const tier: "trial" | "premium" = isPremium ? "premium" : "trial";

  let reason: AccessState["reason"];
  if (isFollower) reason = "follower";
  else if (isSubscribed) reason = "passphrase";
  else reason = "trial";

  return {
    isPremium,
    tier,
    reason,
    needsReauth,
    isLoggedIn,
    isFollower,
    isSubscribed,
  };
}
