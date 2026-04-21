import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { Session } from 'next-auth';
import { can } from '@/lib/rbac';
import type { ContactFilters } from './schemas';

export async function listContacts(session: Session, filters: ContactFilters) {
  const where: Prisma.ContactWhereInput = {};
  const and: Prisma.ContactWhereInput[] = [];

  // Scope by ownership if user only has read:own
  if (!can(session, 'contacts:read:all')) {
    if (!can(session, 'contacts:read:own')) {
      return { rows: [], total: 0 };
    }
    and.push({ ownerId: session.user.id });
  }

  if (filters.q) {
    const q = filters.q.trim();
    and.push({
      OR: [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { companyName: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  if (filters.country?.length) and.push({ country: { in: filters.country } });
  if (filters.status?.length) and.push({ status: { in: filters.status } });
  if (filters.source?.length) and.push({ source: { in: filters.source } });
  if (filters.ownerId?.length) and.push({ ownerId: { in: filters.ownerId } });
  if (filters.marketSegment?.length) and.push({ marketSegment: { in: filters.marketSegment } });
  if (filters.productInterest?.length) {
    and.push({ productInterest: { hasSome: filters.productInterest } });
  }
  if (filters.tagIds?.length) {
    and.push({ tags: { some: { tagId: { in: filters.tagIds } } } });
  }
  if (filters.importBatchId) and.push({ importBatchId: filters.importBatchId });
  if (filters.createdFrom) and.push({ createdAt: { gte: new Date(filters.createdFrom) } });
  if (filters.createdTo) and.push({ createdAt: { lte: new Date(filters.createdTo) } });

  if (and.length) where.AND = and;

  const orderBy: Prisma.ContactOrderByWithRelationInput = {
    [filters.sortBy]: filters.sortDir,
  };

  const [rows, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        tags: { include: { tag: true } },
      },
      orderBy,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.contact.count({ where }),
  ]);

  return { rows, total };
}

export async function getContactById(session: Session, id: string) {
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      account: { select: { id: true, name: true } },
      importBatch: { select: { id: true, fileName: true, createdAt: true } },
      tags: { include: { tag: true } },
    },
  });
  if (!contact) return null;

  if (!can(session, 'contacts:read:all')) {
    if (!can(session, 'contacts:read:own')) return null;
    if (contact.ownerId !== session.user.id) return null;
  }

  return contact;
}

export async function listTags() {
  return prisma.tag.findMany({ orderBy: { name: 'asc' } });
}

export async function listUsers() {
  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, avatarUrl: true },
    orderBy: { name: 'asc' },
  });
}

export async function listCountries() {
  const rows = await prisma.contact.groupBy({
    by: ['country'],
    where: { country: { not: null } },
    _count: true,
    orderBy: { country: 'asc' },
  });
  return rows
    .map((r) => r.country)
    .filter((c): c is string => !!c);
}

export async function getContactAuditLog(contactId: string) {
  return prisma.auditLog.findMany({
    where: { resource: 'contacts', resourceId: contactId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
