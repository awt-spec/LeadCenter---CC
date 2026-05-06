import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * Audit log queries powering /audit.
 *
 * Modelo subyacente: `AuditLog(userId, action, resource, resourceId,
 * changes, metadata, ipAddress, userAgent, createdAt)`. Todos los
 * mutadores de cuentas/contactos/opps/tasks/activities/campañas ya
 * escriben aquí desde hace tiempo, igual que login/logout.
 *
 * Filtros soportados:
 *   - userId    : uno o varios usuarios
 *   - action    : 'create', 'update', 'delete', 'login', 'logout', etc.
 *   - resource  : 'accounts', 'contacts', 'opportunities', 'auth', etc.
 *   - dateFrom / dateTo : rango ISO date
 *   - q         : texto libre que busca en action / resource / metadata
 *
 * Orden de magnitud esperado: ~10K-100K rows en 30 días para una org
 * normal. Las queries usan los índices existentes (`@@index([userId])`,
 * `@@index([resource, resourceId])`, `@@index([createdAt])`).
 */

export type AuditFilters = {
  userId?: string[];
  action?: string[];
  resource?: string[];
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  reviewState?: 'reviewed' | 'unreviewed' | 'all';
  page: number;
  pageSize: number;
};

export type AuditLogRow = {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  changes: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewedById: string | null;
  reviewNote: string | null;
  user: { id: string; name: string | null; email: string; avatarUrl: string | null } | null;
  reviewedBy: { id: string; name: string | null; email: string } | null;
};

export type AuditStats = {
  total24h: number;
  total7d: number;
  total30d: number;
  uniqueUsers30d: number;
  topAction: { action: string; count: number } | null;
  topResource: { resource: string; count: number } | null;
};

export type DailyAuditDatum = { day: string; count: number };
export type UserActivityDatum = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  count: number;
};
export type ResourceDatum = { resource: string; count: number };

export type UserDrilldown = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  totalActions30d: number;
  byAction: Array<{ action: string; count: number }>;
  byResource: Array<{ resource: string; count: number }>;
  estimatedActiveMinutes30d: number;
  daysActive30d: number;
  lastSeen: Date | null;
};

// ── Helpers ────────────────────────────────────────────────────────

function buildWhere(filters: AuditFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  const and: Prisma.AuditLogWhereInput[] = [];

  if (filters.userId?.length) and.push({ userId: { in: filters.userId } });
  if (filters.action?.length) and.push({ action: { in: filters.action } });
  if (filters.resource?.length) and.push({ resource: { in: filters.resource } });

  if (filters.dateFrom) {
    and.push({ createdAt: { gte: new Date(filters.dateFrom) } });
  }
  if (filters.dateTo) {
    // Incluir el dia completo
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    and.push({ createdAt: { lte: end } });
  }

  if (filters.q) {
    const q = filters.q.trim();
    and.push({
      OR: [
        { action: { contains: q, mode: 'insensitive' } },
        { resource: { contains: q, mode: 'insensitive' } },
        { resourceId: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  if (filters.reviewState === 'reviewed') {
    and.push({ reviewedAt: { not: null } });
  } else if (filters.reviewState === 'unreviewed') {
    and.push({ reviewedAt: null });
  }

  if (and.length) where.AND = and;
  return where;
}

// ── Queries ────────────────────────────────────────────────────────

export async function listAuditLog(
  filters: AuditFilters
): Promise<{ rows: AuditLogRow[]; total: number }> {
  const where = buildWhere(filters);

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { rows: rows as AuditLogRow[], total };
}

export async function getAuditStats(): Promise<AuditStats> {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const since24h = new Date(now.getTime() - day);
  const since7d = new Date(now.getTime() - 7 * day);
  const since30d = new Date(now.getTime() - 30 * day);

  const [total24h, total7d, total30d, uniqueUsers, topActionRows, topResourceRows] =
    await Promise.all([
      prisma.auditLog.count({ where: { createdAt: { gte: since24h } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: since7d } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: since30d } } }),
      prisma.auditLog
        .findMany({
          where: { createdAt: { gte: since30d }, userId: { not: null } },
          distinct: ['userId'],
          select: { userId: true },
        })
        .then((r) => r.length),
      prisma.auditLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: since30d } },
        _count: { _all: true },
        orderBy: { _count: { action: 'desc' } },
        take: 1,
      }),
      prisma.auditLog.groupBy({
        by: ['resource'],
        where: { createdAt: { gte: since30d } },
        _count: { _all: true },
        orderBy: { _count: { resource: 'desc' } },
        take: 1,
      }),
    ]);

  return {
    total24h,
    total7d,
    total30d,
    uniqueUsers30d: uniqueUsers,
    topAction: topActionRows[0]
      ? { action: topActionRows[0].action, count: topActionRows[0]._count._all }
      : null,
    topResource: topResourceRows[0]
      ? { resource: topResourceRows[0].resource, count: topResourceRows[0]._count._all }
      : null,
  };
}

export async function getAuditByDay(days = 30): Promise<DailyAuditDatum[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // Usamos $queryRaw con date_trunc para agrupar por día en TZ del DB.
  const rows = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
    SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
    FROM "AuditLog"
    WHERE "createdAt" >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({
    day: r.day.toISOString().slice(0, 10),
    count: Number(r.count),
  }));
}

export async function getTopUsers(days = 30, limit = 10): Promise<UserActivityDatum[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const grouped = await prisma.auditLog.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: since }, userId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { userId: 'desc' } },
    take: limit,
  });
  const userIds = grouped.map((g) => g.userId).filter((x): x is string => !!x);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));
  return grouped
    .filter((g) => g.userId && userMap.has(g.userId))
    .map((g) => {
      const u = userMap.get(g.userId!)!;
      return {
        userId: u.id,
        name: u.name ?? u.email,
        email: u.email,
        avatarUrl: u.avatarUrl,
        count: g._count._all,
      };
    });
}

export async function getResourceBreakdown(days = 30): Promise<ResourceDatum[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.auditLog.groupBy({
    by: ['resource'],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { resource: 'desc' } },
  });
  return rows.map((r) => ({ resource: r.resource, count: r._count._all }));
}

/**
 * Drilldown por usuario en los últimos `days` días. Computa "tiempo
 * activo estimado" como la suma de (max - min) de createdAt por día,
 * capeada a 8h por día (evitamos outliers cuando alguien deja la pestaña
 * abierta toda la noche).
 */
export async function getUserDrilldown(
  userId: string,
  days = 30
): Promise<UserDrilldown | null> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  if (!user) return null;

  const [byAction, byResource, total, dayBuckets, lastRow] = await Promise.all([
    prisma.auditLog.groupBy({
      by: ['action'],
      where: { userId, createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { action: 'desc' } },
    }),
    prisma.auditLog.groupBy({
      by: ['resource'],
      where: { userId, createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { resource: 'desc' } },
    }),
    prisma.auditLog.count({ where: { userId, createdAt: { gte: since } } }),
    prisma.$queryRaw<
      Array<{ day: Date; first: Date; last: Date }>
    >`
      SELECT
        date_trunc('day', "createdAt") AS day,
        MIN("createdAt") AS first,
        MAX("createdAt") AS last
      FROM "AuditLog"
      WHERE "userId" = ${userId} AND "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.auditLog.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  const CAP_MIN = 8 * 60; // 8 horas máximas por día
  let activeMin = 0;
  for (const b of dayBuckets) {
    const ms = b.last.getTime() - b.first.getTime();
    const min = Math.min(CAP_MIN, Math.max(1, Math.round(ms / 60_000)));
    activeMin += min;
  }

  return {
    userId: user.id,
    name: user.name ?? user.email,
    email: user.email,
    avatarUrl: user.avatarUrl,
    totalActions30d: total,
    byAction: byAction.map((g) => ({ action: g.action, count: g._count._all })),
    byResource: byResource.map((g) => ({ resource: g.resource, count: g._count._all })),
    estimatedActiveMinutes30d: activeMin,
    daysActive30d: dayBuckets.length,
    lastSeen: lastRow?.createdAt ?? null,
  };
}

/**
 * Listas para popular dropdowns de filtros: actions y resources
 * distintos vistos en los últimos 90 días.
 */
export async function getDistinctActionsAndResources(): Promise<{
  actions: string[];
  resources: string[];
}> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const [actions, resources] = await Promise.all([
    prisma.auditLog.findMany({
      where: { createdAt: { gte: since } },
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: since } },
      distinct: ['resource'],
      select: { resource: true },
      orderBy: { resource: 'asc' },
    }),
  ]);
  return {
    actions: actions.map((r) => r.action),
    resources: resources.map((r) => r.resource),
  };
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  v2 — analytics extendidos                                       ║
// ╚══════════════════════════════════════════════════════════════════╝

export type HeatmapCell = { dow: number; hour: number; count: number };
export type HourBucket = { hour: number; count: number };
export type OnlineUser = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  lastAction: Date;
  recentActions: number;
};
export type StatsWithDeltas = AuditStats & {
  delta24h: number | null; // % vs día anterior
  delta7d: number | null; // % vs semana anterior
  delta30d: number | null; // % vs mes anterior
};
export type Session = {
  start: Date;
  end: Date;
  durationMin: number;
  actionCount: number;
  resources: string[]; // distintos recursos tocados en la sesión
};
export type ResourceTrailEvent = {
  id: string;
  action: string;
  changes: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  user: { id: string; name: string | null; email: string; avatarUrl: string | null } | null;
};

/**
 * Heatmap hora-del-día × día-de-la-semana, últimos `days` días.
 * Devuelve los buckets densos (sin filas con 0). El UI rellena.
 *
 * date_part('dow', ...) en Postgres: 0=Domingo, 6=Sábado.
 */
export async function getActivityHeatmap(days = 30): Promise<HeatmapCell[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw<
    Array<{ dow: number; hour: number; count: bigint }>
  >`
    SELECT
      EXTRACT(DOW  FROM "createdAt")::int   AS dow,
      EXTRACT(HOUR FROM "createdAt")::int   AS hour,
      COUNT(*)::bigint                       AS count
    FROM "AuditLog"
    WHERE "createdAt" >= ${since}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `;
  return rows.map((r) => ({ dow: r.dow, hour: r.hour, count: Number(r.count) }));
}

/**
 * Distribución plana por hora del día (0-23), agregando todos los días.
 */
export async function getHourDistribution(days = 30): Promise<HourBucket[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`
    SELECT
      EXTRACT(HOUR FROM "createdAt")::int AS hour,
      COUNT(*)::bigint AS count
    FROM "AuditLog"
    WHERE "createdAt" >= ${since}
    GROUP BY 1
    ORDER BY 1
  `;
  // Rellenar horas con 0 para que el chart no salte
  const map = new Map(rows.map((r) => [r.hour, Number(r.count)]));
  const buckets: HourBucket[] = [];
  for (let h = 0; h < 24; h++) buckets.push({ hour: h, count: map.get(h) ?? 0 });
  return buckets;
}

/**
 * "Online ahora" — usuarios con actividad en los últimos `windowMin`.
 * Sin WebSockets: aproximación basada en última acción.
 */
export async function getOnlineUsers(windowMin = 5, limit = 20): Promise<OnlineUser[]> {
  const since = new Date(Date.now() - windowMin * 60 * 1000);
  const grouped = await prisma.auditLog.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: since }, userId: { not: null } },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: limit,
  });
  const userIds = grouped.map((g) => g.userId).filter((x): x is string => !!x);
  if (userIds.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));
  return grouped
    .filter((g) => g.userId && userMap.has(g.userId))
    .map((g) => {
      const u = userMap.get(g.userId!)!;
      return {
        userId: u.id,
        name: u.name ?? u.email,
        email: u.email,
        avatarUrl: u.avatarUrl,
        lastAction: g._max.createdAt!,
        recentActions: g._count._all,
      };
    });
}

/**
 * Stats con deltas vs el período anterior. Dejamos `topAction` y
 * `topResource` igual que en `getAuditStats` y agregamos los % de
 * cambio. Una sola RAID porque hace 6 counts en paralelo.
 */
export async function getAuditStatsWithDeltas(): Promise<StatsWithDeltas> {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const since24h = new Date(now.getTime() - day);
  const since48h = new Date(now.getTime() - 2 * day);
  const since7d = new Date(now.getTime() - 7 * day);
  const since14d = new Date(now.getTime() - 14 * day);
  const since30d = new Date(now.getTime() - 30 * day);
  const since60d = new Date(now.getTime() - 60 * day);

  const [
    total24h,
    prev24h,
    total7d,
    prev7d,
    total30d,
    prev30d,
    uniqueUsers,
    topActionRows,
    topResourceRows,
  ] = await Promise.all([
    prisma.auditLog.count({ where: { createdAt: { gte: since24h } } }),
    prisma.auditLog.count({
      where: { createdAt: { gte: since48h, lt: since24h } },
    }),
    prisma.auditLog.count({ where: { createdAt: { gte: since7d } } }),
    prisma.auditLog.count({
      where: { createdAt: { gte: since14d, lt: since7d } },
    }),
    prisma.auditLog.count({ where: { createdAt: { gte: since30d } } }),
    prisma.auditLog.count({
      where: { createdAt: { gte: since60d, lt: since30d } },
    }),
    prisma.auditLog
      .findMany({
        where: { createdAt: { gte: since30d }, userId: { not: null } },
        distinct: ['userId'],
        select: { userId: true },
      })
      .then((r) => r.length),
    prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: since30d } },
      _count: { _all: true },
      orderBy: { _count: { action: 'desc' } },
      take: 1,
    }),
    prisma.auditLog.groupBy({
      by: ['resource'],
      where: { createdAt: { gte: since30d } },
      _count: { _all: true },
      orderBy: { _count: { resource: 'desc' } },
      take: 1,
    }),
  ]);

  const delta = (curr: number, prev: number): number | null =>
    prev === 0 ? (curr === 0 ? 0 : null) : ((curr - prev) / prev) * 100;

  return {
    total24h,
    total7d,
    total30d,
    uniqueUsers30d: uniqueUsers,
    topAction: topActionRows[0]
      ? { action: topActionRows[0].action, count: topActionRows[0]._count._all }
      : null,
    topResource: topResourceRows[0]
      ? { resource: topResourceRows[0].resource, count: topResourceRows[0]._count._all }
      : null,
    delta24h: delta(total24h, prev24h),
    delta7d: delta(total7d, prev7d),
    delta30d: delta(total30d, prev30d),
  };
}

/**
 * Sesiones de un usuario: agrupamos clicks consecutivos en sesión nueva
 * cuando hay gap > `gapMin` minutos. Default 30 min — convención común
 * en analytics web.
 */
export async function getUserSessions(
  userId: string,
  days = 30,
  gapMin = 30,
  limit = 20
): Promise<Session[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.auditLog.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { createdAt: true, resource: true },
    orderBy: { createdAt: 'asc' },
  });

  if (rows.length === 0) return [];

  const sessions: Session[] = [];
  const gapMs = gapMin * 60 * 1000;
  let start = rows[0].createdAt;
  let end = rows[0].createdAt;
  let count = 0;
  let resourceSet = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.createdAt.getTime() - end.getTime() > gapMs) {
      sessions.push({
        start,
        end,
        durationMin: Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000)),
        actionCount: count,
        resources: [...resourceSet],
      });
      start = r.createdAt;
      resourceSet = new Set();
      count = 0;
    }
    end = r.createdAt;
    count += 1;
    resourceSet.add(r.resource);
  }
  // Última sesión abierta
  sessions.push({
    start,
    end,
    durationMin: Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000)),
    actionCount: count,
    resources: [...resourceSet],
  });

  // Devolver las más recientes primero
  return sessions.reverse().slice(0, limit);
}

/**
 * Trail completo de un recurso específico (toda su historia).
 * Útil para "ver qué le pasó a esta opp / cuenta / contacto".
 */
export async function getResourceTrail(
  resource: string,
  resourceId: string,
  limit = 200
): Promise<ResourceTrailEvent[]> {
  const rows = await prisma.auditLog.findMany({
    where: { resource, resourceId },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows as ResourceTrailEvent[];
}

/**
 * Para CSV export — devuelve hasta `maxRows` filas planas.
 * NO usa paginación: el operador exporta todo el filtro de una.
 */
export async function listAuditForExport(
  filters: AuditFilters,
  maxRows = 10_000
): Promise<AuditLogRow[]> {
  // Reusamos buildWhere via listAuditLog con pageSize = maxRows
  const result = await listAuditLog({ ...filters, page: 1, pageSize: maxRows });
  return result.rows;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  v3 Batch C — permission matrix + inactive users                 ║
// ╚══════════════════════════════════════════════════════════════════╝

export type RoleEntry = { id: string; key: string; name: string };
export type PermissionEntry = {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
};
export type PermissionMatrix = {
  roles: RoleEntry[];
  permissions: PermissionEntry[];
  matrix: Record<string, Set<string>>; // roleKey → Set<permissionKey>
};

const SENSITIVE_KEYWORDS = [
  'delete',
  'archive',
  'role_grant',
  'role_revoke',
  'permission_grant',
  'permission_revoke',
  'change_role',
  ':all',
  'audit:read',
];

export function isSensitivePermission(key: string): boolean {
  return SENSITIVE_KEYWORDS.some((k) => key.includes(k));
}

export async function getRolePermissionMatrix(): Promise<PermissionMatrix> {
  const [roles, permissions, rolePerms] = await Promise.all([
    prisma.role.findMany({
      select: { id: true, key: true, name: true },
      orderBy: { key: 'asc' },
    }),
    prisma.permission.findMany({
      select: {
        id: true,
        key: true,
        resource: true,
        action: true,
        description: true,
      },
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    }),
    prisma.rolePermission.findMany({
      select: { role: { select: { key: true } }, permission: { select: { key: true } } },
    }),
  ]);

  const matrix: Record<string, Set<string>> = {};
  for (const r of roles) matrix[r.key] = new Set();
  for (const rp of rolePerms) {
    if (matrix[rp.role.key]) matrix[rp.role.key].add(rp.permission.key);
  }

  return { roles, permissions, matrix };
}

export type InactiveUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  lastSeen: Date | null;
};

export async function getInactiveUsers(daysThreshold = 14): Promise<InactiveUser[]> {
  const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);

  // Subquery: users con cualquier acción después de cutoff
  const activeUserIds = await prisma.auditLog.findMany({
    where: { createdAt: { gte: cutoff }, userId: { not: null } },
    distinct: ['userId'],
    select: { userId: true },
  });
  const activeSet = new Set(activeUserIds.map((r) => r.userId).filter(Boolean) as string[]);

  const users = await prisma.user.findMany({
    where: { isActive: true, id: { notIn: [...activeSet] } },
    select: { id: true, name: true, email: true, avatarUrl: true },
    orderBy: { name: 'asc' },
  });

  // Última acción conocida (si nunca actuó queda null)
  const lastSeenRows = await prisma.auditLog.groupBy({
    by: ['userId'],
    where: { userId: { in: users.map((u) => u.id) } },
    _max: { createdAt: true },
  });
  const lastSeenMap = new Map<string, Date | null>();
  for (const r of lastSeenRows) {
    if (r.userId) lastSeenMap.set(r.userId, r._max.createdAt ?? null);
  }

  return users.map((u) => ({
    id: u.id,
    name: u.name ?? u.email,
    email: u.email,
    avatarUrl: u.avatarUrl,
    lastSeen: lastSeenMap.get(u.id) ?? null,
  }));
}
