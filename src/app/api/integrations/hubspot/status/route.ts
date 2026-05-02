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

  const grouped = await prisma.integrationMapping.groupBy({
    by: ['internalType'],
    where: { integrationId: integ.id },
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(grouped.map((c) => [c.internalType, c._count._all]));

  const lastRun = integ.runs[0];
  const state = (integ.syncState ?? {}) as {
    cursors?: { companies?: string; contacts?: string; deals?: string; emails?: string };
    totals?: { companies?: number; contacts?: number; deals?: number; emails?: number };
    phase?: string;
  };
  const totals = {
    accounts: state.totals?.companies ?? 0,
    contacts: state.totals?.contacts ?? 0,
    opportunities: state.totals?.deals ?? 0,
    emails: state.totals?.emails ?? 0,
  };
  const counts = {
    accounts: countMap['Account'] ?? 0,
    contacts: countMap['Contact'] ?? 0,
    opportunities: countMap['Opportunity'] ?? 0,
    emails: countMap['Activity'] ?? 0,
  };
  const progress = {
    accounts: totals.accounts > 0 ? Math.min(1, counts.accounts / totals.accounts) : null,
    contacts: totals.contacts > 0 ? Math.min(1, counts.contacts / totals.contacts) : null,
    opportunities: totals.opportunities > 0 ? Math.min(1, counts.opportunities / totals.opportunities) : null,
    emails: totals.emails > 0 ? Math.min(1, counts.emails / totals.emails) : null,
  };
  // Phase: if any cursor is present, that phase is in-progress; else 'idle'.
  let phase: 'companies' | 'deals' | 'contacts' | 'emails' | 'idle' = 'idle';
  if (state.cursors?.companies !== undefined) phase = 'companies';
  else if (state.cursors?.deals !== undefined) phase = 'deals';
  else if (state.cursors?.contacts !== undefined) phase = 'contacts';
  else if (state.cursors?.emails !== undefined) phase = 'emails';

  return NextResponse.json({
    status: integ.status,
    lastSyncedAt: integ.lastSyncedAt,
    lastError: integ.lastError,
    counts,
    totals,
    progress,
    phase,
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
