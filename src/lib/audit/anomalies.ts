import 'server-only';
import { prisma } from '@/lib/db';
import type { AuditLogRow } from './queries';

/**
 * Heurísticas de anomalía sobre AuditLog. Sin ML; pura estadística sobre
 * los últimos 30 días por usuario.
 *
 *   - high_volume       : el usuario hizo >3× su promedio diario
 *   - unusual_hour      : la acción cayó en una hora nunca vista antes
 *   - new_resource_type : primera vez tocando ese resource
 *   - mass_delete       : ráfaga de ≥10 deletes del mismo recurso en <60s
 *   - after_hours       : entre 23:00 y 06:00 UTC (servidor)
 *   - admin_action      : acción privilegiada (delete, role_change, etc.)
 *
 * `flagAnomalies` recibe el batch de eventos a evaluar (típicamente la
 * página visible) + un map de baselines pre-computadas para cada usuario
 * involucrado. Devuelve un Map<eventId, AnomalyFlag[]>.
 */

export type AnomalyKind =
  | 'high_volume'
  | 'unusual_hour'
  | 'new_resource_type'
  | 'mass_delete'
  | 'after_hours'
  | 'admin_action';

export type AnomalyFlag = {
  kind: AnomalyKind;
  reason: string;
  severity: 1 | 2 | 3; // 1=info, 2=warning, 3=alert
};

export type UserBaseline = {
  userId: string;
  dailyAvg: number; // promedio acciones/día en últimos 30d
  activeHours: Set<number>; // horas (0-23) en las que el user actuó alguna vez
  knownResources: Set<string>;
};

const SENSITIVE_ACTIONS = new Set([
  'delete',
  'archive',
  'role_grant',
  'role_revoke',
  'permission_grant',
  'permission_revoke',
]);

export async function getUserBaselines(
  userIds: string[],
  days = 30
): Promise<Map<string, UserBaseline>> {
  const out = new Map<string, UserBaseline>();
  if (userIds.length === 0) return out;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Una sola query agregada por user para hours + resources + count.
  // Usamos Postgres date_part('hour') para no traer todos los rows.
  const hourRows = await prisma.$queryRaw<
    Array<{ userId: string; hour: number }>
  >`
    SELECT DISTINCT "userId", EXTRACT(HOUR FROM "createdAt")::int AS hour
    FROM "AuditLog"
    WHERE "userId" = ANY(${userIds}::text[]) AND "createdAt" >= ${since}
  `;
  const resourceRows = await prisma.$queryRaw<
    Array<{ userId: string; resource: string }>
  >`
    SELECT DISTINCT "userId", "resource"
    FROM "AuditLog"
    WHERE "userId" = ANY(${userIds}::text[]) AND "createdAt" >= ${since}
  `;
  const countRows = await prisma.auditLog.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds }, createdAt: { gte: since } },
    _count: { _all: true },
  });

  for (const u of userIds) {
    out.set(u, {
      userId: u,
      dailyAvg: 0,
      activeHours: new Set(),
      knownResources: new Set(),
    });
  }
  for (const r of hourRows) out.get(r.userId)?.activeHours.add(r.hour);
  for (const r of resourceRows) out.get(r.userId)?.knownResources.add(r.resource);
  for (const r of countRows) {
    const b = out.get(r.userId!);
    if (b) b.dailyAvg = r._count._all / days;
  }
  return out;
}

export async function getDayCountsForUsers(
  userIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (userIds.length === 0) return out;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await prisma.auditLog.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds }, createdAt: { gte: startOfDay } },
    _count: { _all: true },
  });
  for (const r of rows) if (r.userId) out.set(r.userId, r._count._all);
  return out;
}

/**
 * Evalúa flags por evento. La detección de mass_delete requiere ver
 * eventos vecinos, así que recorremos dos veces sobre la misma lista.
 */
export function flagAnomalies(
  events: AuditLogRow[],
  baselines: Map<string, UserBaseline>,
  todayCounts: Map<string, number>
): Map<string, AnomalyFlag[]> {
  const out = new Map<string, AnomalyFlag[]>();
  const push = (id: string, flag: AnomalyFlag) => {
    const arr = out.get(id) ?? [];
    arr.push(flag);
    out.set(id, arr);
  };

  // Pre-compute mass_delete: agrupar deletes del mismo (userId, resource)
  // que estén a ≤60s entre sí.
  const deletes = events
    .filter((e) => e.action === 'delete' && e.userId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Sliding window: por cada delete, contar cuántos deletes hubo del mismo
  // (user, resource) en los 60s anteriores incluido él.
  for (let i = 0; i < deletes.length; i++) {
    const cur = deletes[i];
    const since = cur.createdAt.getTime() - 60_000;
    let cnt = 0;
    for (let j = i; j >= 0; j--) {
      const d = deletes[j];
      if (d.createdAt.getTime() < since) break;
      if (d.userId === cur.userId && d.resource === cur.resource) cnt += 1;
    }
    if (cnt >= 10) {
      push(cur.id, {
        kind: 'mass_delete',
        reason: `≥${cnt} deletes de ${cur.resource} en <60s`,
        severity: 3,
      });
    }
  }

  for (const e of events) {
    // admin_action — siempre marca, severity 1 (info)
    if (SENSITIVE_ACTIONS.has(e.action)) {
      push(e.id, {
        kind: 'admin_action',
        reason: `Acción privilegiada: ${e.action}`,
        severity: e.action === 'delete' ? 2 : 1,
      });
    }

    // after_hours — UTC del servidor
    const h = e.createdAt.getUTCHours();
    if (h >= 23 || h < 6) {
      push(e.id, {
        kind: 'after_hours',
        reason: `Acción a las ${h.toString().padStart(2, '0')}:00 UTC`,
        severity: 1,
      });
    }

    if (!e.userId) continue;
    const baseline = baselines.get(e.userId);
    if (!baseline) continue;

    // unusual_hour — solo si el user tiene un baseline real (≥10 acciones)
    if (
      baseline.activeHours.size >= 3 &&
      !baseline.activeHours.has(h) &&
      baseline.dailyAvg >= 0.3 // al menos algo de actividad
    ) {
      push(e.id, {
        kind: 'unusual_hour',
        reason: `Hora ${h.toString().padStart(2, '0')}h fuera del patrón habitual de este usuario`,
        severity: 2,
      });
    }

    // new_resource_type — primera vez que el user toca este resource
    if (baseline.knownResources.size > 0 && !baseline.knownResources.has(e.resource)) {
      push(e.id, {
        kind: 'new_resource_type',
        reason: `Primera vez tocando "${e.resource}"`,
        severity: 1,
      });
    }

    // high_volume — el día actual va por más de 3× el promedio
    const today = todayCounts.get(e.userId) ?? 0;
    if (baseline.dailyAvg >= 5 && today > 3 * baseline.dailyAvg) {
      push(e.id, {
        kind: 'high_volume',
        reason: `Hoy ${today} acciones (${(today / baseline.dailyAvg).toFixed(1)}× su promedio)`,
        severity: 2,
      });
    }
  }

  return out;
}

export const ANOMALY_LABEL: Record<AnomalyKind, string> = {
  high_volume: 'Volumen alto',
  unusual_hour: 'Hora inusual',
  new_resource_type: 'Recurso nuevo',
  mass_delete: 'Ráfaga de borrados',
  after_hours: 'Fuera de horario',
  admin_action: 'Privilegiada',
};
