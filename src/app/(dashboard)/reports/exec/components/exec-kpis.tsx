import { Card } from '@/components/ui/card';
import {
  ArrowUp,
  ArrowDown,
  Minus,
  TrendingUp,
  Trophy,
  Target,
  Activity,
  DollarSign,
  Briefcase,
  Clock,
} from 'lucide-react';
import type { ExecKPIs } from '@/lib/reports/exec-queries';

function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function DeltaPill({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-sysde-mid">
        <Minus className="h-3 w-3" /> sin base
      </span>
    );
  }
  const sign = pct > 0 ? '+' : '';
  const small = Math.abs(pct) < 5;
  const color = small
    ? 'text-sysde-mid bg-sysde-bg'
    : pct > 0
      ? 'text-green-700 bg-green-50'
      : 'text-amber-700 bg-amber-50';
  const Icon = small ? Minus : pct > 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold rounded px-1.5 py-0.5 ${color}`}
      title="vs período anterior"
    >
      <Icon className="h-3 w-3" />
      {sign}
      {pct.toFixed(0)}%
    </span>
  );
}

function Big({
  icon,
  label,
  value,
  sub,
  delta,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`p-5 ${highlight ? 'bg-sysde-red text-white border-sysde-red' : ''}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div
          className={`flex items-center gap-2 text-[11px] uppercase tracking-wider ${
            highlight ? 'text-white/80' : 'text-sysde-mid'
          }`}
        >
          <span className={highlight ? 'text-white' : 'text-sysde-red'}>{icon}</span>
          {label}
        </div>
        {delta !== undefined ? <DeltaPill pct={delta} /> : null}
      </div>
      <div
        className={`text-3xl font-bold ${highlight ? 'text-white' : 'text-sysde-gray'}`}
      >
        {value}
      </div>
      {sub ? (
        <div
          className={`mt-1 text-xs ${highlight ? 'text-white/80' : 'text-sysde-mid'}`}
        >
          {sub}
        </div>
      ) : null}
    </Card>
  );
}

export function ExecKPIs({ kpis }: { kpis: ExecKPIs }) {
  return (
    <div className="space-y-3">
      {/* Hero row: Won + Pipeline */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
        <Big
          icon={<Trophy className="h-5 w-5" />}
          label="Cerrado en el período"
          value={fmtUSD(kpis.wonValue)}
          sub={`${kpis.wonCount} deal${kpis.wonCount === 1 ? '' : 's'} ganado${kpis.wonCount === 1 ? '' : 's'} · win-rate ${kpis.winRate.toFixed(0)}%`}
          delta={kpis.deltaWonValue}
          highlight
        />
        <Big
          icon={<TrendingUp className="h-5 w-5" />}
          label="Pipeline ponderado"
          value={fmtUSD(kpis.pipelineWeighted)}
          sub={`${fmtUSD(kpis.pipelineTotal)} total · ${kpis.openCount} opp abiertas`}
        />
      </div>

      {/* Secondary KPIs row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Big
          icon={<Target className="h-4 w-4" />}
          label="Deals nuevos"
          value={kpis.newDealsCount.toString()}
          sub={kpis.newDealsValue > 0 ? `${fmtUSD(kpis.newDealsValue)} en pipeline` : ''}
          delta={kpis.deltaNewDeals}
        />
        <Big
          icon={<DollarSign className="h-4 w-4" />}
          label="Ticket promedio"
          value={fmtUSD(kpis.avgDealSize)}
          sub={kpis.wonCount > 0 ? `de ${kpis.wonCount} deals` : 'sin deals cerrados'}
        />
        <Big
          icon={<Clock className="h-4 w-4" />}
          label="Ciclo promedio"
          value={kpis.avgCycleDays > 0 ? `${Math.round(kpis.avgCycleDays)}d` : '—'}
          sub="creación → cierre"
        />
        <Big
          icon={<Activity className="h-4 w-4" />}
          label="Actividad"
          value={kpis.activitiesCount.toString()}
          sub="interacciones registradas"
          delta={kpis.deltaActivities}
        />
      </div>

      {/* Win rate explicit */}
      <div className="grid gap-3 grid-cols-1 lg:grid-cols-3">
        <Big
          icon={<Briefcase className="h-4 w-4" />}
          label="Win rate"
          value={`${kpis.winRate.toFixed(1)}%`}
          sub={`${kpis.wonCount} ganados · ${kpis.lostCount} perdidos`}
          delta={kpis.deltaWinRate}
        />
        <Big
          icon={<Trophy className="h-4 w-4" />}
          label="Perdido"
          value={fmtUSD(kpis.lostValue)}
          sub={`${kpis.lostCount} deal${kpis.lostCount === 1 ? '' : 's'} caído${kpis.lostCount === 1 ? '' : 's'}`}
        />
        <Big
          icon={<TrendingUp className="h-4 w-4" />}
          label="Forecast del pipeline"
          value={fmtUSD(kpis.pipelineWeighted)}
          sub="ponderado por probabilidad de stage"
        />
      </div>
    </div>
  );
}
