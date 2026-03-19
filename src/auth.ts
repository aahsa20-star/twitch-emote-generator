import NextAuth from "next-auth";
import Twitch from "next-auth/providers/twitch";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Twitch],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, account, profile }) {
      if (account && profile) {
        token.id = profile.sub;
        token.login = (profile as Record<string, unknown>).login as string | undefined ?? profile.preferred_username;
        token.name = profile.preferred_username ?? profile.name;
        token.picture = (profile as Record<string, unknown>).profile_image_url as string | undefined;
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
