import {
  listTasksByAccount,
  getDependencyCandidates,
  getTaskAnalytics,
} from '@/lib/tasks/queries';
import { getUsersLite } from '@/lib/shared/lite-lists';
import { prisma } from '@/lib/db';
import { TaskViews } from '../tasks/task-views';
import { Skeleton } from '@/components/ui/skeleton';

export async function TasksTabAsync({
  accountId,
  canEdit,
  includeClosed,
}: {
  accountId: string;
  canEdit: boolean;
  includeClosed: boolean;
}) {
  const [tasks, users, totals, analytics, dependencyCandidates] = await Promise.all([
    listTasksByAccount(accountId, { includeClosed }),
    getUsersLite(),
    prisma.task.groupBy({
      by: ['status'],
      where: { accountId, parentTaskId: null },
      _count: { _all: true },
    }),
    getTaskAnalytics(accountId),
    getDependencyCandidates(accountId),
  ]);

  const counts = totals.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = r._count._all;
    return acc;
  }, {});
  const closedTotal = (counts.DONE ?? 0) + (counts.CANCELLED ?? 0);
  const openTotal = Object.values(counts).reduce((a, b) => a + b, 0) - closedTotal;

  return (
    <TaskViews
      accountId={accountId}
      initialTasks={tasks}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email ?? undefined,
        avatarUrl: u.avatarUrl,
      }))}
      canEdit={canEdit}
      includeClosed={includeClosed}
      openCount={openTotal}
      closedCount={closedTotal}
      analytics={analytics}
      dependencyCandidates={dependencyCandidates}
    />
  );
}

export function TasksTabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex w-[280px] shrink-0 flex-col gap-2">
            <Skeleton className="h-9 rounded-t-lg" />
            <div className="space-y-2 rounded-b-lg bg-sysde-bg/40 p-2">
              {Array.from({ length: 2 }).map((_, j) => (
                <Skeleton key={j} className="h-24 rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
