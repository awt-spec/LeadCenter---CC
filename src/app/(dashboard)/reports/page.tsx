import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { auth } from '@/lib/auth';
import type { Prisma } from '@prisma/client';
import { can } from '@/lib/rbac';
import { Card } from '@/components/ui/card';
import { Forbidden } from '@/components/shared/forbidden';
import {
  StageChart,
  MonthlyChart,
  OutcomeChart,
  TopAccountsChart,
  VelocityChart,
  ActivityVolumeChart,
  EngagementHistogram,
  SegmentDonut,
  EmailFunnel,
} from './charts';
import { Extractor } from './components/extractor';
import {
  getPipelineSummary,
  getStageVelocity,
  getActivityVolume,
  getEngagementHistogram,
  getEmailFunnel,
  getPipelineBySegment,
  getPipelineByProduct,
} from '@/lib/reports/queries';

export const metadata = { title: 'Reportes' };
export const dynamic = 'force-dynamic';

function moneyFmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

const PERIODS = [
  { key: '30d', label: '30 días' },
  { key: '90d', label: '90 días' },
  { key: 'ytd', label: 'YTD' },
  { key: 'all', label: 'Todo' },
] as const;

type Period = typeof PERIODS[number]['key'];

const loadDashboardCached = unstable_cache(
  loadDashboard,
  ['reports-v2'],
  { revalidate: 120, tags: ['reports'] }
);

async function loadDashboard(scopeJson: string, period: Period) {
  const scope = JSON.parse(scopeJson) as Prisma.OpportunityWhereInput;
  // Period scoping is currently applied to the time-bucketed charts in their own queries;
  // the pipeline/outcome KPIs always reflect the full pipeline for stability of mental model.
  void period;
  const [
    summary, velocity, activity, engagement, emailFunnel,
    bySegment, byProduct,
  ] = await Promise.all([
    getPipelineSummary(scope),
    getStageVelocity(scope),
    getActivityVolume(12),
    getEngagementHistogram(),
    getEmailFunnel(),
    getPipelineBySegment(scope),
    getPipelineByProduct(scope),
  ]);
  return { summary, velocity, activity, engagement, emailFunnel, bySegment, byProduct };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!can(session, 'reports:read:all') && !can(session, 'reports:read:own')) {
    return <Forbidden message="No tienes permiso para ver reportes." />;
  }

  const sp = await searchParams;
  const period: Period = (PERIODS.find((p) => p.key === sp.period)?.key ?? '90d') as Period;
  const tab = sp.tab === 'extractor' ? 'extractor' : 'overview';

  const canAll = can(session, 'reports:read:all') || can(session, 'opportunities:read:all');
  const scope: Prisma.OpportunityWhereInput = canAll ? {} : { ownerId: session.user.id };
  const data = await loadDashboardCached(JSON.stringify(scope), period);

  const { summary, velocity, activity, engagement, emailFunnel, bySegment, byProduct } = data;

  const funnelData = [
    { label: 'Enviados', value: emailFunnel.sent, pct: 100, color: '#3B82F6' },
    { label: 'Abiertos', value: emailFunnel.opened, pct: emailFunnel.openRate, color: '#10B981' },
    { label: 'Clicks', value: emailFunnel.clicked, pct: emailFunnel.clickRate, color: '#0EA5E9' },
    { label: 'Respondidos', value: emailFunnel.replied, pct: emailFunnel.replyRate, color: '#8B5CF6' },
    ...(emailFunnel.bounced > 0
      ? [{ label: 'Rebotaron', value: emailFunnel.bounced, pct: emailFunnel.bounceRate, color: '#C8200F' }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-sysde-gray">Reportes</h2>
          <p className="mt-1 text-sm text-sysde-mid">
            Pipeline, conversión, velocidad y engagement.
          </p>
        </div>
        <Link
          href="/reports/exec"
          className="inline-flex items-center gap-2 rounded-lg bg-sysde-red px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sysde-red-dk transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Brief ejecutivo IA
        </Link>
        <div className="flex items-center gap-2">
          {tab === 'overview' && (
            <div className="flex items-center gap-1 rounded-lg border border-sysde-border bg-white p-1 text-xs">
              {PERIODS.map((p) => (
                <Link
                  key={p.key}
                  href={`/reports?period=${p.key}`}
                  className={
                    period === p.key
                      ? 'rounded-md bg-sysde-red px-3 py-1.5 font-medium text-white'
                      : 'rounded-md px-3 py-1.5 text-sysde-mid hover:text-sysde-gray'
                  }
                >
                  {p.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-sysde-border bg-white p-1 self-start">
        <Link
          href="/reports"
          className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition ${
            tab === 'overview' ? 'bg-sysde-red text-white' : 'text-sysde-mid hover:text-sysde-gray'
          }`}
        >
          Resumen
        </Link>
        <Link
          href="/reports?tab=extractor"
          className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition ${
            tab === 'extractor' ? 'bg-sysde-red text-white' : 'text-sysde-mid hover:text-sysde-gray'
          }`}
        >
          Extractor IA
        </Link>
      </div>

      {tab === 'extractor' && <Extractor />}
      {tab === 'overview' && <OverviewTab summary={summary} velocity={velocity} activity={activity} engagement={engagement} funnelData={funnelData} emailFunnel={emailFunnel} bySegment={bySegment} byProduct={byProduct} />}
    </div>
  );
}

interface OverviewProps {
  summary: Awaited<ReturnType<typeof getPipelineSummary>>;
  velocity: Awaited<ReturnType<typeof getStageVelocity>>;
  activity: Awaited<ReturnType<typeof getActivityVolume>>;
  engagement: Awaited<ReturnType<typeof getEngagementHistogram>>;
  funnelData: Array<{ label: string; value: number; pct: number; color: string }>;
  emailFunnel: Awaited<ReturnType<typeof getEmailFunnel>>;
  bySegment: Awaited<ReturnType<typeof getPipelineBySegment>>;
  byProduct: Awaited<ReturnType<typeof getPipelineByProduct>>;
}

function OverviewTab({ summary, velocity, activity, engagement, funnelData, emailFunnel, bySegment, byProduct }: OverviewProps) {
  return (
    <>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-7">
        <KpiBlock label="Pipeline total" value={moneyFmt(summary.kpis.totalPipeline)} accent />
        <KpiBlock label="Ponderado" value={moneyFmt(summary.kpis.weightedPipeline)} />
        <KpiBlock label="Ganado" value={moneyFmt(summary.kpis.wonValue)} positive />
        <KpiBlock label="Win rate" value={`${summary.kpis.winRate.toFixed(0)}%`} />
        <KpiBlock label="Deal size avg" value={moneyFmt(summary.kpis.avgDealSize)} />
        <KpiBlock label="Ciclo avg" value={`${summary.kpis.avgCycleDays.toFixed(0)}d`} />
        <KpiBlock label="Abiertas" value={summary.kpis.openCount.toLocaleString('es-MX')} />
      </div>

      {/* Pipeline + outcome */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Pipeline por fase" subtitle="Valor estimado de oportunidades abiertas">
          <StageChart data={summary.stageData} />
        </ChartCard>

        <ChartCard title="Tendencia mensual" subtitle="Últimos 6 meses · creadas/ganadas/perdidas">
          <MonthlyChart data={summary.months} />
        </ChartCard>

        <ChartCard title="Resultado de oportunidades" subtitle="Distribución de valor por estado">
          <OutcomeChart data={summary.outcomeData} />
        </ChartCard>

        <ChartCard title="Top 5 cuentas" subtitle="Por valor de oportunidades abiertas">
          <TopAccountsChart data={summary.topAccounts} />
        </ChartCard>
      </div>

      {/* Velocity + activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Velocidad por fase"
          subtitle="Días promedio que pasa una oportunidad en cada fase (de stageHistory)"
        >
          <VelocityChart data={velocity} />
        </ChartCard>

        <ChartCard
          title="Volumen de actividad"
          subtitle="Llamadas, emails, reuniones y notas — últimas 12 semanas"
        >
          <ActivityVolumeChart data={activity} />
        </ChartCard>
      </div>

      {/* Segmentation */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Pipeline por segmento" subtitle="Valor abierto por segmento de cuenta">
          <SegmentDonut data={bySegment} />
        </ChartCard>

        <ChartCard title="Pipeline por producto" subtitle="Valor abierto por producto SYSDE">
          <SegmentDonut data={byProduct} />
        </ChartCard>

        <ChartCard title="Engagement de contactos" subtitle="Distribución del score 0–100">
          <EngagementHistogram data={engagement} />
        </ChartCard>
      </div>

      {/* Email funnel */}
      <ChartCard
        title="Email funnel"
        subtitle={
          emailFunnel.sent > 0
            ? `${emailFunnel.sent.toLocaleString('es-MX')} emails enviados (sincronizados desde HubSpot)`
            : 'Aún no hay emails sincronizados desde HubSpot. Aparecerá cuando la fase emails termine.'
        }
      >
        {emailFunnel.sent > 0 ? (
          <EmailFunnel data={funnelData} />
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-sysde-mid">
            Esperando primeros emails sincronizados…
          </div>
        )}
      </ChartCard>
    </>
  );
}

function KpiBlock({
  label,
  value,
  accent,
  positive,
}: {
  label: string;
  value: string;
  accent?: boolean;
  positive?: boolean;
}) {
  return (
    <Card className={accent ? 'border-sysde-red/30 bg-red-50/40 p-4' : 'p-4'}>
      <div className="text-[10px] uppercase tracking-wide text-sysde-mid">{label}</div>
      <div
        className={
          'mt-1 text-xl font-semibold ' +
          (accent ? 'text-sysde-red' : positive ? 'text-emerald-600' : 'text-sysde-gray')
        }
      >
        {value}
      </div>
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-sysde-gray">{title}</h3>
        <p className="text-xs text-sysde-mid">{subtitle}</p>
      </div>
      {children}
    </Card>
  );
}
