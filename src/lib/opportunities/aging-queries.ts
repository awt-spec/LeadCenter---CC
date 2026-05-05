// Aging queries for the dashboard. We compute aging per-opportunity using
// a single bulk SQL aggregation: get the latest "gestión" activity per opp
// in one round-trip, then classify in Node.

import { prisma } from '@/lib/db';
import type { Session } from 'next-auth';
import { can } from '@/lib/rbac';
import {
  classifyAging,
  GESTION_TYPES,
  INBOUND_TYPES,
  type AgingLevel,
} from './aging';

export interface AgingRow {
  opportunityId: string;
  opportunityName: string;
  opportunityCode: string;
  accountId: string;
  accountName: string;
  ownerName: string | null;
  stage: string;
  status: string;
  estimatedValue: number | null;
  currency: string;
  expectedCloseDate: Date | null;
  lastActivityAt: Date | null;
  lastActivityType: string | null;
  hoursSince: number | null;
  level: AgingLevel;
  needsResponse: boolean;
}

interface RawRow {
  id: string;
  name: string;
  code: string;
  account_id: string;
  account_name: string;
  owner_name: string | null;
  stage: string;
  status: string;
  estimated_value: string | null; // Decimal as string from raw SQL
  currency: string;
  expected_close_date: Date | null;
  last_activity_at: Date | null;
  last_activity_type: string | null;
}

/// Build the aging table for the dashboard. Includes all OPEN opps in scope.
/// Rows ordered by aging severity desc, then by deal value desc.
export async function loadAging(
  session: Session,
  options: { ownerScope: 'mine' | 'all'; includeStandBy?: boolean } = { ownerScope: 'all' }
): Promise<{ rows: AgingRow[]; counts: Record<AgingLevel, number> }> {
  const userId = session.user?.id ?? '';
  const scopeAll = options.ownerScope === 'all' && can(session, 'opportunities:read:all');
  const includeStandBy = options.includeStandBy ?? false;

  const gestionTypesArr = [...GESTION_TYPES] as readonly string[];
  const statuses = includeStandBy ? ['OPEN', 'STAND_BY'] : ['OPEN'];
  const params: Array<readonly string[] | string[] | string> = [gestionTypesArr, statuses];
  let ownerClause = '';
  if (!scopeAll) {
    ownerClause = `AND o."ownerId" = $3`;
    params.push(userId);
  }

  const rows = await prisma.$queryRawUnsafe<RawRow[]>(
    `WITH last_act AS (
       SELECT
         a."opportunityId",
         a."type"::text AS "type",
         a."occurredAt",
         ROW_NUMBER() OVER (PARTITION BY a."opportunityId" ORDER BY a."occurredAt" DESC) AS rn
       FROM "Activity" a
       WHERE a."opportunityId" IS NOT NULL
         AND a."type"::text = ANY($1::text[])
     )
     SELECT
       o."id",
       o."name",
       o."code",
       o."accountId" AS account_id,
       acc."name" AS account_name,
       u."name" AS owner_name,
       o."stage"::text AS stage,
       o."status"::text AS status,
       o."estimatedValue"::text AS estimated_value,
       o."currency",
       o."expectedCloseDate" AS expected_close_date,
       la."occurredAt" AS last_activity_at,
       la."type" AS last_activity_type
     FROM "Opportunity" o
     INNER JOIN "Account" acc ON acc."id" = o."accountId"
     LEFT JOIN "User" u ON u."id" = o."ownerId"
     LEFT JOIN last_act la ON la."opportunityId" = o."id" AND la.rn = 1
     WHERE o."status"::text = ANY($2::text[])
       ${ownerClause}`,
    ...params
  );

  const out: AgingRow[] = [];
  const counts: Record<AgingLevel, number> = { fresh: 0, warning: 0, orange: 0, red: 0, never: 0 };
  for (const r of rows) {
    const cls = r.last_activity_at
      ? classifyAging([{ type: r.last_activity_type as never, occurredAt: r.last_activity_at }])
      : classifyAging([]);
    const value = r.estimated_value ? Number(r.estimated_value) : null;
    out.push({
      opportunityId: r.id,
      opportunityName: r.name,
      opportunityCode: r.code,
      accountId: r.account_id,
      accountName: r.account_name,
      ownerName: r.owner_name,
      stage: r.stage,
      status: r.status,
      estimatedValue: value,
      currency: r.currency,
      expectedCloseDate: r.expected_close_date,
      lastActivityAt: r.last_activity_at,
      lastActivityType: r.last_activity_type,
      hoursSince: cls.hoursSince,
      level: cls.level,
      needsResponse: cls.needsResponse,
    });
    counts[cls.level]++;
  }

  // Sort: red first, orange, warning, never, fresh; within level by deal value desc.
  const order: Record<AgingLevel, number> = { red: 0, orange: 1, warning: 2, never: 3, fresh: 4 };
  out.sort((a, b) => {
    const d = order[a.level] - order[b.level];
    if (d !== 0) return d;
    return (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0);
  });

  return { rows: out, counts };
}
