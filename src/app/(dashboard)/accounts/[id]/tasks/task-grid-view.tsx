'use client';

import { format, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, Lock, Link2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getInitials } from '@/lib/utils';
import {
  TASK_PRIORITY_DOT,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_PILL,
  TASK_STATUS_DOT,
  TASK_STATUS_LABELS,
} from '@/lib/tasks/labels';
import type { TaskWithRelations } from '@/lib/tasks/queries';

export function TaskGridView({
  tasks,
  onSelect,
}: {
  tasks: TaskWithRelations[];
  onSelect: (id: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-sysde-border bg-sysde-bg/40 p-10 text-center text-sm text-sysde-mid">
        Sin tareas en este filtro.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tasks.map((t) => {
        const overdue = t.dueDate && isPast(t.dueDate) && t.status !== 'DONE' && !isToday(t.dueDate);
        const blockedOpen = t.blockedBy?.filter((d) => d.blockedBy.status !== 'DONE' && d.blockedBy.status !== 'CANCELLED') ?? [];
        const isLocked = blockedOpen.length > 0;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={cn(
              'group relative flex flex-col gap-2.5 overflow-hidden rounded-lg border border-sysde-border bg-white p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-sysde-red/40 hover:shadow-md',
              isLocked && 'border-amber-300/60 bg-amber-50/40'
            )}
          >
            {t.color && (
              <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: t.color }} aria-hidden />
            )}
            <div className="flex items-start justify-between gap-2">
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', TASK_STATUS_PILL[t.status])}>
                <span className={cn('h-1.5 w-1.5 rounded-full', TASK_STATUS_DOT[t.status])} />
                {TASK_STATUS_LABELS[t.status]}
              </span>
              <span
                className={cn('h-2 w-2 shrink-0 rounded-full ring-2 ring-white', TASK_PRIORITY_DOT[t.priority])}
                title={TASK_PRIORITY_LABELS[t.priority]}
              />
            </div>

            <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-sysde-gray">{t.title}</h4>

            {t.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {t.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                    {tag}
                  </span>
                ))}
                {t.tags.length > 2 && (
                  <span className="text-[10px] text-sysde-mid">+{t.tags.length - 2}</span>
                )}
              </div>
            )}

            <div className="mt-auto flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1 text-[11px] text-sysde-mid">
                {t.dueDate && (
                  <span className={cn('inline-flex items-center gap-0.5', overdue && 'font-semibold text-danger')}>
                    <CalendarDays className="h-3 w-3" />
                    {format(t.dueDate, 'd MMM', { locale: es })}
                  </span>
                )}
                {isLocked && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-700">
                    <Lock className="h-2.5 w-2.5" /> {blockedOpen.length}
                  </span>
                )}
                {(t._count.blocking ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-700">
                    <Link2 className="h-2.5 w-2.5" /> {t._count.blocking}
                  </span>
                )}
              </div>
              {t.assignees.length > 0 && (
                <div className="flex -space-x-1.5">
                  {t.assignees.slice(0, 3).map((a) => (
                    <Avatar key={a.userId} className="h-5 w-5 ring-2 ring-white">
                      {a.user.avatarUrl ? <AvatarImage src={a.user.avatarUrl} alt={a.user.name} /> : null}
                      <AvatarFallback className="text-[8px]">{getInitials(a.user.name)}</AvatarFallback>
                    </Avatar>
                  ))}
                  {t.assignees.length > 3 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sysde-bg ring-2 ring-white text-[8px] font-medium text-sysde-mid">
                      +{t.assignees.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
