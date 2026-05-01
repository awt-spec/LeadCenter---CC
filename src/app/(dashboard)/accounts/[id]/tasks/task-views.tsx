'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Eye,
  EyeOff,
  KanbanSquare,
  List,
  Calendar,
  LayoutGrid,
  BarChart3,
} from 'lucide-react';
import { TaskKanban } from './task-kanban';
import { TaskListView } from './task-list-view';
import { TaskGridView } from './task-grid-view';
import { TaskCalendarView } from './task-calendar-view';
import { TaskCharts, type TaskAnalytics } from './task-charts';
import { TaskCreateDialog } from './task-create-dialog';
import { TaskDetailDrawer } from './task-detail-drawer';
import type { TaskWithRelations } from '@/lib/tasks/queries';
import { cn } from '@/lib/utils';

type UserOption = { id: string; name: string; avatarUrl?: string | null; email?: string };
type DependencyOption = { id: string; title: string; status: string; color: string | null };

type ViewMode = 'kanban' | 'list' | 'grid' | 'calendar';

const VIEW_OPTIONS: Array<{ id: ViewMode; label: string; icon: typeof KanbanSquare }> = [
  { id: 'kanban', label: 'Kanban', icon: KanbanSquare },
  { id: 'list', label: 'Lista', icon: List },
  { id: 'grid', label: 'Grid', icon: LayoutGrid },
  { id: 'calendar', label: 'Calendario', icon: Calendar },
];

export function TaskViews({
  accountId,
  initialTasks,
  users,
  canEdit,
  includeClosed = false,
  openCount,
  closedCount,
  analytics,
  dependencyCandidates,
}: {
  accountId: string;
  initialTasks: TaskWithRelations[];
  users: UserOption[];
  canEdit: boolean;
  includeClosed?: boolean;
  openCount?: number;
  closedCount?: number;
  analytics: TaskAnalytics;
  dependencyCandidates: DependencyOption[];
}) {
  const [view, setView] = useState<ViewMode>('kanban');
  const [showCharts, setShowCharts] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* View switcher */}
          <div className="inline-flex rounded-lg border border-sysde-border bg-white p-0.5 shadow-sm">
            {VIEW_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const sel = view === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setView(opt.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
                    sel
                      ? 'bg-sysde-red text-white shadow-sm'
                      : 'text-sysde-gray hover:bg-sysde-bg'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowCharts((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              showCharts
                ? 'border-sysde-red bg-sysde-red text-white'
                : 'border-sysde-border bg-white text-sysde-gray hover:bg-sysde-bg'
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            {showCharts ? 'Ocultar gráficos' : 'Mostrar gráficos'}
          </button>

          {/* Counts */}
          <div className="hidden flex-wrap items-center gap-2 text-xs text-sysde-mid md:flex">
            <span>
              <strong className="text-sysde-gray">{openCount ?? initialTasks.length}</strong> activas
            </span>
            {(closedCount ?? 0) > 0 && (
              <>
                <span>·</span>
                <span>
                  <strong className="text-sysde-gray">{closedCount}</strong> cerradas
                </span>
              </>
            )}
            {analytics.overdueOpen > 0 && (
              <>
                <span>·</span>
                <span className="font-semibold text-danger">{analytics.overdueOpen} vencidas</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ClosedFilterToggle includeClosed={includeClosed} closedCount={closedCount ?? 0} />
          {canEdit && (
            <TaskCreateDialog
              accountId={accountId}
              users={users}
              dependencyCandidates={dependencyCandidates}
            />
          )}
        </div>
      </div>

      {/* Charts panel */}
      {showCharts && <TaskCharts data={analytics} />}

      {/* View body */}
      {view === 'kanban' && (
        <TaskKanban
          accountId={accountId}
          initialTasks={initialTasks}
          users={users}
          canEdit={canEdit}
          dependencyCandidates={dependencyCandidates}
        />
      )}
      {view === 'list' && <TaskListView tasks={initialTasks} onSelect={setOpenTaskId} />}
      {view === 'grid' && <TaskGridView tasks={initialTasks} onSelect={setOpenTaskId} />}
      {view === 'calendar' && <TaskCalendarView tasks={initialTasks} onSelect={setOpenTaskId} />}

      {/* Drawer reused by non-kanban views */}
      {view !== 'kanban' && (
        <TaskDetailDrawer
          taskId={openTaskId}
          open={!!openTaskId}
          onOpenChange={(o) => !o && setOpenTaskId(null)}
          users={users}
        />
      )}
    </div>
  );
}

function ClosedFilterToggle({
  includeClosed,
  closedCount,
}: {
  includeClosed?: boolean;
  closedCount: number;
}) {
  const sp = useSearchParams();
  const next = new URLSearchParams(sp.toString());
  if (includeClosed) next.delete('closed');
  else next.set('closed', '1');
  const Icon = includeClosed ? EyeOff : Eye;
  const label = includeClosed
    ? 'Solo activas'
    : closedCount > 0
    ? `Mostrar cerradas (${closedCount})`
    : 'Mostrar cerradas';

  return (
    <Link
      href={`?${next.toString()}#tasks`}
      scroll={false}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
        includeClosed
          ? 'border-sysde-red bg-sysde-red text-white hover:bg-sysde-red-dark'
          : 'border-sysde-border bg-white text-sysde-gray hover:bg-sysde-bg'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
