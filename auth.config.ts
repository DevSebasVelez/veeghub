import type { NextAuthConfig } from "next-auth";

const publicRoutes = ["/login"];

export const authConfig = {
  secret:
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "veeghub-development-auth-secret"),
  pages: {
    signIn: "/login",
  },
  providers: [],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = Boolean(auth?.user);
      const isPublicRoute = publicRoutes.includes(pathname);

      if (pathname.startsWith("/admin")) {
        return isLoggedIn && auth?.user?.role === "ADMIN";
      }

      if (isPublicRoute && isLoggedIn) {
        return Response.redirect(new URL("/admin", request.nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
        session.user.role = token.role === "ADMIN" ? token.role : "ADMIN";
      }

      return session;
    },
  },
} satisfies NextAuthConfig;
