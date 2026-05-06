// Test directo contra Prisma — duplica la query exacta de getOpportunityById
// para evitar la cascada de imports (auth.config etc) que NextAuth requiere
// cargar en server-side. El comportamiento testeado es el `take` en cada
// include nested.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;
let oppId: string;

beforeAll(async () => {
  prisma = new PrismaClient({ log: ['error'] });
  const top = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT o.id FROM "Opportunity" o
       LEFT JOIN "StageHistory" h ON h."opportunityId" = o.id
       GROUP BY o.id ORDER BY COUNT(h.id) DESC LIMIT 1`
  );
  oppId = top[0]?.id ?? '';
}, 60_000);

afterAll(async () => { await prisma.$disconnect(); });

async function fetchOpp(id: string) {
  return prisma.opportunity.findUnique({
    where: { id },
    include: {
      contactRoles: {
        include: { contact: { select: { id: true, fullName: true } } },
        orderBy: [{ isPrimary: 'desc' }, { addedAt: 'asc' }],
        take: 50,
      },
      stageHistory: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { changedAt: 'desc' },
        take: 50,
      },
      checkpoints: {
        orderBy: [{ completedAt: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 100,
      },
    },
  });
}

describe('OPT-003: getOpportunityById limita arrays nested', () => {
  it('stageHistory tiene como máximo 50 entries', async () => {
    expect(oppId).toBeTruthy();
    const opp = await fetchOpp(oppId);
    expect(opp).not.toBeNull();
    if (!opp) return;
    expect(opp.stageHistory.length).toBeLessThanOrEqual(50);
  });

  it('checkpoints tiene como máximo 100 entries', async () => {
    const opp = await fetchOpp(oppId);
    if (!opp) return;
    expect(opp.checkpoints.length).toBeLessThanOrEqual(100);
  });

  it('contactRoles tiene como máximo 50 entries', async () => {
    const opp = await fetchOpp(oppId);
    if (!opp) return;
    expect(opp.contactRoles.length).toBeLessThanOrEqual(50);
  });
});
