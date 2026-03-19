import NextAuth from "next-auth";
import Twitch from "next-auth/providers/twitch";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Twitch],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, account, profile }) {
      if (account && profile) {
        // Debug: log profile to see what Twitch OIDC returns
        console.log("TWITCH PROFILE:", JSON.stringify(profile, null, 2));

        token.id = profile.sub;
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
