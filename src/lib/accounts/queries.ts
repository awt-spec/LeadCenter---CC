import type { Prisma } from '@prisma/client';
import type { Session } from 'next-auth';
import { prisma } from '@/lib/db';
import { can } from '@/lib/rbac';
import type { AccountFilters } from './schemas';

export async function listAccounts(session: Session, filters: AccountFilters) {
  const where: Prisma.AccountWhereInput = {};
  const and: Prisma.AccountWhereInput[] = [];

  if (!can(session, 'accounts:read:all')) {
    if (!can(session, 'accounts:read:own')) return { rows: [], total: 0 };
    and.push({
      OR: [
        { ownerId: session.user.id },
        { opportunities: { some: { ownerId: session.user.id } } },
      ],
    });
  }

  if (filters.q) {
    const q = filters.q.trim();
    and.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { domain: { contains: q, mode: 'insensitive' } },
        { legalName: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  if (filters.country?.length) and.push({ country: { in: filters.country } });
  if (filters.segment?.length) and.push({ segment: { in: filters.segment } });
  if (filters.status?.length) and.push({ status: { in: filters.status } });
  if (filters.size?.length) and.push({ size: { in: filters.size } });
  if (filters.ownerId?.length) and.push({ ownerId: { in: filters.ownerId } });
  if (filters.hasActiveOpps) {
    and.push({ opportunities: { some: { status: 'OPEN' } } });
  }

  if (and.length) where.AND = and;

  const orderBy: Prisma.AccountOrderByWithRelationInput = {
    [filters.sortBy]: filters.sortDir,
  };

  const [rows, total] = await Promise.all([
    prisma.account.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { contacts: true, opportunities: true } },
        opportunities: {
          where: { status: 'OPEN' },
          select: { estimatedValue: true },
        },
      },
      orderBy,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.account.count({ where }),
  ]);

  return { rows, total };
}

export async function getAccountById(session: Session, id: string) {
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      createdBy: { select: { id: true, name: true } },
      parentAccount: { select: { id: true, name: true } },
      childAccounts: { select: { id: true, name: true, status: true } },
      contacts: {
        include: {
          owner: { select: { id: true, name: true, avatarUrl: true } },
          tags: { include: { tag: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      opportunities: {
        include: {
          owner: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { contacts: true, opportunities: true } },
    },
  });
  if (!account) return null;

  if (!can(session, 'accounts:read:all')) {
    if (!can(session, 'accounts:read:own')) return null;
    const isOwner = account.ownerId === session.user.id;
    const hasOpp = account.opportunities.some((o) => o.ownerId === session.user.id);
    if (!isOwner && !hasOpp) return null;
  }

  return account;
}

export async function getAccountStats(session: Session) {
  const baseWhere: Prisma.AccountWhereInput = can(session, 'accounts:read:all')
    ? {}
    : {
        OR: [
          { ownerId: session.user.id },
          { opportunities: { some: { ownerId: session.user.id } } },
        ],
      };

  const [total, prospects, customers, pipelineOpps] = await Promise.all([
    prisma.account.count({ where: baseWhere }),
    prisma.account.count({ where: { ...baseWhere, status: 'PROSPECT' } }),
    prisma.account.count({ where: { ...baseWhere, status: 'CUSTOMER' } }),
    prisma.opportunity.findMany({
      where: { status: 'OPEN', account: baseWhere },
      select: { estimatedValue: true },
    }),
  ]);

  const pipelineTotal = pipelineOpps.reduce((acc, o) => {
    return acc + Number(o.estimatedValue ?? 0);
  }, 0);

  return { total, prospects, customers, pipelineTotal };
}
