// HubSpot OAuth 2.0 — authorize URL, code exchange, token refresh.
// Docs: https://developers.hubspot.com/docs/api/working-with-oauth

import { prisma } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encryption';

export const HUBSPOT_AUTH_HOST = 'https://app.hubspot.com';
export const HUBSPOT_API_HOST = 'https://api.hubapi.com';
export const HUBSPOT_TOKEN_URL = `${HUBSPOT_API_HOST}/oauth/v1/token`;

/// Scopes we ask for. Must match the scopes configured on the HubSpot Public App.
/// Read-only first; write scopes will be added once we want bidirectional sync.
export const HUBSPOT_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.companies.read',
  'crm.objects.deals.read',
  'crm.schemas.contacts.read',
  'crm.schemas.companies.read',
  'crm.schemas.deals.read',
  'crm.objects.owners.read',
  'oauth',
];

export function getRedirectUri(): string {
  const explicit = process.env.HUBSPOT_REDIRECT_URI;
  if (explicit) return explicit;
  const origin = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000';
  return `${origin.replace(/\/+$/, '')}/api/integrations/hubspot/callback`;
}

export function buildAuthorizeUrl(state: string): string {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  if (!clientId) throw new Error('HUBSPOT_CLIENT_ID is not configured');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    scope: HUBSPOT_SCOPES.join(' '),
    state,
  });
  return `${HUBSPOT_AUTH_HOST}/oauth/authorize?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: 'bearer';
}

async function postForm(url: string, body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot token request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('HubSpot credentials are not configured');
  return postForm(HUBSPOT_TOKEN_URL, {
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getRedirectUri(),
    code,
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('HubSpot credentials are not configured');
  return postForm(HUBSPOT_TOKEN_URL, {
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
}

interface AccessTokenInfo {
  hub_id: number;
  user: string;
  user_id: number;
  scopes: string[];
  expires_in: number;
}

/// Fetch metadata about an access token (portal id, user email, scopes).
export async function getTokenInfo(accessToken: string): Promise<AccessTokenInfo> {
  const res = await fetch(`${HUBSPOT_API_HOST}/oauth/v1/access-tokens/${accessToken}`);
  if (!res.ok) throw new Error(`Failed to fetch HubSpot token info: ${res.status}`);
  return (await res.json()) as AccessTokenInfo;
}

/// Returns a valid access token for the integration, refreshing if expired.
/// Persists rotated tokens back to the DB.
export async function getValidAccessToken(integrationId: string): Promise<string> {
  const integ = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integ || !integ.encAccessToken || !integ.encRefreshToken) {
    throw new Error('Integration is not connected');
  }
  const expiresSoon =
    integ.expiresAt && integ.expiresAt.getTime() - Date.now() < 60_000; // <1min buffer
  if (!expiresSoon) {
    return decrypt(integ.encAccessToken);
  }
  // Refresh
  const refresh = decrypt(integ.encRefreshToken);
  const fresh = await refreshAccessToken(refresh);
  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      encAccessToken: encrypt(fresh.access_token),
      encRefreshToken: encrypt(fresh.refresh_token),
      expiresAt: new Date(Date.now() + fresh.expires_in * 1000),
    },
  });
  return fresh.access_token;
}
