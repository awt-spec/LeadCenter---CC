// Dashboard chart data builders. Each function does ONE round-trip to
// Postgres, returns a small array that fits a Recharts dataset directly.

import { prisma } from '@/lib/db';
import type { Session } from 'next-auth';
import { can } from '@/lib/rbac';
import { STAGE_LABELS_SHORT, STAGE_PROBABILITY } from '@/lib/shared/labels';
import type { OpportunityStage } from '@prisma/client';

export interface PipelineByStagePoint {
  stage: string;
  label: string;
  count: number;
  value: number;
  weighted: number;
}

interface RawStageRow { stage: string; count: bigint; sum: string | null; }

export async function pipelineByStage(session: Session): Promise<PipelineByStagePoint[]> {
  const userId = session.user?.id ?? '';
  const scopeAll = can(session, 'opportunities:read:all');
  const params: Array<string | string[]> = [];
  let where = `o."status" = 'OPEN'`;
  if (!scopeAll) {
    where += ` AND o."ownerId" = $1`;
    params.push(userId);
  }
  const rows = await prisma.$queryRawUnsafe<RawStageRow[]>(
    `SELECT o."stage"::text AS stage,
            COUNT(*)::bigint AS count,
            SUM(o."estimatedValue")::text AS sum
       FROM "Opportunity" o
       WHERE ${where}
       GROUP BY o."stage"`,
    ...params
  );

  // Order matches the pipeline progression
  const order: OpportunityStage[] = [
    'LEAD', 'DISCOVERY', 'SIZING', 'DEMO', 'PROPOSAL', 'NEGOTIATION', 'CLOSING',
  ];
  const byStage = new Map(rows.map((r) => [r.stage, r] as const));
  return order
    .filter((s) => byStage.has(s))
    .map((s) => {
      const r = byStage.get(s)!;
      const value = r.sum ? Number(r.sum) : 0;
      const prob = STAGE_PROBABILITY[s] / 100;
      return {
        stage: s,
        label: STAGE_LABELS_SHORT[s],
        count: Number(r.count),
        value,
        weighted: value * prob,
      };
    });
}

export interface ActivityWeekPoint {
  weekStart: string;
  weekLabel: string;
  emails: number;
  calls: number;
  meetings: number;
  notes: number;
  total: number;
}

interface RawWeekRow {
  week_start: Date;
  type: string;
  count: bigint;
}

export async function activityByWeek(session: Session, weeks = 12): Promise<ActivityWeekPoint[]> {
  const userId = session.user?.id ?? '';
  const scopeAll = can(session, 'opportunities:read:all');
  const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
  const params: Array<Date | string> = [since];
  let where = `a."occurredAt" >= $1`;
  if (!scopeAll) {
    where += ` AND a."createdById" = $2`;
    params.push(userId);
  }
  const rows = await prisma.$queryRawUnsafe<RawWeekRow[]>(
    `SELECT date_trunc('week', a."occurredAt" AT TIME ZONE 'UTC')::date AS week_start,
            a."type"::text AS type,
            COUNT(*)::bigint AS count
       FROM "Activity" a
       WHERE ${where}
       GROUP BY week_start, a."type"
       ORDER BY week_start ASC`,
    ...params
  );

  const buckets = new Map<string, ActivityWeekPoint>();
  for (const r of rows) {
    const key = r.week_start.toISOString().slice(0, 10);
    let p = buckets.get(key);
    if (!p) {
      p = {
        weekStart: key,
        weekLabel: r.week_start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
        emails: 0, calls: 0, meetings: 0, notes: 0, total: 0,
      };
      buckets.set(key, p);
    }
    const c = Number(r.count);
    p.total += c;
    switch (r.type) {
      case 'EMAIL_SENT':
      case 'EMAIL_RECEIVED':
        p.emails += c; break;
      case 'CALL':
      case 'WHATSAPP':
        p.calls += c; break;
      case 'MEETING':
      case 'DEMO':
        p.meetings += c; break;
      case 'INTERNAL_NOTE':
        p.notes += c; break;
    }
  }
  return [...buckets.values()];
}

export interface WinRatePoint { quarter: string; won: number; lost: number; rate: number }

export async function winRateByQuarter(session: Session, quarters = 4): Promise<WinRatePoint[]> {
  const userId = session.user?.id ?? '';
  const scopeAll = can(session, 'opportunities:read:all');
  const since = new Date(Date.now() - quarters * 90 * 24 * 60 * 60 * 1000);
  const params: Array<Date | string> = [since];
  let where = `o."closedAt" IS NOT NULL AND o."closedAt" >= $1 AND o."status"::text IN ('WON','LOST')`;
  if (!scopeAll) {
    where += ` AND o."ownerId" = $2`;
    params.push(userId);
  }
  const rows = await prisma.$queryRawUnsafe<Array<{ quarter: string; status: string; count: bigint }>>(
    `SELECT to_char(date_trunc('quarter', o."closedAt"), 'YYYY-"Q"Q') AS quarter,
            o."status"::text AS status,
            COUNT(*)::bigint AS count
       FROM "Opportunity" o
       WHERE ${where}
       GROUP BY quarter, o."status"
       ORDER BY quarter ASC`,
    ...params
  );
  const buckets = new Map<string, WinRatePoint>();
  for (const r of rows) {
    let p = buckets.get(r.quarter);
    if (!p) { p = { quarter: r.quarter, won: 0, lost: 0, rate: 0 }; buckets.set(r.quarter, p); }
    if (r.status === 'WON') p.won = Number(r.count);
    else if (r.status === 'LOST') p.lost = Number(r.count);
  }
  for (const p of buckets.values()) {
    const total = p.won + p.lost;
    p.rate = total > 0 ? Math.round((p.won / total) * 100) : 0;
  }
  return [...buckets.values()];
}
