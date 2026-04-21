import type { OpportunityStage, Prisma } from '@prisma/client';
import type { Session } from 'next-auth';
import { prisma } from '@/lib/db';
import { can } from '@/lib/rbac';
import { STAGE_PROBABILITY } from '@/lib/opportunities/stage-rules';

export type PipelineFilters = {
  q?: string;
  product?: string[];
  ownerId?: string[];
  rating?: string[];
  country?: string[];
  segment?: string[];
  commercialModel?: string[];
  minValue?: number;
  maxValue?: number;
  closeFrom?: string;
  closeTo?: string;
  createdFrom?: string;
  createdTo?: string;
  onlyMine?: boolean;
  overdueNextAction?: boolean;
  stale7d?: boolean;
  includeWon?: boolean;
  includeLost?: boolean;
  includeStandBy?: boolean;
  includeNurture?: boolean;
};

export type PipelineOpportunityCard = {
  id: string;
  code: string | null;
  name: string;
  stage: OpportunityStage;
  status: string;
  product: string;
  rating: string;
  estimatedValue: number | null;
  currency: string;
  probability: number;
  expectedCloseDate: Date | null;
  nextActionDate: Date | null;
  nextActionNote: string | null;
  stageChangedAt: Date;
  updatedAt: Date;
  lastActivityAt: Date | null;
  account: { id: string; name: string };
  owner: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  primaryContact: {
    id: string;
    fullName: string;
    role: string;
    avatarUrl: string | null;
  } | null;
  description: string | null;
  portfolioAmount: number | null;
  userCount: number | null;
  annualOperations: number | null;
  clientCount: number | null;
};

function buildPipelineWhere(session: Session, filters: PipelineFilters): Prisma.OpportunityWhereInput {
  const and: Prisma.OpportunityWhereInput[] = [];
  const where: Prisma.OpportunityWhereInput = {};

  // Scope by ownership
  if (!can(session, 'opportunities:read:all') || filters.onlyMine) {
    if (!can(session, 'opportunities:read:own') && !can(session, 'opportunities:read:all')) {
      return { id: 'never' };
    }
    and.push({ ownerId: session.user.id });
  }

  // Default to OPEN only; include closed stages per filter flags
  const includedStatuses: Prisma.OpportunityStatus[] = ['OPEN'];
  if (filters.includeWon) includedStatuses.push('WON');
  if (filters.includeLost) includedStatuses.push('LOST');
  if (filters.includeStandBy) includedStatuses.push('STAND_BY');
  if (filters.includeNurture) includedStatuses.push('NURTURE');
  and.push({ status: { in: includedStatuses } });

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
  if (filters.product?.length)
    and.push({ product: { in: filters.product as Prisma.OpportunityWhereInput['product'] as never } });
  if (filters.ownerId?.length) and.push({ ownerId: { in: filters.ownerId } });
  if (filters.rating?.length)
    and.push({ rating: { in: filters.rating as never } });
  if (filters.country?.length)
    and.push({ account: { country: { in: filters.country } } });
  if (filters.segment?.length)
    and.push({ account: { segment: { in: filters.segment as never } } });
  if (filters.commercialModel?.length)
    and.push({ commercialModel: { in: filters.commercialModel as never } });
  if (filters.minValue !== undefined) and.push({ estimatedValue: { gte: filters.minValue } });
  if (filters.maxValue !== undefined) and.push({ estimatedValue: { lte: filters.maxValue } });
  if (filters.closeFrom) and.push({ expectedCloseDate: { gte: new Date(filters.closeFrom) } });
  if (filters.closeTo) and.push({ expectedCloseDate: { lte: new Date(filters.closeTo) } });
  if (filters.createdFrom) and.push({ createdAt: { gte: new Date(filters.createdFrom) } });
  if (filters.createdTo) and.push({ createdAt: { lte: new Date(filters.createdTo) } });
  if (filters.overdueNextAction) {
    and.push({ nextActionDate: { lt: new Date() } });
  }
  if (filters.stale7d) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    and.push({
      OR: [
        { lastActivityAt: null, updatedAt: { lt: sevenDaysAgo } },
        { lastActivityAt: { lt: sevenDaysAgo } },
      ],
    });
  }

  if (and.length) where.AND = and;
  return where;
}

export async function loadPipeline(session: Session, filters: PipelineFilters) {
  const where = buildPipelineWhere(session, filters);

  const rows = await prisma.opportunity.findMany({
    where,
    orderBy: [{ stageChangedAt: 'desc' }],
    include: {
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      contactRoles: {
        where: { isPrimary: true },
        take: 1,
        include: {
          contact: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
        },
      },
    },
  });

  const cards: PipelineOpportunityCard[] = rows.map((o) => ({
    id: o.id,
    code: o.code,
    name: o.name,
    stage: o.stage,
    status: o.status,
    product: o.product,
    rating: o.rating,
    estimatedValue: o.estimatedValue ? Number(o.estimatedValue) : null,
    currency: o.currency,
    probability: o.probability,
    expectedCloseDate: o.expectedCloseDate,
    nextActionDate: o.nextActionDate,
    nextActionNote: o.nextActionNote,
    stageChangedAt: o.stageChangedAt,
    updatedAt: o.updatedAt,
    lastActivityAt: o.lastActivityAt,
    account: o.account,
    owner: o.owner,
    primaryContact: o.contactRoles[0]
      ? {
          id: o.contactRoles[0].contact.id,
          fullName: o.contactRoles[0].contact.fullName,
          role: o.contactRoles[0].role,
          avatarUrl: o.contactRoles[0].contact.avatarUrl,
        }
      : null,
    description: o.description,
    portfolioAmount: o.portfolioAmount ? Number(o.portfolioAmount) : null,
    userCount: o.userCount,
    annualOperations: o.annualOperations,
    clientCount: o.clientCount,
  }));

  return cards;
}

export function groupByStage(cards: PipelineOpportunityCard[]) {
  const grouped = new Map<OpportunityStage, PipelineOpportunityCard[]>();
  for (const c of cards) {
    const arr = grouped.get(c.stage);
    if (arr) arr.push(c);
    else grouped.set(c.stage, [c]);
  }
  return grouped;
}

export function computeColumnStats(cards: PipelineOpportunityCard[]) {
  const total = cards.reduce((acc, c) => acc + (c.estimatedValue ?? 0), 0);
  const weighted = cards.reduce((acc, c) => {
    const prob = STAGE_PROBABILITY[c.stage];
    return acc + (c.estimatedValue ?? 0) * (prob / 100);
  }, 0);
  return { count: cards.length, total, weighted };
}
