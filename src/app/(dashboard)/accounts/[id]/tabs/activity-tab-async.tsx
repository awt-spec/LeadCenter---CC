import type { Session } from 'next-auth';
import { listActivities } from '@/lib/activities/queries';
import { activityFilterSchema } from '@/lib/activities/schemas';
import {
  getContactsLite,
  getAccountsLite,
  getOpportunitiesLite,
  getUsersLite,
} from '@/lib/shared/lite-lists';
import { TimelineWithComposer } from '@/components/activities/timeline-with-composer';
import { can } from '@/lib/rbac';
import { Skeleton } from '@/components/ui/skeleton';

export async function ActivityTabAsync({
  accountId,
  session,
}: {
  accountId: string;
  session: Session;
}) {
  const filters = activityFilterSchema.parse({});
  const [{ rows: activities }, contacts, accounts, opps, users] = await Promise.all([
    listActivities(session, { accountId }, filters),
    getContactsLite(),
    getAccountsLite(),
    getOpportunitiesLite(),
    getUsersLite(),
  ]);

  return (
    <TimelineWithComposer
      activities={activities}
      currentUserId={session.user.id}
      composerDefaults={{ accountId }}
      contacts={contacts.map((c) => ({ id: c.id, label: c.fullName }))}
      accounts={accounts.map((a) => ({ id: a.id, label: a.name }))}
      opportunities={opps.map((o) => ({
        id: o.id,
        label: `${o.code ?? o.id} · ${o.name}`,
      }))}
      users={users.map((u) => ({ id: u.id, name: u.name }))}
      canCreate={can(session, 'activities:create')}
      title="Timeline"
    />
  );
}

export function ActivityTabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-sysde-border bg-white p-4 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
