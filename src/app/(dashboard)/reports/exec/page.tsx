import { Card } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { Forbidden } from '@/components/shared/forbidden';
import {
  getExecKPIs,
  getTopWonDeals,
  getTopOpenDeals,
  getDealsAtRisk,
  getTopPerformers,
  getPipelineFunnel,
  getWeeklyTrend,
  periodRange,
  type ExecPeriod,
} from '@/lib/reports/exec-queries';
import { PeriodSelector } from './components/period-selector';
import { ExecToolbar } from './components/exec-toolbar';
import { ExecKPIs } from './components/exec-kpis';
import { AIExecSummary } from './components/ai-exec-summary';
import {
  TopWonDeals,
  TopOpenDeals,
  DealsAtRisk,
} from './components/top-deals';
import { TopPerformers } from './components/top-performers';
import { FunnelViz } from './components/funnel-viz';
import { WeeklyTrendChart } from './components/weekly-trend';

export const metadata = { title: 'Brief ejecutivo · Reportes' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ period?: string }>;

const VALID_PERIODS: ExecPeriod[] = ['week', 'month', 'quarter', 'year'];

export default async function ExecReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  if (!can(session, 'reports:read:all') && !can(session, 'reports:read:own')) {
    return <Forbidden message="No tienes permiso para ver reportes." />;
  }

  const periodParam = sp.period as ExecPeriod | undefined;
  const period: ExecPeriod = VALID_PERIODS.includes(periodParam as ExecPeriod)
    ? (periodParam as ExecPeriod)
    : 'week';
  const range = periodRange(period);

  const [kpis, topWon, topOpen, atRisk, performers, funnel, trend] =
    await Promise.all([
      getExecKPIs(range),
      getTopWonDeals(range, 5),
      getTopOpenDeals(5),
      getDealsAtRisk(14, 5),
      getTopPerformers(range, 5),
      getPipelineFunnel(),
      getWeeklyTrend(12),
    ]);

  const periodLabel = range.label;
  const dateRangeLabel = `${range.start.toLocaleDateString('es', {
    day: '2-digit',
    month: 'short',
  })} – ${range.end.toLocaleDateString('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}`;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto print:max-w-none">
      {/* Hero */}
      <header className="bg-sysde-red text-white rounded-xl p-8 print:rounded-none print:p-6 -mx-4 sm:mx-0 print:mx-0">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.15em] opacity-80 mb-2">
              SYSDE · LeadCenter
            </div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight">
              Brief ejecutivo
            </h1>
            <p className="mt-2 text-sm opacity-90">
              {periodLabel} · {dateRangeLabel}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3 print:hidden">
            <PeriodSelector current={period} />
            <ExecToolbar />
          </div>
        </div>
      </header>

      {/* AI Summary — protagonist */}
      <AIExecSummary period={period} />

      {/* KPIs */}
      <section>
        <h2 className="text-[11px] uppercase tracking-wider text-sysde-mid mb-3">
          Métricas del período
        </h2>
        <ExecKPIs kpis={kpis} />
      </section>

      {/* Top deals: won + open */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TopWonDeals deals={topWon} />
        <TopOpenDeals deals={topOpen} />
      </div>

      {/* Deals at risk + Top performers */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DealsAtRisk deals={atRisk} />
        <TopPerformers performers={performers} />
      </div>

      {/* Funnel + trend */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <FunnelViz stages={funnel} />
        <Card className="p-5">
          <header className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-sysde-gray">
              Tendencia 12 semanas
            </h3>
            <span className="text-[10px] text-sysde-mid">
              creados / ganados / perdidos por semana
            </span>
          </header>
          {trend.length === 0 ? (
            <div className="text-sm text-sysde-mid text-center py-12">
              Sin datos suficientes.
            </div>
          ) : (
            <WeeklyTrendChart data={trend} />
          )}
        </Card>
      </div>

      {/* Footer */}
      <footer className="border-t border-sysde-border pt-6 text-center print:break-inside-avoid">
        <div className="text-[11px] text-sysde-mid">
          Generado el{' '}
          {new Date().toLocaleString('es', {
            dateStyle: 'long',
            timeStyle: 'short',
          })}{' '}
          · LeadCenter SYSDE Internacional
        </div>
        <div className="mt-1 text-[10px] text-sysde-mid italic">
          Brief generado por IA — los números son tomados directo de la base.
          Las recomendaciones son sugerencias, no decisiones automáticas.
        </div>
      </footer>
    </div>
  );
}
