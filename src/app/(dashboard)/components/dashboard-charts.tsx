'use client';

import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PipelineByStagePoint, ActivityWeekPoint, WinRatePoint } from '@/lib/dashboard/charts';

const SYSDE_RED = '#C8200F';
const SYSDE_RED_DK = '#A81C0C';
const SYSDE_GRAY = '#3D3D3D';
const SYSDE_MID = '#888880';

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

export function PipelineFunnelChart({ data }: { data: PipelineByStagePoint[] }) {
  if (data.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Pipeline por etapa</CardTitle>
        <p className="text-xs text-sysde-mid">Volumen y valor weighted por probabilidad</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
            <XAxis type="number" tickFormatter={fmtMoney} tick={{ fill: SYSDE_MID, fontSize: 11 }} />
            <YAxis type="category" dataKey="label" width={140} tick={{ fill: SYSDE_GRAY, fontSize: 11 }} />
            <Tooltip
              formatter={(value, name) => {
                const v = Number(value ?? 0);
                if (name === 'count') return [v, 'Deals'];
                if (name === 'weighted') return [`USD ${fmtMoney(v)}`, 'Weighted'];
                return [`USD ${fmtMoney(v)}`, 'Total'];
              }}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="value" name="Total" fill={SYSDE_RED} radius={[0, 3, 3, 0]} />
            <Bar dataKey="weighted" name="Weighted" fill={SYSDE_RED_DK} radius={[0, 3, 3, 0]} opacity={0.6} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ActivityWeeksChart({ data }: { data: ActivityWeekPoint[] }) {
  if (data.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Actividad por semana</CardTitle>
        <p className="text-xs text-sysde-mid">Emails / Llamadas / Reuniones / Notas — últimas {data.length} semanas</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="weekLabel" tick={{ fill: SYSDE_MID, fontSize: 11 }} />
            <YAxis tick={{ fill: SYSDE_MID, fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="emails" name="Emails" stroke={SYSDE_RED} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="calls" name="Llamadas" stroke="#F59E0B" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="meetings" name="Reuniones" stroke="#10B981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="notes" name="Notas" stroke={SYSDE_MID} strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function WinRateChart({ data }: { data: WinRatePoint[] }) {
  if (data.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Win rate por trimestre</CardTitle>
        <p className="text-xs text-sysde-mid">Ganados vs perdidos · % cierre</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="quarter" tick={{ fill: SYSDE_MID, fontSize: 11 }} />
            <YAxis tick={{ fill: SYSDE_MID, fontSize: 11 }} />
            <Tooltip
              formatter={(value, name) => {
                const v = Number(value ?? 0);
                if (name === 'rate') return [`${v}%`, 'Win rate'];
                return [v, name === 'won' ? 'Ganados' : 'Perdidos'];
              }}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="won" stackId="a" name="Ganados" fill="#10B981" />
            <Bar dataKey="lost" stackId="a" name="Perdidos" fill={SYSDE_MID}>
              {data.map((_, i) => <Cell key={i} fill={SYSDE_MID} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
