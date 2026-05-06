import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;
let topAccountId: string;

beforeAll(async () => {
  prisma = new PrismaClient({ log: ['error'] });
  const top = await prisma.$queryRawUnsafe<Array<{ accountId: string }>>(
    `SELECT "accountId" FROM "Activity" WHERE "accountId" IS NOT NULL
     GROUP BY "accountId" ORDER BY COUNT(*) DESC LIMIT 1`
  );
  topAccountId = top[0]?.accountId ?? '';
}, 60_000);

afterAll(async () => { await prisma.$disconnect(); });

describe('OPT-005: listActivities timeline de cuenta usa el composite limpio', () => {
  it('Query directa con accountId NO usa Bitmap+OR ni Sort top-N caro', async () => {
    expect(topAccountId).toBeTruthy();
    const plan = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
       SELECT id FROM "Activity"
       WHERE "accountId" = $1
       ORDER BY "occurredAt" DESC LIMIT 25`,
      topAccountId
    );
    const planText = plan.map((r) => r['QUERY PLAN']).join('\n');
    expect(planText).toMatch(/Activity_accountId_occurredAt_idx/);
    expect(planText).not.toMatch(/Bitmap (Heap|Index) Scan/);

    const m = planText.match(/Execution Time:\s*([\d.]+)\s*ms/);
    if (m) {
      const ms = Number(m[1]);
      expect(ms, `Execution time: ${ms}ms — esperábamos <100ms`).toBeLessThan(100);
    }
  });

  it('Activities con SOLO contactId que tiene account tienen accountId backfilled', async () => {
    // Después del backfill, no debería haber activities con contactId.account != null
    // pero sin accountId.
    const orphans = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count
         FROM "Activity" a
         INNER JOIN "Contact" c ON a."contactId" = c.id
         WHERE a."accountId" IS NULL
           AND a."contactId" IS NOT NULL
           AND c."accountId" IS NOT NULL`
    );
    expect(Number(orphans[0]?.count ?? 0)).toBe(0);
  });
});
