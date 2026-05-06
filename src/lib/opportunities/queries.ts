import type { Prisma } from '@prisma/client';
import type { Session } from 'next-auth';
import { prisma } from '@/lib/db';
import { can } from '@/lib/rbac';
import type { OpportunityFilters } from './schemas';
import { STAGE_PROBABILITY } from './stage-rules';

export async function listOpportunities(session: Session, filters: OpportunityFilters) {
  const where: Prisma.OpportunityWhereInput = {};
  const and: Prisma.OpportunityWhereInput[] = [];

  if (!can(session, 'opportunities:read:all') || filters.onlyMine) {
    if (!can(session, 'opportunities:read:own') && !can(session, 'opportunities:read:all')) {
      return { rows: [], total: 0 };
    }
    and.push({ ownerId: session.user.id });
  }

  if (filters.q) {
    const q = filters.q.trim();
    and.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { account: { name: { contains: q, mode: 'insensitive' } } },
      ],
    });
  }
  if (filters.stage?.length) and.push({ stage: { in: filters.stage } });
  if (filters.status?.length) and.push({ status: { in: filters.status } });
  if (filters.product?.length) and.push({ product: { in: filters.product } });
  if (filters.subProduct?.length) and.push({ subProduct: { in: filters.subProduct } });
  if (filters.rating?.length) and.push({ rating: { in: filters.rating } });
  if (filters.ownerId?.length) and.push({ ownerId: { in: filters.ownerId } });
  if (filters.country?.length)
    and.push({ account: { country: { in: filters.country } } });
  if (filters.minValue) and.push({ estimatedValue: { gte: filters.minValue } });
  if (filters.maxValue) and.push({ estimatedValue: { lte: filters.maxValue } });
  if (filters.closeFrom)
    and.push({ expectedCloseDate: { gte: new Date(filters.closeFrom) } });
  if (filters.closeTo)
    and.push({ expectedCloseDate: { lte: new Date(filters.closeTo) } });

  if (and.length) where.AND = and;

  const orderBy: Prisma.OpportunityOrderByWithRelationInput = {
    [filters.sortBy]: filters.sortDir,
  };

  const [rows, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: {
        account: { select: { id: true, name: true, country: true } },
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.opportunity.count({ where }),
  ]);

  return { rows, total };
}

export async function getOpportunityStats(session: Session) {
  const baseWhere: Prisma.OpportunityWhereInput = can(session, 'opportunities:read:all')
    ? {}
    : { ownerId: session.user.id };

  const [openOpps, closedOpps] = await Promise.all([
    prisma.opportunity.findMany({
      where: { ...baseWhere, status: 'OPEN' },
      select: { estimatedValue: true, stage: true },
    }),
    prisma.opportunity.findMany({
      where: {
        ...baseWhere,
        status: { in: ['WON', 'LOST'] },
        closedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      select: { status: true },
    }),
  ]);

  const pipelineTotal = openOpps.reduce((acc, o) => acc + Number(o.estimatedValue ?? 0), 0);
  const forecast = openOpps.reduce((acc, o) => {
    const prob = STAGE_PROBABILITY[o.stage];
    return acc + Number(o.estimatedValue ?? 0) * (prob / 100);
  }, 0);

  const won = closedOpps.filter((o) => o.status === 'WON').length;
  const total = closedOpps.length;
  const winRate = total > 0 ? (won / total) * 100 : 0;

  return {
    openCount: openOpps.length,
    pipelineTotal,
    forecast,
    winRate,
  };
}

export async function getOpportunityById(session: Session, id: string) {
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    // OPT-011: relationJoins. contactRoles + stageHistory + checkpoints
    // (con sus nested includes) en un solo SQL en lugar de 4 queries.
    relationLoadStrategy: 'join',
    include: {
      account: {
        select: { id: true, name: true, country: true, segment: true },
      },
      owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      createdBy: { select: { id: true, name: true } },
      contactRoles: {
        include: {
          contact: {
            select: {
              id: true,
              fullName: true,
              email: true,
              jobTitle: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: [{ isPrimary: 'desc' }, { addedAt: 'asc' }],
        take: 50,  // OPT-003: cap. Si una opp tiene >50 contactos, paginar.
      },
      stageHistory: {
        include: {
          changedBy: { select: { id: true, name: true } },
        },
        orderBy: { changedAt: 'desc' },
        take: 50,  // OPT-003: cap. La UI muestra los últimos cambios.
      },
      checkpoints: {
        include: {
          assignee: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          completedBy: { select: { id: true, name: true } },
        },
        // Pendings first, then completed; within each by dueDate asc.
        orderBy: [{ completedAt: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 100,  // OPT-003: cap.
      },
    },
  });
  if (!opp) return null;

  if (!can(session, 'opportunities:read:all')) {
    if (!can(session, 'opportunities:read:own')) return null;
    if (opp.ownerId !== session.user.id) return null;
  }

  return opp;
}

export async function getOpportunityAuditLog(opportunityId: string) {
  return prisma.auditLog.findMany({
    where: { resource: 'opportunities', resourceId: opportunityId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function searchAccounts(q: string, limit = 10) {
  if (!q.trim()) {
    return prisma.account.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: { id: true, name: true, country: true, segment: true },
    });
  }
  return prisma.account.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { domain: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: limit,
    select: { id: true, name: true, country: true, segment: true },
  });
}

export async function searchContactsForOpp(q: string, limit = 10) {
  if (!q.trim()) {
    return prisma.contact.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: { id: true, fullName: true, email: true, jobTitle: true, companyName: true },
    });
  }
  return prisma.contact.findMany({
    where: {
      OR: [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: limit,
    select: { id: true, fullName: true, email: true, jobTitle: true, companyName: true },
  });
}
