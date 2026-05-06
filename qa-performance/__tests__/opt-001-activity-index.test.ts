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

afterAll(async () => {
  await prisma.$disconnect();
});

describe('OPT-001: Activity timeline usa el composite index', () => {
  it('EXPLAIN del query de timeline NO usa Activity_occurredAt_idx (single col)', async () => {
    expect(topAccountId).toBeTruthy();
    const plan = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
       SELECT id, "occurredAt", type FROM "Activity"
       WHERE "accountId" = $1
       ORDER BY "occurredAt" DESC LIMIT 25`,
      topAccountId
    );
    const planText = plan.map((r) => r['QUERY PLAN']).join('\n');

    // El test espera que el planner use el composite. Antes del fix esto FALLA
    // porque el planner elige Activity_occurredAt_idx (single col) y filtra
    // 90K+ filas en memoria.
    expect(planText, `Plan completo:\n${planText}`).toMatch(
      /Activity_accountId_occurredAt_idx/
    );
    // Y que NO esté usando el single-col occurredAt index
    expect(planText).not.toMatch(/using "Activity_occurredAt_idx"/);
    // Y que no tenga "Rows Removed by Filter" en el order de miles
    const removed = planText.match(/Rows Removed by Filter:\s*(\d+)/);
    if (removed) {
      const n = Number(removed[1]);
      expect(n, `Filtró ${n} filas. Esperábamos <100`).toBeLessThan(100);
    }
  });

  it('Query es rápida (<1s p99 en cold cache)', async () => {
    expect(topAccountId).toBeTruthy();
    const start = Date.now();
    await prisma.activity.findMany({
      where: { accountId: topAccountId },
      orderBy: { occurredAt: 'desc' },
      take: 25,
    });
    const ms = Date.now() - start;
    // Antes del fix: ~1500-19000ms. Después: <500ms incluso con cold cache.
    expect(ms, `Tomó ${ms}ms — esperábamos <1000`).toBeLessThan(1000);
  });
});
