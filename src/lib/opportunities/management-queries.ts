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
  /// Razón principal por la que está en este hero ('needs_response' | 'red' | 'never')
  reason: 'needs_response' | 'red' | 'never';
};

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
