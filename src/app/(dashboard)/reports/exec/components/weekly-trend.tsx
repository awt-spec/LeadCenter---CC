'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeeklyTrend } from '@/lib/reports/exec-queries';

const tooltipStyle = {
  backgroundColor: 'white',
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  fontSize: 12,
  padding: '6px 10px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

export function WeeklyTrendChart({ data }: { data: WeeklyTrend[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis
          dataKey="week"
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
          formatter={(v) => [Number(v).toLocaleString('es'), '']}
        />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          iconType="line"
        />
        <Line
          type="monotone"
          dataKey="created"
          stroke="#3D3D3D"
          strokeWidth={2}
          dot={false}
          name="Creados"
        />
        <Line
          type="monotone"
          dataKey="won"
          stroke="#16a34a"
          strokeWidth={2}
          dot={false}
          name="Ganados"
        />
        <Line
          type="monotone"
          dataKey="lost"
          stroke="#C8200F"
          strokeWidth={2}
          dot={false}
          name="Perdidos"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
