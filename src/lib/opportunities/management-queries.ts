import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * Queries para los widgets de "estado de gestión" en /opportunities y
 * /sprint. Contadores por color de staleness + top opps que necesitan
 * atención inmediata.
 */

export type ManagementStats = {
  total: number;          // total de opps abiertas en el scope
  fresh: number;          // <24h
  yellow: number;         // 24-48h
  orange: number;         // 48-72h
  red: number;            // 72h+ (incluye sin gestión)
  needsResponse: number;  // lastActivityDirection = INBOUND
};

const HOUR = 60 * 60 * 1000;

export async function getManagementStats(
  scope: Prisma.OpportunityWhereInput
): Promise<ManagementStats> {
  const now = Date.now();
  const t24 = new Date(now - 24 * HOUR);
  const t48 = new Date(now - 48 * HOUR);
  const t72 = new Date(now - 72 * HOUR);
  const openScope = { ...scope, status: 'OPEN' as const };

  const [total, fresh, yellow, orange, red, needsResponse] = await Promise.all([
    prisma.opportunity.count({ where: openScope }),
    prisma.opportunity.count({
      where: { ...openScope, lastActivityAt: { gte: t24 } },
    }),
    prisma.opportunity.count({
      where: { ...openScope, lastActivityAt: { gte: t48, lt: t24 } },
    }),
    prisma.opportunity.count({
      where: { ...openScope, lastActivityAt: { gte: t72, lt: t48 } },
    }),
    prisma.opportunity.count({
      where: {
        ...openScope,
        OR: [{ lastActivityAt: { lt: t72 } }, { lastActivityAt: null }],
      },
    }),
    prisma.opportunity.count({
      where: { ...openScope, lastActivityDirection: 'INBOUND' },
    }),
  ]);

  return { total, fresh, yellow, orange, red, needsResponse };
}

export type AttentionReason =
  | 'needs_response'
  | 'red'
  | 'never'
  | 'high_value'
  | 'unassigned';

export type AttentionPerspective =
  | 'smart' // combinación weighted urgency × value × stage
  | 'urgency' // pelota → red → never (la default original)
  | 'value' // top valor primero, dentro de los no-fresh
  | 'unassigned' // sin owner, por valor
  | 'by_owner'; // agrupado por owner

export type NeedAttentionOpp = {
  id: string;
  code: string | null;
  name: string;
  stage: string;
  estimatedValue: number | null;
  currency: string;
  lastActivityAt: Date | null;
  lastActivityDirection: 'OUTBOUND' | 'INBOUND' | 'INTERNAL' | null;
  account: { id: string; name: string };
  owner: { id: string; name: string | null; email: string; avatarUrl: string | null } | null;
  /// Razón principal por la que está en este hero
  reason: AttentionReason;
  /// Score 0-100 (poblado en 'smart' perspective)
  score?: number;
};

const STAGE_WEIGHT: Record<string, number> = {
  LEAD: 1,
  DISCOVERY: 1.2,
  SIZING: 1.5,
  DEMO: 2,
  PROPOSAL: 2.5,
  NEGOTIATION: 3,
  CLOSING: 3.5,
  HANDOFF: 0.5, // ya cerró, baja prioridad
};

/**
 * Score 0-100 para "smart" perspective.
 *   urgency:  4 INBOUND, 3.5 nunca, 3 red, 2 orange, 1 yellow, 0 fresh
 *   value:    log10(value+1) ÷ 2.5, mínimo 0.3
 *   stage:    STAGE_WEIGHT
 *   ownership: 1 si tiene owner, 0.7 si no
 * raw = urg × value × stage × ownership; score = min(100, raw × 5).
 */
export function computeAttentionScore(opp: {
  estimatedValue: number | null;
  stage: string;
  lastActivityAt: Date | null;
  lastActivityDirection: 'OUTBOUND' | 'INBOUND' | 'INTERNAL' | null;
  owner: unknown | null;
  now?: Date;
}): number {
  const now = opp.now ?? new Date();
  let urg = 0;
  if (opp.lastActivityDirection === 'INBOUND') urg = 4;
  else if (!opp.lastActivityAt) urg = 3.5;
  else {
    const hours = (now.getTime() - opp.lastActivityAt.getTime()) / 3_600_000;
    if (hours >= 72) urg = 3;
    else if (hours >= 48) urg = 2;
    else if (hours >= 24) urg = 1;
    else urg = 0;
  }
  if (urg === 0) return 0;

  const v = opp.estimatedValue ?? 0;
  const valFactor = v > 0 ? Math.max(0.3, Math.min(7, Math.log10(v + 1)) / 2.5) : 0.3;
  const stageFactor = STAGE_WEIGHT[opp.stage] ?? 1;
  const ownerPen = opp.owner ? 1 : 0.7;
  return Math.min(100, Math.round(urg * valFactor * stageFactor * ownerPen * 5));
}

/**
 * Devuelve hasta `limit` opps que necesitan atención AHORA. Prioridad:
 *   1. Las que tienen ball-in-court (INBOUND) — pelota en nuestro campo.
 *   2. Las rojas (>72h sin gestión).
 *   3. Las nunca-gestionadas (lastActivityAt = null).
 *
 * Ordenado por valor descendente dentro de cada categoría.
 */
export async function getNeedAttentionOpps(
  scope: Prisma.OpportunityWhereInput,
  limit = 6
): Promise<NeedAttentionOpp[]> {
  const t72 = new Date(Date.now() - 72 * HOUR);
  const openScope = { ...scope, status: 'OPEN' as const };

  // 3 queries en paralelo, después merge + dedupe + cap.
  const [needsResponse, redOpps, neverOpps] = await Promise.all([
    prisma.opportunity.findMany({
      where: { ...openScope, lastActivityDirection: 'INBOUND' },
      include: {
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { estimatedValue: 'desc' },
      take: limit,
    }),
    prisma.opportunity.findMany({
      where: {
        ...openScope,
        lastActivityAt: { lt: t72 },
        // Excluimos las que ya están en needsResponse (las traen aparte)
        NOT: { lastActivityDirection: 'INBOUND' },
      },
      include: {
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { estimatedValue: 'desc' },
      take: limit,
    }),
    prisma.opportunity.findMany({
      where: { ...openScope, lastActivityAt: null },
      include: {
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { estimatedValue: 'desc' },
      take: limit,
    }),
  ]);

  const map = (rows: typeof needsResponse, reason: NeedAttentionOpp['reason']): NeedAttentionOpp[] =>
    rows.map((o) => ({
      id: o.id,
      code: o.code,
      name: o.name,
      stage: o.stage,
      estimatedValue: o.estimatedValue ? Number(o.estimatedValue) : null,
      currency: o.currency,
      lastActivityAt: o.lastActivityAt,
      lastActivityDirection: o.lastActivityDirection,
      account: o.account,
      owner: o.owner,
      reason,
    }));

  const merged: NeedAttentionOpp[] = [
    ...map(needsResponse, 'needs_response'),
    ...map(redOpps, 'red'),
    ...map(neverOpps, 'never'),
  ];

  // Dedupe (un opp en INBOUND no debería estar también en red, pero por las dudas)
  const seen = new Set<string>();
  const out: NeedAttentionOpp[] = [];
  for (const o of merged) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push(o);
    if (out.length >= limit) break;
  }
  return out;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  v2 — perspectivas múltiples + smart scoring                     ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Devuelve un pool de hasta `pool` opps en estado de necesitar
 * atención (no fresh) — base para el scoring/ordenamiento.
 */
async function getAttentionPool(
  scope: Prisma.OpportunityWhereInput,
  pool = 80
): Promise<NeedAttentionOpp[]> {
  const t24 = new Date(Date.now() - 24 * HOUR);
  const openScope = { ...scope, status: 'OPEN' as const };

  const rows = await prisma.opportunity.findMany({
    where: {
      ...openScope,
      OR: [
        { lastActivityDirection: 'INBOUND' },
        { lastActivityAt: null },
        { lastActivityAt: { lt: t24 } },
      ],
    },
    include: {
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { estimatedValue: 'desc' },
    take: pool,
  });

  const t72 = new Date(Date.now() - 72 * HOUR);

  return rows.map((o): NeedAttentionOpp => {
    let reason: AttentionReason = 'red';
    if (o.lastActivityDirection === 'INBOUND') reason = 'needs_response';
    else if (!o.lastActivityAt) reason = 'never';
    else if (o.lastActivityAt < t72) reason = 'red';
    else reason = 'red'; // 24-72h también lo metemos como rojo simplificado para el pool
    if (!o.ownerId) reason = 'unassigned';

    return {
      id: o.id,
      code: o.code,
      name: o.name,
      stage: o.stage,
      estimatedValue: o.estimatedValue ? Number(o.estimatedValue) : null,
      currency: o.currency,
      lastActivityAt: o.lastActivityAt,
      lastActivityDirection: o.lastActivityDirection,
      account: o.account,
      owner: o.owner,
      reason,
    };
  });
}

/**
 * Devuelve opps según la perspectiva seleccionada. Cada perspectiva
 * tiene un orden distinto y posiblemente un filtro adicional.
 *
 * - `smart`:      score 0-100 = urgency × value × stage × ownership.
 *                  Devuelve los top N por score.
 * - `urgency`:    pelota → red → never → 24h+ (la default original).
 * - `value`:      ordena solo por valor desc (sólo no-fresh).
 * - `unassigned`: solo sin owner, ordenado por valor.
 * - `by_owner`:   no aplica acá — usar `getNeedAttentionByOwner`.
 */
export async function getNeedAttentionOppsByPerspective(
  scope: Prisma.OpportunityWhereInput,
  perspective: AttentionPerspective,
  limit = 6
): Promise<NeedAttentionOpp[]> {
  if (perspective === 'urgency') {
    return getNeedAttentionOpps(scope, limit);
  }

  const pool = await getAttentionPool(scope, perspective === 'smart' ? 100 : 80);

  if (perspective === 'value') {
    return pool
      .filter((o) => (o.estimatedValue ?? 0) > 0)
      .sort((a, b) => (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0))
      .map((o) => ({ ...o, reason: 'high_value' as AttentionReason }))
      .slice(0, limit);
  }

  if (perspective === 'unassigned') {
    return pool
      .filter((o) => !o.owner)
      .sort((a, b) => (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0))
      .map((o) => ({ ...o, reason: 'unassigned' as AttentionReason }))
      .slice(0, limit);
  }

  // smart: scoring weighted
  const scored = pool
    .map((o) => ({
      ...o,
      score: computeAttentionScore({
        estimatedValue: o.estimatedValue,
        stage: o.stage,
        lastActivityAt: o.lastActivityAt,
        lastActivityDirection: o.lastActivityDirection,
        owner: o.owner,
      }),
    }))
    .filter((o) => o.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Agrupa los opps que necesitan atención por owner. Las orphans (sin
 * owner) van en su propio bucket "unassigned".
 */
export type OwnerBucket = {
  ownerId: string | null;
  ownerName: string;
  ownerEmail: string | null;
  ownerAvatar: string | null;
  opps: NeedAttentionOpp[];
};

export async function getNeedAttentionByOwner(
  scope: Prisma.OpportunityWhereInput,
  perOwnerLimit = 5
): Promise<OwnerBucket[]> {
  const pool = await getAttentionPool(scope, 200);

  const buckets = new Map<string, OwnerBucket>();
  for (const o of pool) {
    const key = o.owner?.id ?? '__unassigned__';
    let b = buckets.get(key);
    if (!b) {
      b = {
        ownerId: o.owner?.id ?? null,
        ownerName: o.owner?.name ?? o.owner?.email ?? 'Sin asignar',
        ownerEmail: o.owner?.email ?? null,
        ownerAvatar: o.owner?.avatarUrl ?? null,
        opps: [],
      };
      buckets.set(key, b);
    }
    b.opps.push(o);
  }

  // Ordenar opps dentro de cada bucket por score smart, cap perOwnerLimit
  for (const b of buckets.values()) {
    b.opps = b.opps
      .map((o) => ({
        ...o,
        score: computeAttentionScore({
          estimatedValue: o.estimatedValue,
          stage: o.stage,
          lastActivityAt: o.lastActivityAt,
          lastActivityDirection: o.lastActivityDirection,
          owner: o.owner,
        }),
      }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, perOwnerLimit);
  }

  // Ordenar buckets: primero los que tienen más opps urgentes, sin
  // asignar al final.
  const list = [...buckets.values()];
  list.sort((a, b) => {
    if (a.ownerId === null && b.ownerId !== null) return 1;
    if (b.ownerId === null && a.ownerId !== null) return -1;
    return b.opps.length - a.opps.length;
  });
  return list;
}
