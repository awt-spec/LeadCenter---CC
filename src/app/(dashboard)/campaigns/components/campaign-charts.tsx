'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#C8200F', '#8B5CF6', '#0EA5E9', '#14B8A6'];

const tooltipStyle = {
  backgroundColor: 'white',
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  fontSize: 12,
  padding: '8px 12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

function moneyFmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${n.toFixed(0)}`;
}

export function ContactStatusChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  if (!data.length) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-sysde-mid">
        Aún no hay contactos enrolados.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={88}
          innerRadius={48}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function OppByStageChart({
  data,
}: {
  data: { stage: string; value: number; count: number }[];
}) {
  if (!data.length) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-sysde-mid">
        Sin oportunidades atribuidas.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#64748B' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={moneyFmt}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v, _n, p) => {
            const item = (p as { payload?: { count: number } }).payload;
            return [`$${moneyFmt(Number(v))} · ${item?.count ?? 0} opp`, 'Valor'];
          }}
        />
        <Bar dataKey="value" fill="#C8200F" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FunnelChart({
  data,
}: {
  data: { stage: string; count: number }[];
}) {
  if (!data.length) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-sysde-mid">
        Sin datos del funnel.
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const pct = (d.count / max) * 100;
        return (
          <div key={d.stage}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-sysde-gray">{d.stage}</span>
              <span className="text-sysde-mid">{d.count}</span>
            </div>
            <div className="mt-1 h-3 overflow-hidden rounded-full bg-sysde-bg">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${
                    COLORS[(i + 1) % COLORS.length]
                  })`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
