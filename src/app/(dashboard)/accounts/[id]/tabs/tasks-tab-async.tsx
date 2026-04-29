import type { Session } from 'next-auth';
import { listTasksByAccount } from '@/lib/tasks/queries';
import { getUsersLite } from '@/lib/shared/lite-lists';
import { TaskKanban } from '../tasks/task-kanban';
import { Skeleton } from '@/components/ui/skeleton';

export async function TasksTabAsync({
  accountId,
  canEdit,
}: {
  accountId: string;
  canEdit: boolean;
}) {
  const [tasks, users] = await Promise.all([
    listTasksByAccount(accountId),
    getUsersLite(),
  ]);
  return (
    <TaskKanban
      accountId={accountId}
      initialTasks={tasks}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email ?? undefined,
        avatarUrl: u.avatarUrl,
      }))}
      canEdit={canEdit}
    />
  );
}

export function TasksTabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
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
