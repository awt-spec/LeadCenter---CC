'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, MessageCircle, Paperclip, ListTree, Lock, Unlock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getInitials } from '@/lib/utils';
import {
  TASK_PRIORITY_DOT,
  TASK_PRIORITY_LABELS,
} from '@/lib/tasks/labels';
import type { TaskWithRelations } from '@/lib/tasks/queries';

const TAG_COLORS = ['bg-blue-50 text-blue-700', 'bg-emerald-50 text-emerald-700', 'bg-violet-50 text-violet-700', 'bg-amber-50 text-amber-700', 'bg-pink-50 text-pink-700', 'bg-cyan-50 text-cyan-700'];

export function TaskCard({
  task,
  onClick,
  draggable = true,
}: {
  task: TaskWithRelations;
  onClick?: () => void;
  draggable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !draggable,
    data: { task },
  });

  const overdue = task.dueDate && isPast(task.dueDate) && task.status !== 'DONE' && !isToday(task.dueDate);
  const todayDue = task.dueDate && isToday(task.dueDate);
  const blockedByOpen = task.blockedBy?.filter((d) => d.blockedBy.status !== 'DONE' && d.blockedBy.status !== 'CANCELLED') ?? [];
  const isLocked = blockedByOpen.length > 0;
  const blockingCount = task._count.blocking ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'group relative cursor-grab overflow-hidden rounded-lg border border-sysde-border bg-white text-left shadow-sm transition-all hover:-translate-y-px hover:border-sysde-red/40 hover:shadow-md active:cursor-grabbing',
        isDragging && 'shadow-lg',
        isLocked && 'border-amber-300/60 bg-amber-50/40'
      )}
    >
      {/* Color stripe (left side) */}
      {task.color && (
        <div
          className="absolute left-0 top-0 h-full w-1"
          style={{ backgroundColor: task.color }}
          aria-hidden
        />
      )}

      <div className={cn('p-3', task.color && 'pl-3.5')}>
        <div className="flex items-start gap-2">
          <span
            className={cn('mt-1 h-2 w-2 shrink-0 rounded-full ring-2 ring-white', TASK_PRIORITY_DOT[task.priority])}
            title={TASK_PRIORITY_LABELS[task.priority]}
          />
          <h4 className="flex-1 text-sm font-medium leading-snug text-sysde-gray">{task.title}</h4>
          {(isLocked || blockingCount > 0) && (
            <div className="flex items-center gap-0.5">
              {isLocked && (
                <span
                  title={`Bloqueada por ${blockedByOpen.length} tarea(s)`}
                  className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200"
                >
                  <Lock className="h-2.5 w-2.5" />
                  {blockedByOpen.length}
                </span>
              )}
              {blockingCount > 0 && !isLocked && (
                <span
                  title={`Bloquea ${blockingCount} tarea(s)`}
                  className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200"
                >
                  <Unlock className="h-2.5 w-2.5" />
                  {blockingCount}
                </span>
              )}
            </div>
          )}
        </div>

        {task.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map((t, i) => (
              <span key={t} className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', TAG_COLORS[i % TAG_COLORS.length])}>
                {t}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
                +{task.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-sysde-mid">
            {task.dueDate && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded px-1.5 py-0.5',
                  overdue && 'bg-red-50 font-semibold text-danger',
                  todayDue && 'bg-amber-50 font-semibold text-amber-700',
                  !overdue && !todayDue && 'text-sysde-mid'
                )}
              >
                <CalendarDays className="h-3 w-3" />
                {format(task.dueDate, 'd MMM', { locale: es })}
              </span>
            )}
            {task._count.subtasks > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <ListTree className="h-3 w-3" />
                {task._count.subtasks}
              </span>
            )}
            {task._count.comments > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <MessageCircle className="h-3 w-3" />
                {task._count.comments}
              </span>
            )}
            {task._count.attachments > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Paperclip className="h-3 w-3" />
                {task._count.attachments}
              </span>
            )}
          </div>

          {task.assignees.length > 0 && (
            <div className="flex -space-x-1.5">
              {task.assignees.slice(0, 3).map((a) => (
                <Avatar key={a.userId} className="h-5 w-5 ring-2 ring-white">
                  {a.user.avatarUrl ? <AvatarImage src={a.user.avatarUrl} alt={a.user.name} /> : null}
                  <AvatarFallback className="text-[8px]">{getInitials(a.user.name)}</AvatarFallback>
                </Avatar>
              ))}
              {task.assignees.length > 3 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sysde-bg ring-2 ring-white text-[8px] font-medium text-sysde-mid">
                  +{task.assignees.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
