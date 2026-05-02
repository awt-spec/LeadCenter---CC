// Sync engine: pulls Companies → Accounts, Contacts → Contacts, Deals → Opportunities.
// Idempotent via IntegrationMapping (externalId ↔ internalId). Re-runs update.

import { prisma } from '@/lib/db';
import { listObjects, getPipelines } from './client';
import { mapCompanyToAccount, mapContactToContact, mapDealToOpportunity } from './mapping';

interface SyncStats {
  companies: { created: number; updated: number; skipped: number };
  contacts: { created: number; updated: number; skipped: number };
  deals: { created: number; updated: number; skipped: number };
}

const empty = (): SyncStats => ({
  companies: { created: 0, updated: 0, skipped: 0 },
  contacts: { created: 0, updated: 0, skipped: 0 },
  deals: { created: 0, updated: 0, skipped: 0 },
});

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

// ---------- Companies ----------

async function syncCompanies(integrationId: string, importerUserId: string, stats: SyncStats) {
  const props = ['name', 'domain', 'website', 'industry', 'country', 'city', 'address', 'description', 'lifecyclestage', 'legalname'];
  for await (const batch of listObjects(integrationId, 'companies', { properties: props, limit: 100 })) {
    for (const c of batch) {
      const data = mapCompanyToAccount(c.properties as Record<string, string | null>, importerUserId);
      const existingMap = await getMapping(integrationId, 'company', c.id);
      if (existingMap) {
        await prisma.account.update({
          where: { id: existingMap.internalId },
          data: { ...data, createdById: undefined }, // don't overwrite creator on update
        });
        stats.companies.updated++;
        await recordMapping(integrationId, 'company', c.id, 'Account', existingMap.internalId);
        continue;
      }
      // First time — try to match by domain to avoid duplicates with manually created accts
      let internalId: string | null = null;
      if (data.domain) {
        const found = await prisma.account.findFirst({
          where: { domain: { equals: data.domain, mode: 'insensitive' } },
          select: { id: true },
        });
        if (found) internalId = found.id;
      }
      if (!internalId) {
        // Domain may collide; pick a synthetic one if absent or duplicate
        let dom = data.domain;
        if (dom) {
          const collide = await prisma.account.findFirst({ where: { domain: dom }, select: { id: true } });
          if (collide) {
            // Use synthetic to avoid the unique constraint
            dom = `hs-${c.id}.${dom}`.slice(0, 200);
          }
        } else {
          dom = `hs-${c.id}.hubspot.lc-imported`;
        }
        const created = await prisma.account.create({ data: { ...data, domain: dom }, select: { id: true } });
        internalId = created.id;
        stats.companies.created++;
      } else {
        await prisma.account.update({ where: { id: internalId }, data: { ...data, domain: data.domain ?? undefined, createdById: undefined } });
        stats.companies.updated++;
      }
      await recordMapping(integrationId, 'company', c.id, 'Account', internalId);
    }
  }
}

// ---------- Contacts ----------

async function syncContacts(integrationId: string, importerUserId: string, stats: SyncStats) {
  const props = ['email', 'firstname', 'lastname', 'jobtitle', 'phone', 'mobilephone', 'company', 'website', 'country', 'city', 'hs_linkedin_url', 'hs_lead_status'];
  const associations = ['companies'];
  for await (const batch of listObjects(integrationId, 'contacts', { properties: props, associations, limit: 100 })) {
    for (const c of batch) {
      // Resolve company → accountId via existing mapping
      const companyHsId = (c as unknown as { associations?: { companies?: { results: Array<{ id: string }> } } })
        .associations?.companies?.results?.[0]?.id;
      let accountId: string | null = null;
      if (companyHsId) {
        const m = await getMapping(integrationId, 'company', companyHsId);
        if (m) accountId = m.internalId;
      }

      const data = mapContactToContact(c.properties as Record<string, string | null>, accountId, importerUserId);
      if (!data) {
        stats.contacts.skipped++;
        continue;
      }

      const existingMap = await getMapping(integrationId, 'contact', c.id);
      if (existingMap) {
        await prisma.contact.update({
          where: { id: existingMap.internalId },
          data: { ...data, createdById: undefined, email: undefined }, // never re-write email
        });
        stats.contacts.updated++;
        await recordMapping(integrationId, 'contact', c.id, 'Contact', existingMap.internalId);
        continue;
      }
      // Match by email (unique)
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

async function syncDeals(integrationId: string, importerUserId: string, stats: SyncStats) {
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
    for (const d of batch) {
      const companyHsId = (d as unknown as { associations?: { companies?: { results: Array<{ id: string }> } } })
        .associations?.companies?.results?.[0]?.id;
      let accountId: string | null = null;
      if (companyHsId) {
        const m = await getMapping(integrationId, 'company', companyHsId);
        if (m) accountId = m.internalId;
      }
      if (!accountId) {
        // Skip orphan deals (no associated company)
        stats.deals.skipped++;
        continue;
      }
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
  try {
    // Need an "importer" user to attribute records to.
    const integ = await prisma.integration.findUnique({ where: { id: integrationId }, select: { connectedById: true } });
    const importerId = integ?.connectedById ?? triggeredById;
    if (!importerId) throw new Error('No importer user available — connectedById missing');

    await syncCompanies(integrationId, importerId, stats);
    await syncContacts(integrationId, importerId, stats);
    await syncDeals(integrationId, importerId, stats);

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: 'ok',
        finishedAt: new Date(),
        itemsCreated: stats.companies.created + stats.contacts.created + stats.deals.created,
        itemsUpdated: stats.companies.updated + stats.contacts.updated + stats.deals.updated,
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
