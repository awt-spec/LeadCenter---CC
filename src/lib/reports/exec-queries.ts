import 'server-only';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { STAGE_PROBABILITY } from '@/lib/opportunities/stage-rules';

/**
 * Reportes ejecutivos para el landing /reports/exec.
 *
 * Todas las queries reciben un período (week/month/quarter/year) y
 * computan: KPIs con deltas vs período previo, top deals, top
 * performers, deals at risk, forecast, anomalías sales-specific.
 */

export type ExecPeriod = 'week' | 'month' | 'quarter' | 'year';

export type DateRangeWithCompare = {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  label: string;
};

export function periodRange(period: ExecPeriod, ref: Date = new Date()): DateRangeWithCompare {
  const end = new Date(ref);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  const prevEnd = new Date(end);
  const prevStart = new Date(end);

  if (period === 'week') {
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    prevEnd.setDate(start.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);
    prevStart.setDate(prevEnd.getDate() - 6);
    prevStart.setHours(0, 0, 0, 0);
    return { start, end, prevStart, prevEnd, label: 'Esta semana' };
  }
  if (period === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    prevEnd.setDate(0); // último día del mes anterior
    prevEnd.setHours(23, 59, 59, 999);
    prevStart.setMonth(prevEnd.getMonth(), 1);
    prevStart.setHours(0, 0, 0, 0);
    return { start, end, prevStart, prevEnd, label: 'Este mes' };
  }
  if (period === 'quarter') {
    const q = Math.floor(end.getMonth() / 3);
    start.setMonth(q * 3, 1);
    start.setHours(0, 0, 0, 0);
    prevEnd.setTime(start.getTime() - 1);
    prevStart.setMonth(start.getMonth() - 3, 1);
    prevStart.setHours(0, 0, 0, 0);
    return { start, end, prevStart, prevEnd, label: 'Este trimestre' };
  }
  // year
  start.setMonth(0, 1);
  start.setHours(0, 0, 0, 0);
  prevEnd.setTime(start.getTime() - 1);
  prevStart.setFullYear(start.getFullYear() - 1, 0, 1);
  prevStart.setHours(0, 0, 0, 0);
  return { start, end, prevStart, prevEnd, label: 'Este año' };
}

export type ExecKPIs = {
  // Pipeline state (snapshot — no period)
  pipelineTotal: number;
  pipelineWeighted: number;
  openCount: number;

  // Period KPIs
  wonValue: number;
  wonCount: number;
  lostValue: number;
  lostCount: number;
  newDealsCount: number;
  newDealsValue: number;
  winRate: number;
  avgDealSize: number;
  avgCycleDays: number;
  activitiesCount: number;

  // Deltas vs prev period (% change). null si no hay base.
  deltaWonValue: number | null;
  deltaWonCount: number | null;
  deltaWinRate: number | null;
  deltaNewDeals: number | null;
  deltaActivities: number | null;
};

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / prev) * 100;
}

export async function getExecKPIs(
  range: DateRangeWithCompare,
  scope: Prisma.OpportunityWhereInput = {}
): Promise<ExecKPIs> {
  const [openOpps, periodOpps, prevOpps, periodActivities, prevActivities] = await Promise.all([
    // Snapshot: opps abiertas ahora
    prisma.opportunity.findMany({
      where: { ...scope, status: 'OPEN' },
      select: { stage: true, estimatedValue: true },
    }),
    // Opps creadas o cerradas en el período
    prisma.opportunity.findMany({
      where: {
        ...scope,
        OR: [
          { createdAt: { gte: range.start, lte: range.end } },
          { closedAt: { gte: range.start, lte: range.end } },
        ],
      },
      select: {
        status: true,
        estimatedValue: true,
        createdAt: true,
        closedAt: true,
      },
    }),
    // Opps creadas o cerradas en el período PREVIO
    prisma.opportunity.findMany({
      where: {
        ...scope,
        OR: [
          { createdAt: { gte: range.prevStart, lte: range.prevEnd } },
          { closedAt: { gte: range.prevStart, lte: range.prevEnd } },
        ],
      },
      select: {
        status: true,
        estimatedValue: true,
        createdAt: true,
        closedAt: true,
      },
    }),
    prisma.activity.count({
      where: { occurredAt: { gte: range.start, lte: range.end } },
    }),
    prisma.activity.count({
      where: { occurredAt: { gte: range.prevStart, lte: range.prevEnd } },
    }),
  ]);

  // Pipeline snapshot
  let pipelineTotal = 0;
  let pipelineWeighted = 0;
  for (const o of openOpps) {
    const v = o.estimatedValue ? Number(o.estimatedValue) : 0;
    pipelineTotal += v;
    pipelineWeighted += v * (STAGE_PROBABILITY[o.stage] / 100);
  }

  // Period stats helper
  const summarize = (rows: typeof periodOpps) => {
    let wonV = 0,
      lostV = 0,
      newV = 0;
    let wonC = 0,
      lostC = 0,
      newC = 0;
    let cycleDaysSum = 0,
      cycleCount = 0;
    for (const o of rows) {
      const v = o.estimatedValue ? Number(o.estimatedValue) : 0;
      if (o.createdAt >= range.start && o.createdAt <= range.end) {
        newV += v;
        newC += 1;
      }
      if (o.closedAt && o.closedAt >= range.start && o.closedAt <= range.end) {
        if (o.status === 'WON') {
          wonV += v;
          wonC += 1;
          cycleDaysSum +=
            (o.closedAt.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          cycleCount += 1;
        } else if (o.status === 'LOST') {
          lostV += v;
          lostC += 1;
        }
      }
    }
    const closed = wonC + lostC;
    const winRate = closed > 0 ? (wonC / closed) * 100 : 0;
    const avg = wonC > 0 ? wonV / wonC : 0;
    const cycle = cycleCount > 0 ? cycleDaysSum / cycleCount : 0;
    return { wonV, lostV, newV, wonC, lostC, newC, winRate, avg, cycle };
  };

  const cur = summarize(periodOpps);
  const prev = summarize(prevOpps);

  // Adapt period stats from PREVIOUS period using prev range
  const summarizePrev = (rows: typeof prevOpps) => {
    let wonV = 0,
      wonC = 0,
      newC = 0;
    for (const o of rows) {
      const v = o.estimatedValue ? Number(o.estimatedValue) : 0;
      if (o.createdAt >= range.prevStart && o.createdAt <= range.prevEnd) newC += 1;
      if (o.closedAt && o.closedAt >= range.prevStart && o.closedAt <= range.prevEnd) {
        if (o.status === 'WON') {
          wonV += v;
          wonC += 1;
        }
      }
    }
    return { wonV, wonC, newC };
  };
  const prevReal = summarizePrev(prevOpps);

  // winRate prev (against closed)
  let prevClosed = 0,
    prevWon = 0;
  for (const o of prevOpps) {
    if (o.closedAt && o.closedAt >= range.prevStart && o.closedAt <= range.prevEnd) {
      prevClosed += 1;
      if (o.status === 'WON') prevWon += 1;
    }
  }
  const prevWinRate = prevClosed > 0 ? (prevWon / prevClosed) * 100 : 0;

  return {
    pipelineTotal,
    pipelineWeighted,
    openCount: openOpps.length,
    wonValue: cur.wonV,
    wonCount: cur.wonC,
    lostValue: cur.lostV,
    lostCount: cur.lostC,
    newDealsCount: cur.newC,
    newDealsValue: cur.newV,
    winRate: cur.winRate,
    avgDealSize: cur.avg,
    avgCycleDays: cur.cycle,
    activitiesCount: periodActivities,
    deltaWonValue: pct(cur.wonV, prevReal.wonV),
    deltaWonCount: pct(cur.wonC, prevReal.wonC),
    deltaWinRate:
      prevWinRate === 0
        ? cur.winRate === 0
          ? 0
          : null
        : ((cur.winRate - prevWinRate) / prevWinRate) * 100,
    deltaNewDeals: pct(cur.newC, prevReal.newC),
    deltaActivities: pct(periodActivities, prevActivities),
  };
}

export type DealEntry = {
  id: string;
  code: string | null;
  name: string;
  stage: string;
  status: string;
  value: number | null;
  currency: string;
  closedAt: Date | null;
  expectedCloseDate: Date | null;
  daysInStage: number | null;
  account: { id: string; name: string };
  owner: { id: string; name: string | null; email: string } | null;
};

export async function getTopWonDeals(
  range: DateRangeWithCompare,
  limit = 10
): Promise<DealEntry[]> {
  const rows = await prisma.opportunity.findMany({
    where: {
      status: 'WON',
      closedAt: { gte: range.start, lte: range.end },
    },
    include: {
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
    orderBy: { estimatedValue: 'desc' },
    take: limit,
  });
  return rows.map((o) => ({
    id: o.id,
    code: o.code,
    name: o.name,
    stage: o.stage,
    status: o.status,
    value: o.estimatedValue ? Number(o.estimatedValue) : null,
    currency: o.currency,
    closedAt: o.closedAt,
    expectedCloseDate: o.expectedCloseDate,
    daysInStage: null,
    account: o.account,
    owner: o.owner,
  }));
}

export async function getTopOpenDeals(limit = 10): Promise<DealEntry[]> {
  const rows = await prisma.opportunity.findMany({
    where: { status: 'OPEN' },
    include: {
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
    orderBy: { estimatedValue: 'desc' },
    take: limit,
  });
  const now = Date.now();
  return rows.map((o) => ({
    id: o.id,
    code: o.code,
    name: o.name,
    stage: o.stage,
    status: o.status,
    value: o.estimatedValue ? Number(o.estimatedValue) : null,
    currency: o.currency,
    closedAt: null,
    expectedCloseDate: o.expectedCloseDate,
    daysInStage: o.stageChangedAt
      ? Math.floor((now - o.stageChangedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null,
    account: o.account,
    owner: o.owner,
  }));
}

export async function getDealsAtRisk(staleDays = 14, limit = 8): Promise<DealEntry[]> {
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);
  const rows = await prisma.opportunity.findMany({
    where: {
      status: 'OPEN',
      OR: [
        { lastActivityAt: { lt: cutoff } },
        { lastActivityAt: null, updatedAt: { lt: cutoff } },
      ],
    },
    include: {
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
    orderBy: { estimatedValue: 'desc' },
    take: limit,
  });
  const now = Date.now();
  return rows.map((o) => ({
    id: o.id,
    code: o.code,
    name: o.name,
    stage: o.stage,
    status: o.status,
    value: o.estimatedValue ? Number(o.estimatedValue) : null,
    currency: o.currency,
    closedAt: null,
    expectedCloseDate: o.expectedCloseDate,
    daysInStage: o.stageChangedAt
      ? Math.floor((now - o.stageChangedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null,
    account: o.account,
    owner: o.owner,
  }));
}

export type Performer = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  wonValue: number;
  wonCount: number;
  pipelineValue: number;
  activities: number;
};

export async function getTopPerformers(
  range: DateRangeWithCompare,
  limit = 8
): Promise<Performer[]> {
  // Won deals por owner en el período
  const wonRows = await prisma.opportunity.groupBy({
    by: ['ownerId'],
    where: {
      status: 'WON',
      closedAt: { gte: range.start, lte: range.end },
      ownerId: { not: null },
    },
    _sum: { estimatedValue: true },
    _count: { _all: true },
  });
  // Pipeline abierto por owner ahora
  const openRows = await prisma.opportunity.groupBy({
    by: ['ownerId'],
    where: { status: 'OPEN', ownerId: { not: null } },
    _sum: { estimatedValue: true },
  });
  // Activities por user en el período
  const actRows = await prisma.activity.groupBy({
    by: ['createdById'],
    where: {
      occurredAt: { gte: range.start, lte: range.end },
      createdById: { not: undefined as unknown as string },
    },
    _count: { _all: true },
  });

  const stats = new Map<
    string,
    { wonValue: number; wonCount: number; pipelineValue: number; activities: number }
  >();

  for (const r of wonRows) {
    if (!r.ownerId) continue;
    const v = stats.get(r.ownerId) ?? {
      wonValue: 0,
      wonCount: 0,
      pipelineValue: 0,
      activities: 0,
    };
    v.wonValue += r._sum.estimatedValue ? Number(r._sum.estimatedValue) : 0;
    v.wonCount += r._count._all;
    stats.set(r.ownerId, v);
  }
  for (const r of openRows) {
    if (!r.ownerId) continue;
    const v = stats.get(r.ownerId) ?? {
      wonValue: 0,
      wonCount: 0,
      pipelineValue: 0,
      activities: 0,
    };
    v.pipelineValue += r._sum.estimatedValue ? Number(r._sum.estimatedValue) : 0;
    stats.set(r.ownerId, v);
  }
  for (const r of actRows) {
    if (!r.createdById) continue;
    const v = stats.get(r.createdById) ?? {
      wonValue: 0,
      wonCount: 0,
      pipelineValue: 0,
      activities: 0,
    };
    v.activities += r._count._all;
    stats.set(r.createdById, v);
  }

  const userIds = [...stats.keys()];
  if (userIds.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  const usermap = new Map(users.map((u) => [u.id, u]));

  return [...stats.entries()]
    .map(([uid, s]) => {
      const u = usermap.get(uid);
      if (!u) return null;
      return {
        userId: u.id,
        name: u.name ?? u.email,
        email: u.email,
        avatarUrl: u.avatarUrl,
        ...s,
      };
    })
    .filter((x): x is Performer => x !== null)
    .sort((a, b) => b.wonValue - a.wonValue || b.activities - a.activities)
    .slice(0, limit);
}

export type StageDistribution = { stage: string; count: number; value: number };

export async function getPipelineFunnel(): Promise<StageDistribution[]> {
  const rows = await prisma.opportunity.groupBy({
    by: ['stage'],
    where: { status: 'OPEN' },
    _count: { _all: true },
    _sum: { estimatedValue: true },
  });
  const STAGE_ORDER = [
    'LEAD',
    'DISCOVERY',
    'SIZING',
    'DEMO',
    'PROPOSAL',
    'NEGOTIATION',
    'CLOSING',
    'HANDOFF',
  ] as const;
  const map = new Map(rows.map((r) => [r.stage as string, r]));
  return STAGE_ORDER.map((s) => ({
    stage: s,
    count: map.get(s)?._count._all ?? 0,
    value: map.get(s)?._sum.estimatedValue ? Number(map.get(s)!._sum.estimatedValue) : 0,
  }));
}

export type WeeklyTrend = { week: string; created: number; won: number; lost: number };

export async function getWeeklyTrend(weeks = 12): Promise<WeeklyTrend[]> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - weeks * 7);

  const rows = await prisma.$queryRaw<
    Array<{ week: Date; created: bigint; won: bigint; lost: bigint }>
  >`
    SELECT
      date_trunc('week', "createdAt") AS week,
      COUNT(*) FILTER (WHERE "createdAt" IS NOT NULL)::bigint AS created,
      COUNT(*) FILTER (WHERE "status" = 'WON' AND "closedAt" >= ${start})::bigint AS won,
      COUNT(*) FILTER (WHERE "status" = 'LOST' AND "closedAt" >= ${start})::bigint AS lost
    FROM "Opportunity"
    WHERE "createdAt" >= ${start}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({
    week: r.week.toISOString().slice(0, 10),
    created: Number(r.created),
    won: Number(r.won),
    lost: Number(r.lost),
  }));
}
