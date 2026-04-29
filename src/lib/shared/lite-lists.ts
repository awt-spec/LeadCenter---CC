import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db';

/**
 * Cached "lite" lists used by activity composers, opportunity selectors, etc.
 * These rarely change while the user is mid-session and don't need to be
 * refetched on every detail-page render. Cached 5 min, tagged so we can
 * invalidate when the underlying entity is created/edited.
 */

export const getContactsLite = unstable_cache(
  async () =>
    prisma.contact.findMany({
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
      take: 100,
    }),
  ['contacts-lite'],
  { revalidate: 300, tags: ['contacts'] }
);

export const getAccountsLite = unstable_cache(
  async () =>
    prisma.account.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 100,
    }),
  ['accounts-lite'],
  { revalidate: 300, tags: ['accounts'] }
);

export const getOpportunitiesLite = unstable_cache(
  async () =>
    prisma.opportunity.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ['opportunities-lite'],
  { revalidate: 300, tags: ['opportunities'] }
);

export const getUsersLite = unstable_cache(
  async () =>
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, avatarUrl: true },
      orderBy: { name: 'asc' },
    }),
  ['users-lite'],
  { revalidate: 300, tags: ['users'] }
);
