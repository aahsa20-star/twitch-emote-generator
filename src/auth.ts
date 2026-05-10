import NextAuth from "next-auth";
import Twitch from "next-auth/providers/twitch";
// Side-effect import for next-auth/jwt module augmentation.
import "@/types/auth";
import { checkIsFollower } from "@/lib/twitch/follower-check";

const TWITCH_BROADCASTER_ID = process.env.AUTH_TWITCH_BROADCASTER_ID;

/**
 * Refresh a Twitch user access token via /oauth2/token.
 * Throws on non-200 so the caller can flag the JWT with RefreshTokenError.
 */
async function refreshTwitchToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string | string[];
}> {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.AUTH_TWITCH_ID!,
      client_secret: process.env.AUTH_TWITCH_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitch token refresh failed: ${res.status} ${body}`);
  }
  return res.json();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Twitch({
      clientId: process.env.AUTH_TWITCH_ID,
      clientSecret: process.env.AUTH_TWITCH_SECRET,
      // fix7: add user:read:follows on top of the default OIDC + email scopes
      authorization: {
        params: {
          scope: "openid user:read:email user:read:follows",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, trigger }) {
      // ---------- Initial sign-in ----------
      // `account` is provided only on the first call after sign-in.
      if (account?.access_token) {
        const accessToken = account.access_token;
        token.access_token = accessToken;
        token.refresh_token = account.refresh_token as string | undefined;
        token.expires_at =
          (account.expires_at as number | undefined) ??
          Math.floor(Date.now() / 1000) +
            ((account.expires_in as number | undefined) ?? 3600);
        // Twitch returns scope as either string or array depending on flow
        const rawScope = account.scope as string | string[] | undefined;
        token.scope = Array.isArray(rawScope) ? rawScope.join(" ") : rawScope ?? "";

        // Fetch user info from Helix /users (existing behavior, retained)
        try {
          const res = await fetch("https://api.twitch.tv/helix/users", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Client-Id": process.env.AUTH_TWITCH_ID!,
            },
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
          console.error("Twitch /helix/users error:", e);
        }

        // Compute isFollower against the Aki broadcaster id.
        // Uses the Stage-2 wrapper with 3x retry + 24h stale-cache fallback.
        if (TWITCH_BROADCASTER_ID && token.sub) {
          const staleCache =
            token.isFollower != null && token.followCheckedAt != null
              ? {
                  isFollower: token.isFollower,
                  checkedAt: token.followCheckedAt,
                }
              : undefined;
          const result = await checkIsFollower(
            accessToken,
            token.sub,
            TWITCH_BROADCASTER_ID,
            staleCache,
          );
          if (result.source === "fresh") {
            token.isFollower = result.isFollower ?? false;
            token.followedAt = result.followedAt;
            token.followCheckedAt = Date.now();
            delete token.error;
          } else if (result.source === "stale-cache") {
            // Keep existing cache value, log error but don't surface
            token.isFollower = result.isFollower ?? false;
            token.error = "FollowCheckError";
          } else {
            // fail-safe: no usable cache, treat as non-follower
            token.isFollower = false;
            token.error = "FollowCheckError";
          }
        } else {
          if (!TWITCH_BROADCASTER_ID) {
            console.error(
              "[auth] AUTH_TWITCH_BROADCASTER_ID not set — follower judgement skipped",
            );
          }
          token.isFollower = false;
        }

        return token;
      }

      // ---------- fix7.2: client-triggered re-verification ----------
      // FollowGateModal's "Follow check" button calls useSession().update()
      // directly (no /api/follower-recheck round-trip — that endpoint was
      // removed in fix7.2 because Auth.js v5 getToken() is incompatible
      // with App Router and returned null even for authenticated users).
      // update() triggers this callback with trigger === "update". We
      // deliberately IGNORE the `session` argument — clients can pass
      // anything to update(), including a forged `{ isFollower: true }`,
      // so we never trust it. The Twitch API re-fetch below is the sole
      // gate that decides isFollower's new value, eliminating the
      // elevation-of-privilege risk entirely.
      if (
        trigger === "update" &&
        token.access_token &&
        token.sub &&
        TWITCH_BROADCASTER_ID
      ) {
        // Throttle: skip if we re-checked within the last 5 seconds.
        // Without this, spam-clicking the button could hit Twitch's
        // rate limit on our Helix client id.
        const lastCheck = token.followCheckedAt;
        const recentlyChecked =
          typeof lastCheck === "number" && Date.now() - lastCheck < 5000;
        if (!recentlyChecked) {
          const staleCache =
            typeof token.isFollower === "boolean" &&
            typeof token.followCheckedAt === "number"
              ? {
                  isFollower: token.isFollower,
                  checkedAt: token.followCheckedAt,
                }
              : undefined;
          const result = await checkIsFollower(
            token.access_token,
            token.sub,
            TWITCH_BROADCASTER_ID,
            staleCache,
          );
          if (result.source === "fresh") {
            token.isFollower = result.isFollower ?? false;
            token.followedAt = result.followedAt;
            token.followCheckedAt = Date.now();
            delete token.error;
          } else if (result.source === "stale-cache") {
            token.isFollower = result.isFollower ?? false;
            token.error = "FollowCheckError";
          } else {
            token.isFollower = false;
            token.error = "FollowCheckError";
          }
        }
      }

      // ---------- Subsequent calls: refresh if expired ----------
      if (
        token.expires_at &&
        Date.now() >= (token.expires_at as number) * 1000
      ) {
        if (!token.refresh_token) {
          token.error = "RefreshTokenError";
          return token;
        }
        try {
          const newTokens = await refreshTwitchToken(token.refresh_token);
          token.access_token = newTokens.access_token;
          // refresh tokens may rotate — only overwrite when a new one is provided
          token.refresh_token = newTokens.refresh_token ?? token.refresh_token;
          token.expires_at =
            Math.floor(Date.now() / 1000) + newTokens.expires_in;
          if (newTokens.scope) {
            token.scope = Array.isArray(newTokens.scope)
              ? newTokens.scope.join(" ")
              : newTokens.scope;
          }
          // clear stale errors after a successful refresh
          if (token.error === "RefreshTokenError") {
            delete token.error;
          }
        } catch (e) {
          console.error("Twitch token refresh error:", e);
          token.error = "RefreshTokenError";
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? token.id) as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string | undefined;
        // Expose follower fields to the session payload so client-side
        // useSession() can drive the UI gating.
        const userExt = session.user as unknown as Record<string, unknown>;
        userExt.login = token.login as string;
        userExt.isFollower = token.isFollower ?? false;
        userExt.followedAt = token.followedAt;
        userExt.followCheckedAt = token.followCheckedAt;
        userExt.scope = token.scope ?? "";
        if (token.error) {
          userExt.error = token.error;
        }
      }
      return session;
    },
  },
});
