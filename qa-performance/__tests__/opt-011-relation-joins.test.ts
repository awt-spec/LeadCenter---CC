// OPT-011: usar relationLoadStrategy: 'join' para colapsar el N+1
// implícito de los Prisma includes anidados.
//
// Test: medir mismo query con strategy "query" (default, N+1) vs
// strategy "join" (LATERAL JOINs, 1 query SQL). Esperamos que join
// sea consistentemente más rápido o equivalente.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;
let topAccountId: string;

const includeShape = {
  createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
  contact: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
  account: { select: { id: true, name: true } },
  opportunity: { select: { id: true, name: true, code: true } },
  participants: {
    include: { contact: { select: { id: true, fullName: true, avatarUrl: true } } },
    take: 8,
  },
  mentions: {
    include: { mentionedUser: { select: { id: true, name: true, avatarUrl: true } } },
    take: 5,
  },
  attachments: {
    select: { id: true, fileName: true, fileUrl: true, fileSize: true, mimeType: true },
    take: 8,
  },
  nextActionAssignee: { select: { id: true, name: true, avatarUrl: true } },
  assignees: {
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    take: 5,
  },
} as const;

beforeAll(async () => {
  prisma = new PrismaClient({ log: ['error'] });
  const top = await prisma.$queryRawUnsafe<Array<{ accountId: string }>>(
    `SELECT "accountId" FROM "Activity" WHERE "accountId" IS NOT NULL
     GROUP BY "accountId" ORDER BY COUNT(*) DESC LIMIT 1`
  );
  topAccountId = top[0]?.accountId ?? '';
}, 60_000);

afterAll(async () => { await prisma.$disconnect(); });

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; result: T }> {
  const start = Date.now();
  const result = await fn();
  return { ms: Date.now() - start, result };
}

describe('OPT-011: relationLoadStrategy join elimina N+1 implícito', () => {
  it('"join" strategy es consistente / más rápido que "query" en timeline', async () => {
    expect(topAccountId).toBeTruthy();
    const where = { accountId: topAccountId } as const;

    // Warm DB cache primero
    await prisma.activity.findMany({ where, include: includeShape, orderBy: { occurredAt: 'desc' }, take: 25 });

    // Medir 3 corridas de cada strategy y tomar la mediana
    const queryRuns: number[] = [];
    const joinRuns: number[] = [];
    for (let i = 0; i < 3; i++) {
      const q = await timed(() => prisma.activity.findMany({
        where, include: includeShape, relationLoadStrategy: 'query',
        orderBy: { occurredAt: 'desc' }, take: 25,
      }));
      queryRuns.push(q.ms);
      const j = await timed(() => prisma.activity.findMany({
        where, include: includeShape, relationLoadStrategy: 'join',
        orderBy: { occurredAt: 'desc' }, take: 25,
      }));
      joinRuns.push(j.ms);
    }
    queryRuns.sort((a, b) => a - b);
    joinRuns.sort((a, b) => a - b);
    const queryMedian = queryRuns[1];
    const joinMedian = joinRuns[1];
    console.log(`  query strategy: median=${queryMedian}ms (runs=${queryRuns})`);
    console.log(`  join  strategy: median=${joinMedian}ms (runs=${joinRuns})`);

    // join no debería ser >50% más lento que query (margen de tolerancia
    // por variabilidad de red). En la práctica esperamos join < query.
    expect(joinMedian, `join median ${joinMedian}ms, query median ${queryMedian}ms`).toBeLessThan(queryMedian * 1.5);
  });
});
