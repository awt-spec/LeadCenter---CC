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

/// Stream all pages of a CRM list endpoint. Yields { results, nextAfter }
/// so the caller can persist the cursor between runs (resumable syncs).
/// Pass `startAfter` to resume from a previous cursor.
export async function* listObjects<P = Record<string, string | null>>(
  integrationId: string,
  objectType: 'companies' | 'contacts' | 'deals' | 'emails' | 'emails',
  options: {
    properties?: string[];
    associations?: string[];
    limit?: number;
    startAfter?: string;
  } = {}
): AsyncGenerator<{ results: HsListResponse<P>['results']; nextAfter: string | null }> {
  const limit = options.limit ?? 100;
  let after: string | undefined = options.startAfter;
  for (;;) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (after) params.set('after', after);
    if (options.properties?.length) params.set('properties', options.properties.join(','));
    if (options.associations?.length) params.set('associations', options.associations.join(','));
    const res = await hsFetch(integrationId, `/crm/v3/objects/${objectType}?${params.toString()}`);
    if (!res.ok) throw new Error(`HubSpot list ${objectType} failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as HsListResponse<P>;
    const nextAfter = json.paging?.next?.after ?? null;
    if (json.results?.length) yield { results: json.results, nextAfter };
    if (!nextAfter) return;
    after = nextAfter;
  }
}

/// Get an exact total count for an object type via the search endpoint
/// (the regular list endpoint doesn't return totals).
export async function getObjectTotal(
  integrationId: string,
  objectType: 'companies' | 'contacts' | 'deals' | 'emails'
): Promise<number> {
  const res = await hsFetch(integrationId, `/crm/v3/objects/${objectType}/search`, {
    method: 'POST',
    body: JSON.stringify({ limit: 1, filterGroups: [] }),
  });
  if (!res.ok) return 0;
  const json = (await res.json()) as { total?: number };
  return json.total ?? 0;
}

/// Stream objects with hs_object_id > minId via the search endpoint.
/// Lets us skip records already mapped — faster catch-up than re-paginating
/// the list endpoint linearly. Search caps at 10K results; for bigger sets
/// the caller can re-invoke with the new max id.
export async function* searchObjectsAfterId<P = Record<string, string | null>>(
  integrationId: string,
  objectType: 'companies' | 'contacts' | 'deals' | 'emails',
  minId: string,
  options: {
    properties?: string[];
    associations?: string[];
    limit?: number;
  } = {}
): AsyncGenerator<{ results: HsListResponse<P>['results']; nextAfter: string | null }> {
  const limit = options.limit ?? 100;
  let after: string | undefined;
  for (;;) {
    const reqBody = {
      limit,
      after,
      filterGroups: [
        { filters: [{ propertyName: 'hs_object_id', operator: 'GT', value: minId }] },
      ],
      sorts: [{ propertyName: 'hs_object_id', direction: 'ASCENDING' }],
      properties: options.properties ?? [],
    };
    const res = await hsFetch(integrationId, `/crm/v3/objects/${objectType}/search`, {
      method: 'POST',
      body: JSON.stringify(reqBody),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HubSpot search ${objectType} failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as HsListResponse<P>;
    const nextAfter = json.paging?.next?.after ?? null;
    if (json.results?.length) {
      // Search API doesn't include associations inline. Fetch them per record
      // for emails (we need contact/account/deal links).
      if (options.associations?.length) {
        for (const r of json.results) {
          const ar = await hsFetch(
            integrationId,
            `/crm/v3/objects/${objectType}/${r.id}?associations=${options.associations.join(',')}`
          );
          if (ar.ok) {
            const obj = (await ar.json()) as { associations?: HsListResponse<P>['results'][number]['associations'] };
            (r as { associations?: HsListResponse<P>['results'][number]['associations'] }).associations = obj.associations;
          }
        }
      }
      yield { results: json.results, nextAfter };
    }
    if (!nextAfter) return;
    after = nextAfter;
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
