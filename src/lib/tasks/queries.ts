import 'server-only';
import type { Prisma } from '@prisma/client';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db';

export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: {
    createdBy: { select: { id: true; name: true; avatarUrl: true } };
    assignees: { include: { user: { select: { id: true; name: true; avatarUrl: true; email: true } } } };
    _count: { select: { subtasks: true; comments: true; attachments: true } };
    contact: { select: { id: true; fullName: true; avatarUrl: true } };
    opportunity: { select: { id: true; name: true; code: true } };
  };
}>;

// Active = not DONE / CANCELLED. By default we only return active tasks
// because closed lists grow indefinitely (3k+ rows per account is common
// after a CSV import). The Kanban toggles `includeClosed` when the user
// wants to see history.
const STATUS_CLOSED = ['DONE', 'CANCELLED'] as const;

const listTasksByAccountRaw = unstable_cache(
  async (accountId: string, includeClosed: boolean): Promise<TaskWithRelations[]> => {
    const where: Prisma.TaskWhereInput = {
      accountId,
      parentTaskId: null,
      ...(includeClosed ? {} : { status: { notIn: [...STATUS_CLOSED] } }),
    };
    return prisma.task.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        assignees: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, email: true } },
          },
        },
        _count: { select: { subtasks: true, comments: true, attachments: true } },
        contact: { select: { id: true, fullName: true, avatarUrl: true } },
        opportunity: { select: { id: true, name: true, code: true } },
      },
      orderBy: includeClosed
        ? [{ status: 'asc' }, { completedAt: 'desc' }, { position: 'asc' }]
        : [{ position: 'asc' }, { createdAt: 'asc' }],
      take: includeClosed ? 500 : 200, // cap for perf
    });
  },
  ['tasks-by-account'],
  { revalidate: 60, tags: ['tasks'] }
);

export async function listTasksByAccount(
  accountId: string,
  opts: { includeClosed?: boolean } = {}
): Promise<TaskWithRelations[]> {
  return listTasksByAccountRaw(accountId, opts.includeClosed ?? false);
}

export async function getTaskById(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      assignees: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true, email: true } },
        },
      },
      account: { select: { id: true, name: true } },
      opportunity: { select: { id: true, name: true, code: true } },
      contact: { select: { id: true, fullName: true } },
      subtasks: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: {
          assignees: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
          _count: { select: { subtasks: true, comments: true, attachments: true } },
        },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      attachments: {
        orderBy: { uploadedAt: 'desc' },
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
    },
  });
}

export async function getTaskStats(accountId: string) {
  const [total, byStatus] = await Promise.all([
    prisma.task.count({ where: { accountId, parentTaskId: null } }),
    prisma.task.groupBy({
      by: ['status'],
      where: { accountId, parentTaskId: null },
      _count: { _all: true },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const r of byStatus) counts[r.status] = r._count._all;

  return {
    total,
    byStatus: counts,
    open: total - (counts.DONE ?? 0) - (counts.CANCELLED ?? 0),
  };
}
