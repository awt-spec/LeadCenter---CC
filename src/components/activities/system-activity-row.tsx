import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ACTIVITY_TYPE_ICONS } from '@/lib/activities/labels';
import type { ActivityWithRelations } from '@/lib/activities/queries';

export function SystemActivityRow({ activity }: { activity: ActivityWithRelations }) {
  const Icon = ACTIVITY_TYPE_ICONS[activity.type];
  return (
    <div className="relative flex items-center gap-3 pl-10 text-xs text-sysde-mid">
      <span className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-neutral-300" />
      <Icon className="h-3.5 w-3.5" />
      <span>
        <strong className="font-medium text-sysde-gray">
          {activity.createdBy.name.split(' ')[0]}
        </strong>{' '}
        {activity.subject.toLowerCase()}
      </span>
      <span className="ml-auto">
        {formatDistanceToNow(activity.occurredAt, { addSuffix: true, locale: es })}
      </span>
    </div>
  );
}
