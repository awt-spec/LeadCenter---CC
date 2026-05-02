// Resumable, parallel HubSpot → LeadCenter sync engine.
//
// State machine: integration.syncState.phase walks through
//   'companies' → 'deals' → 'contacts' → 'idle'.
// On each phase, we paginate HubSpot using the persisted cursor (`after`)
// and process each 100-record batch in parallel (concurrency 8).
//
// Time budget: caps at 4min wall-clock. When we hit it, we save the cursor
// and return — the next /5-min cron tick resumes from exactly where we were.
//
// Dedup priority (unchanged from prior commits):
//   1. HubSpot id ↔ LC id mapping (always wins)
//   2. Real domain match
//   3. Fuzzy normalised name match
//   4. Create new

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { Account } from '@prisma/client';
import { listObjects, getPipelines, getObjectTotal } from './client';
import { mapCompanyToAccount, mapContactToContact, mapDealToOpportunity } from './mapping';

type Phase = 'companies' | 'deals' | 'contacts' | 'idle';

interface SyncState {
  cursors?: { companies?: string; contacts?: string; deals?: string };
  totals?: { companies?: number; contacts?: number; deals?: number; fetchedAt?: string };
  phase?: Phase;
}

interface SyncStats {
  companies: { created: number; updated: number; merged: number; skipped: number };
  contacts:  { created: number; updated: number; skipped: number };
  deals:     { created: number; updated: number; skipped: number };
  truncated: boolean;
  phase: Phase;
}

const empty = (): SyncStats => ({
  companies: { created: 0, updated: 0, merged: 0, skipped: 0 },
  contacts:  { created: 0, updated: 0, skipped: 0 },
  deals:     { created: 0, updated: 0, skipped: 0 },
  truncated: false,
  phase: 'companies',
});

const TIME_BUDGET_MS = 4 * 60 * 1000;
const PARALLELISM = 8;
const TOTALS_TTL_MS = 60 * 60 * 1000;

// ====================== Helpers ======================

function isSyntheticDomain(d: string | null | undefined): boolean {
  if (!d) return true;
  return /\.lc-imported$|\.imported$|sysde\.internal$|^hs-.+\.hubspot\.lc-imported$/i.test(d);
}

function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(s\.?a\.?(?:\sde\sc\.?v\.?)?|de\srl|coop|cooperativa|asociaci[oó]n|inc\.?|ltd\.?|llc|gmbh)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/// Tiny concurrency-limited mapper. Avoids pulling p-limit as a dep.
async function parallelMap<T, R>(
  items: T[],
  limit: number,
  fn: (t: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

async function getMapping(integrationId: string, externalType: string, externalId: string) {
  return prisma.integrationMapping.findUnique({
    where: {
      integrationId_externalType_externalId: { integrationId, externalType, externalId },
    },
  });
}

async function recordMapping(
  integrationId: string,
  externalType: string,
  externalId: string,
  internalType: string,
  internalId: string
) {
  await prisma.integrationMapping.upsert({
    where: { integrationId_externalType_externalId: { integrationId, externalType, externalId } },
    create: { integrationId, externalType, externalId, internalType, internalId },
    update: { internalType, internalId, lastSeenAt: new Date(), lastSyncedAt: new Date() },
  });
}

async function findCandidateAccount(name: string, domain: string | null): Promise<Account | null> {
  if (domain) {
    const match = await prisma.account.findFirst({
      where: { domain: { equals: domain, mode: 'insensitive' } },
    });
    if (match) return match;
  }
  const norm = normalizeName(name);
  if (norm.length < 4) return null;
  const candidates = await prisma.account.findMany({
    where: { name: { contains: norm.split(' ')[0], mode: 'insensitive' } },
    take: 25,
  });
  for (const c of candidates) {
    if (normalizeName(c.name) === norm) return c;
  }
  return null;
}

async function getState(integrationId: string): Promise<SyncState> {
  const integ = await prisma.integration.findUnique({
    where: { id: integrationId },
    select: { syncState: true },
  });
  return ((integ?.syncState ?? {}) as SyncState) || {};
}

async function saveState(integrationId: string, state: SyncState): Promise<void> {
  await prisma.integration.update({
    where: { id: integrationId },
    data: { syncState: state as unknown as Prisma.InputJsonValue },
  });
}

async function ensureTotals(integrationId: string, state: SyncState): Promise<SyncState> {
  const fetchedAt = state.totals?.fetchedAt ? new Date(state.totals.fetchedAt).getTime() : 0;
  if (Date.now() - fetchedAt < TOTALS_TTL_MS && state.totals?.companies !== undefined) return state;

  const [companies, contacts, deals] = await Promise.all([
    getObjectTotal(integrationId, 'companies').catch(() => state.totals?.companies ?? 0),
    getObjectTotal(integrationId, 'contacts').catch(() => state.totals?.contacts ?? 0),
    getObjectTotal(integrationId, 'deals').catch(() => state.totals?.deals ?? 0),
  ]);
  const next: SyncState = {
    ...state,
    totals: { companies, contacts, deals, fetchedAt: new Date().toISOString() },
  };
  await saveState(integrationId, next);
  return next;
}

// ====================== Phase: Companies ======================

async function processCompany(integrationId: string, importerUserId: string, c: { id: string; properties: Record<string, string | null> }, stats: SyncStats): Promise<void> {
  const data = mapCompanyToAccount(c.properties, importerUserId);
  const realDomain = !isSyntheticDomain(data.domain ?? null) ? (data.domain ?? null) : null;

  const existingMap = await getMapping(integrationId, 'company', c.id);
  if (existingMap) {
    await prisma.account.update({
      where: { id: existingMap.internalId },
      data: {
        ...data,
        createdById: undefined,
        ...(realDomain ? { needsDomainReview: false } : {}),
      },
    });
    stats.companies.updated++;
    await recordMapping(integrationId, 'company', c.id, 'Account', existingMap.internalId);
    return;
  }
  const candidate = await findCandidateAccount(data.name, realDomain);
  if (candidate) {
    await prisma.account.update({
      where: { id: candidate.id },
      data: {
        name: data.name ?? candidate.name,
        domain: realDomain ?? candidate.domain,
        legalName: data.legalName ?? candidate.legalName,
        website: data.website ?? candidate.website,
        industry: data.industry ?? candidate.industry,
        country: data.country ?? candidate.country,
        city: data.city ?? candidate.city,
        address: data.address ?? candidate.address,
        description: candidate.description ?? data.description ?? null,
        status: candidate.status === 'PROSPECT' ? data.status : candidate.status,
        needsDomainReview: !realDomain && candidate.needsDomainReview,
      },
    });
    stats.companies.merged++;
    await recordMapping(integrationId, 'company', c.id, 'Account', candidate.id);
    return;
  }
  const dom = realDomain ?? `hs-${c.id}.hubspot.lc-imported`;
  const created = await prisma.account.create({
    data: { ...data, domain: dom, needsDomainReview: !realDomain },
    select: { id: true },
  });
  stats.companies.created++;
  await recordMapping(integrationId, 'company', c.id, 'Account', created.id);
}

async function syncCompanies(integrationId: string, importerUserId: string, state: SyncState, stats: SyncStats, deadline: number): Promise<SyncState> {
  stats.phase = 'companies';
  const props = ['name', 'domain', 'website', 'industry', 'country', 'city', 'address', 'description', 'lifecyclestage', 'legalname'];
  let cursor: SyncState = state;
  for await (const { results, nextAfter } of listObjects(integrationId, 'companies', { properties: props, limit: 100, startAfter: cursor.cursors?.companies })) {
    if (Date.now() > deadline) { stats.truncated = true; return cursor; }
    await parallelMap(results, PARALLELISM, (c) => processCompany(integrationId, importerUserId, c as { id: string; properties: Record<string, string | null> }, stats));
    cursor = {
      ...cursor,
      cursors: { ...(cursor.cursors ?? {}), companies: nextAfter ?? undefined },
    };
    await saveState(integrationId, cursor);
    if (!nextAfter) break;
  }
  // Phase complete → clear cursor
  cursor = { ...cursor, cursors: { ...(cursor.cursors ?? {}), companies: undefined } };
  await saveState(integrationId, cursor);
  return cursor;
}

// ====================== Phase: Deals ======================

async function syncDeals(integrationId: string, importerUserId: string, state: SyncState, stats: SyncStats, deadline: number): Promise<SyncState> {
  stats.phase = 'deals';
  const pipelines = await getPipelines(integrationId);
  const stageById = new Map<string, { label: string; probability: number }>();
  for (const p of pipelines) {
    for (const s of p.stages) {
      stageById.set(s.id, {
        label: s.label,
        probability: Math.round(Number(s.metadata?.probability ?? '0') * 100),
      });
    }
  }
  const props = ['dealname', 'amount', 'closedate', 'dealstage', 'pipeline', 'description', 'deal_currency_code'];
  const associations = ['companies'];
  let cursor: SyncState = state;
  for await (const { results, nextAfter } of listObjects(integrationId, 'deals', { properties: props, associations, limit: 100, startAfter: cursor.cursors?.deals })) {
    if (Date.now() > deadline) { stats.truncated = true; return cursor; }
    await parallelMap(results, PARALLELISM, async (d) => {
      const dd = d as { id: string; properties: Record<string, string | null>; associations?: { companies?: { results: Array<{ id: string }> } } };
      const companyHsId = dd.associations?.companies?.results?.[0]?.id;
      let accountId: string | null = null;
      if (companyHsId) {
        const m = await getMapping(integrationId, 'company', companyHsId);
        if (m) accountId = m.internalId;
      }
      if (!accountId) { stats.deals.skipped++; return; }
      const data = mapDealToOpportunity(dd.properties, accountId, importerUserId, stageById);
      const existingMap = await getMapping(integrationId, 'deal', dd.id);
      if (existingMap) {
        await prisma.opportunity.update({
          where: { id: existingMap.internalId },
          data: { ...data, createdById: undefined },
        });
        stats.deals.updated++;
        await recordMapping(integrationId, 'deal', dd.id, 'Opportunity', existingMap.internalId);
        return;
      }
      const created = await prisma.opportunity.create({ data, select: { id: true } });
      stats.deals.created++;
      await recordMapping(integrationId, 'deal', dd.id, 'Opportunity', created.id);
    });
    cursor = { ...cursor, cursors: { ...(cursor.cursors ?? {}), deals: nextAfter ?? undefined } };
    await saveState(integrationId, cursor);
    if (!nextAfter) break;
  }
  cursor = { ...cursor, cursors: { ...(cursor.cursors ?? {}), deals: undefined } };
  await saveState(integrationId, cursor);
  return cursor;
}

// ====================== Phase: Contacts ======================

async function syncContacts(integrationId: string, importerUserId: string, state: SyncState, stats: SyncStats, deadline: number): Promise<SyncState> {
  stats.phase = 'contacts';
  const props = ['email', 'firstname', 'lastname', 'jobtitle', 'phone', 'mobilephone', 'company', 'website', 'country', 'city', 'hs_linkedin_url', 'hs_lead_status'];
  const associations = ['companies'];
  let cursor: SyncState = state;
  for await (const { results, nextAfter } of listObjects(integrationId, 'contacts', { properties: props, associations, limit: 100, startAfter: cursor.cursors?.contacts })) {
    if (Date.now() > deadline) { stats.truncated = true; return cursor; }
    await parallelMap(results, PARALLELISM, async (c) => {
      const cc = c as { id: string; properties: Record<string, string | null>; associations?: { companies?: { results: Array<{ id: string }> } } };
      const companyHsId = cc.associations?.companies?.results?.[0]?.id;
      let accountId: string | null = null;
      if (companyHsId) {
        const m = await getMapping(integrationId, 'company', companyHsId);
        if (m) accountId = m.internalId;
      }
      const data = mapContactToContact(cc.properties, accountId, importerUserId);
      if (!data) { stats.contacts.skipped++; return; }

      const existingMap = await getMapping(integrationId, 'contact', cc.id);
      if (existingMap) {
        await prisma.contact.update({
          where: { id: existingMap.internalId },
          data: { ...data, createdById: undefined, email: undefined },
        });
        stats.contacts.updated++;
        await recordMapping(integrationId, 'contact', cc.id, 'Contact', existingMap.internalId);
        return;
      }
      const existingByEmail = await prisma.contact.findUnique({ where: { email: data.email } });
      if (existingByEmail) {
        await prisma.contact.update({
          where: { id: existingByEmail.id },
          data: { ...data, createdById: undefined, email: undefined },
        });
        stats.contacts.updated++;
        await recordMapping(integrationId, 'contact', cc.id, 'Contact', existingByEmail.id);
        return;
      }
      try {
        const created = await prisma.contact.create({ data, select: { id: true } });
        stats.contacts.created++;
        await recordMapping(integrationId, 'contact', cc.id, 'Contact', created.id);
      } catch (e) {
        // Race on the unique email could happen with parallelism; treat as update.
        const after = await prisma.contact.findUnique({ where: { email: data.email } });
        if (after) {
          stats.contacts.updated++;
          await recordMapping(integrationId, 'contact', cc.id, 'Contact', after.id);
        } else {
          throw e;
        }
      }
    });
    cursor = { ...cursor, cursors: { ...(cursor.cursors ?? {}), contacts: nextAfter ?? undefined } };
    await saveState(integrationId, cursor);
    if (!nextAfter) break;
  }
  cursor = { ...cursor, cursors: { ...(cursor.cursors ?? {}), contacts: undefined } };
  await saveState(integrationId, cursor);
  return cursor;
}

// ====================== Orchestrator ======================

export async function runFullSync(integrationId: string, triggeredById: string | null): Promise<{ runId: string; stats: SyncStats }> {
  const run = await prisma.syncRun.create({
    data: { integrationId, status: 'running', trigger: 'manual', triggeredById: triggeredById ?? undefined },
    select: { id: true },
  });
  await prisma.integration.update({
    where: { id: integrationId },
    data: { status: 'SYNCING', lastError: null },
  });
  const stats = empty();
  const deadline = Date.now() + TIME_BUDGET_MS;
  try {
    const integ = await prisma.integration.findUnique({ where: { id: integrationId }, select: { connectedById: true } });
    const importerId = integ?.connectedById ?? triggeredById;
    if (!importerId) throw new Error('No importer user available — connectedById missing');

    let state = await getState(integrationId);
    state = await ensureTotals(integrationId, state);

    // Phase order: companies → deals → contacts. Skip phases whose cursor is
    // already cleared (= phase already done from a prior tick).
    const compInProgress = state.cursors?.companies !== undefined;
    const dealInProgress = state.cursors?.deals !== undefined;
    const contInProgress = state.cursors?.contacts !== undefined;

    // Run companies if cursor present OR no companies cursor at all (fresh start)
    if (compInProgress || (!dealInProgress && !contInProgress)) {
      state = await syncCompanies(integrationId, importerId, state, stats, deadline);
    }
    if (Date.now() < deadline) state = await syncDeals(integrationId, importerId, state, stats, deadline);
    if (Date.now() < deadline) state = await syncContacts(integrationId, importerId, state, stats, deadline);

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: 'ok',
        finishedAt: new Date(),
        itemsCreated: stats.companies.created + stats.contacts.created + stats.deals.created,
        itemsUpdated:
          stats.companies.updated + stats.contacts.updated + stats.deals.updated + stats.companies.merged,
        itemsSkipped: stats.companies.skipped + stats.contacts.skipped + stats.deals.skipped,
        details: stats as unknown as object,
      },
    });
    await prisma.integration.update({
      where: { id: integrationId },
      data: { status: 'CONNECTED', lastSyncedAt: new Date() },
    });
    return { runId: run.id, stats };
  } catch (e) {
    const err = (e as Error).message;
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status: 'error', finishedAt: new Date(), error: err, details: stats as unknown as object },
    });
    await prisma.integration.update({
      where: { id: integrationId },
      data: { status: 'ERROR', lastError: err.slice(0, 500) },
    });
    throw e;
  }
}
