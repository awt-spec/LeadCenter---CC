'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { TaskCard } from './task-card';
import { TaskDetailDrawer } from './task-detail-drawer';
import { setTaskStatus } from '@/lib/tasks/mutations';
import {
  KANBAN_COLUMNS,
  TASK_STATUS_DOT,
  TASK_STATUS_LABELS,
} from '@/lib/tasks/labels';
import type { TaskStatus } from '@/lib/tasks/schemas';
import type { TaskWithRelations } from '@/lib/tasks/queries';
import { cn } from '@/lib/utils';

type UserOption = { id: string; name: string; avatarUrl?: string | null; email?: string };
type DependencyOption = { id: string; title: string; status: string; color: string | null };

export function TaskKanban({
  accountId,
  initialTasks,
  users,
  canEdit,
  dependencyCandidates: _dependencyCandidates = [],
}: {
  accountId: string;
  initialTasks: TaskWithRelations[];
  users: UserOption[];
  canEdit: boolean;
  dependencyCandidates?: DependencyOption[];
}) {
  // accountId is read at the call site for navigation; not used directly here
  // beyond keeping the prop-shape stable. eslint-disable-next-line @typescript-eslint/no-unused-vars
  void accountId;
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const grouped = useMemo(() => {
    const map = new Map<TaskStatus, TaskWithRelations[]>();
    for (const col of KANBAN_COLUMNS) map.set(col.status as TaskStatus, []);
    for (const t of tasks) {
      const arr = map.get(t.status as TaskStatus);
      if (arr) arr.push(t);
    }
    return map;
  }, [tasks]);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    const targetStatus = (over.data.current as { status?: TaskStatus })?.status;
    if (!targetStatus) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    // optimistic
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t)));

    startTransition(async () => {
      const r = await setTaskStatus(taskId, targetStatus);
      if (!r.ok) {
        toast.error(r.error);
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t))
        );
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {KANBAN_COLUMNS.map((col) => {
            const items = grouped.get(col.status as TaskStatus) ?? [];
            return (
              <KanbanColumn
                key={col.status}
                status={col.status as TaskStatus}
                items={items}
                canEdit={canEdit}
                onCardClick={setOpenTaskId}
              />
            );
          })}
        </div>
        <DragOverlay dropAnimation={{ duration: 180 }}>
          {activeTask && (
            <div style={{ width: 280, opacity: 0.9 }}>
              <TaskCard task={activeTask} draggable={false} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <TaskDetailDrawer
        taskId={openTaskId}
        open={!!openTaskId}
        onOpenChange={(o) => !o && setOpenTaskId(null)}
        users={users}
      />
    </>
  );
}

function KanbanColumn({
  status,
  items,
  canEdit,
  onCardClick,
}: {
  status: TaskStatus;
  items: TaskWithRelations[];
  canEdit: boolean;
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}`, data: { status } });

  return (
    <div className="flex w-[280px] shrink-0 flex-col">
      <div className="flex items-center justify-between rounded-t-lg bg-sysde-bg px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', TASK_STATUS_DOT[status])} />
          <span className="text-xs font-semibold uppercase tracking-wide text-sysde-gray">
            {TASK_STATUS_LABELS[status]}
          </span>
          <span className="text-xs text-sysde-mid">{items.length}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[120px] flex-1 flex-col gap-2 rounded-b-lg bg-sysde-bg/40 p-2 transition-colors',
          isOver && 'bg-sysde-red-light'
        )}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((t) => (
            <TaskCard key={t.id} task={t} onClick={() => onCardClick(t.id)} draggable={canEdit} />
          ))}
        </SortableContext>
        {items.length === 0 && (
          <div className="rounded-md border border-dashed border-sysde-border p-3 text-center text-[11px] text-sysde-mid">
            Vacío
          </div>
        )}
      </div>
    </div>
  );
}
