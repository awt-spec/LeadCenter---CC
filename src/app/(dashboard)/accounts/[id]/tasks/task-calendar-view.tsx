'use client';

import { useMemo, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TASK_PRIORITY_DOT } from '@/lib/tasks/labels';
import type { TaskWithRelations } from '@/lib/tasks/queries';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function TaskCalendarView({
  tasks,
  onSelect,
}: {
  tasks: TaskWithRelations[];
  onSelect: (id: string) => void;
}) {
  const [cursor, setCursor] = useState(() => new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const arr: Date[] = [];
    let d = start;
    while (d <= end) {
      arr.push(d);
      d = addDays(d, 1);
    }
    return arr;
  }, [cursor]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const key = format(t.dueDate, 'yyyy-MM-dd');
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasks]);

  const noDateTasks = tasks.filter((t) => !t.dueDate);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold capitalize text-sysde-gray">
            {format(cursor, "LLLL yyyy", { locale: es })}
          </h3>
          <p className="text-xs text-sysde-mid">
            {tasks.filter((t) => t.dueDate).length} con fecha · {noDateTasks.length} sin fecha
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setCursor(addMonths(cursor, -1))}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
            Hoy
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-sysde-border bg-white">
        <div className="grid grid-cols-7 border-b border-sysde-border bg-sysde-bg text-[11px] uppercase tracking-wide text-sysde-mid">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center font-semibold">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const inMonth = isSameMonth(day, cursor);
            const today = isToday(day);
            const dayTasks = tasksByDay.get(format(day, 'yyyy-MM-dd')) ?? [];
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[96px] border-b border-r border-sysde-border p-1.5 text-xs',
                  !inMonth && 'bg-sysde-bg/30 text-sysde-mid',
                  today && 'bg-sysde-red-light/40'
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full text-[11px] font-medium',
                      today && 'bg-sysde-red text-white',
                      !today && 'text-sysde-gray'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[10px] text-sysde-mid">{dayTasks.length}</span>
                  )}
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onSelect(t.id)}
                      style={t.color ? { borderLeftColor: t.color, borderLeftWidth: 3 } : undefined}
                      className={cn(
                        'flex w-full items-center gap-1 truncate rounded border border-sysde-border bg-white px-1.5 py-1 text-left text-[11px] text-sysde-gray transition-colors hover:border-sysde-red/40 hover:bg-sysde-bg'
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TASK_PRIORITY_DOT[t.priority])} />
                      <span className="truncate">{t.title}</span>
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="block text-[10px] text-sysde-mid">+{dayTasks.length - 3} más</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {noDateTasks.length > 0 && (
        <div className="rounded-lg border border-dashed border-sysde-border bg-sysde-bg/40 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-sysde-mid">Sin fecha de vencimiento</p>
          <div className="flex flex-wrap gap-1.5">
            {noDateTasks.slice(0, 12).map((t) => (
              <button
                key={t.id}
                onClick={() => onSelect(t.id)}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] text-sysde-gray ring-1 ring-sysde-border transition-colors hover:ring-sysde-red/40"
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', TASK_PRIORITY_DOT[t.priority])} />
                {t.title}
              </button>
            ))}
            {noDateTasks.length > 12 && (
              <span className="self-center text-[11px] text-sysde-mid">+{noDateTasks.length - 12} más</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
