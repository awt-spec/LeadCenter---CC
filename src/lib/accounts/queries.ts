import type { Prisma } from '@prisma/client';
import type { Session } from 'next-auth';
import { unstable_cache } from 'next/cache';
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

  const [rawRows, total] = await Promise.all([
    prisma.account.findMany({
      where,
      select: {
        id: true,
        name: true,
        domain: true,
        needsDomainReview: true,
        country: true,
        segment: true,
        size: true,
        status: true,
        priority: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { contacts: true, opportunities: true } },
      },
      orderBy,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.account.count({ where }),
  ]);

  // Pipeline total por cuenta — single GROUP BY contra Opportunity en
  // lugar de un subquery por cada row. Con 50 cuentas × N opps cada una
  // pasamos de 50 round-trips a 1.
  const accountIds = rawRows.map((r) => r.id);
  const pipelineSums =
    accountIds.length === 0
      ? []
      : await prisma.opportunity.groupBy({
          by: ['accountId'],
          where: { accountId: { in: accountIds }, status: 'OPEN' },
          _sum: { estimatedValue: true },
        });
  const pipelineByAccount = new Map(
    pipelineSums.map((p) => [p.accountId, Number(p._sum.estimatedValue ?? 0)])
  );

  // Re-emit rows in the shape the page expects (with `opportunities[]`)
  // so we don't have to refactor the consumer.
  const rows = rawRows.map((r) => ({
    ...r,
    opportunities: pipelineByAccount.has(r.id)
      ? [{ estimatedValue: pipelineByAccount.get(r.id)! }]
      : [],
  }));

  return { rows, total };
}

// Minimal lookup for the page header — paints instantly while the
// heavy queries below stream in via Suspense.
export const getAccountMinimal = unstable_cache(
  async (id: string) =>
    prisma.account.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        legalName: true,
        domain: true,
        needsDomainReview: true,
        website: true,
        status: true,
        priority: true,
        country: true,
        city: true,
        segment: true,
        size: true,
        ownerId: true,
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        parentAccount: { select: { id: true, name: true } },
        _count: { select: { contacts: true, opportunities: true } },
      },
    }),
  ['account-minimal'],
  { revalidate: 60, tags: ['accounts'] }
);

// Raw lookup cached per-id. Session-dependent RBAC check stays out of
// the cache key (applied at the call site below).
//
// Performance: limits + selective fields. Tabs that need MORE data
// (full activity timeline, all tasks, etc.) fetch their own data
// async via Suspense — no need to pre-load everything here.
const getAccountByIdRaw = unstable_cache(
  async (id: string) => {
    return prisma.account.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        createdBy: { select: { id: true, name: true } },
        parentAccount: { select: { id: true, name: true } },
        childAccounts: { select: { id: true, name: true, status: true } },
        contacts: {
          // Only fetch what the contacts table preview shows. Tags are
          // visible only on the contacts detail, not on this preview.
          select: {
            id: true, fullName: true, email: true, jobTitle: true, avatarUrl: true,
            seniorityLevel: true, status: true, createdAt: true,
            owner: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        opportunities: {
          select: {
            id: true, name: true, code: true, stage: true, status: true,
            estimatedValue: true, currency: true, expectedCloseDate: true,
            product: true, ownerId: true,
            owner: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
          take: 30,
        },
        _count: { select: { contacts: true, opportunities: true } },
      },
    });
  },
  ['account-detail'],
  { revalidate: 120, tags: ['accounts'] }
);

export async function getAccountById(session: Session, id: string) {
  const account = await getAccountByIdRaw(id);
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
