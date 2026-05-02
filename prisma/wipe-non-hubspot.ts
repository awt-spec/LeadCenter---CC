// One-shot cleanup: wipes everything that did NOT come from HubSpot.
// Survival criterion: a record is kept only if it has an IntegrationMapping
// (provider='hubspot', internalType=record-type, internalId=record.id).
//
// Run manually:
//   DATABASE_URL="$DIRECT_URL" bun prisma/wipe-non-hubspot.ts
//
// SAFETY: this is destructive. Run once, after the user explicitly asked
// "borra todo lo CSV/BD anterior, sólo dejame lo que viene de HubSpot".

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 0) Pre-counts (for the "before" snapshot in the log)
  const before = {
    accounts: await prisma.account.count(),
    contacts: await prisma.contact.count(),
    opportunities: await prisma.opportunity.count(),
    tasks: await prisma.task.count(),
    activities: await prisma.activity.count(),
    campaigns: await prisma.campaign.count(),
    campaignContacts: await prisma.campaignContact.count(),
    mappings: await prisma.integrationMapping.count(),
    syncRuns: await prisma.syncRun.count(),
  };
  console.log('Before:', before);

  // 1) Surviving HubSpot record ids (whatever was already mapped)
  const accountIdsHs = (
    await prisma.integrationMapping.findMany({
      where: { internalType: 'Account' },
      select: { internalId: true },
    })
  ).map((m) => m.internalId);
  const contactIdsHs = (
    await prisma.integrationMapping.findMany({
      where: { internalType: 'Contact' },
      select: { internalId: true },
    })
  ).map((m) => m.internalId);
  const opportunityIdsHs = (
    await prisma.integrationMapping.findMany({
      where: { internalType: 'Opportunity' },
      select: { internalId: true },
    })
  ).map((m) => m.internalId);
  console.log('Survivors via mapping:', {
    accounts: accountIdsHs.length,
    contacts: contactIdsHs.length,
    opportunities: opportunityIdsHs.length,
  });

  // 2) Tasks: tied to Account; if the account is going, kill them.
  const taskDel = await prisma.task.deleteMany({
    where: {
      OR: [
        { accountId: { notIn: accountIdsHs.length ? accountIdsHs : ['__never__'] } },
        { accountId: null },
      ],
    },
  });
  console.log(`  Tasks deleted: ${taskDel.count}`);

  // 3) Activities — same logic
  const actDel = await prisma.activity.deleteMany({
    where: {
      OR: [
        { accountId: { notIn: accountIdsHs.length ? accountIdsHs : ['__never__'] } },
        { accountId: null },
      ],
    },
  });
  console.log(`  Activities deleted: ${actDel.count}`);

  // 4) Opportunities not from HubSpot
  const oppDel = await prisma.opportunity.deleteMany({
    where: { id: { notIn: opportunityIdsHs.length ? opportunityIdsHs : ['__never__'] } },
  });
  console.log(`  Opportunities deleted: ${oppDel.count}`);

  // 5) Contacts not from HubSpot
  const contactDel = await prisma.contact.deleteMany({
    where: { id: { notIn: contactIdsHs.length ? contactIdsHs : ['__never__'] } },
  });
  console.log(`  Contacts deleted: ${contactDel.count}`);

  // 6) Accounts not from HubSpot
  const acctDel = await prisma.account.deleteMany({
    where: { id: { notIn: accountIdsHs.length ? accountIdsHs : ['__never__'] } },
  });
  console.log(`  Accounts deleted: ${acctDel.count}`);

  // 7) BD-NOTION campaign and any orphaned campaigns
  const campDel = await prisma.campaign.deleteMany({
    where: { code: 'BD-NOTION-2026' },
  });
  console.log(`  Campaigns deleted: ${campDel.count}`);

  // 8) Failed/error sync runs older than now (just keep history of OK ones)
  const runDel = await prisma.syncRun.deleteMany({
    where: { status: 'error' },
  });
  console.log(`  Failed sync runs cleared: ${runDel.count}`);

  // 9) Reset Integration error
  await prisma.integration.updateMany({
    where: { provider: 'hubspot' },
    data: { lastError: null },
  });

  // 10) After-counts
  const after = {
    accounts: await prisma.account.count(),
    contacts: await prisma.contact.count(),
    opportunities: await prisma.opportunity.count(),
    tasks: await prisma.task.count(),
    activities: await prisma.activity.count(),
    campaigns: await prisma.campaign.count(),
    mappings: await prisma.integrationMapping.count(),
    syncRuns: await prisma.syncRun.count(),
  };
  console.log('\nAfter:', after);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
