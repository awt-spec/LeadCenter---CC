import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = new PrismaClient({ log: ['error'] });
}, 30_000);

afterAll(async () => { await prisma.$disconnect(); });

describe('OPT-002: Pipeline opps NO regresiona a Seq Scan', () => {
  it('EXPLAIN del query NO usa Seq Scan + execution < 100ms', async () => {
    const plan = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
       SELECT id, name FROM "Opportunity"
       WHERE "status" = 'OPEN'
       ORDER BY "stageChangedAt" DESC LIMIT 100`
    );
    const planText = plan.map((r) => r['QUERY PLAN']).join('\n');

    // Con 766 opps el Bitmap Index Scan del status + Sort top-N corre
    // en ~1ms. Si las opps crecen a >5K y el sort se vuelve caro,
    // habrá que agregar composite (status, stageChangedAt DESC).
    // Este test guard catches the regression.
    expect(planText, `Plan completo:\n${planText}`).not.toMatch(/Seq Scan on "Opportunity"/);
    expect(planText).toMatch(/Index Scan|Index Only Scan|Bitmap Index Scan/);

    const m = planText.match(/Execution Time:\s*([\d.]+)\s*ms/);
    if (m) {
      const ms = Number(m[1]);
      expect(ms, `Execution time: ${ms}ms — guard: <100ms`).toBeLessThan(100);
    }
  });
});
