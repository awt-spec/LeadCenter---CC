import { format, isToday, isYesterday, startOfDay, isSameYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { ActivityCard } from './activity-card';
import { SystemActivityRow } from './system-activity-row';
import type { ActivityWithRelations } from '@/lib/activities/queries';
import { EmptyState } from '@/components/shared/empty-state';
import { Inbox } from 'lucide-react';

type Props = {
  activities: ActivityWithRelations[];
  currentUserId: string;
  hideRelations?: boolean;
  groupByDate?: boolean;
  allUsers?: { id: string; name: string; email?: string; avatarUrl?: string | null }[];
};

export function ActivityTimeline({
  activities,
  currentUserId,
  hideRelations,
  groupByDate = true,
  allUsers,
}: Props) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-sysde-border bg-white">
        <EmptyState
          icon={Inbox}
          title="Sin actividades aún"
          description="Cuando registres una llamada, reunión, email o nota interna, aparecerá aquí."
        />
      </div>
    );
  }

  if (!groupByDate) {
    return (
      <div className="relative space-y-4">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-sysde-border" />
        {activities.map((a) =>
          a.isSystemGenerated ? (
            <SystemActivityRow key={a.id} activity={a} />
          ) : (
            <ActivityCard
              key={a.id}
              activity={a}
              currentUserId={currentUserId}
              hideRelations={hideRelations}
              allUsers={allUsers}
            />
          )
        )}
      </div>
    );
  }

  const groups = groupActivitiesByDate(activities);

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <div key={g.label} className="relative">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sysde-mid">
              {g.label}
            </span>
            <div className="h-px flex-1 bg-sysde-border" />
          </div>
          <div className="relative space-y-4">
            <div className="absolute left-4 top-2 bottom-2 w-px bg-sysde-border" />
            {g.activities.map((a) =>
              a.isSystemGenerated ? (
                <SystemActivityRow key={a.id} activity={a} />
              ) : (
                <ActivityCard
                  key={a.id}
                  activity={a}
                  currentUserId={currentUserId}
                  hideRelations={hideRelations}
                />
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupActivitiesByDate(activities: ActivityWithRelations[]) {
  const groupsMap = new Map<string, ActivityWithRelations[]>();
  const now = new Date();

  for (const a of activities) {
    const day = startOfDay(a.occurredAt);
    let label: string;
    if (isToday(day)) label = 'Hoy';
    else if (isYesterday(day)) label = 'Ayer';
    else if (isSameYear(day, now)) label = format(day, "EEEE d 'de' LLLL", { locale: es });
    else label = format(day, "d 'de' LLLL yyyy", { locale: es });

    const arr = groupsMap.get(label);
    if (arr) arr.push(a);
    else groupsMap.set(label, [a]);
  }

  return Array.from(groupsMap.entries()).map(([label, activities]) => ({
    label: label.charAt(0).toUpperCase() + label.slice(1),
    activities,
  }));
}
