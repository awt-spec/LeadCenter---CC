import 'server-only';
import type { Prisma } from '@prisma/client';
import type { Session } from 'next-auth';
import { prisma } from '@/lib/db';
import { can } from '@/lib/rbac';
import type { CampaignFilters } from './schemas';

export async function listCampaigns(session: Session, filters: CampaignFilters) {
  const and: Prisma.CampaignWhereInput[] = [];
  const where: Prisma.CampaignWhereInput = {};

  if (!can(session, 'reports:read:all') && !can(session, 'opportunities:read:all')) {
    and.push({ ownerId: session.user.id });
  }

  if (filters.q) {
    and.push({
      OR: [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { code: { contains: filters.q, mode: 'insensitive' } },
      ],
    });
  }
  if (filters.status?.length) and.push({ status: { in: filters.status } });
  if (filters.type?.length) and.push({ type: { in: filters.type } });
  if (filters.ownerId?.length) and.push({ ownerId: { in: filters.ownerId } });

  if (and.length) where.AND = and;

  const [rows, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        status: true,
        goal: true,
        startDate: true,
        endDate: true,
        budget: true,
        spent: true,
        currency: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { contacts: true, opportunities: true, steps: true } },
        opportunities: {
          where: { status: 'OPEN' },
          select: { estimatedValue: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.campaign.count({ where }),
  ]);

  return { rows, total };
}

export async function getCampaignById(session: Session, id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      createdBy: { select: { id: true, name: true } },
      steps: { orderBy: { order: 'asc' } },
      opportunities: {
        select: {
          id: true,
          name: true,
          stage: true,
          status: true,
          estimatedValue: true,
          currency: true,
          account: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      contacts: {
        include: {
          contact: {
            select: { id: true, fullName: true, email: true, status: true, avatarUrl: true },
          },
        },
        orderBy: { enrolledAt: 'desc' },
        take: 100,
      },
      _count: { select: { contacts: true, opportunities: true, steps: true } },
    },
  });
  if (!campaign) return null;

  if (
    !can(session, 'reports:read:all') &&
    !can(session, 'opportunities:read:all') &&
    campaign.ownerId !== session.user.id
  ) {
    return null;
  }
  return campaign;
}

export async function getCampaignStats(session: Session) {
  const where: Prisma.CampaignWhereInput =
    can(session, 'reports:read:all') || can(session, 'opportunities:read:all')
      ? {}
      : { ownerId: session.user.id };

  const [total, active, completed, oppCount] = await Promise.all([
    prisma.campaign.count({ where }),
    prisma.campaign.count({ where: { ...where, status: 'ACTIVE' } }),
    prisma.campaign.count({ where: { ...where, status: 'COMPLETED' } }),
    prisma.opportunity.count({
      where: { campaignId: { not: null } },
    }),
  ]);

  return { total, active, completed, oppCount };
}
