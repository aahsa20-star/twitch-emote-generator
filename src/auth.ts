import NextAuth from "next-auth";
import Twitch from "next-auth/providers/twitch";
// Side-effect import for next-auth/jwt module augmentation.
import "@/types/auth";

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

/**
 * GET /helix/channels/followed?user_id=X&broadcaster_id=AKI_ID
 *
 * Returns null on auth/network failure (caller should fail-safe to false).
 * Stage 2 will replace this with the retry-aware wrapper in
 * `src/lib/twitch/follower-check.ts`. For Stage 1 we keep it inline.
 */
async function checkFollowingBroadcaster(
  accessToken: string,
  userId: string,
  broadcasterId: string,
): Promise<{ isFollower: boolean; followedAt?: string } | null> {
  const url =
    "https://api.twitch.tv/helix/channels/followed?user_id=" +
    encodeURIComponent(userId) +
    "&broadcaster_id=" +
    encodeURIComponent(broadcasterId);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": process.env.AUTH_TWITCH_ID!,
    },
  });
  if (!res.ok) {
    return null;
  }
  const json = await res.json();
  const followedAt = json?.data?.[0]?.followed_at as string | undefined;
  return {
    isFollower: (json?.data?.length ?? 0) > 0,
    followedAt,
  };
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
    async jwt({ token, account }) {
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

        // Compute isFollower against the Aki broadcaster id (fail-safe to false)
        if (TWITCH_BROADCASTER_ID && token.sub) {
          try {
            const result = await checkFollowingBroadcaster(
              accessToken,
              token.sub,
              TWITCH_BROADCASTER_ID,
            );
            if (result) {
              token.isFollower = result.isFollower;
              token.followedAt = result.followedAt;
              token.followCheckedAt = Date.now();
              delete token.error;
            } else {
              token.isFollower = false;
              token.error = "FollowCheckError";
            }
          } catch (e) {
            console.error("Twitch /helix/channels/followed error:", e);
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
