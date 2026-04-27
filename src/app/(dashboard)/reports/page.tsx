import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { can } from '@/lib/rbac';
import { Card } from '@/components/ui/card';
import { Forbidden } from '@/components/shared/forbidden';
import { STAGE_PROBABILITY } from '@/lib/opportunities/stage-rules';
import {
  StageChart,
  MonthlyChart,
  OutcomeChart,
  TopAccountsChart,
  type StageDatum,
  type MonthDatum,
  type OutcomeDatum,
  type TopAccountDatum,
} from './charts';

export const metadata = { title: 'Reportes' };

const STAGE_LABEL: Record<string, string> = {
  LEAD: 'Lead',
  DISCOVERY: 'Discovery',
  SIZING: 'Sizing',
  DEMO: 'Demo',
  PROPOSAL: 'Propuesta',
  NEGOTIATION: 'Negociación',
  CLOSING: 'Cierre',
  HANDOFF: 'Handoff',
};

const PIPELINE_STAGES = ['LEAD', 'DISCOVERY', 'SIZING', 'DEMO', 'PROPOSAL', 'NEGOTIATION', 'CLOSING', 'HANDOFF'] as const;

function moneyFmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

async function loadReports(userId: string, canAll: boolean) {
  const scope = canAll ? {} : { ownerId: userId };

  const [allOpps, allAccounts] = await Promise.all([
    prisma.opportunity.findMany({
      where: scope,
      select: {
        stage: true,
        status: true,
        estimatedValue: true,
        createdAt: true,
        closedAt: true,
        accountId: true,
        account: { select: { name: true } },
      },
    }),
    prisma.account.findMany({
      where: scope,
      select: { id: true, name: true },
    }),
  ]);

  const stageMap = new Map<string, { count: number; value: number }>();
  for (const s of PIPELINE_STAGES) stageMap.set(s, { count: 0, value: 0 });
  for (const o of allOpps) {
    if (o.status !== 'OPEN') continue;
    const cur = stageMap.get(o.stage);
    if (!cur) continue;
    cur.count += 1;
    cur.value += o.estimatedValue ? Number(o.estimatedValue) : 0;
  }
  const stageData: StageDatum[] = PIPELINE_STAGES.map((s) => ({
    stage: STAGE_LABEL[s] ?? s,
    count: stageMap.get(s)?.count ?? 0,
    value: stageMap.get(s)?.value ?? 0,
  }));

  const now = new Date();
  const months: MonthDatum[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    let created = 0,
      won = 0,
      lost = 0;
    for (const o of allOpps) {
      if (o.createdAt >= d && o.createdAt < next) created += 1;
      if (o.closedAt && o.closedAt >= d && o.closedAt < next) {
        if (o.status === 'WON') won += 1;
        else if (o.status === 'LOST') lost += 1;
      }
    }
    months.push({
      month: d.toLocaleDateString('es-CR', { month: 'short' }),
      created,
      won,
      lost,
    });
  }

  let wonValue = 0,
    lostValue = 0,
    openValue = 0,
    wonDeals = 0,
    lostDeals = 0,
    openDeals = 0;
  for (const o of allOpps) {
    const v = o.estimatedValue ? Number(o.estimatedValue) : 0;
    if (o.status === 'WON') {
      wonValue += v;
      wonDeals += 1;
    } else if (o.status === 'LOST') {
      lostValue += v;
      lostDeals += 1;
    } else if (o.status === 'OPEN') {
      openValue += v;
      openDeals += 1;
    }
  }
  const outcomeData: OutcomeDatum[] = [
    { name: 'Abiertas', value: openValue, deals: openDeals },
    { name: 'Ganadas', value: wonValue, deals: wonDeals },
    { name: 'Perdidas', value: lostValue, deals: lostDeals },
  ].filter((d) => d.value > 0);

  const accountTotals = new Map<string, number>();
  for (const o of allOpps) {
    if (o.status !== 'OPEN') continue;
    const v = o.estimatedValue ? Number(o.estimatedValue) : 0;
    accountTotals.set(o.accountId, (accountTotals.get(o.accountId) ?? 0) + v);
  }
  const topAccounts: TopAccountDatum[] = Array.from(accountTotals.entries())
    .map(([id, value]) => ({
      name: allAccounts.find((a) => a.id === id)?.name ?? '—',
      value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .reverse();

  let totalPipeline = 0;
  let weightedPipeline = 0;
  for (const o of allOpps) {
    if (o.status !== 'OPEN') continue;
    const v = o.estimatedValue ? Number(o.estimatedValue) : 0;
    totalPipeline += v;
    weightedPipeline += v * (STAGE_PROBABILITY[o.stage] / 100);
  }
  const winRate =
    wonDeals + lostDeals > 0 ? (wonDeals / (wonDeals + lostDeals)) * 100 : 0;

  return {
    stageData,
    months,
    outcomeData,
    topAccounts,
    totalPipeline,
    weightedPipeline,
    wonValue,
    winRate,
  };
}

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!can(session, 'reports:read:all') && !can(session, 'reports:read:own')) {
    return <Forbidden message="No tienes permiso para ver reportes." />;
  }

  const canAll = can(session, 'reports:read:all') || can(session, 'opportunities:read:all');
  const data = await loadReports(session.user.id, canAll);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-sysde-gray">Reportes</h2>
        <p className="mt-1 text-sm text-sysde-mid">
          Visión global del pipeline, conversión y top cuentas.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiBlock label="Pipeline total" value={moneyFmt(data.totalPipeline)} />
        <KpiBlock label="Ponderado" value={moneyFmt(data.weightedPipeline)} />
        <KpiBlock label="Ganado YTD" value={moneyFmt(data.wonValue)} />
        <KpiBlock label="Win rate" value={`${data.winRate.toFixed(0)}%`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Pipeline por fase" subtitle="Valor estimado de oportunidades abiertas">
          <StageChart data={data.stageData} />
        </ChartCard>

        <ChartCard title="Tendencia mensual" subtitle="Últimos 6 meses">
          <MonthlyChart data={data.months} />
        </ChartCard>

        <ChartCard title="Resultado de oportunidades" subtitle="Distribución de valor por estado">
          <OutcomeChart data={data.outcomeData} />
        </ChartCard>

        <ChartCard title="Top 5 cuentas" subtitle="Por valor de oportunidades abiertas">
          <TopAccountsChart data={data.topAccounts} />
        </ChartCard>
      </div>
    </div>
  );
}

function KpiBlock({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wide text-sysde-mid">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-sysde-gray">{value}</div>
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
