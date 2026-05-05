import { prisma } from '@/lib/db';
import type { Audience } from './schemas';
import { AUDIENCES } from './schemas';

/// Fetch the C.O.C. for an account. If none exists, returns a "shell" object
/// so the UI can render the empty state without an extra round trip. The
/// shell is NOT persisted — it's only created on the first save.
export async function getSharedContextByAccount(accountId: string) {
  const ctx = await prisma.sharedContext.findUnique({
    where: { accountId },
    include: {
      versions: {
        orderBy: { audience: 'asc' },
        include: {
          updatedBy: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      links: {
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        include: {
          createdBy: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      updatedBy: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  // Index versions by audience for the UI
  const byAudience = new Map<Audience, NonNullable<typeof ctx>['versions'][number]>();
  if (ctx) {
    for (const v of ctx.versions) byAudience.set(v.audience as Audience, v);
  }
  // Provide stub versions for audiences without content so the UI tabs are stable.
  const versions = AUDIENCES.map((a) => ({
    audience: a,
    body: byAudience.get(a)?.body ?? null,
    updatedAt: byAudience.get(a)?.updatedAt ?? null,
    updatedBy: byAudience.get(a)?.updatedBy ?? null,
  }));

  return {
    exists: Boolean(ctx),
    id: ctx?.id ?? null,
    headline: ctx?.headline ?? null,
    strategy: ctx?.strategy ?? null,
    goals: ctx?.goals ?? null,
    risks: ctx?.risks ?? null,
    nextSteps: ctx?.nextSteps ?? null,
    status: ctx?.status ?? 'ACTIVE',
    createdAt: ctx?.createdAt ?? null,
    updatedAt: ctx?.updatedAt ?? null,
    createdBy: ctx?.createdBy ?? null,
    updatedBy: ctx?.updatedBy ?? null,
    versions,
    links: ctx?.links ?? [],
  };
}

export type SharedContextView = Awaited<ReturnType<typeof getSharedContextByAccount>>;
