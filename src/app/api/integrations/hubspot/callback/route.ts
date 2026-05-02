import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { exchangeCodeForTokens, getTokenInfo } from '@/lib/integrations/hubspot/oauth';

/// HubSpot redirects here after the user approves the OAuth scopes.
/// Exchanges the code for tokens and persists the Integration row.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !can(session, 'settings:update')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.cookies.get('hs_oauth_state')?.value;

  if (!code) {
    return redirectWithError(req, 'missing_code');
  }
  if (!state || !cookieState || state !== cookieState) {
    return redirectWithError(req, 'state_mismatch');
  }

  try {
    const tokens = await exchangeCodeForTokens(code, req.url);
    const info = await getTokenInfo(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Resolve the connector to a real DB user. Demo/synthetic sessions have
    // an id that isn't in the User table, which would FK-violate. Fall back
    // to the email lookup, then to null.
    let connectedById: string | null = null;
    if (session.user.email) {
      const real = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      if (real) connectedById = real.id;
    }
    if (!connectedById) {
      const exists = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true },
      });
      if (exists) connectedById = exists.id;
    }

    await prisma.integration.upsert({
      where: {
        provider_externalAccountId: { provider: 'hubspot', externalAccountId: String(info.hub_id) },
      },
      create: {
        provider: 'hubspot',
        externalAccountId: String(info.hub_id),
        ownerEmail: info.user,
        encAccessToken: encrypt(tokens.access_token),
        encRefreshToken: encrypt(tokens.refresh_token),
        expiresAt,
        scopes: info.scopes,
        status: 'CONNECTED',
        connectedById,
      },
      update: {
        ownerEmail: info.user,
        encAccessToken: encrypt(tokens.access_token),
        encRefreshToken: encrypt(tokens.refresh_token),
        expiresAt,
        scopes: info.scopes,
        status: 'CONNECTED',
        lastError: null,
        connectedById,
      },
    });

    const res = NextResponse.redirect(new URL('/settings/integrations?status=connected', req.url));
    res.cookies.set('hs_oauth_state', '', { maxAge: 0, path: '/' });
    return res;
  } catch (e) {
    return redirectWithError(req, 'token_exchange_failed', (e as Error).message);
  }
}

function redirectWithError(req: NextRequest, code: string, detail?: string) {
  const u = new URL('/settings/integrations', req.url);
  u.searchParams.set('error', code);
  if (detail) u.searchParams.set('detail', detail.slice(0, 200));
  return NextResponse.redirect(u);
}
