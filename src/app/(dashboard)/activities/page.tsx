import { Activity, AlertOctagon, AtSign, ListTodo } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { Forbidden } from '@/components/shared/forbidden';
import { Card, CardContent } from '@/components/ui/card';
import { prisma } from '@/lib/db';
import {
  listActivities,
  getGlobalActivityStats,
} from '@/lib/activities/queries';
import { activityFilterSchema } from '@/lib/activities/schemas';
import { listUsers } from '@/lib/contacts/queries';
import { ActivitiesFilters } from './components/activities-filters';
import { ActivityTimeline } from '@/components/activities/activity-timeline';

export const metadata = { title: 'Actividad' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function arr(v: string | string[] | undefined) {
  if (!v) return undefined;
  return Array.isArray(v) ? v : [v];
}

export default async function ActivitiesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  if (!can(session, 'activities:read')) {
    return <Forbidden message="No tienes permiso para ver actividades." />;
  }

  const filters = activityFilterSchema.parse({
    q: typeof sp.q === 'string' ? sp.q : undefined,
    type: arr(sp.type),
    tags: arr(sp.tags),
    createdById: arr(sp.createdById),
    dateFrom: typeof sp.dateFrom === 'string' ? sp.dateFrom : undefined,
    dateTo: typeof sp.dateTo === 'string' ? sp.dateTo : undefined,
    pendingNextAction: sp.pendingNextAction === 'true',
    onlyMyMentions: sp.onlyMyMentions === 'true',
    includeSystem: sp.includeSystem === 'true',
    page: sp.page ? Number(sp.page) : 1,
    pageSize: sp.pageSize ? Number(sp.pageSize) : 50,
  });

  const [{ rows: activities, total }, stats, users] = await Promise.all([
    listActivities(session, { global: true }, filters),
    getGlobalActivityStats(session),
    listUsers(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-[24px] font-semibold text-sysde-gray">Actividad</h2>
        <p className="mt-1 text-sm text-sysde-mid">
          Toda la actividad comercial del equipo · {total.toLocaleString('es-MX')} actividades
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Esta semana" value={stats.thisWeek} icon={Activity} color="#3B82F6" />
        <StatCard
          label="Acciones pendientes"
          value={stats.pendingNextActions}
          icon={ListTodo}
          color="#F59E0B"
        />
        <StatCard
          label="Mis menciones"
          value={stats.unreadMentions}
          icon={AtSign}
          color="#C8200F"
        />
        <StatCard
          label="Acciones vencidas"
          value={stats.overdueActions}
          icon={AlertOctagon}
          color="#EF4444"
        />
      </div>

      <ActivitiesFilters users={users.map((u) => ({ id: u.id, name: u.name }))} />

      <ActivityTimeline
        activities={activities}
        currentUserId={session.user.id}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="relative p-5">
        <div
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}26`, color }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-sysde-mid">
          {label}
        </div>
        <div className="mt-2 text-[28px] font-semibold leading-none text-sysde-gray">
          {value.toLocaleString('es-MX')}
        </div>
      </CardContent>
    </Card>
  );
}
