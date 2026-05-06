import 'server-only';
import type { Prisma } from '@prisma/client';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db';

export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: {
    createdBy: { select: { id: true; name: true; avatarUrl: true } };
    assignees: { include: { user: { select: { id: true; name: true; avatarUrl: true; email: true } } } };
    _count: {
      select: {
        subtasks: true;
        comments: true;
        attachments: true;
        blockedBy: true;
        blocking: true;
      };
    };
    contact: { select: { id: true; fullName: true; avatarUrl: true } };
    opportunity: { select: { id: true; name: true; code: true } };
    blockedBy: {
      include: {
        blockedBy: { select: { id: true; title: true; status: true } };
      };
    };
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
        _count: {
          select: {
            subtasks: true,
            comments: true,
            attachments: true,
            blockedBy: true,
            blocking: true,
          },
        },
        contact: { select: { id: true, fullName: true, avatarUrl: true } },
        opportunity: { select: { id: true, name: true, code: true } },
        blockedBy: {
          include: {
            blockedBy: { select: { id: true, title: true, status: true } },
          },
        },
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
    // OPT-011: relationJoins. El task drawer carga subtasks + comments +
    // attachments + assignees + blockedBy + blocking. Sin relationJoins
    // son ~8 queries separadas en serie. Con join, una sola SQL.
    relationLoadStrategy: 'join',
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
        take: 30,  // OPT-004: cap. Más allá, hacer una task separada.
      },
      comments: {
        orderBy: { createdAt: 'desc' },  // newest first; UI revierte si quiere
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        take: 50,  // OPT-004: cap. La UI puede paginar histórico viejo.
      },
      attachments: {
        orderBy: { uploadedAt: 'desc' },
        include: { uploadedBy: { select: { id: true, name: true } } },
        take: 20,  // OPT-004: cap.
      },
      blockedBy: {
        include: {
          blockedBy: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              color: true,
            },
          },
        },
      },
      blocking: {
        include: {
          task: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              color: true,
            },
          },
        },
      },
    },
  });
}

// All non-closed root tasks for an account, used to populate the
// "depends on" picker. Excludes the task itself + tasks that already
// depend on this one (transitive cycle prevention is handled in mutation).
export async function getDependencyCandidates(accountId: string, excludeTaskId?: string) {
  return prisma.task.findMany({
    where: {
      accountId,
      parentTaskId: null,
      status: { notIn: ['DONE', 'CANCELLED'] },
      ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
    },
    select: { id: true, title: true, status: true, color: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

// Aggregations for the charts section. Returns:
//   - byStatus: count per status (pie/donut)
//   - byPriority: count per priority (bar)
//   - byAssignee: count per user (bar, top 8)
//   - completionTrend: 14-day rolling created vs completed (line)
//   - overdueOpen: tasks past dueDate still open
export async function getTaskAnalytics(accountId: string) {
  const [byStatus, byPriority, allOpenAndClosed, overdueOpen] = await Promise.all([
    prisma.task.groupBy({
      by: ['status'],
      where: { accountId, parentTaskId: null },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ['priority'],
      where: { accountId, parentTaskId: null, status: { notIn: ['DONE', 'CANCELLED'] } },
      _count: { _all: true },
    }),
    prisma.task.findMany({
      where: { accountId, parentTaskId: null },
      select: {
        id: true,
        createdAt: true,
        completedAt: true,
        assignees: {
          select: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
      take: 2000,
    }),
    prisma.task.count({
      where: {
        accountId,
        parentTaskId: null,
        dueDate: { lt: new Date() },
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
    }),
  ]);

  // Last 14 days created/completed
  const days: Array<{ day: string; created: number; completed: number }> = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ day: key, created: 0, completed: 0 });
  }
  const dayIndex = new Map(days.map((d, i) => [d.day, i]));
  for (const t of allOpenAndClosed) {
    const c = t.createdAt.toISOString().slice(0, 10);
    const ci = dayIndex.get(c);
    if (ci !== undefined) days[ci].created += 1;
    if (t.completedAt) {
      const k = t.completedAt.toISOString().slice(0, 10);
      const di = dayIndex.get(k);
      if (di !== undefined) days[di].completed += 1;
    }
  }

  // Top assignees
  const assigneeMap = new Map<
    string,
    { id: string; name: string; avatarUrl: string | null; count: number }
  >();
  for (const t of allOpenAndClosed) {
    for (const a of t.assignees) {
      const u = a.user;
      const cur = assigneeMap.get(u.id);
      if (cur) cur.count += 1;
      else assigneeMap.set(u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl, count: 1 });
    }
  }
  const topAssignees = [...assigneeMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
    byPriority: byPriority.map((r) => ({ priority: r.priority, count: r._count._all })),
    completionTrend: days,
    topAssignees,
    overdueOpen,
    total: allOpenAndClosed.length,
  };
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
