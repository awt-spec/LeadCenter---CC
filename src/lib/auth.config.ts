import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/login' },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublic = nextUrl.pathname === '/login' || nextUrl.pathname.startsWith('/login/');

      if (!isLoggedIn && !isPublic) {
        const loginUrl = new URL('/login', nextUrl.origin);
        if (nextUrl.pathname !== '/') {
          loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
        }
        return Response.redirect(loginUrl);
      }

      if (isLoggedIn && isPublic) {
        return Response.redirect(new URL('/', nextUrl.origin));
      }

      return true;
    },

    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId;
        session.user.roles = token.roles ?? [];
        session.user.permissions = token.permissions ?? [];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
