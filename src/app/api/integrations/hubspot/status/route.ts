import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/// Lightweight polling endpoint. Used by the UI to show live sync progress
/// without waiting for the full /sync POST to return.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !can(session, 'settings:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const integ = await prisma.integration.findFirst({
    where: { provider: 'hubspot' },
    include: {
      runs: {
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!integ) return NextResponse.json({ status: 'NONE' });

  const counts = await prisma.integrationMapping.groupBy({
    by: ['internalType'],
    where: { integrationId: integ.id },
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(counts.map((c) => [c.internalType, c._count._all]));

  const lastRun = integ.runs[0];
  return NextResponse.json({
    status: integ.status,
    lastSyncedAt: integ.lastSyncedAt,
    lastError: integ.lastError,
    counts: {
      accounts: countMap['Account'] ?? 0,
      contacts: countMap['Contact'] ?? 0,
      opportunities: countMap['Opportunity'] ?? 0,
    },
    lastRun: lastRun
      ? {
          id: lastRun.id,
          status: lastRun.status,
          startedAt: lastRun.startedAt,
          finishedAt: lastRun.finishedAt,
          itemsCreated: lastRun.itemsCreated,
          itemsUpdated: lastRun.itemsUpdated,
          itemsSkipped: lastRun.itemsSkipped,
          error: lastRun.error,
        }
      : null,
  });
}
