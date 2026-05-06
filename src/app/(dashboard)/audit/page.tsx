import Link from 'next/link';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { Card } from '@/components/ui/card';
import { Forbidden } from '@/components/shared/forbidden';
import { listUsers } from '@/lib/contacts/queries';
import {
  listAuditLog,
  getAuditByDay,
  getTopUsers,
  getResourceBreakdown,
  getDistinctActionsAndResources,
  getUserDrilldown,
  getActivityHeatmap,
  getHourDistribution,
  getOnlineUsers,
  getAuditStatsWithDeltas,
  getUserSessions,
} from '@/lib/audit/queries';
import { parseAuditFilters } from '@/lib/audit/parse-filters';
import { AuditStatsBar } from './components/audit-stats';
import { AuditFilters } from './components/audit-filters';
import { AuditTable } from './components/audit-table';
import {
  DailyActivityChart,
  TopUsersChart,
  ResourceDonut,
} from './components/audit-charts';
import { ActivityHeatmap, HourDistribution } from './components/activity-heatmap';
import { UserActivityPanel } from './components/user-activity-panel';
import { OnlineNowCard } from './components/online-now';
import { AuditToolbar } from './components/audit-toolbar';

export const metadata = { title: 'Auditoría' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  if (!can(session, 'audit:read')) {
    return <Forbidden message="No tienes permiso para ver la auditoría." />;
  }

  const urlParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((val) => urlParams.append(k, val));
    else urlParams.set(k, v);
  }
  const filters = parseAuditFilters(urlParams);

  const focusUserId =
    filters.userId && filters.userId.length === 1 ? filters.userId[0] : null;

  // 11 queries en paralelo. Con connection_limit=15 (post-hotfix) cabe.
  // Si vemos P2024 aquí también, partimos en 2 ondas.
  const [
    logResult,
    stats,
    dailyData,
    heatmap,
    hourDist,
    topUsers,
    resourceBreakdown,
    onlineUsers,
    dropdown,
    users,
    drilldown,
    sessions,
  ] = await Promise.all([
    listAuditLog(filters),
    getAuditStatsWithDeltas(),
    getAuditByDay(30),
    getActivityHeatmap(30),
    getHourDistribution(30),
    getTopUsers(30, 10),
    getResourceBreakdown(30),
    getOnlineUsers(5, 10),
    getDistinctActionsAndResources(),
    listUsers(),
    focusUserId ? getUserDrilldown(focusUserId, 30) : Promise.resolve(null),
    focusUserId ? getUserSessions(focusUserId, 30, 30, 15) : Promise.resolve([]),
  ]);

  const baseParams = new URLSearchParams(urlParams);
  baseParams.delete('page');
  const baseUrl = baseParams.toString() ? `/audit?${baseParams.toString()}` : '/audit';

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-sysde-gray">Auditoría</h1>
          <p className="text-sm text-sysde-mid mt-1">
            Quién hizo qué, cuándo y sobre qué recurso. Stats de los últimos 30 días.
          </p>
        </div>
        <AuditToolbar />
      </header>

      <AuditStatsBar stats={stats} />

      {/* Heatmap + Hour distribution */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-sysde-gray">
              Heatmap de actividad — hora × día (30d)
            </h3>
            <span className="text-[10px] text-sysde-mid">
              UTC del servidor · hora local del log
            </span>
          </div>
          {heatmap.length === 0 ? (
            <div className="text-sm text-sysde-mid text-center py-12">
              Sin datos para los últimos 30 días.
            </div>
          ) : (
            <ActivityHeatmap data={heatmap} />
          )}
        </Card>

        <OnlineNowCard users={onlineUsers} windowMin={5} />
      </div>

      {/* Daily area + hour distribution + resource donut */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-sysde-gray">Acciones por día (30d)</h3>
          </div>
          {dailyData.length === 0 ? (
            <div className="text-sm text-sysde-mid text-center py-12">Sin actividad reciente.</div>
          ) : (
            <DailyActivityChart data={dailyData} />
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-sysde-gray">Recursos tocados</h3>
          </div>
          {resourceBreakdown.length === 0 ? (
            <div className="text-sm text-sysde-mid text-center py-12">Sin datos.</div>
          ) : (
            <ResourceDonut data={resourceBreakdown} />
          )}
        </Card>

        <Card className="p-4 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-sysde-gray">
              Distribución por hora del día (30d)
            </h3>
            <span className="text-[10px] text-sysde-mid">
              encuentra los picos · sirve para detectar uso fuera de horario
            </span>
          </div>
          <HourDistribution data={hourDist} />
        </Card>
      </div>

      {/* Filters + table + drilldown */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-sysde-gray">Filtros</h3>
            <AuditFilters
              users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
              actions={dropdown.actions}
              resources={dropdown.resources}
              current={{
                userId: filters.userId ?? [],
                action: filters.action ?? [],
                resource: filters.resource ?? [],
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
                q: filters.q,
              }}
            />
          </Card>

          <AuditTable
            rows={logResult.rows}
            total={logResult.total}
            page={filters.page}
            pageSize={filters.pageSize}
            baseUrl={baseUrl}
          />
        </div>

        <aside className="space-y-4">
          {drilldown ? (
            <UserActivityPanel drilldown={drilldown} sessions={sessions} />
          ) : (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-sysde-gray mb-3">Top usuarios (30d)</h3>
              {topUsers.length === 0 ? (
                <div className="text-sm text-sysde-mid text-center py-8">Sin actividad.</div>
              ) : (
                <>
                  <TopUsersChart data={topUsers} />
                  <div className="mt-3 space-y-1 border-t border-sysde-border pt-3">
                    {topUsers.slice(0, 5).map((u) => (
                      <Link
                        key={u.userId}
                        href={`/audit?userId=${u.userId}`}
                        className="flex items-center justify-between text-xs hover:text-sysde-red"
                      >
                        <span>{u.name}</span>
                        <span className="text-sysde-mid">{u.count.toLocaleString('es')}</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-sysde-gray mb-2">¿Cómo se usa?</h3>
            <ul className="text-xs text-sysde-mid leading-relaxed space-y-1.5 list-disc list-inside">
              <li>Click en un usuario → su perfil con sesiones, tiempo activo y distribución.</li>
              <li>Click en un ID de recurso → la trail completa de ese registro.</li>
              <li>Botón <strong>Live</strong> auto-refresca cada 10s.</li>
              <li>Botón <strong>Export CSV</strong> baja todo lo filtrado (cap 10K).</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
