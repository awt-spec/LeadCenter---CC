// Sprint queries — backboard data for the role-specific sprint views.
//
// Marketing (Katherine): leads to contact + active campaigns + her audit.
// BD (Sebastian): companies to research/import + DB stats + his audit.

import { prisma } from '@/lib/db';
import type { Session } from 'next-auth';

/// Anchor "this week" on Monday UTC.
function thisMondayUtc(): Date {
  const now = new Date();
  const dow = now.getUTCDay();
  const daysToMonday = (dow + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToMonday));
}

export interface SprintCard {
  id: string;
  title: string;
  subtitle: string | null;
  /// Bucket where the card lives.
  bucket: string;
  href: string;
  meta: { label: string; value: string }[];
  /// Color accent (hex) — derived from priority/age.
  accent: 'red' | 'orange' | 'amber' | 'emerald' | 'neutral' | 'red-sysde';
}

export interface SprintBoard {
  buckets: Array<{ key: string; label: string; description?: string; cards: SprintCard[] }>;
  /// Top-line goals for the sprint.
  goals: { label: string; current: number; target: number }[];
}

// ─────────────────────────────────────────────────────
// Marketing sprint (Katherine): leads + campaigns

export async function loadMarketingSprint(session: Session): Promise<{
  board: SprintBoard;
  campaigns: Array<{ id: string; name: string; status: string; targetCount: number; engagedCount: number }>;
}> {
  const userId = session.user!.id;
  const monday = thisMondayUtc();

  // Buckets we'll fill:
  // 1. "Backlog" — owned contacts, never contacted, status=ACTIVE/NURTURE.
  // 2. "Esta semana" — last activity (any) within current week.
  // 3. "Awaiting reply" — last EMAIL_SENT but no EMAIL_RECEIVED after.
  // 4. "Replied" — last EMAIL_RECEIVED within 14d, no follow-up since.
  // 5. "Cerrado" — Tasks DONE this week or Activities tagged FOLLOWUP done.

  const [contacts, recentActivities, pendingTasks, doneTasks] = await Promise.all([
    prisma.contact.findMany({
      where: {
        OR: [{ ownerId: userId }, { createdById: userId }],
        status: { in: ['ACTIVE', 'NURTURE'] },
      },
      select: {
        id: true, fullName: true, email: true, jobTitle: true, status: true,
        engagementScore: true,
        account: { select: { id: true, name: true, country: true } },
      },
      orderBy: [{ engagementScore: 'desc' }, { fullName: 'asc' }],
      take: 80,
    }),
    prisma.activity.findMany({
      where: {
        createdById: userId,
        occurredAt: { gte: monday },
      },
      select: {
        id: true, type: true, subject: true, occurredAt: true,
        contactId: true, accountId: true,
      },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    }),
    prisma.task.findMany({
      where: {
        OR: [
          { createdById: userId },
          { assignees: { some: { userId } } },
        ],
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      select: {
        id: true, title: true, status: true, priority: true, dueDate: true,
        accountId: true, account: { select: { name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      take: 30,
    }),
    prisma.task.findMany({
      where: {
        OR: [
          { createdById: userId },
          { assignees: { some: { userId } } },
        ],
        status: 'DONE',
        completedAt: { gte: monday },
      },
      select: {
        id: true, title: true, completedAt: true,
        account: { select: { name: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 20,
    }),
  ]);

  // Build buckets
  const cardsByBucket: Record<string, SprintCard[]> = {
    backlog: [],
    week: [],
    awaiting: [],
    replied: [],
    done: [],
  };

  // Index activities per contact for quick lookup
  const activitiesByContact = new Map<string, typeof recentActivities>();
  for (const a of recentActivities) {
    if (!a.contactId) continue;
    let arr = activitiesByContact.get(a.contactId);
    if (!arr) { arr = []; activitiesByContact.set(a.contactId, arr); }
    arr.push(a);
  }

  for (const c of contacts) {
    const activities = activitiesByContact.get(c.id) ?? [];
    const lastActivity = activities[0] ?? null;

    // Determine bucket. We use the last activity Katherine logged for this
    // contact (within `since`); if there is none, the contact lives in
    // Backlog. Otherwise we route by direction + recency.
    let bucket = 'backlog';
    if (lastActivity && lastActivity.occurredAt >= monday) {
      bucket = 'week';
    } else if (lastActivity?.type === 'EMAIL_SENT') {
      bucket = 'awaiting';
    } else if (lastActivity?.type === 'EMAIL_RECEIVED') {
      bucket = 'replied';
    }

    if (bucket === 'backlog' && cardsByBucket.backlog.length >= 25) continue;

    cardsByBucket[bucket].push({
      id: c.id,
      title: c.fullName,
      subtitle: c.account ? `${c.account.name}${c.account.country ? ' · ' + c.account.country : ''}` : c.jobTitle,
      bucket,
      href: `/contacts/${c.id}`,
      meta: [
        { label: 'Score', value: String(c.engagementScore) },
        ...(c.jobTitle ? [{ label: 'Cargo', value: c.jobTitle }] : []),
        ...(lastActivity ? [{ label: 'Última', value: lastActivity.subject.slice(0, 30) }] : []),
      ],
      accent: bucket === 'replied' ? 'red-sysde' : bucket === 'awaiting' ? 'amber' : bucket === 'week' ? 'emerald' : 'neutral',
    });
  }

  // Add pending tasks to "Esta semana" with task-style cards
  for (const t of pendingTasks.slice(0, 12)) {
    const overdue = t.dueDate && t.dueDate < new Date();
    cardsByBucket.week.push({
      id: 'task-' + t.id,
      title: t.title,
      subtitle: t.account?.name ?? 'Sin cuenta',
      bucket: 'week',
      href: `/accounts/${t.accountId}`,
      meta: [
        { label: 'Prioridad', value: t.priority },
        ...(t.dueDate ? [{ label: 'Vence', value: t.dueDate.toISOString().slice(0, 10) }] : []),
      ],
      accent: overdue ? 'red' : 'amber',
    });
  }

  // Done bucket from completed tasks
  for (const t of doneTasks.slice(0, 12)) {
    cardsByBucket.done.push({
      id: 'task-done-' + t.id,
      title: t.title,
      subtitle: t.account?.name ?? null,
      bucket: 'done',
      href: '/sprint',
      meta: t.completedAt ? [{ label: 'Cerrada', value: t.completedAt.toISOString().slice(0, 10) }] : [],
      accent: 'emerald',
    });
  }

  // Goals — heuristic targets that the user can adjust later in settings
  const emailsThisWeek = recentActivities.filter((a) => a.type === 'EMAIL_SENT').length;
  const callsThisWeek = recentActivities.filter((a) => a.type === 'CALL').length;
  const meetingsThisWeek = recentActivities.filter((a) => ['MEETING', 'DEMO'].includes(a.type)).length;

  const board: SprintBoard = {
    buckets: [
      { key: 'backlog', label: 'Backlog', description: 'Leads asignados sin actividad reciente', cards: cardsByBucket.backlog },
      { key: 'week', label: 'Esta semana', description: 'Trabajado lunes en adelante', cards: cardsByBucket.week },
      { key: 'awaiting', label: 'Esperando respuesta', description: 'Email enviado, sin reply', cards: cardsByBucket.awaiting },
      { key: 'replied', label: 'Cliente respondió', description: 'Pelota en tu campo', cards: cardsByBucket.replied },
      { key: 'done', label: 'Cerrado esta semana', description: 'Tasks completadas', cards: cardsByBucket.done },
    ],
    goals: [
      { label: 'Emails enviados', current: emailsThisWeek, target: 80 },
      { label: 'Llamadas', current: callsThisWeek, target: 15 },
      { label: 'Reuniones / demos', current: meetingsThisWeek, target: 5 },
    ],
  };

  // Active campaigns
  const campaignRows = await prisma.campaign.findMany({
    where: {
      OR: [{ ownerId: userId }, { createdById: userId }],
      status: { in: ['ACTIVE', 'PAUSED', 'DRAFT'] },
    },
    select: {
      id: true, name: true, status: true,
      _count: { select: { contacts: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 8,
  });
  const campaigns = await Promise.all(campaignRows.map(async (c) => {
    const engaged = await prisma.campaignContact.count({
      where: { campaignId: c.id, status: { in: ['ENGAGED', 'OPENED', 'CLICKED', 'REPLIED'] } as never },
    }).catch(() => 0);
    return {
      id: c.id, name: c.name, status: c.status,
      targetCount: c._count.contacts,
      engagedCount: engaged,
    };
  }));

  return { board, campaigns };
}

// ─────────────────────────────────────────────────────
// BD sprint (Sebastian): research + DB generation

export async function loadBDSprint(session: Session): Promise<{
  board: SprintBoard;
  stats: { totalAccounts: number; totalContacts: number; addedThisWeek: number; needsReview: number };
}> {
  const userId = session.user!.id;
  const monday = thisMondayUtc();

  const [needsResearch, recent, doneTasks, totalAccounts, totalContacts, addedThisWeek, needsReview] = await Promise.all([
    prisma.account.findMany({
      where: {
        OR: [{ ownerId: userId }, { createdById: userId }],
        status: 'PROSPECT',
      },
      select: {
        id: true, name: true, country: true, segment: true, industry: true,
        domain: true, needsDomainReview: true, createdAt: true,
        _count: { select: { contacts: true, activities: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 80,
    }),
    prisma.account.findMany({
      where: {
        OR: [{ ownerId: userId }, { createdById: userId }],
        createdAt: { gte: monday },
      },
      select: { id: true, name: true, country: true, _count: { select: { contacts: true } }, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.task.findMany({
      where: {
        OR: [{ createdById: userId }, { assignees: { some: { userId } } }],
        status: 'DONE',
        completedAt: { gte: monday },
      },
      select: { id: true, title: true, completedAt: true, account: { select: { name: true } } },
      orderBy: { completedAt: 'desc' },
      take: 12,
    }),
    prisma.account.count(),
    prisma.contact.count(),
    prisma.account.count({ where: { createdAt: { gte: monday } } }),
    prisma.account.count({ where: { needsDomainReview: true } }),
  ]);

  const cardsByBucket: Record<string, SprintCard[]> = {
    research: [],
    investigating: [],
    review: [],
    inLC: [],
    done: [],
  };

  for (const a of needsResearch) {
    let bucket = 'research';
    if (a._count.activities > 0) bucket = 'investigating';
    if (a.needsDomainReview) bucket = 'review';
    if (a._count.contacts > 0 && !a.needsDomainReview) bucket = 'inLC';
    if (cardsByBucket[bucket].length >= 25) continue;

    cardsByBucket[bucket].push({
      id: a.id,
      title: a.name,
      subtitle: [a.country, a.segment, a.industry].filter(Boolean).join(' · ') || null,
      bucket,
      href: `/accounts/${a.id}`,
      meta: [
        ...(a.domain ? [{ label: 'Domain', value: a.domain }] : []),
        { label: 'Contactos', value: String(a._count.contacts) },
        { label: 'Acts', value: String(a._count.activities) },
      ],
      accent: bucket === 'review' ? 'amber' : bucket === 'inLC' ? 'emerald' : bucket === 'investigating' ? 'red-sysde' : 'neutral',
    });
  }

  for (const t of doneTasks) {
    cardsByBucket.done.push({
      id: 'task-done-' + t.id,
      title: t.title,
      subtitle: t.account?.name ?? null,
      bucket: 'done',
      href: '/sprint',
      meta: t.completedAt ? [{ label: 'Cerrada', value: t.completedAt.toISOString().slice(0, 10) }] : [],
      accent: 'emerald',
    });
  }

  void recent; // available if you want to surface a "recent imports" timeline

  const board: SprintBoard = {
    buckets: [
      { key: 'research', label: 'Por investigar', description: 'Cuentas que necesitan research', cards: cardsByBucket.research },
      { key: 'investigating', label: 'En investigación', description: 'Con actividad reciente', cards: cardsByBucket.investigating },
      { key: 'review', label: 'Revisión necesaria', description: 'Sin dominio confirmado', cards: cardsByBucket.review },
      { key: 'inLC', label: 'Con contactos', description: 'Datos completados', cards: cardsByBucket.inLC },
      { key: 'done', label: 'Tasks cerradas', description: 'Esta semana', cards: cardsByBucket.done },
    ],
    goals: [
      { label: 'Cuentas nuevas semana', current: addedThisWeek, target: 30 },
      { label: 'Por revisar dominio', current: needsReview, target: 0 },
    ],
  };

  return {
    board,
    stats: { totalAccounts, totalContacts, addedThisWeek, needsReview },
  };
}

// ─────────────────────────────────────────────────────
// Activity audit per user — extended con cuentas gestionadas y tiempo estimado.

export interface AuditDayRow {
  date: string;
  emails: number;
  calls: number;
  meetings: number;
  notes: number;
  tasks: number;
  total: number;
  /// Minutos de trabajo estimado para este día (suma duraciones reales o
  /// estimaciones por tipo de actividad si la duración está vacía).
  estimatedMinutes: number;
}

export interface AuditAccountTouched {
  accountId: string;
  accountName: string;
  count: number;
  lastTouchedAt: Date;
}

export interface AuditTypeBreakdown {
  emailsSent: number;
  emailsReceived: number;
  calls: number;
  meetings: number;
  demos: number;
  proposals: number;
  notes: number;
  tasksCompleted: number;
  stageChanges: number;
  other: number;
}

export interface AuditUser {
  id: string;
  name: string;
  email: string;
  /// Total activities en la ventana entera.
  total: number;
  /// Activities desde el lunes UTC.
  totalThisWeek: number;
  /// Cuentas distintas que tocó.
  uniqueAccountsTouched: number;
  /// Tiempo estimado en minutos en la ventana.
  estimatedMinutesTotal: number;
  /// Tiempo estimado esta semana en minutos.
  estimatedMinutesThisWeek: number;
  /// Tareas completadas en la ventana.
  tasksCompleted: number;
  /// Top 8 cuentas más tocadas.
  topAccounts: AuditAccountTouched[];
  /// Breakdown completo por tipo (en la ventana).
  breakdown: AuditTypeBreakdown;
  /// Granularidad diaria.
  days: AuditDayRow[];
}

/// Estimaciones de duración cuando el usuario no la registró.
/// Heurísticas conservadoras — el equipo puede ajustar editando individuales.
const DURATION_DEFAULTS_MIN: Record<string, number> = {
  EMAIL_SENT: 6,
  EMAIL_RECEIVED: 2,
  CALL: 18,
  WHATSAPP: 5,
  MEETING: 45,
  DEMO: 60,
  PROPOSAL_SENT: 25,
  MATERIAL_SENT: 8,
  LINKEDIN_MESSAGE: 4,
  INTERNAL_NOTE: 3,
  TASK: 15,
  STAGE_CHANGE: 1,
  CONTACT_LINKED: 1,
  STATUS_CHANGE: 1,
  FILE_SHARED: 4,
  EVENT_ATTENDED: 90,
};

interface RawAuditRow {
  user_id: string;
  user_name: string;
  user_email: string;
  day: Date;
  type: string;
  count: bigint;
  duration_sum: number | null;
}

interface RawAccountTouched {
  user_id: string;
  account_id: string;
  account_name: string;
  count: bigint;
  last_touched_at: Date;
}

interface RawTaskCompleted {
  user_id: string;
  count: bigint;
}

/// Per-user activity audit for the last `days` days.
export async function loadAudit(days = 14): Promise<AuditUser[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const monday = thisMondayUtc();

  // 1. Daily activity counts + duration sum, per user + type
  const rows = await prisma.$queryRawUnsafe<RawAuditRow[]>(
    `SELECT a."createdById" AS user_id,
            u."name" AS user_name,
            u."email" AS user_email,
            date_trunc('day', a."occurredAt" AT TIME ZONE 'UTC')::date AS day,
            a."type"::text AS type,
            COUNT(*)::bigint AS count,
            SUM(COALESCE(a."durationMinutes", 0))::int AS duration_sum
       FROM "Activity" a
       INNER JOIN "User" u ON u."id" = a."createdById"
       WHERE a."occurredAt" >= $1
         AND u."isActive" = true
       GROUP BY a."createdById", u."name", u."email", day, a."type"
       ORDER BY user_name, day DESC`,
    since
  );

  // 2. Top accounts touched per user (limit 8 each)
  const accountRows = await prisma.$queryRawUnsafe<RawAccountTouched[]>(
    `WITH ranked AS (
       SELECT a."createdById" AS user_id,
              a."accountId" AS account_id,
              acc."name" AS account_name,
              COUNT(*) AS count,
              MAX(a."occurredAt") AS last_touched_at,
              ROW_NUMBER() OVER (PARTITION BY a."createdById" ORDER BY COUNT(*) DESC) AS rn
         FROM "Activity" a
         INNER JOIN "Account" acc ON acc."id" = a."accountId"
         WHERE a."occurredAt" >= $1
           AND a."accountId" IS NOT NULL
         GROUP BY a."createdById", a."accountId", acc."name"
     )
     SELECT user_id, account_id, account_name, count::bigint, last_touched_at
       FROM ranked
       WHERE rn <= 8
       ORDER BY user_id, count DESC`,
    since
  );

  // 3. Distinct accounts touched per user
  const distinctAccountRows = await prisma.$queryRawUnsafe<{ user_id: string; distinct_count: bigint }[]>(
    `SELECT a."createdById" AS user_id,
            COUNT(DISTINCT a."accountId")::bigint AS distinct_count
       FROM "Activity" a
       WHERE a."occurredAt" >= $1
         AND a."accountId" IS NOT NULL
       GROUP BY a."createdById"`,
    since
  );

  // 4. Tasks completed per user
  const tasksRows = await prisma.$queryRawUnsafe<RawTaskCompleted[]>(
    `SELECT t."createdById" AS user_id,
            COUNT(*)::bigint AS count
       FROM "Task" t
       WHERE t."completedAt" >= $1
       GROUP BY t."createdById"`,
    since
  );

  // ── Build per-user results ──────────────────────────────────
  const byUser = new Map<string, AuditUser>();

  // Init users with their activity rows
  for (const r of rows) {
    let u = byUser.get(r.user_id);
    if (!u) {
      u = {
        id: r.user_id,
        name: r.user_name,
        email: r.user_email,
        total: 0,
        totalThisWeek: 0,
        uniqueAccountsTouched: 0,
        estimatedMinutesTotal: 0,
        estimatedMinutesThisWeek: 0,
        tasksCompleted: 0,
        topAccounts: [],
        breakdown: {
          emailsSent: 0, emailsReceived: 0, calls: 0, meetings: 0,
          demos: 0, proposals: 0, notes: 0, tasksCompleted: 0,
          stageChanges: 0, other: 0,
        },
        days: [],
      };
      byUser.set(r.user_id, u);
    }
    const dayKey = r.day.toISOString().slice(0, 10);
    let d = u.days.find((x) => x.date === dayKey);
    if (!d) {
      d = { date: dayKey, emails: 0, calls: 0, meetings: 0, notes: 0, tasks: 0, total: 0, estimatedMinutes: 0 };
      u.days.push(d);
    }
    const c = Number(r.count);
    const realDuration = Number(r.duration_sum ?? 0);
    const estimated = realDuration > 0 ? realDuration : c * (DURATION_DEFAULTS_MIN[r.type] ?? 5);
    d.total += c;
    d.estimatedMinutes += estimated;
    u.total += c;
    u.estimatedMinutesTotal += estimated;
    if (r.day >= monday) {
      u.totalThisWeek += c;
      u.estimatedMinutesThisWeek += estimated;
    }
    switch (r.type) {
      case 'EMAIL_SENT': d.emails += c; u.breakdown.emailsSent += c; break;
      case 'EMAIL_RECEIVED': d.emails += c; u.breakdown.emailsReceived += c; break;
      case 'CALL': d.calls += c; u.breakdown.calls += c; break;
      case 'WHATSAPP': d.calls += c; u.breakdown.calls += c; break;
      case 'MEETING': d.meetings += c; u.breakdown.meetings += c; break;
      case 'DEMO': d.meetings += c; u.breakdown.demos += c; break;
      case 'INTERNAL_NOTE': d.notes += c; u.breakdown.notes += c; break;
      case 'PROPOSAL_SENT': u.breakdown.proposals += c; break;
      case 'STAGE_CHANGE': u.breakdown.stageChanges += c; break;
      case 'TASK': d.tasks += c; break;
      default: u.breakdown.other += c;
    }
  }

  // Distinct accounts touched
  for (const r of distinctAccountRows) {
    const u = byUser.get(r.user_id);
    if (u) u.uniqueAccountsTouched = Number(r.distinct_count);
  }

  // Top accounts per user
  for (const r of accountRows) {
    const u = byUser.get(r.user_id);
    if (!u) continue;
    u.topAccounts.push({
      accountId: r.account_id,
      accountName: r.account_name,
      count: Number(r.count),
      lastTouchedAt: r.last_touched_at,
    });
  }

  // Tasks completed
  for (const r of tasksRows) {
    const u = byUser.get(r.user_id);
    if (u) {
      u.tasksCompleted = Number(r.count);
      u.breakdown.tasksCompleted = Number(r.count);
    }
  }

  return [...byUser.values()].sort((a, b) => b.totalThisWeek - a.totalThisWeek);
}
