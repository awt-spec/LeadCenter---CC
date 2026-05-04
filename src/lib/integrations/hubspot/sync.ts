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
import { mapCompanyToAccount, mapContactToContact, mapDealToOpportunity, mapEmailToActivity, HS_EMAIL_PROPS } from './mapping';

type Phase = 'companies' | 'deals' | 'contacts' | 'emails' | 'idle';

interface SyncState {
  cursors?: { companies?: string; contacts?: string; deals?: string; emails?: string };
  totals?: { companies?: number; contacts?: number; deals?: number; emails?: number; fetchedAt?: string };
  /// ISO timestamps of when each phase last reached the end (no more pages).
  /// We use these to skip a phase if it was completed within the last hour
  /// — otherwise contacts re-iterates eternally and starves emails.
  completedAt?: { companies?: string; contacts?: string; deals?: string; emails?: string };
  phase?: Phase;
}

interface SyncStats {
  companies: { created: number; updated: number; merged: number; skipped: number };
  contacts:  { created: number; updated: number; skipped: number };
  deals:     { created: number; updated: number; skipped: number };
  emails:    { created: number; updated: number; skipped: number };
  truncated: boolean;
  phase: Phase;
}

const empty = (): SyncStats => ({
  companies: { created: 0, updated: 0, merged: 0, skipped: 0 },
  contacts:  { created: 0, updated: 0, skipped: 0 },
  deals:     { created: 0, updated: 0, skipped: 0 },
  emails:    { created: 0, updated: 0, skipped: 0 },
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

  const [companies, contacts, deals, emails] = await Promise.all([
    getObjectTotal(integrationId, 'companies').catch(() => state.totals?.companies ?? 0),
    getObjectTotal(integrationId, 'contacts').catch(() => state.totals?.contacts ?? 0),
    getObjectTotal(integrationId, 'deals').catch(() => state.totals?.deals ?? 0),
    getObjectTotal(integrationId, 'emails').catch(() => state.totals?.emails ?? 0),
  ]);
  const next: SyncState = {
    ...state,
    totals: { companies, contacts, deals, emails, fetchedAt: new Date().toISOString() },
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
  try {
    const created = await prisma.account.create({
      data: { ...data, domain: dom, needsDomainReview: !realDomain },
      select: { id: true },
    });
    stats.companies.created++;
    await recordMapping(integrationId, 'company', c.id, 'Account', created.id);
  } catch (e: unknown) {
    // Race: a parallel worker just created an account with the same domain
    // (HubSpot allows duplicate domains across companies). Treat as merge.
    const code = (e as { code?: string }).code;
    if (code !== 'P2002') throw e;
    const racer = await prisma.account.findFirst({
      where: { domain: { equals: dom, mode: 'insensitive' } },
    });
    if (!racer) throw e;
    await prisma.account.update({
      where: { id: racer.id },
      data: {
        ...data,
        createdById: undefined,
        domain: realDomain ?? racer.domain,
        ...(realDomain ? { needsDomainReview: false } : {}),
      },
    });
    stats.companies.merged++;
    await recordMapping(integrationId, 'company', c.id, 'Account', racer.id);
  }
}

/// Wrapper that swallows individual record errors so one bad row doesn't
/// kill the whole batch — we log and let the sync keep going.
async function safeProcess<T>(item: T, fn: (t: T) => Promise<void>, stats: SyncStats, label: string): Promise<void> {
  try {
    await fn(item);
  } catch (e) {
    console.error(`[sync] ${label} failed:`, (e as Error).message.slice(0, 200));
    // Bump skipped so the user sees there were issues without aborting.
    if (label === 'company') stats.companies.skipped++;
    else if (label === 'deal') stats.deals.skipped++;
    else if (label === 'email') stats.emails.skipped++;
    else stats.contacts.skipped++;
  }
}

async function syncCompanies(integrationId: string, importerUserId: string, state: SyncState, stats: SyncStats, deadline: number): Promise<SyncState> {
  stats.phase = 'companies';
  const props = ['name', 'domain', 'website', 'industry', 'country', 'city', 'address', 'description', 'lifecyclestage', 'legalname'];
  let cursor: SyncState = state;
  for await (const { results, nextAfter } of listObjects(integrationId, 'companies', { properties: props, limit: 100, startAfter: cursor.cursors?.companies })) {
    if (Date.now() > deadline) { stats.truncated = true; return cursor; }
    await parallelMap(results, PARALLELISM, (c) =>
      safeProcess(c, (cc) => processCompany(integrationId, importerUserId, cc as { id: string; properties: Record<string, string | null> }, stats), stats, 'company')
    );
    cursor = {
      ...cursor,
      cursors: { ...(cursor.cursors ?? {}), companies: nextAfter ?? undefined },
    };
    await saveState(integrationId, cursor);
    if (!nextAfter) break;
  }
  // Phase complete → clear cursor + mark completedAt
  cursor = {
    ...cursor,
    cursors: { ...(cursor.cursors ?? {}), companies: undefined },
    completedAt: { ...(cursor.completedAt ?? {}), companies: new Date().toISOString() },
  };
  await saveState(integrationId, cursor);
  return cursor;
}

// ====================== Phase: Deals ======================

const ORPHAN_DEAL_DOMAIN = 'sin-empresa.hubspot.lc-imported';

/// Lazily get/create the bucket account that holds deals whose HubSpot record
/// has no associated company. Per user request these still come into LC so
/// they're visible — just grouped under a single placeholder account.
async function getOrCreateOrphanAccount(importerUserId: string): Promise<string> {
  const existing = await prisma.account.findFirst({ where: { domain: ORPHAN_DEAL_DOMAIN }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.account.create({
    data: {
      name: '(Sin empresa asignada · HubSpot)',
      domain: ORPHAN_DEAL_DOMAIN,
      status: 'PROSPECT',
      priority: 'NORMAL',
      needsDomainReview: false,
      description: 'Cuenta placeholder para deals de HubSpot que no tienen empresa asociada en HubSpot. Si querés mover un deal a su empresa real, edita la oportunidad y cambia su cuenta.',
      createdById: importerUserId,
    },
    select: { id: true },
  });
  return created.id;
}

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
    await parallelMap(results, PARALLELISM, (d) => safeProcess(d, async (dItem) => {
      const dd = dItem as { id: string; properties: Record<string, string | null>; associations?: { companies?: { results: Array<{ id: string }> } } };
      const companyHsId = dd.associations?.companies?.results?.[0]?.id;
      let accountId: string | null = null;
      if (companyHsId) {
        const m = await getMapping(integrationId, 'company', companyHsId);
        if (m) accountId = m.internalId;
      }
      // Fallback: orphan deals (no company association in HubSpot) get parked
      // on the placeholder bucket account so the user still sees them in LC.
      if (!accountId) {
        accountId = await getOrCreateOrphanAccount(importerUserId);
      }
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
    }, stats, 'deal'));
    cursor = { ...cursor, cursors: { ...(cursor.cursors ?? {}), deals: nextAfter ?? undefined } };
    await saveState(integrationId, cursor);
    if (!nextAfter) break;
  }
  cursor = {
    ...cursor,
    cursors: { ...(cursor.cursors ?? {}), deals: undefined },
    completedAt: { ...(cursor.completedAt ?? {}), deals: new Date().toISOString() },
  };
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
    await parallelMap(results, PARALLELISM, (c) => safeProcess(c, async (cItem) => {
      const cc = cItem as { id: string; properties: Record<string, string | null>; associations?: { companies?: { results: Array<{ id: string }> } } };
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
    }, stats, 'contact'));
    cursor = { ...cursor, cursors: { ...(cursor.cursors ?? {}), contacts: nextAfter ?? undefined } };
    await saveState(integrationId, cursor);
    if (!nextAfter) break;
  }
  cursor = {
    ...cursor,
    cursors: { ...(cursor.cursors ?? {}), contacts: undefined },
    completedAt: { ...(cursor.completedAt ?? {}), contacts: new Date().toISOString() },
  };
  await saveState(integrationId, cursor);
  return cursor;
}

// ====================== Phase: Emails (engagements → Activity) ======================

async function syncEmails(integrationId: string, importerUserId: string, state: SyncState, stats: SyncStats, deadline: number): Promise<SyncState> {
  stats.phase = 'emails';
  // If the user previously hit a 403 because the OAuth app lacks the email
  // scopes, skip silently. They re-enable by re-authorising with the scopes.
  if ((state as { emailsBlocked?: boolean }).emailsBlocked) return state;

  const props = HS_EMAIL_PROPS;
  const associations = ['contacts', 'companies', 'deals'];
  let cursor: SyncState = state;
  let iter: AsyncIterator<{ results: Array<{ id: string; properties: Record<string, string | null> }>; nextAfter: string | null }>;
  try {
    iter = listObjects(integrationId, 'emails', { properties: props, associations, limit: 100, startAfter: cursor.cursors?.emails })[Symbol.asyncIterator]();
  } catch (e) {
    return cursor;
  }
  while (true) {
    let next: IteratorResult<{ results: Array<{ id: string; properties: Record<string, string | null> }>; nextAfter: string | null }>;
    try {
      next = await iter.next();
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (/403|scope|sales-email-read|crm\.objects\.emails\.read/i.test(msg)) {
        // Mark as blocked so future ticks skip the phase, and leave a friendly
        // hint in the integration's lastError for the UI to render.
        cursor = { ...cursor, emailsBlocked: true } as SyncState & { emailsBlocked: true };
        await saveState(integrationId, cursor);
        await prisma.integration.update({
          where: { id: integrationId },
          data: {
            lastError:
              'Para sincronizar correos faltan scopes en el HubSpot Public App: ' +
              'sales-email-read, crm.schemas.emails.read, crm.objects.emails.read. ' +
              'Agrégalos en developers.hubspot.com → tu app → Auth, después Desconectá y volvé a Conectar.',
          },
        });
        return cursor;
      }
      throw e;
    }
    if (next.done) break;
    const { results, nextAfter } = next.value;
    if (Date.now() > deadline) { stats.truncated = true; return cursor; }
    await parallelMap(results, PARALLELISM, (e) => safeProcess(e, async (eItem) => {
      const ee = eItem as {
        id: string;
        properties: Record<string, string | null>;
        associations?: {
          contacts?: { results: Array<{ id: string }> };
          companies?: { results: Array<{ id: string }> };
          deals?: { results: Array<{ id: string }> };
        };
      };
      // Resolve associations to internal ids via mapping
      const contactHsId = ee.associations?.contacts?.results?.[0]?.id;
      const companyHsId = ee.associations?.companies?.results?.[0]?.id;
      const dealHsId = ee.associations?.deals?.results?.[0]?.id;
      const [contactMap, accountMap, dealMap] = await Promise.all([
        contactHsId ? getMapping(integrationId, 'contact', contactHsId) : null,
        companyHsId ? getMapping(integrationId, 'company', companyHsId) : null,
        dealHsId ? getMapping(integrationId, 'deal', dealHsId) : null,
      ]);
      const contactId = contactMap?.internalId ?? null;
      const accountId = accountMap?.internalId ?? null;
      const opportunityId = dealMap?.internalId ?? null;

      // Skip emails with no resolvable association — nothing to attach to
      if (!contactId && !accountId && !opportunityId) {
        stats.emails.skipped++;
        return;
      }

      const data = mapEmailToActivity(ee.properties, contactId, accountId, opportunityId, importerUserId);
      if (!data) { stats.emails.skipped++; return; }

      const existingMap = await getMapping(integrationId, 'email', ee.id);
      if (existingMap) {
        await prisma.activity.update({
          where: { id: existingMap.internalId },
          data: { ...data, createdById: undefined },
        });
        stats.emails.updated++;
        await recordMapping(integrationId, 'email', ee.id, 'Activity', existingMap.internalId);
        return;
      }
      const created = await prisma.activity.create({ data, select: { id: true } });
      stats.emails.created++;
      await recordMapping(integrationId, 'email', ee.id, 'Activity', created.id);
    }, stats, 'email'));
    cursor = { ...cursor, cursors: { ...(cursor.cursors ?? {}), emails: nextAfter ?? undefined } };
    await saveState(integrationId, cursor);
    if (!nextAfter) break;
  }
  cursor = {
    ...cursor,
    cursors: { ...(cursor.cursors ?? {}), emails: undefined },
    completedAt: { ...(cursor.completedAt ?? {}), emails: new Date().toISOString() },
  };
  await saveState(integrationId, cursor);
  return cursor;
}

// ====================== Orchestrator ======================

export async function runFullSync(integrationId: string, triggeredById: string | null, trigger: 'manual' | 'cron' | 'webhook' = 'manual'): Promise<{ runId: string; stats: SyncStats }> {
  const run = await prisma.syncRun.create({
    data: { integrationId, status: 'running', trigger, triggeredById: triggeredById ?? undefined },
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
    const emailInProgress = state.cursors?.emails !== undefined;

    // Skip a phase if it completed within the last hour AND its cursor is
    // undefined. This prevents the wasteful re-iter loop where contacts
    // keeps re-syncing existing records and starves emails phase.
    const RECENT_MS = 60 * 60 * 1000;
    const recentlyCompleted = (phase: 'companies' | 'deals' | 'contacts' | 'emails') => {
      const at = state.completedAt?.[phase];
      if (!at) return false;
      return Date.now() - new Date(at).getTime() < RECENT_MS;
    };

    if (compInProgress || (!recentlyCompleted('companies') && !dealInProgress && !contInProgress && !emailInProgress)) {
      state = await syncCompanies(integrationId, importerId, state, stats, deadline);
    }
    if (Date.now() < deadline && (dealInProgress || !recentlyCompleted('deals'))) {
      state = await syncDeals(integrationId, importerId, state, stats, deadline);
    }
    if (Date.now() < deadline && (contInProgress || !recentlyCompleted('contacts'))) {
      state = await syncContacts(integrationId, importerId, state, stats, deadline);
    }
    if (Date.now() < deadline && (emailInProgress || !recentlyCompleted('emails'))) {
      state = await syncEmails(integrationId, importerId, state, stats, deadline);
    }

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: 'ok',
        finishedAt: new Date(),
        itemsCreated: stats.companies.created + stats.contacts.created + stats.deals.created + stats.emails.created,
        itemsUpdated:
          stats.companies.updated + stats.contacts.updated + stats.deals.updated + stats.emails.updated + stats.companies.merged,
        itemsSkipped: stats.companies.skipped + stats.contacts.skipped + stats.deals.skipped + stats.emails.skipped,
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
