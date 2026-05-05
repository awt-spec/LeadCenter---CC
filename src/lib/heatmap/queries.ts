// Account engagement heat map queries.
//
// Aggregates Activity rows per (account, week) bucket so the UI can render a
// matrix of accounts (rows) × last 12 weeks (columns) with cell color = how
// hot the account was that week. Useful to spot:
//   • Accounts cooling down (used to be hot, now silent → risk).
//   • Accounts heating up (suddenly active → opportunity).
//   • Owner workload imbalance (one rep covering 80% of activity).

import { prisma } from '@/lib/db';
import type { Session } from 'next-auth';
import { can } from '@/lib/rbac';

export const HEATMAP_WEEKS_DEFAULT = 12;

export interface HeatmapFilters {
  ownerId?: string;
  segment?: string;
  country?: string;
  status?: string;
  weeks?: number;
  /// "all" → ignore owner filter (only admins). "mine" → only mine.
  scope?: 'all' | 'mine';
}

export interface HeatmapWeek {
  /// ISO date of the Monday of this week (UTC).
  start: string;
  /// "5 May" — short label for the column header.
  label: string;
}

export interface HeatmapAccountRow {
  accountId: string;
  accountName: string;
  ownerName: string | null;
  status: string;
  country: string | null;
  segment: string | null;
  /// Activity counts per week, in same order as weeks[].
  counts: number[];
  /// Total activities in the window.
  total: number;
  /// Activities per type (only the dominant ones — emails, calls, meetings,
  /// notes). Used to show a small breakdown on hover.
  breakdown: { emails: number; calls: number; meetings: number; tasks: number; notes: number; other: number };
  /// Did this account go from active → silent? (had activity weeks ago, none recently)
  cooling: boolean;
  /// Going from silent → active?
  heating: boolean;
}

/// Build the weeks array. We anchor weeks on Monday UTC because most teams
/// reset on Monday and the calendar view feels right.
export function buildWeeks(weeksCount: number): HeatmapWeek[] {
  const out: HeatmapWeek[] = [];
  const now = new Date();
  // Find this week's Monday in UTC.
  const dow = now.getUTCDay(); // 0=Sun..6=Sat
  const daysToMonday = (dow + 6) % 7; // 0 if Mon, 6 if Sun
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToMonday));
  for (let i = weeksCount - 1; i >= 0; i--) {
    const d = new Date(thisMonday);
    d.setUTCDate(thisMonday.getUTCDate() - i * 7);
    out.push({
      start: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    });
  }
  return out;
}

interface RawCount {
  account_id: string;
  week_start: Date;
  total: bigint;
  emails: bigint;
  calls: bigint;
  meetings: bigint;
  tasks: bigint;
  notes: bigint;
  other: bigint;
}

interface RawAccount {
  id: string;
  name: string;
  status: string;
  country: string | null;
  segment: string | null;
  ownerName: string | null;
}

export async function loadHeatmap(
  session: Session,
  filters: HeatmapFilters
): Promise<{ weeks: HeatmapWeek[]; rows: HeatmapAccountRow[]; totals: { activities: number; accounts: number } }> {
  const userId = session.user?.id ?? '';
  const weeksCount = Math.max(4, Math.min(filters.weeks ?? HEATMAP_WEEKS_DEFAULT, 26));
  const weeks = buildWeeks(weeksCount);

  // Earliest week start (UTC midnight) — use as the time floor.
  const since = new Date(weeks[0].start + 'T00:00:00.000Z');

  // RBAC scope — admins can request "all"; everyone else sees only theirs.
  const scopeAll = filters.scope === 'all' && can(session, 'opportunities:read:all');

  // Compose a scope clause for raw SQL. We build params positionally.
  const params: Array<string | Date | string[]> = [since];
  let where = `a."occurredAt" >= $1`;
  let p = 2;

  if (!scopeAll) {
    where += ` AND (acc."ownerId" = $${p} OR a."createdById" = $${p})`;
    params.push(userId);
    p++;
  } else if (filters.ownerId) {
    where += ` AND acc."ownerId" = $${p}`;
    params.push(filters.ownerId);
    p++;
  }
  if (filters.segment) {
    where += ` AND acc."segment"::text = $${p}`;
    params.push(filters.segment);
    p++;
  }
  if (filters.country) {
    where += ` AND acc."country" = $${p}`;
    params.push(filters.country);
    p++;
  }
  if (filters.status) {
    where += ` AND acc."status"::text = $${p}`;
    params.push(filters.status);
    p++;
  }

  // Aggregate per (account, week, type-bucket). One round-trip.
  const rawCounts = await prisma.$queryRawUnsafe<RawCount[]>(
    `SELECT
        a."accountId" AS account_id,
        date_trunc('week', a."occurredAt" AT TIME ZONE 'UTC')::date AS week_start,
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE a."type" IN ('EMAIL_SENT','EMAIL_RECEIVED'))::bigint AS emails,
        COUNT(*) FILTER (WHERE a."type" = 'CALL')::bigint AS calls,
        COUNT(*) FILTER (WHERE a."type" IN ('MEETING','DEMO'))::bigint AS meetings,
        COUNT(*) FILTER (WHERE a."type" = 'TASK')::bigint AS tasks,
        COUNT(*) FILTER (WHERE a."type" = 'INTERNAL_NOTE')::bigint AS notes,
        COUNT(*) FILTER (WHERE a."type" NOT IN ('EMAIL_SENT','EMAIL_RECEIVED','CALL','MEETING','DEMO','TASK','INTERNAL_NOTE'))::bigint AS other
     FROM "Activity" a
     INNER JOIN "Account" acc ON acc."id" = a."accountId"
     WHERE ${where} AND a."accountId" IS NOT NULL
     GROUP BY a."accountId", date_trunc('week', a."occurredAt" AT TIME ZONE 'UTC')`,
    ...params
  );

  if (rawCounts.length === 0) {
    return { weeks, rows: [], totals: { activities: 0, accounts: 0 } };
  }

  // Pull account metadata for the accounts that show up in counts.
  const ids = [...new Set(rawCounts.map((r) => r.account_id))];
  const accountsRaw = await prisma.$queryRawUnsafe<RawAccount[]>(
    `SELECT a."id", a."name", a."status"::text AS status, a."country", a."segment"::text AS segment,
            COALESCE(u."name", NULL) AS "ownerName"
       FROM "Account" a
       LEFT JOIN "User" u ON u."id" = a."ownerId"
       WHERE a."id" = ANY($1::text[])`,
    ids
  );
  const accById = new Map(accountsRaw.map((a) => [a.id, a] as const));

  // Index counts by account+week.
  const weekIndex = new Map(weeks.map((w, i) => [w.start, i] as const));
  type Bucket = HeatmapAccountRow['breakdown'] & { counts: number[] };
  const byAccount = new Map<string, Bucket>();
  for (const r of rawCounts) {
    const wkKey = r.week_start.toISOString().slice(0, 10);
    const wkIdx = weekIndex.get(wkKey);
    if (wkIdx === undefined) continue;
    let b = byAccount.get(r.account_id);
    if (!b) {
      b = {
        emails: 0, calls: 0, meetings: 0, tasks: 0, notes: 0, other: 0,
        counts: new Array(weeks.length).fill(0),
      };
      byAccount.set(r.account_id, b);
    }
    b.counts[wkIdx] += Number(r.total);
    b.emails += Number(r.emails);
    b.calls += Number(r.calls);
    b.meetings += Number(r.meetings);
    b.tasks += Number(r.tasks);
    b.notes += Number(r.notes);
    b.other += Number(r.other);
  }

  // Build rows
  const rows: HeatmapAccountRow[] = [];
  let totalActivities = 0;
  for (const [accountId, b] of byAccount) {
    const meta = accById.get(accountId);
    if (!meta) continue;
    const total = b.counts.reduce((s, n) => s + n, 0);
    totalActivities += total;
    // Cooling: had activity in first half but not in last 3 weeks
    const half = Math.floor(b.counts.length / 2);
    const firstHalf = b.counts.slice(0, half).reduce((s, n) => s + n, 0);
    const last3 = b.counts.slice(-3).reduce((s, n) => s + n, 0);
    const cooling = firstHalf >= 3 && last3 === 0;
    const heating = firstHalf === 0 && last3 >= 2;
    rows.push({
      accountId,
      accountName: meta.name,
      ownerName: meta.ownerName,
      status: meta.status,
      country: meta.country,
      segment: meta.segment,
      counts: b.counts,
      total,
      breakdown: {
        emails: b.emails, calls: b.calls, meetings: b.meetings,
        tasks: b.tasks, notes: b.notes, other: b.other,
      },
      cooling,
      heating,
    });
  }

  // Sort by total activity desc, cap at 100 to keep the page snappy.
  rows.sort((a, b) => b.total - a.total);
  const trimmed = rows.slice(0, 100);

  return { weeks, rows: trimmed, totals: { activities: totalActivities, accounts: rows.length } };
}
