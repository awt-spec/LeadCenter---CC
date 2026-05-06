'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  DailyAuditDatum,
  ResourceDatum,
  UserActivityDatum,
} from '@/lib/audit/queries';
import { RESOURCE_LABEL } from './labels';

const PALETTE = ['#C8200F', '#A81C0C', '#3D3D3D', '#888880', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

const tooltipStyle = {
  backgroundColor: 'white',
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  fontSize: 12,
  padding: '6px 10px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

export function DailyActivityChart({ data }: { data: DailyAuditDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="dailyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C8200F" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#C8200F" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: '#888880' }}
          tickFormatter={(d: string) => d.slice(5)}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#888880' }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(d) => String(d)}
          formatter={(v) => [Number(v).toLocaleString('es'), 'Acciones']}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#C8200F"
          strokeWidth={2}
          fill="url(#dailyGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TopUsersChart({ data }: { data: UserActivityDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#888880' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: '#3D3D3D' }}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [Number(v).toLocaleString('es'), 'Acciones']}
        />
        <Bar dataKey="count" fill="#C8200F" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ResourceDonut({ data }: { data: ResourceDatum[] }) {
  const trimmed = data.slice(0, 7);
  const rest = data.slice(7).reduce((acc, r) => acc + r.count, 0);
  const slices: Array<{ name: string; count: number }> = [
    ...trimmed.map((r) => ({
      name: RESOURCE_LABEL[r.resource] ?? r.resource,
      count: r.count,
    })),
  ];
  if (rest > 0) slices.push({ name: 'Otros', count: rest });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="count"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={80}
          paddingAngle={2}
        >
          {slices.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v, name) => [Number(v).toLocaleString('es'), String(name)]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
