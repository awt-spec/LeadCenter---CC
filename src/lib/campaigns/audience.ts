// Audience builder — query helpers for the Campaign "Audiencia" tab.
// Lets the user filter Accounts and Contacts via shared criteria, preview
// matches, then bulk-enroll the resulting contacts.

import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export interface AudienceFilter {
  /// Account-level filters
  accountStatus?: string[];   // e.g. ['CUSTOMER', 'PROSPECT']
  accountSegment?: string[];
  accountCountry?: string[];
  accountOwnerId?: string[];
  /// Contact-level filters
  contactStatus?: string[];
  contactSeniority?: string[];
  contactSource?: string[];
  hasEmail?: boolean;
  /// Free-form search
  q?: string;
}

function buildContactWhere(f: AudienceFilter): Prisma.ContactWhereInput {
  const and: Prisma.ContactWhereInput[] = [{ doNotContact: false }];

  if (f.hasEmail !== false) {
    and.push({ email: { not: { contains: '.imported' } } });
  }
  if (f.q) {
    and.push({
      OR: [
        { fullName: { contains: f.q, mode: 'insensitive' } },
        { email: { contains: f.q, mode: 'insensitive' } },
        { jobTitle: { contains: f.q, mode: 'insensitive' } },
      ],
    });
  }
  if (f.contactStatus?.length) {
    and.push({ status: { in: f.contactStatus as Prisma.EnumContactStatusFilter['in'] } });
  }
  if (f.contactSeniority?.length) {
    and.push({ seniorityLevel: { in: f.contactSeniority as Prisma.EnumSeniorityLevelFilter['in'] } });
  }
  if (f.contactSource?.length) {
    and.push({ source: { in: f.contactSource as Prisma.EnumContactSourceFilter['in'] } });
  }

  // Account-level filters joined via account
  const accountAnd: Prisma.AccountWhereInput[] = [];
  if (f.accountStatus?.length) {
    accountAnd.push({ status: { in: f.accountStatus as Prisma.EnumAccountStatusFilter['in'] } });
  }
  if (f.accountSegment?.length) {
    accountAnd.push({ segment: { in: f.accountSegment as Prisma.EnumMarketSegmentNullableFilter['in'] } });
  }
  if (f.accountCountry?.length) {
    accountAnd.push({ country: { in: f.accountCountry } });
  }
  if (f.accountOwnerId?.length) {
    accountAnd.push({ ownerId: { in: f.accountOwnerId } });
  }
  if (accountAnd.length) {
    and.push({ account: { AND: accountAnd } });
  }

  return { AND: and };
}

export async function previewAudience(filter: AudienceFilter, sampleSize = 8) {
  const where = buildContactWhere(filter);
  const [count, sample, byAccount] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        jobTitle: true,
        seniorityLevel: true,
        account: { select: { id: true, name: true, status: true } },
      },
      orderBy: { engagementScore: 'desc' },
      take: sampleSize,
    }),
    prisma.contact.groupBy({
      by: ['accountId'],
      where,
      _count: { _all: true },
      orderBy: { _count: { accountId: 'desc' } },
      take: 10,
    }),
  ]);

  return { count, sample, byAccount };
}

export async function listMatchingContactIds(filter: AudienceFilter, max = 5000) {
  const where = buildContactWhere(filter);
  const ids = await prisma.contact.findMany({
    where,
    select: { id: true },
    take: max,
  });
  return ids.map((c) => c.id);
}
