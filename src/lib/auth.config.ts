import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import { ALLOWED_EMAIL_DOMAIN } from '@/lib/constants';

export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          hd: ALLOWED_EMAIL_DOMAIN,
          prompt: 'select_account',
        },
      },
    }),
  ],
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
