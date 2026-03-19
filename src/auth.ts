import NextAuth from "next-auth";
import type { OIDCConfig } from "next-auth/providers";

interface TwitchProfile {
  sub: string;
  preferred_username: string;
  email: string;
  picture: string;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      id: "twitch",
      name: "Twitch",
      type: "oidc",
      issuer: "https://id.twitch.tv/oauth2",
      clientId: process.env.AUTH_TWITCH_ID,
      clientSecret: process.env.AUTH_TWITCH_SECRET,
      authorization: {
        params: {
          scope: "openid user:read:email",
          claims: JSON.stringify({
            id_token: {
              picture: null,
              preferred_username: null,
            },
            userinfo: {
              picture: null,
              preferred_username: null,
            },
          }),
        },
      },
      profile(profile: TwitchProfile) {
        return {
          id: profile.sub,
          name: profile.preferred_username,
          email: profile.email,
          image: profile.picture,
          login: profile.preferred_username,
        };
      },
    } satisfies OIDCConfig<TwitchProfile>,
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        token.id = user.id;
        token.login = (user as Record<string, unknown>).login as string;
        token.picture = user.image;

        // profile()で取れなかった場合、Helix APIにフォールバック
        if (!token.login || !token.picture) {
          try {
            const res = await fetch("https://api.twitch.tv/helix/users", {
              headers: {
                Authorization: `Bearer ${account.access_token}`,
                "Client-Id": process.env.AUTH_TWITCH_ID!,
              },
            });
            if (res.ok) {
              const data = await res.json();
              const twitchUser = data.data?.[0];
              if (twitchUser) {
                token.id = twitchUser.id;
                token.login = twitchUser.login;
                token.name = twitchUser.display_name;
                token.picture = twitchUser.profile_image_url;
              }
            }
          } catch {
            // Helix APIが失敗してもログイン自体は成功させる
          }
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string | undefined;
        (session.user as Record<string, unknown>).login = token.login as string;
      }
      return session;
    },
  },
});
