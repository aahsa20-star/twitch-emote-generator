import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { checkIsFollower } from "@/lib/twitch/follower-check";

/**
 * POST /api/follower-recheck
 *
 * fix7.1: Server-side re-verification of follower status without a full
 * page reload. Replaces the previous `signIn("twitch")` round-trip in
 * FollowGateModal that was destroying the user's React state (uploaded
 * image, brush edits, EmoteConfig) on every "Follow check" click.
 *
 * Flow:
 *   1. Client clicks "フォロー済み・解除を確認"
 *   2. Client POSTs here → we read JWT directly via getToken (server-only;
 *      access_token is never exposed to the client per types/auth.ts:57)
 *   3. We call checkIsFollower with the existing access_token + 24h cache
 *   4. Return the result for granular UX messaging
 *   5. Client, on isFollower=true, calls useSession().update({}) — that
 *      triggers the jwt callback's `trigger === "update"` branch which
 *      re-verifies server-side (security: client-supplied isFollower in
 *      session payload is deliberately ignored)
 *
 * Response:
 *   200 + { isFollower: true, followedAt, source: "fresh" | "stale-cache" }
 *   200 + { isFollower: false, propagationLikely: true }   ← Twitch fresh "no"
 *   200 + { isFollower: false, source: "fail-safe" }       ← API down, no cache
 *   401 + { error: "unauthorized", needsSignin: true }     ← token revoked / scope lost
 *   401 + { error: "unauthenticated", needsSignin: true }  ← no session at all
 *   500 + { error: "broadcaster-id-missing" }              ← env var not set
 */
export async function POST(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    salt:
      process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
  });

  if (!token?.access_token || !token.sub) {
    return NextResponse.json(
      { error: "unauthenticated", needsSignin: true },
      { status: 401 },
    );
  }

  const broadcasterId = process.env.AUTH_TWITCH_BROADCASTER_ID;
  if (!broadcasterId) {
    console.error(
      "[follower-recheck] AUTH_TWITCH_BROADCASTER_ID not set — cannot verify",
    );
    return NextResponse.json(
      { error: "broadcaster-id-missing" },
      { status: 500 },
    );
  }

  const staleCache =
    typeof token.isFollower === "boolean" &&
    typeof token.followCheckedAt === "number"
      ? { isFollower: token.isFollower, checkedAt: token.followCheckedAt }
      : undefined;

  const result = await checkIsFollower(
    token.access_token,
    token.sub,
    broadcasterId,
    staleCache,
  );

  // Token failed (401 from Twitch) — user must re-OAuth.
  if (result.error === "unauthorized") {
    return NextResponse.json(
      { error: "unauthorized", needsSignin: true },
      { status: 401 },
    );
  }

  // Definitive "not follower" from a fresh API call.
  // Could be Twitch propagation lag right after a follow — surface that
  // possibility to the client for friendly messaging.
  const propagationLikely =
    result.isFollower === false && result.source === "fresh";

  return NextResponse.json({
    isFollower: result.isFollower ?? false,
    followedAt: result.followedAt,
    source: result.source,
    propagationLikely,
  });
}
