import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Twitter from "next-auth/providers/twitter";

/** Edge-safe config (no database access) used by middleware. */
export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login", error: "/login", newUser: "/dashboard" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  // App-specific cookie names so sessions from other apps on the same host (e.g. other localhost projects) are ignored.
  cookies: {
    sessionToken: { name: "pus.session-token", options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https") } },
    callbackUrl: { name: "pus.callback-url", options: { sameSite: "lax", path: "/" } },
    csrfToken: { name: "pus.csrf-token", options: { httpOnly: true, sameSite: "lax", path: "/" } },
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, allowDangerousEmailAccountLinking: true })] : []),
    ...(process.env.FACEBOOK_CLIENT_ID ? [Facebook({ clientId: process.env.FACEBOOK_CLIENT_ID, clientSecret: process.env.FACEBOOK_CLIENT_SECRET!, allowDangerousEmailAccountLinking: true })] : []),
    ...(process.env.TWITTER_CLIENT_ID ? [Twitter({ clientId: process.env.TWITTER_CLIENT_ID, clientSecret: process.env.TWITTER_CLIENT_SECRET!, allowDangerousEmailAccountLinking: true })] : []),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/checkout")) {
        if (!isLoggedIn) return false;
        if (pathname.startsWith("/admin") && (auth?.user as { role?: string })?.role !== "admin") {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
      }
      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = (user as { id?: string }).id;
        token.role = (user as { role?: string }).role;
        token.username = (user as { username?: string }).username;
      }
      if (trigger === "update" && session) Object.assign(token, session);
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { username?: string }).username = token.username as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
