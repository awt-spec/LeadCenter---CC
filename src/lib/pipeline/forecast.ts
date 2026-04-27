import type { Session } from 'next-auth';
import { prisma } from '@/lib/db';
import { can } from '@/lib/rbac';
import { STAGE_PROBABILITY } from '@/lib/opportunities/stage-rules';
import type { PipelineFilters } from './queries';

function scope(session: Session, filters: PipelineFilters) {
  if (filters.onlyMine || !can(session, 'opportunities:read:all')) {
    return { ownerId: session.user.id };
  }
  return {};
}

export type PipelineStats = {
  pipelineTotal: number;
  pipelineDelta: number | null;
  forecast: number;
  forecastDelta: number | null;
  openCount: number;
  openCountDelta: number | null;
  winRate: number;
  winRateDelta: number | null;
};

export async function computePipelineStats(
  session: Session,
  filters: PipelineFilters
): Promise<PipelineStats> {
  const ownerScope = scope(session, filters);

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const last30 = new Date(now.getTime() - 30 * dayMs);
  const prev30Start = new Date(now.getTime() - 60 * dayMs);
  const last90 = new Date(now.getTime() - 90 * dayMs);
  const prev90Start = new Date(now.getTime() - 180 * dayMs);

  const [openOpps, closed90, closedPrev90] = await Promise.all([
    prisma.opportunity.findMany({
      where: { ...ownerScope, status: 'OPEN' },
      select: { estimatedValue: true, stage: true, createdAt: true },
    }),
    prisma.opportunity.findMany({
      where: {
        ...ownerScope,
        status: { in: ['WON', 'LOST'] },
        closedAt: { gte: last90 },
      },
      select: { status: true },
    }),
    prisma.opportunity.findMany({
      where: {
        ...ownerScope,
        status: { in: ['WON', 'LOST'] },
        closedAt: { gte: prev90Start, lt: last90 },
      },
      select: { status: true },
    }),
  ]);

  const pipelineTotal = openOpps.reduce((acc, o) => acc + Number(o.estimatedValue ?? 0), 0);
  const forecast = openOpps.reduce((acc, o) => {
    const p = STAGE_PROBABILITY[o.stage];
    return acc + Number(o.estimatedValue ?? 0) * (p / 100);
  }, 0);

  const pipelineCreatedLast30 = openOpps
    .filter((o) => o.createdAt >= last30)
    .reduce((acc, o) => acc + Number(o.estimatedValue ?? 0), 0);
  const pipelineCreatedPrev30 = openOpps
    .filter((o) => o.createdAt >= prev30Start && o.createdAt < last30)
    .reduce((acc, o) => acc + Number(o.estimatedValue ?? 0), 0);

  const winRate =
    closed90.length > 0
      ? (closed90.filter((o) => o.status === 'WON').length / closed90.length) * 100
      : 0;
  const prevWinRate =
    closedPrev90.length > 0
      ? (closedPrev90.filter((o) => o.status === 'WON').length / closedPrev90.length) * 100
      : null;

  const delta = (curr: number, prev: number | null) =>
    prev === null || prev === 0 ? null : ((curr - prev) / prev) * 100;

  return {
    pipelineTotal,
    pipelineDelta: delta(pipelineCreatedLast30, pipelineCreatedPrev30),
    forecast,
    forecastDelta: null,
    openCount: openOpps.length,
    openCountDelta: null,
    winRate,
    winRateDelta: prevWinRate !== null ? delta(winRate, prevWinRate) : null,
  };
}
