import type { Prisma } from '@prisma/client';
import type { Session } from 'next-auth';
import { prisma } from '@/lib/db';
import { can } from '@/lib/rbac';
import type { ActivityFilters } from './schemas';

export type ActivityWithRelations = Prisma.ActivityGetPayload<{
  include: {
    createdBy: { select: { id: true; name: true; email: true; avatarUrl: true } };
    contact: { select: { id: true; fullName: true; email: true; avatarUrl: true } };
    account: { select: { id: true; name: true } };
    opportunity: { select: { id: true; name: true; code: true } };
    participants: {
      include: {
        contact: { select: { id: true; fullName: true; avatarUrl: true } };
      };
    };
    mentions: {
      include: {
        mentionedUser: { select: { id: true; name: true; avatarUrl: true } };
      };
    };
    attachments: {
      select: { id: true; fileName: true; fileUrl: true; fileSize: true; mimeType: true };
    };
    nextActionAssignee: { select: { id: true; name: true; avatarUrl: true } };
    assignees: {
      include: {
        user: { select: { id: true; name: true; email: true; avatarUrl: true } };
      };
    };
  };
}>;

const INCLUDE = {
  createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
  contact: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
  account: { select: { id: true, name: true } },
  opportunity: { select: { id: true, name: true, code: true } },
  // Cap nested relations — la card sólo muestra los primeros 5 anyway,
  // y la mayoría de actividades importadas (Asana) tienen 0 acá. Evita
  // cargar arrays gigantes para activities populares.
  participants: {
    include: {
      contact: { select: { id: true, fullName: true, avatarUrl: true } },
    },
    take: 8,
  },
  mentions: {
    include: {
      mentionedUser: { select: { id: true, name: true, avatarUrl: true } },
    },
    take: 5,
  },
  attachments: {
    select: { id: true, fileName: true, fileUrl: true, fileSize: true, mimeType: true },
    take: 8,
  },
  nextActionAssignee: { select: { id: true, name: true, avatarUrl: true } },
  assignees: {
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    take: 5,
  },
} satisfies Prisma.ActivityInclude;

export type ActivityScope = {
  contactId?: string;
  accountId?: string;
  opportunityId?: string;
  global?: boolean;
};

function buildWhere(
  session: Session,
  scope: ActivityScope,
  filters: ActivityFilters
): Prisma.ActivityWhereInput {
  const and: Prisma.ActivityWhereInput[] = [];

  if (scope.contactId) {
    and.push({ contactId: scope.contactId });
  }
  if (scope.opportunityId) {
    and.push({ opportunityId: scope.opportunityId });
  }
  if (scope.accountId) {
    // OPT-005: usamos accountId DIRECTO (el composite walks index ordenado).
    // El OR previo (accountId OR opp.accountId OR contact.accountId) tomaba
    // 1.5-19s en cuentas calientes porque Postgres no podía elegir un único
    // índice. Backfilleamos accountId en activities con contactId-only
    // (ver migration 20260505190000_backfill_activity_account); las
    // activities con contact sin account son orphans que no aparecen en
    // ninguna cuenta. Las nuevas activities setean accountId desde el
    // composer cuando linkean contact/opp.
    and.push({ accountId: scope.accountId });
  }

  // For SDR / functional_consultant scoping: limit to activities they created or linked to
  // entities they can see. Basic approach: if user has no read:all permissions at all, only
  // show activities they created or are mentioned in.
  const hasGlobal =
    can(session, 'contacts:read:all') ||
    can(session, 'opportunities:read:all') ||
    can(session, 'accounts:read:all');
  if (!hasGlobal) {
    and.push({
      OR: [
        { createdById: session.user.id },
        { mentions: { some: { mentionedUserId: session.user.id } } },
        { nextActionAssigneeId: session.user.id },
        { contact: { ownerId: session.user.id } },
        { opportunity: { ownerId: session.user.id } },
      ],
    });
  }

  if (filters.q) {
    const q = filters.q.trim();
    and.push({
      OR: [
        { subject: { contains: q, mode: 'insensitive' } },
        { bodyText: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  if (filters.type?.length) and.push({ type: { in: filters.type } });
  if (filters.tags?.length) and.push({ tags: { hasSome: filters.tags } });
  if (filters.createdById?.length) and.push({ createdById: { in: filters.createdById } });
  if (filters.contactId) and.push({ contactId: filters.contactId });
  if (filters.accountId) and.push({ accountId: filters.accountId });
  if (filters.opportunityId) and.push({ opportunityId: filters.opportunityId });
  if (filters.dateFrom) and.push({ occurredAt: { gte: new Date(filters.dateFrom) } });
  if (filters.dateTo) and.push({ occurredAt: { lte: new Date(filters.dateTo) } });
  if (filters.pendingNextAction) {
    and.push({
      nextActionDate: { not: null },
      nextActionCompleted: false,
    });
  }
  if (filters.onlyMyMentions) {
    and.push({ mentions: { some: { mentionedUserId: session.user.id } } });
  }
  if (!filters.includeSystem) {
    and.push({ isSystemGenerated: false });
  }

  return and.length ? { AND: and } : {};
}

export async function listActivities(
  session: Session,
  scope: ActivityScope,
  filters: ActivityFilters
) {
  const where = buildWhere(session, scope, filters);

  const [rows, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      include: INCLUDE,
      // OPT-011: con relationJoins habilitado, Prisma materializa los
      // 9 includes en una sola query SQL con LATERAL JOINs en lugar de
      // 1 + N queries separadas. Reduce 25 activities × ~10 includes =
      // 250 round-trips → 1.
      relationLoadStrategy: 'join',
      orderBy: { occurredAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.activity.count({ where }),
  ]);

  return { rows, total };
}

export async function getActivityById(id: string) {
  return prisma.activity.findUnique({ where: { id }, include: INCLUDE });
}

export async function getLatestPendingNextAction(opportunityId: string) {
  return prisma.activity.findFirst({
    where: {
      opportunityId,
      nextActionCompleted: false,
      nextActionDate: { not: null },
    },
    orderBy: { nextActionDate: 'asc' },
    include: {
      nextActionAssignee: { select: { id: true, name: true, avatarUrl: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

export async function getGlobalActivityStats(session: Session) {
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [thisWeek, pendingNextActions, unreadMentions, overdueActions] = await Promise.all([
    prisma.activity.count({
      where: { occurredAt: { gte: weekStart }, isSystemGenerated: false },
    }),
    prisma.activity.count({
      where: {
        nextActionCompleted: false,
        nextActionDate: { not: null },
      },
    }),
    prisma.activityMention.count({
      where: { mentionedUserId: session.user.id, readAt: null },
    }),
    prisma.activity.count({
      where: {
        nextActionCompleted: false,
        nextActionDate: { lt: now },
      },
    }),
  ]);

  return { thisWeek, pendingNextActions, unreadMentions, overdueActions };
}

export async function getInboxMentions(session: Session, onlyUnread = false) {
  return prisma.activityMention.findMany({
    where: {
      mentionedUserId: session.user.id,
      ...(onlyUnread && { readAt: null }),
    },
    include: {
      activity: { include: INCLUDE },
    },
    orderBy: { activity: { createdAt: 'desc' } },
    take: 50,
  });
}

export async function getAssignedNextActions(session: Session) {
  return prisma.activity.findMany({
    where: {
      nextActionAssigneeId: session.user.id,
      nextActionCompleted: false,
    },
    include: INCLUDE,
    orderBy: { nextActionDate: 'asc' },
  });
}

export async function getMyCreatedActivities(session: Session) {
  return prisma.activity.findMany({
    where: { createdById: session.user.id },
    include: INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

/// Emails recibidos (EMAIL_RECEIVED) en los últimos 30 días para los que NO hay
/// un EMAIL_SENT posterior al mismo contacto. Heurística simple para "necesita
/// respuesta". Limita a las cuentas/contactos donde el usuario es owner.
export async function getEmailsNeedingReply(session: Session, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const received = await prisma.activity.findMany({
    where: {
      type: 'EMAIL_RECEIVED',
      occurredAt: { gte: since },
      OR: [
        { contact: { ownerId: session.user.id } },
        { account: { ownerId: session.user.id } },
        { opportunity: { ownerId: session.user.id } },
      ],
    },
    include: INCLUDE,
    orderBy: { occurredAt: 'desc' },
    take: 50,
  });
  // For each received email, check if there's a SENT after it for same contact.
  const results: typeof received = [];
  for (const r of received) {
    if (!r.contactId) {
      results.push(r);
      continue;
    }
    const replied = await prisma.activity.findFirst({
      where: {
        type: 'EMAIL_SENT',
        contactId: r.contactId,
        occurredAt: { gt: r.occurredAt },
      },
      select: { id: true },
    });
    if (!replied) results.push(r);
  }
  return results;
}

/// Cuentas del usuario sin actividad reciente. Útil para detectar cuentas
/// "frías" que necesitan re-warm.
export async function getColdAccounts(session: Session, daysThreshold = 14) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysThreshold);
  const accts = await prisma.account.findMany({
    where: {
      ownerId: session.user.id,
      status: { in: ['PROSPECT', 'ACTIVE'] },
      activities: {
        none: { occurredAt: { gte: cutoff } },
      },
    },
    select: {
      id: true, name: true, domain: true, status: true, priority: true,
      country: true, segment: true, updatedAt: true,
      _count: { select: { contacts: true, opportunities: true, activities: true } },
    },
    orderBy: { updatedAt: 'asc' },
    take: 30,
  });
  return accts;
}

/// Tasks asignadas al usuario que están vencidas (dueDate < now) y no DONE/CANCELLED.
export async function getOverdueTasks(session: Session) {
  return prisma.task.findMany({
    where: {
      dueDate: { lt: new Date() },
      status: { notIn: ['DONE', 'CANCELLED'] },
      assignees: { some: { userId: session.user.id } },
    },
    select: {
      id: true, title: true, status: true, priority: true, dueDate: true, color: true,
      account: { select: { id: true, name: true } },
      _count: { select: { subtasks: true } },
    },
    orderBy: { dueDate: 'asc' },
    take: 30,
  });
}

/// Hero stats: counts that go into the Inbox header pill.
export async function getInboxHeroStats(session: Session) {
  const [unreadMentions, overdueActivities, overdueTasks, coldAccounts, emailsToReply] = await Promise.all([
    prisma.activityMention.count({
      where: { mentionedUserId: session.user.id, readAt: null },
    }),
    prisma.activity.count({
      where: {
        nextActionAssigneeId: session.user.id,
        nextActionCompleted: false,
        nextActionDate: { lt: new Date() },
      },
    }),
    prisma.task.count({
      where: {
        dueDate: { lt: new Date() },
        status: { notIn: ['DONE', 'CANCELLED'] },
        assignees: { some: { userId: session.user.id } },
      },
    }),
    prisma.account.count({
      where: {
        ownerId: session.user.id,
        status: { in: ['PROSPECT', 'ACTIVE'] },
        activities: {
          none: { occurredAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
        },
      },
    }),
    // Approximate count of emails received in last 30d on records the user owns.
    prisma.activity.count({
      where: {
        type: 'EMAIL_RECEIVED',
        occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        OR: [
          { contact: { ownerId: session.user.id } },
          { account: { ownerId: session.user.id } },
          { opportunity: { ownerId: session.user.id } },
        ],
      },
    }),
  ]);
  return { unreadMentions, overdueActivities, overdueTasks, coldAccounts, emailsToReply };
}
