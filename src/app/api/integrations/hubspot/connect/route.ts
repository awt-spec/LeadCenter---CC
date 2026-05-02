import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { buildAuthorizeUrl } from '@/lib/integrations/hubspot/oauth';

/// Starts the HubSpot OAuth flow. Stores a CSRF state in a short-lived cookie
/// and redirects to HubSpot's authorize endpoint.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !can(session, 'settings:update')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!process.env.HUBSPOT_CLIENT_ID) {
    return NextResponse.json(
      { error: 'HUBSPOT_CLIENT_ID is not configured. See docs/hubspot-setup.md' },
      { status: 500 }
    );
  }
  const state = randomBytes(16).toString('hex');
  // Pass the request URL so we derive the redirect_uri from the actual host
  // (works for production, preview deploys, and custom domains).
  const url = buildAuthorizeUrl(state, req.url);
  const res = NextResponse.redirect(url);
  res.cookies.set('hs_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
