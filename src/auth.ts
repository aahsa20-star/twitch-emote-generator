import NextAuth from "next-auth";
import Twitch from "next-auth/providers/twitch";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Twitch],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      // 初回サインイン時のみ（accountが存在する時）
      if (account?.access_token) {
        try {
          const res = await fetch("https://api.twitch.tv/helix/users", {
            headers: {
              "Authorization": `Bearer ${account.access_token}`,
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
          console.error("Twitch Helix API error:", e);
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? token.id) as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string | undefined;
        (session.user as Record<string, unknown>).login = token.login as string;
      }
      return session;
    },
  },
});
