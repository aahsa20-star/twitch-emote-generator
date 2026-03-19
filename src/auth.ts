import NextAuth from "next-auth";
import Twitch from "next-auth/providers/twitch";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Twitch],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        // Twitch Helix APIから直接ユーザー情報を取得
        const res = await fetch("https://api.twitch.tv/helix/users", {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
            "Client-Id": process.env.AUTH_TWITCH_ID!,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const user = data.data?.[0];
          if (user) {
            token.id = user.id;
            token.login = user.login;
            token.name = user.display_name;
            token.picture = user.profile_image_url;
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
