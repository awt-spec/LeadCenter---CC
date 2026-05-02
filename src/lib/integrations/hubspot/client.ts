// Thin typed wrapper over the HubSpot CRM v3 API. We avoid the official SDK
// to keep the bundle tiny — Next.js server routes work fine with `fetch`.

import { HUBSPOT_API_HOST, getValidAccessToken } from './oauth';

export interface HsObject<P = Record<string, string | null>> {
  id: string;
  properties: P;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
}

export interface HsAssociation {
  id: string;
  type: string;
}

interface HsListResponse<P> {
  results: Array<HsObject<P> & { associations?: Record<string, { results: HsAssociation[] }> }>;
  paging?: { next?: { after: string } };
}

async function hsFetch(integrationId: string, path: string, init?: RequestInit): Promise<Response> {
  const token = await getValidAccessToken(integrationId);
  const res = await fetch(`${HUBSPOT_API_HOST}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 429) {
    // Rate limit — backoff once.
    await new Promise((r) => setTimeout(r, 2000));
    return hsFetch(integrationId, path, init);
  }
  return res;
}

/// Stream all pages of a CRM list endpoint. Yields one batch per request.
export async function* listObjects<P = Record<string, string | null>>(
  integrationId: string,
  objectType: 'companies' | 'contacts' | 'deals',
  options: {
    properties?: string[];
    associations?: string[];
    limit?: number;
  } = {}
): AsyncGenerator<HsListResponse<P>['results']> {
  const limit = options.limit ?? 100;
  let after: string | undefined;
  for (;;) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (after) params.set('after', after);
    if (options.properties?.length) params.set('properties', options.properties.join(','));
    if (options.associations?.length) params.set('associations', options.associations.join(','));
    const res = await hsFetch(integrationId, `/crm/v3/objects/${objectType}?${params.toString()}`);
    if (!res.ok) throw new Error(`HubSpot list ${objectType} failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as HsListResponse<P>;
    if (json.results?.length) yield json.results;
    if (!json.paging?.next?.after) return;
    after = json.paging.next.after;
  }
}

/// Fetch deal pipelines metadata so we can map dealstage → human label.
export async function getPipelines(integrationId: string): Promise<Array<{ id: string; label: string; stages: Array<{ id: string; label: string; metadata?: { probability?: string } }> }>> {
  const res = await hsFetch(integrationId, `/crm/v3/pipelines/deals`);
  if (!res.ok) throw new Error(`HubSpot pipelines failed: ${res.status}`);
  const json = (await res.json()) as { results: Array<{ id: string; label: string; stages: Array<{ id: string; label: string; metadata?: { probability?: string } }> }> };
  return json.results;
}

/// Probe-only call (used by /connect and the UI to sanity-check the token).
export async function ping(integrationId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await hsFetch(integrationId, `/oauth/v1/access-tokens/${await getValidAccessToken(integrationId)}`);
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
