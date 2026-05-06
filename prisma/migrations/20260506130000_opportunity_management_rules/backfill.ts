// Backfill chunked de Activity.direction + Opportunity.lastActivityDirection.
// Se ejecuta por separado del DDL para no chocar con statement_timeout.
//
//   bun run prisma/migrations/20260506130000_opportunity_management_rules/backfill.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['error'] });

async function main() {
  console.log('==> Backfill 1/2: Activity.direction (chunked)');
  let total = 0;
  while (true) {
    // Update en chunks de 5000 IDs ordenados por createdAt — Postgres
    // recibe IN-list pequeño, no escanea toda la tabla.
    const batch = await prisma.activity.findMany({
      where: { direction: null },
      select: { id: true, type: true },
      take: 5000,
      orderBy: { occurredAt: 'asc' },
    });
    if (batch.length === 0) break;

    // Agrupar por dirección derivada para hacer 1 update por bucket
    const buckets: Record<string, string[]> = { OUTBOUND: [], INBOUND: [], INTERNAL: [] };
    for (const r of batch) {
      const dir =
        r.type === 'EMAIL_RECEIVED'
          ? 'INBOUND'
          : r.type === 'INTERNAL_NOTE' ||
              r.type === 'STAGE_CHANGE' ||
              r.type === 'STATUS_CHANGE' ||
              r.type === 'CONTACT_LINKED'
            ? 'INTERNAL'
            : 'OUTBOUND';
      buckets[dir].push(r.id);
    }

    for (const [dir, ids] of Object.entries(buckets)) {
      if (ids.length === 0) continue;
      await prisma.activity.updateMany({
        where: { id: { in: ids } },
        data: { direction: dir as 'OUTBOUND' | 'INBOUND' | 'INTERNAL' },
      });
    }

    total += batch.length;
    process.stdout.write(`\r  ...${total} rows`);
  }
  console.log(`\n  ✓ Activity.direction backfill OK (${total} rows)`);

  console.log('==> Backfill 2/2: Opportunity.lastActivityDirection (chunked)');
  let oppCount = 0;
  while (true) {
    const opps = await prisma.opportunity.findMany({
      where: {
        lastActivityDirection: null,
        lastActivityAt: { not: null },
      },
      select: { id: true },
      take: 500,
    });
    if (opps.length === 0) break;

    for (const opp of opps) {
      const last = await prisma.activity.findFirst({
        where: { opportunityId: opp.id },
        orderBy: { occurredAt: 'desc' },
        select: { direction: true },
      });
      if (last?.direction) {
        await prisma.opportunity.update({
          where: { id: opp.id },
          data: { lastActivityDirection: last.direction },
        });
      }
    }
    oppCount += opps.length;
    process.stdout.write(`\r  ...${oppCount} opps`);
  }
  console.log(`\n  ✓ Opportunity.lastActivityDirection backfill OK (${oppCount} opps)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
