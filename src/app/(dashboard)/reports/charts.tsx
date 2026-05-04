'use client';

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

const COLORS = ['#C8200F', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#0EA5E9', '#14B8A6'];

export type StageDatum = { stage: string; count: number; value: number };
export type MonthDatum = { month: string; created: number; won: number; lost: number };
export type OutcomeDatum = { name: string; value: number; deals: number };
export type TopAccountDatum = { name: string; value: number };

function moneyFmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${n.toFixed(0)}`;
}

const tooltipStyle = {
  backgroundColor: 'white',
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  fontSize: 12,
  padding: '8px 12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

export function StageChart({ data }: { data: StageDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={moneyFmt} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v, name) => [`$${moneyFmt(Number(v))}`, name === 'value' ? 'Valor' : String(name)]}
        />
        <Bar dataKey="value" fill="#C8200F" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyChart({ data }: { data: MonthDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="created" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} name="Creadas" />
        <Line type="monotone" dataKey="won" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} name="Ganadas" />
        <Line type="monotone" dataKey="lost" stroke="#C8200F" strokeWidth={2} dot={{ r: 3 }} name="Perdidas" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function OutcomeChart({ data }: { data: OutcomeDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={50}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v, _n, p) => {
            const payload = (p as { payload?: OutcomeDatum })?.payload;
            return [
              `$${moneyFmt(Number(v))} · ${payload?.deals ?? 0} deals`,
              payload?.name ?? '',
            ];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopAccountsChart({ data }: { data: TopAccountDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 60, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={moneyFmt} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={110} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => `$${moneyFmt(Number(v))}`} />
        <Bar dataKey="value" fill="#3B82F6" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ===== New charts =====

export type VelocityDatum = { stage: string; avgDays: number; samples: number };
export type ActivityWeekDatum = { week: string; email: number; call: number; meeting: number; note: number };
export type EngagementBucket = { bucket: string; count: number };
export type SegmentDatum = { name: string; value: number };

export function VelocityChart({ data }: { data: VelocityDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} unit="d" />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v, _n, p) => {
            const payload = (p as { payload?: VelocityDatum })?.payload;
            return [`${v} días · ${payload?.samples ?? 0} muestras`, 'Promedio'];
          }}
        />
        <Bar dataKey="avgDays" fill="#F59E0B" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ActivityVolumeChart({ data }: { data: ActivityWeekDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="email" stackId="a" fill="#3B82F6" name="Emails" />
        <Bar dataKey="call" stackId="a" fill="#10B981" name="Llamadas" />
        <Bar dataKey="meeting" stackId="a" fill="#C8200F" name="Reuniones" />
        <Bar dataKey="note" stackId="a" fill="#94A3B8" name="Notas" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EngagementHistogram({ data }: { data: EngagementBucket[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [`${v} contactos (${total > 0 ? ((Number(v) / total) * 100).toFixed(1) : 0}%)`, 'Score']}
        />
        <Bar dataKey="count" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SegmentDonut({ data }: { data: SegmentDatum[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-xs text-sysde-mid">
        Sin datos
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
          {data.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v, _n, p) => {
            const payload = (p as { payload?: SegmentDatum })?.payload;
            return [`$${moneyFmt(Number(v))}`, payload?.name ?? ''];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Email funnel — horizontal bars showing sent → opened → clicked → replied
export type FunnelDatum = { label: string; value: number; pct: number; color: string };

export function EmailFunnel({ data }: { data: FunnelDatum[] }) {
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex justify-between text-xs">
            <span className="font-medium text-sysde-gray">{d.label}</span>
            <span className="tabular-nums text-sysde-mid">
              {d.value.toLocaleString('es-MX')}{' '}
              {d.pct > 0 && <span className="text-sysde-gray">({d.pct.toFixed(1)}%)</span>}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.min(100, d.pct)}%`, backgroundColor: d.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
