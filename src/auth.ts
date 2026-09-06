import NextAuth from "next-auth";
import Twitch from "next-auth/providers/twitch";
// Side-effect import for next-auth / next-auth/jwt module augmentation.
import "@/types/auth";
import { getFeatureFlags } from "@/lib/auth/feature-flags";
import { consumeRateLimit, rateLimitKey } from "@/lib/auth/rate-limit";
import { processJwt, type TwitchSessionDeps } from "@/lib/auth/twitch-session";

/**
 * Auth.js v5 + Twitch OAuth (JWT strategy).
 *
 * The token / follower logic lives in `src/lib/auth/twitch-session.ts`
 * (コミット B: unit-tested with a mocked fetch). This file only wires env
 * and Auth.js callbacks. `getToken()` is never used (fix7.2).
 */
function deps(): TwitchSessionDeps {
  return {
    fetch,
    now: Date.now,
    clientId: process.env.AUTH_TWITCH_ID ?? "",
    clientSecret: process.env.AUTH_TWITCH_SECRET ?? "",
    broadcasterId: process.env.AUTH_TWITCH_BROADCASTER_ID || undefined,
    followEnabled: getFeatureFlags().FOLLOW_AUTH_ENABLED,
    throttleManual: async (userId) => {
      // Instance-local throttle (best effort; not shared across instances).
      const rl = await consumeRateLimit({ key: rateLimitKey("follow-recheck", userId), limit: 1, windowSec: 5 });
      return rl.allowed;
    },
    log: (msg, ...rest) => console.error(msg, ...rest),
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Twitch({
      clientId: process.env.AUTH_TWITCH_ID,
      clientSecret: process.env.AUTH_TWITCH_SECRET,
      authorization: {
        params: {
          scope: "openid user:read:email user:read:follows",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, trigger, session: updateHint }) {
      return processJwt(
        token,
        {
          account: account
            ? {
                access_token: account.access_token,
                refresh_token: account.refresh_token as string | undefined,
                expires_at: account.expires_at as number | undefined,
                expires_in: account.expires_in as number | undefined,
                scope: account.scope as string | string[] | undefined,
              }
            : null,
          trigger,
          updateHint,
        },
        deps(),
      );
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? token.id) as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string | undefined;
        session.user.login = token.login;
        // Server-written evidence only — never tokens.
        session.user.isFollower = token.isFollower ?? false;
        session.user.followCheckedAt = token.followCheckedAt;
        session.user.followAttemptedAt = token.followAttemptedAt;
        session.user.followAttemptOutcome = token.followAttemptOutcome;
        session.user.followBroadcasterId = token.followBroadcasterId;
        session.user.scope = token.scope ?? "";
        session.user.followerStatus =
          token.error === "ReauthRequired" || token.error === "RefreshTokenError"
            ? "reauth-required"
            : typeof token.followCheckedAt === "number"
              ? token.isFollower ? "following" : "not-following"
              : token.followAttemptOutcome === "temporary-error"
                ? "temporary-error"
                : "unknown";
        if (token.error) session.user.error = token.error;
        else delete session.user.error;
      }
      return session;
    },
  },
});
