import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = new PrismaClient({ log: ['error'] });
}, 30_000);

afterAll(async () => { await prisma.$disconnect(); });

describe('OPT-002: Pipeline opps usa composite index', () => {
  it('EXPLAIN del query de pipeline NO usa Seq Scan', async () => {
    const plan = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
       SELECT id, name FROM "Opportunity"
       WHERE "status" = 'OPEN'
       ORDER BY "stageChangedAt" DESC LIMIT 100`
    );
    const planText = plan.map((r) => r['QUERY PLAN']).join('\n');

    // Antes del fix: Seq Scan + sort. Después: Index Scan via
    // Opportunity_status_stageChangedAt_idx.
    expect(planText, `Plan completo:\n${planText}`).not.toMatch(/Seq Scan on "Opportunity"/);
    expect(planText).toMatch(/Index Scan|Index Only Scan/);
  });
});
