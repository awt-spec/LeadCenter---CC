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
