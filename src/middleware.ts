import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // Skip middleware for:
    //   - NextAuth own endpoints
    //   - HubSpot CRON ping (auth via CRON_SECRET bearer header)
    //   - HubSpot WEBHOOK ping (auth via HMAC-SHA256 signature)
    //   - Static assets
    '/((?!api/auth|api/integrations/hubspot/cron|api/integrations/hubspot/webhook|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
