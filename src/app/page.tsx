import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getFeatureFlags } from "@/lib/auth/feature-flags";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/passphrase-token";
import { resolveAccess } from "@/lib/auth/resolve-access";
import HomeClient from "@/components/HomeClient";
import SiteGate from "@/components/SiteGate";

/**
 * Site-wide gate (fix14 → R1b).
 *
 * Server Component: evaluates the signed passphrase cookie first (offline),
 * then the Twitch session only when needed. Unlocked → HomeClient, otherwise
 * SiteGate. The public AccessSnapshot is passed down as initial client state.
 *
 * The follower TTL re-verification is NOT done here (RSC cannot persist the
 * refreshed JWT cookie); the client triggers it through
 * `useSession().update()` when `followerRecheckDue` is set.
 *
 * 解除手順（緊急時）: Vercel で SITE_LOCK_ENABLED=false → ゲート撤去（trial 縮退）、
 * FOLLOW_AUTH_ENABLED=false → 合言葉経路のみ、TRIAL_MODE_ENABLED=false → 全解放。
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const flags = getFeatureFlags();
  const cookieStore = await cookies();
  const access = await resolveAccess({
    accessCookie: cookieStore.get(ACCESS_COOKIE_NAME)?.value,
    getSession: auth,
    skipSessionWhenPassphraseValid: true,
    flags,
  });

  // followerPending: last confirmed "following" is older than 24h and not yet
  // re-verified. Render the creator so the client can re-verify in place
  // ("確認中"); protected operations wait for the result (04 指示).
  if (flags.SITE_LOCK_ENABLED && !access.isUnlocked && !access.followerPending) {
    return <SiteGate initialAccess={access} />;
  }

  return <HomeClient initialAccess={access} />;
}
