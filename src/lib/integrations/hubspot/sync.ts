// Sync engine: pulls HubSpot → LeadCenter. Idempotent via IntegrationMapping.
//
// Dedup strategy (in order, less-rigid as requested):
//   1. HubSpot id ↔ LC id mapping (always wins).
//   2. Real domain match (case-insensitive, ignoring synthetic *.lc-imported).
//   3. Fuzzy name match (NFD-normalised, lowercased, suffix-stripped).
//   4. Create new account.
//
// When a HubSpot company merges into an account that had a synthetic domain,
// the synthetic domain is replaced with the real one and `needsDomainReview`
// is cleared — so the red flag in the UI disappears.
//
// Time budget: each runFullSync caps at ~4min wall-clock so Vercel's 5-min
// function limit doesn't kill us mid-write. Remaining work picks up on the
// next /15-min cron tick.

import { prisma } from '@/lib/db';
import type { Account } from '@prisma/client';
import { listObjects, getPipelines } from './client';
import { mapCompanyToAccount, mapContactToContact, mapDealToOpportunity } from './mapping';

interface SyncStats {
  companies: { created: number; updated: number; merged: number; skipped: number };
  contacts:  { created: number; updated: number; skipped: number };
  deals:     { created: number; updated: number; skipped: number };
  truncated: boolean;
}

const empty = (): SyncStats => ({
  companies: { created: 0, updated: 0, merged: 0, skipped: 0 },
  contacts:  { created: 0, updated: 0, skipped: 0 },
  deals:     { created: 0, updated: 0, skipped: 0 },
  truncated: false,
});

const TIME_BUDGET_MS = 4 * 60 * 1000;

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

/// Find the best candidate Account to merge with.
async function findCandidateAccount(name: string, domain: string | null): Promise<Account | null> {
  // 1) Exact real-domain match (don't match against synthetic placeholders)
  if (domain) {
    const realDomainMatch = await prisma.account.findFirst({
      where: { domain: { equals: domain, mode: 'insensitive' } },
    });
    if (realDomainMatch && !isSyntheticDomain(realDomainMatch.domain)) return realDomainMatch;
    if (realDomainMatch) return realDomainMatch; // synthetic but exact — still fine
  }
  // 2) Fuzzy name match (only when name is reasonably long to avoid false positives)
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

// ---------- Companies ----------

async function syncCompanies(integrationId: string, importerUserId: string, stats: SyncStats, deadline: number) {
  const props = ['name', 'domain', 'website', 'industry', 'country', 'city', 'address', 'description', 'lifecyclestage', 'legalname'];
  for await (const batch of listObjects(integrationId, 'companies', { properties: props, limit: 100 })) {
    if (Date.now() > deadline) { stats.truncated = true; return; }
    for (const c of batch) {
      const data = mapCompanyToAccount(c.properties as Record<string, string | null>, importerUserId);
      const realDomain = !isSyntheticDomain(data.domain ?? null) ? (data.domain ?? null) : null;

      // 1) HubSpot id mapping wins
      const existingMap = await getMapping(integrationId, 'company', c.id);
      if (existingMap) {
        await prisma.account.update({
          where: { id: existingMap.internalId },
          data: {
            ...data,
            createdById: undefined,
            // Clear the red flag when we now have a real domain.
            ...(realDomain ? { needsDomainReview: false } : {}),
          },
        });
        stats.companies.updated++;
        await recordMapping(integrationId, 'company', c.id, 'Account', existingMap.internalId);
        continue;
      }

      // 2) Find a candidate to merge into (domain → fuzzy name)
      const candidate = await findCandidateAccount(data.name, realDomain);
      if (candidate) {
        // Merge: prefer HubSpot real values, but keep LC-side createdById/internalNotes/offlineResearch.
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
            // Description: only fill if LC was empty (avoid overwriting curated text)
            description: candidate.description ?? data.description ?? null,
            status: candidate.status === 'PROSPECT' ? data.status : candidate.status,
            // Update the red flag
            needsDomainReview: !realDomain && candidate.needsDomainReview,
          },
        });
        stats.companies.merged++;
        await recordMapping(integrationId, 'company', c.id, 'Account', candidate.id);
        continue;
      }

      // 3) Create new — flag if no real domain
      const dom = realDomain ?? `hs-${c.id}.hubspot.lc-imported`;
      const created = await prisma.account.create({
        data: { ...data, domain: dom, needsDomainReview: !realDomain },
        select: { id: true },
      });
      stats.companies.created++;
      await recordMapping(integrationId, 'company', c.id, 'Account', created.id);
    }
  }
}

// ---------- Contacts ----------

async function syncContacts(integrationId: string, importerUserId: string, stats: SyncStats, deadline: number) {
  const props = ['email', 'firstname', 'lastname', 'jobtitle', 'phone', 'mobilephone', 'company', 'website', 'country', 'city', 'hs_linkedin_url', 'hs_lead_status'];
  const associations = ['companies'];
  for await (const batch of listObjects(integrationId, 'contacts', { properties: props, associations, limit: 100 })) {
    if (Date.now() > deadline) { stats.truncated = true; return; }
    for (const c of batch) {
      const companyHsId = (c as unknown as { associations?: { companies?: { results: Array<{ id: string }> } } })
        .associations?.companies?.results?.[0]?.id;
      let accountId: string | null = null;
      if (companyHsId) {
        const m = await getMapping(integrationId, 'company', companyHsId);
        if (m) accountId = m.internalId;
      }

      const data = mapContactToContact(c.properties as Record<string, string | null>, accountId, importerUserId);
      if (!data) { stats.contacts.skipped++; continue; }

      const existingMap = await getMapping(integrationId, 'contact', c.id);
      if (existingMap) {
        await prisma.contact.update({
          where: { id: existingMap.internalId },
          data: { ...data, createdById: undefined, email: undefined },
        });
        stats.contacts.updated++;
        await recordMapping(integrationId, 'contact', c.id, 'Contact', existingMap.internalId);
        continue;
      }
      // Email is unique → use it as the secondary key
      const existingByEmail = await prisma.contact.findUnique({ where: { email: data.email } });
      if (existingByEmail) {
        await prisma.contact.update({
          where: { id: existingByEmail.id },
          data: { ...data, createdById: undefined, email: undefined },
        });
        stats.contacts.updated++;
        await recordMapping(integrationId, 'contact', c.id, 'Contact', existingByEmail.id);
        continue;
      }
      const created = await prisma.contact.create({ data, select: { id: true } });
      stats.contacts.created++;
      await recordMapping(integrationId, 'contact', c.id, 'Contact', created.id);
    }
  }
}

// ---------- Deals ----------

async function syncDeals(integrationId: string, importerUserId: string, stats: SyncStats, deadline: number) {
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
  for await (const batch of listObjects(integrationId, 'deals', { properties: props, associations, limit: 100 })) {
    if (Date.now() > deadline) { stats.truncated = true; return; }
    for (const d of batch) {
      const companyHsId = (d as unknown as { associations?: { companies?: { results: Array<{ id: string }> } } })
        .associations?.companies?.results?.[0]?.id;
      let accountId: string | null = null;
      if (companyHsId) {
        const m = await getMapping(integrationId, 'company', companyHsId);
        if (m) accountId = m.internalId;
      }
      if (!accountId) { stats.deals.skipped++; continue; }
      const data = mapDealToOpportunity(d.properties as Record<string, string | null>, accountId, importerUserId, stageById);

      const existingMap = await getMapping(integrationId, 'deal', d.id);
      if (existingMap) {
        await prisma.opportunity.update({
          where: { id: existingMap.internalId },
          data: { ...data, createdById: undefined },
        });
        stats.deals.updated++;
        await recordMapping(integrationId, 'deal', d.id, 'Opportunity', existingMap.internalId);
        continue;
      }
      const created = await prisma.opportunity.create({ data, select: { id: true } });
      stats.deals.created++;
      await recordMapping(integrationId, 'deal', d.id, 'Opportunity', created.id);
    }
  }
}

// ---------- Orchestrator ----------

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

    // Order: companies first (so contacts/deals can resolve their account FK).
    await syncCompanies(integrationId, importerId, stats, deadline);
    if (Date.now() < deadline) await syncDeals(integrationId, importerId, stats, deadline);
    if (Date.now() < deadline) await syncContacts(integrationId, importerId, stats, deadline);

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: 'ok',
        finishedAt: new Date(),
        itemsCreated: stats.companies.created + stats.contacts.created + stats.deals.created,
        itemsUpdated: stats.companies.updated + stats.contacts.updated + stats.deals.updated + stats.companies.merged,
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
