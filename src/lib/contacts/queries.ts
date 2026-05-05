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
    if (q.length > 0) {
      // Use Postgres full-text search (GIN index) for sub-millisecond
      // lookups at scale. Falls back to ILIKE if FTS returns nothing.
      const matchedIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Contact"
        WHERE search_vector @@ plainto_tsquery('spanish', ${q})
        LIMIT 5000
      `;
      if (matchedIds.length > 0) {
        and.push({ id: { in: matchedIds.map((r) => r.id) } });
      } else {
        // Fallback for partial / typo matches
        and.push({
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { companyName: { contains: q, mode: 'insensitive' } },
          ],
        });
      }
    }
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
        // La tabla muestra 3 tags + "+N más"; capping the include evita
        // fetch de payloads grandes para contactos con 10+ tags.
        tags: { include: { tag: true }, take: 5 },
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

/// Vista de la base de datos agrupada por cuenta. Trae los accounts top
/// (por cantidad de contactos en scope), cada uno con sus contactos
/// dentro. Pensada para que el equipo pueda ver "qué tenemos en BCP" de
/// un vistazo en lugar de paginar 30k contactos planos.
export async function listContactsByAccount(
  session: Session,
  filters: ContactFilters
): Promise<{
  groups: Array<{
    accountId: string;
    accountName: string;
    accountCountry: string | null;
    accountSegment: string | null;
    totalContacts: number;
    contacts: Array<{
      id: string;
      fullName: string;
      email: string;
      jobTitle: string | null;
      seniorityLevel: string | null;
      status: string;
      country: string | null;
      engagementScore: number;
    }>;
  }>;
  unassignedTotal: number;
  totalAccounts: number;
}> {
  const where: Prisma.ContactWhereInput = {};
  const and: Prisma.ContactWhereInput[] = [];

  if (!can(session, 'contacts:read:all')) {
    if (!can(session, 'contacts:read:own')) return { groups: [], unassignedTotal: 0, totalAccounts: 0 };
    and.push({ ownerId: session.user.id });
  }
  if (filters.country?.length) and.push({ country: { in: filters.country } });
  if (filters.status?.length) and.push({ status: { in: filters.status } });
  if (filters.ownerId?.length) and.push({ ownerId: { in: filters.ownerId } });
  if (filters.marketSegment?.length) and.push({ marketSegment: { in: filters.marketSegment } });
  if (and.length) where.AND = and;

  // Step 1: top accounts by contact count within filters.
  const groupBy = await prisma.contact.groupBy({
    by: ['accountId'],
    where,
    _count: true,
    orderBy: { _count: { id: 'desc' } },
    take: 50,
  });

  const accountIds = groupBy.filter((g) => g.accountId).map((g) => g.accountId!);
  const unassignedTotal = groupBy.find((g) => !g.accountId)?._count ?? 0;

  // Step 2: account metadata
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, name: true, country: true, segment: true },
  });
  const accountById = new Map(accounts.map((a) => [a.id, a] as const));

  // Step 3: contacts for those accounts (cap each at 25, if more we link to
  // the regular listing with filter prefilled)
  const contacts = await prisma.contact.findMany({
    where: { ...where, accountId: { in: accountIds } },
    select: {
      id: true, fullName: true, email: true, jobTitle: true,
      seniorityLevel: true, status: true, country: true,
      engagementScore: true, accountId: true,
    },
    orderBy: [{ engagementScore: 'desc' }, { fullName: 'asc' }],
  });

  const contactsByAccount = new Map<string, typeof contacts>();
  for (const c of contacts) {
    if (!c.accountId) continue;
    let arr = contactsByAccount.get(c.accountId);
    if (!arr) { arr = []; contactsByAccount.set(c.accountId, arr); }
    arr.push(c);
  }

  const groups = groupBy
    .filter((g) => g.accountId && accountById.has(g.accountId))
    .map((g) => {
      const acc = accountById.get(g.accountId!)!;
      const cs = (contactsByAccount.get(g.accountId!) ?? []).slice(0, 25);
      return {
        accountId: acc.id,
        accountName: acc.name,
        accountCountry: acc.country,
        accountSegment: acc.segment,
        totalContacts: g._count,
        contacts: cs.map((c) => ({
          id: c.id,
          fullName: c.fullName,
          email: c.email,
          jobTitle: c.jobTitle,
          seniorityLevel: c.seniorityLevel,
          status: c.status,
          country: c.country,
          engagementScore: c.engagementScore,
        })),
      };
    });

  return { groups, unassignedTotal, totalAccounts: groupBy.length };
}

export async function getContactAuditLog(contactId: string) {
  return prisma.auditLog.findMany({
    where: { resource: 'contacts', resourceId: contactId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
