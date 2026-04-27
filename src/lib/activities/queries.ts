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
    attachments: true;
    nextActionAssignee: { select: { id: true; name: true; avatarUrl: true } };
  };
}>;

const INCLUDE = {
  createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
  contact: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
  account: { select: { id: true, name: true } },
  opportunity: { select: { id: true, name: true, code: true } },
  participants: {
    include: {
      contact: { select: { id: true, fullName: true, avatarUrl: true } },
    },
  },
  mentions: {
    include: {
      mentionedUser: { select: { id: true, name: true, avatarUrl: true } },
    },
  },
  attachments: true,
  nextActionAssignee: { select: { id: true, name: true, avatarUrl: true } },
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
    // Activities linked directly to the account OR via its opportunities/contacts
    and.push({
      OR: [
        { accountId: scope.accountId },
        { opportunity: { accountId: scope.accountId } },
        { contact: { accountId: scope.accountId } },
      ],
    });
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
