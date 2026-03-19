import NextAuth from "next-auth";
import Twitch from "next-auth/providers/twitch";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Twitch],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, account, profile }) {
      if (account && profile) {
        token.id = profile.sub;
        // Twitch OIDC uses preferred_username for login ID, picture for avatar
        token.login = profile.preferred_username;
        token.name = profile.preferred_username;
        token.picture = profile.picture;
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
