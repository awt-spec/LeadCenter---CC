// Aggregations powering the /reports dashboard.
// Each function returns a serialisable shape ready to feed Recharts.

import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { STAGE_PROBABILITY } from '@/lib/opportunities/stage-rules';

export const PIPELINE_STAGES = [
  'LEAD', 'DISCOVERY', 'SIZING', 'DEMO', 'PROPOSAL', 'NEGOTIATION', 'CLOSING', 'HANDOFF',
] as const;

export const STAGE_LABEL: Record<string, string> = {
  LEAD: 'Lead',
  DISCOVERY: 'Discovery',
  SIZING: 'Sizing',
  DEMO: 'Demo',
  PROPOSAL: 'Propuesta',
  NEGOTIATION: 'Negociación',
  CLOSING: 'Cierre',
  HANDOFF: 'Handoff',
};

export type DateRange = { start: Date; end: Date };

export function rangeFromPeriod(period: '7d' | '30d' | '90d' | 'ytd' | 'all'): DateRange | null {
  if (period === 'all') return null;
  const end = new Date();
  const start = new Date(end);
  if (period === '7d') start.setDate(end.getDate() - 7);
  else if (period === '30d') start.setDate(end.getDate() - 30);
  else if (period === '90d') start.setDate(end.getDate() - 90);
  else if (period === 'ytd') {
    start.setMonth(0); start.setDate(1); start.setHours(0,0,0,0);
  }
  return { start, end };
}

// ===== KPIs + Stage / Outcome / Top accounts (same as before, expanded) =====

export type StageDatum = { stage: string; count: number; value: number };
export type OutcomeDatum = { name: string; value: number; deals: number; color: string };
export type TopAccountDatum = { name: string; value: number };
export type MonthDatum = { month: string; created: number; won: number; lost: number };

export interface PipelineSummary {
  stageData: StageDatum[];
  outcomeData: OutcomeDatum[];
  topAccounts: TopAccountDatum[];
  months: MonthDatum[];
  kpis: {
    totalPipeline: number;
    weightedPipeline: number;
    wonValue: number;
    winRate: number;
    avgDealSize: number;
    avgCycleDays: number;
    openCount: number;
  };
}

export async function getPipelineSummary(scope: Prisma.OpportunityWhereInput): Promise<PipelineSummary> {
  const [allOpps, allAccounts] = await Promise.all([
    prisma.opportunity.findMany({
      where: scope,
      select: {
        stage: true, status: true, estimatedValue: true,
        createdAt: true, closedAt: true, accountId: true,
      },
    }),
    prisma.account.findMany({ select: { id: true, name: true } }),
  ]);

  // Per-stage value & count (only OPEN)
  const stageMap = new Map<string, { count: number; value: number }>();
  for (const s of PIPELINE_STAGES) stageMap.set(s, { count: 0, value: 0 });
  for (const o of allOpps) {
    if (o.status !== 'OPEN') continue;
    const cur = stageMap.get(o.stage);
    if (!cur) continue;
    cur.count += 1;
    cur.value += o.estimatedValue ? Number(o.estimatedValue) : 0;
  }
  const stageData = PIPELINE_STAGES.map((s) => ({
    stage: STAGE_LABEL[s] ?? s,
    count: stageMap.get(s)?.count ?? 0,
    value: stageMap.get(s)?.value ?? 0,
  }));

  // Last 6 months: created/won/lost trend
  const now = new Date();
  const months: MonthDatum[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    let created = 0, won = 0, lost = 0;
    for (const o of allOpps) {
      if (o.createdAt >= d && o.createdAt < next) created += 1;
      if (o.closedAt && o.closedAt >= d && o.closedAt < next) {
        if (o.status === 'WON') won += 1;
        else if (o.status === 'LOST') lost += 1;
      }
    }
    months.push({
      month: d.toLocaleDateString('es-CR', { month: 'short' }),
      created, won, lost,
    });
  }

  // Outcome breakdown
  let wonValue = 0, lostValue = 0, openValue = 0;
  let wonDeals = 0, lostDeals = 0, openDeals = 0;
  let cycleDaysSum = 0, cycleDaysCount = 0;
  for (const o of allOpps) {
    const v = o.estimatedValue ? Number(o.estimatedValue) : 0;
    if (o.status === 'WON') {
      wonValue += v; wonDeals += 1;
      if (o.closedAt) {
        cycleDaysSum += (o.closedAt.getTime() - o.createdAt.getTime()) / (1000*60*60*24);
        cycleDaysCount += 1;
      }
    } else if (o.status === 'LOST') {
      lostValue += v; lostDeals += 1;
    } else if (o.status === 'OPEN') {
      openValue += v; openDeals += 1;
    }
  }
  const outcomeData: OutcomeDatum[] = [
    { name: 'Abiertas', value: openValue, deals: openDeals, color: '#3B82F6' },
    { name: 'Ganadas', value: wonValue, deals: wonDeals, color: '#10B981' },
    { name: 'Perdidas', value: lostValue, deals: lostDeals, color: '#C8200F' },
  ].filter((d) => d.value > 0);

  // Top 5 accounts by open value
  const accountTotals = new Map<string, number>();
  for (const o of allOpps) {
    if (o.status !== 'OPEN') continue;
    const v = o.estimatedValue ? Number(o.estimatedValue) : 0;
    accountTotals.set(o.accountId, (accountTotals.get(o.accountId) ?? 0) + v);
  }
  const topAccounts: TopAccountDatum[] = Array.from(accountTotals.entries())
    .map(([id, value]) => ({
      name: allAccounts.find((a) => a.id === id)?.name ?? '—',
      value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .reverse();

  let totalPipeline = 0, weightedPipeline = 0;
  for (const o of allOpps) {
    if (o.status !== 'OPEN') continue;
    const v = o.estimatedValue ? Number(o.estimatedValue) : 0;
    totalPipeline += v;
    weightedPipeline += v * (STAGE_PROBABILITY[o.stage] / 100);
  }

  const closedTotal = wonDeals + lostDeals;
  const winRate = closedTotal > 0 ? (wonDeals / closedTotal) * 100 : 0;
  const avgDealSize = wonDeals > 0 ? wonValue / wonDeals : 0;
  const avgCycleDays = cycleDaysCount > 0 ? cycleDaysSum / cycleDaysCount : 0;

  return {
    stageData, months, outcomeData, topAccounts,
    kpis: {
      totalPipeline, weightedPipeline, wonValue, winRate,
      avgDealSize, avgCycleDays, openCount: openDeals,
    },
  };
}

// ===== Stage velocity (avg days each opp spent in stage) =====

export type VelocityDatum = { stage: string; avgDays: number; samples: number };

export async function getStageVelocity(scope: Prisma.OpportunityWhereInput): Promise<VelocityDatum[]> {
  const histories = await prisma.stageHistory.findMany({
    where: { opportunity: scope, daysInPreviousStage: { not: null }, fromStage: { not: null } },
    select: { fromStage: true, daysInPreviousStage: true },
  });
  const sums = new Map<string, { total: number; count: number }>();
  for (const s of PIPELINE_STAGES) sums.set(s, { total: 0, count: 0 });
  for (const h of histories) {
    if (!h.fromStage || h.daysInPreviousStage == null) continue;
    const cur = sums.get(h.fromStage);
    if (!cur) continue;
    cur.total += h.daysInPreviousStage;
    cur.count += 1;
  }
  return PIPELINE_STAGES.map((s) => ({
    stage: STAGE_LABEL[s] ?? s,
    avgDays: (sums.get(s)?.count ?? 0) > 0 ? Math.round((sums.get(s)!.total / sums.get(s)!.count) * 10) / 10 : 0,
    samples: sums.get(s)?.count ?? 0,
  }));
}

// ===== Activity volume per week (last 12 weeks, stacked by type) =====

export type ActivityWeekDatum = {
  week: string;
  email: number;
  call: number;
  meeting: number;
  note: number;
};

export async function getActivityVolume(weeks = 12): Promise<ActivityWeekDatum[]> {
  const start = new Date();
  start.setDate(start.getDate() - weeks * 7);
  start.setHours(0, 0, 0, 0);
  const grouped = await prisma.activity.findMany({
    where: { occurredAt: { gte: start } },
    select: { type: true, occurredAt: true },
  });
  const buckets = new Map<string, ActivityWeekDatum>();
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    const wKey = isoWeekKey(d);
    buckets.set(wKey, { week: weekLabel(d), email: 0, call: 0, meeting: 0, note: 0 });
  }
  for (const a of grouped) {
    const k = isoWeekKey(a.occurredAt);
    const b = buckets.get(k);
    if (!b) continue;
    if (a.type === 'EMAIL_SENT' || a.type === 'EMAIL_RECEIVED') b.email += 1;
    else if (a.type === 'CALL') b.call += 1;
    else if (a.type === 'MEETING' || a.type === 'DEMO') b.meeting += 1;
    else if (a.type === 'INTERNAL_NOTE') b.note += 1;
  }
  return Array.from(buckets.values());
}

function isoWeekKey(d: Date): string {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-${String(week).padStart(2, '0')}`;
}
function weekLabel(d: Date): string {
  return d.toLocaleDateString('es-CR', { month: 'short', day: 'numeric' });
}

// ===== Engagement score histogram =====

export type EngagementBucket = { bucket: string; count: number };

export async function getEngagementHistogram(): Promise<EngagementBucket[]> {
  const contacts = await prisma.contact.findMany({ select: { engagementScore: true } });
  const buckets = [
    { bucket: '0', count: 0 },
    { bucket: '1-20', count: 0 },
    { bucket: '21-40', count: 0 },
    { bucket: '41-60', count: 0 },
    { bucket: '61-80', count: 0 },
    { bucket: '81-100', count: 0 },
  ];
  for (const c of contacts) {
    const s = Math.max(0, Math.min(100, c.engagementScore));
    if (s === 0) buckets[0].count += 1;
    else if (s <= 20) buckets[1].count += 1;
    else if (s <= 40) buckets[2].count += 1;
    else if (s <= 60) buckets[3].count += 1;
    else if (s <= 80) buckets[4].count += 1;
    else buckets[5].count += 1;
  }
  return buckets;
}

// ===== Email funnel: sent → opened → clicked → replied =====

export interface EmailFunnel {
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

export async function getEmailFunnel(): Promise<EmailFunnel> {
  const sent = await prisma.activity.findMany({
    where: { type: 'EMAIL_SENT' },
    select: { bodyJson: true },
  });
  let opened = 0, clicked = 0, replied = 0, bounced = 0;
  for (const a of sent) {
    const t = (a.bodyJson as { type?: string; tracking?: { openCount?: number; clickCount?: number; replyCount?: number; bounceCount?: number } } | null);
    if (!t || t.type !== 'hs_email' || !t.tracking) continue;
    if ((t.tracking.openCount ?? 0) > 0) opened += 1;
    if ((t.tracking.clickCount ?? 0) > 0) clicked += 1;
    if ((t.tracking.replyCount ?? 0) > 0) replied += 1;
    if ((t.tracking.bounceCount ?? 0) > 0) bounced += 1;
  }
  const total = sent.length;
  return {
    sent: total,
    opened, clicked, replied, bounced,
    openRate: total > 0 ? (opened / total) * 100 : 0,
    clickRate: total > 0 ? (clicked / total) * 100 : 0,
    replyRate: total > 0 ? (replied / total) * 100 : 0,
    bounceRate: total > 0 ? (bounced / total) * 100 : 0,
  };
}

// ===== Pipeline by segment / product (donuts) =====

export type SegmentDatum = { name: string; value: number };

export async function getPipelineBySegment(scope: Prisma.OpportunityWhereInput): Promise<SegmentDatum[]> {
  const opps = await prisma.opportunity.findMany({
    where: { ...scope, status: 'OPEN' },
    select: { estimatedValue: true, account: { select: { segment: true } } },
  });
  const map = new Map<string, number>();
  for (const o of opps) {
    const seg = o.account?.segment ?? 'OTROS';
    const v = o.estimatedValue ? Number(o.estimatedValue) : 0;
    map.set(seg, (map.get(seg) ?? 0) + v);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name: SEGMENT_LABEL[name] ?? name, value }))
    .sort((a, b) => b.value - a.value);
}

export async function getPipelineByProduct(scope: Prisma.OpportunityWhereInput): Promise<SegmentDatum[]> {
  const opps = await prisma.opportunity.findMany({
    where: { ...scope, status: 'OPEN' },
    select: { product: true, estimatedValue: true },
  });
  const map = new Map<string, number>();
  for (const o of opps) {
    const v = o.estimatedValue ? Number(o.estimatedValue) : 0;
    map.set(o.product, (map.get(o.product) ?? 0) + v);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name: PRODUCT_LABEL[name] ?? name, value }))
    .sort((a, b) => b.value - a.value);
}

const SEGMENT_LABEL: Record<string, string> = {
  BANK: 'Banco',
  FINANCE_COMPANY: 'Financiera',
  MICROFINANCE: 'Microfinanza',
  COOPERATIVE: 'Cooperativa',
  PENSION_FUND: 'AFP',
  INSURANCE: 'Seguros',
  FINTECH: 'Fintech',
  RETAIL: 'Retail',
  GOVERNMENT: 'Gobierno',
  OTHER: 'Otros',
  OTROS: 'Sin segmento',
};

const PRODUCT_LABEL: Record<string, string> = {
  SAF_PLUS: 'SAF+',
  FILEMASTER: 'FileMaster',
  FACTORAJE_ONCLOUD: 'Factoraje OnCloud',
  SYSDE_PENSION: 'SYSDE Pensión',
  SENTINEL_PLD: 'Sentinel PLD',
  CUSTOM: 'Otros',
};
