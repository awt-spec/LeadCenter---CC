'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '@/lib/tasks/labels';
import { getInitials } from '@/lib/utils';

const STATUS_COLOR: Record<string, string> = {
  BACKLOG: '#94A3B8',
  TODO: '#3B82F6',
  IN_PROGRESS: '#F59E0B',
  REVIEW: '#8B5CF6',
  BLOCKED: '#DC2626',
  DONE: '#10B981',
  CANCELLED: '#A1A1AA',
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: '#94A3B8',
  NORMAL: '#3B82F6',
  HIGH: '#F59E0B',
  URGENT: '#DC2626',
};

export type TaskAnalytics = {
  byStatus: Array<{ status: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  completionTrend: Array<{ day: string; created: number; completed: number }>;
  topAssignees: Array<{ id: string; name: string; avatarUrl: string | null; count: number }>;
  overdueOpen: number;
  total: number;
};

export function TaskCharts({ data }: { data: TaskAnalytics }) {
  const statusData = useMemo(
    () =>
      data.byStatus.map((r) => ({
        name: TASK_STATUS_LABELS[r.status] ?? r.status,
        status: r.status,
        value: r.count,
      })),
    [data.byStatus]
  );

  const priorityData = useMemo(
    () =>
      data.byPriority.map((r) => ({
        name: TASK_PRIORITY_LABELS[r.priority] ?? r.priority,
        priority: r.priority,
        count: r.count,
      })),
    [data.byPriority]
  );

  const trendData = useMemo(
    () =>
      data.completionTrend.map((d) => ({
        ...d,
        label: format(new Date(d.day), 'd MMM', { locale: es }),
      })),
    [data.completionTrend]
  );

  const open = data.total - (data.byStatus.find((r) => r.status === 'DONE')?.count ?? 0) - (data.byStatus.find((r) => r.status === 'CANCELLED')?.count ?? 0);
  const done = data.byStatus.find((r) => r.status === 'DONE')?.count ?? 0;
  const completionRate = data.total === 0 ? 0 : Math.round((done / data.total) * 100);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total" value={data.total} accent="bg-blue-50 text-blue-700" />
        <Kpi label="Activas" value={open} accent="bg-amber-50 text-amber-700" />
        <Kpi label="Completadas" value={`${completionRate}%`} sub={`${done} de ${data.total}`} accent="bg-emerald-50 text-emerald-700" />
        <Kpi label="Vencidas" value={data.overdueOpen} accent={data.overdueOpen > 0 ? 'bg-red-50 text-danger' : 'bg-neutral-50 text-neutral-600'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wide text-sysde-mid">Por estado</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 || statusData.every((d) => d.value === 0) ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {statusData.map((d) => (
                      <Cell key={d.status} fill={STATUS_COLOR[d.status] ?? '#A1A1AA'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wide text-sysde-mid">Por prioridad (activas)</CardTitle>
          </CardHeader>
          <CardContent>
            {priorityData.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {priorityData.map((d) => (
                      <Cell key={d.priority} fill={PRIORITY_COLOR[d.priority] ?? '#A1A1AA'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wide text-sysde-mid">Actividad últimas 2 semanas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Line
                  type="monotone"
                  dataKey="created"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Creadas"
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Completadas"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {data.topAssignees.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wide text-sysde-mid">Carga por responsable (top 8)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.topAssignees.map((a) => {
                  const max = Math.max(...data.topAssignees.map((x) => x.count));
                  const pct = max === 0 ? 0 : Math.round((a.count / max) * 100);
                  return (
                    <li key={a.id} className="flex items-center gap-3">
                      <Avatar className="h-7 w-7">
                        {a.avatarUrl ? <AvatarImage src={a.avatarUrl} alt={a.name} /> : null}
                        <AvatarFallback className="text-[10px]">{getInitials(a.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-sysde-gray">{a.name}</span>
                          <span className="font-semibold text-sysde-gray">{a.count}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-sysde-bg">
                          <div
                            className="h-full rounded-full bg-sysde-red transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className={`rounded-lg p-3 ring-1 ring-sysde-border ${accent}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] opacity-70">{sub}</div>}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[180px] items-center justify-center text-sm text-sysde-mid">
      Sin datos para graficar.
    </div>
  );
}
