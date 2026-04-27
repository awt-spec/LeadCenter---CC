import Link from 'next/link';
import { Plus, Megaphone, Activity, CheckCircle2, Target } from 'lucide-react';
import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/rbac';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { listCampaigns, getCampaignStats } from '@/lib/campaigns/queries';
import { campaignFilterSchema } from '@/lib/campaigns/schemas';
import {
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_STYLE,
  CAMPAIGN_GOAL_LABELS,
} from '@/lib/campaigns/labels';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Campañas' };

function moneyFmt(n: number, c = 'USD'): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M ${c}`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k ${c}`;
  return `$${n.toFixed(0)} ${c}`;
}

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const filters = campaignFilterSchema.parse({});
  const [{ rows, total }, stats] = await Promise.all([
    listCampaigns(session, filters),
    getCampaignStats(session),
  ]);

  const canCreate = hasRole(session, 'admin') || hasRole(session, 'senior_commercial');

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-sysde-gray">Campañas</h2>
          <p className="mt-1 text-sm text-sysde-mid">
            {total.toLocaleString('es-CR')} campañas · {stats.active} activas · {stats.oppCount} oportunidades
            atribuidas
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/campaigns/new">
              <Plus className="mr-2 h-4 w-4" />
              Nueva campaña
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<Megaphone className="h-5 w-5 text-sysde-red" />}
          label="Total"
          value={stats.total.toString()}
        />
        <KpiCard
          icon={<Activity className="h-5 w-5 text-emerald-600" />}
          label="Activas"
          value={stats.active.toString()}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5 text-blue-600" />}
          label="Completadas"
          value={stats.completed.toString()}
        />
        <KpiCard
          icon={<Target className="h-5 w-5 text-amber-600" />}
          label="Opps atribuidas"
          value={stats.oppCount.toString()}
        />
      </div>

      {rows.length === 0 ? (
        <Card className="p-12 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-sysde-mid" />
          <h3 className="mt-4 text-base font-semibold">Aún no hay campañas</h3>
          <p className="mt-1 text-sm text-sysde-mid">
            Crea tu primera campaña para empezar a atribuir oportunidades a fuentes específicas.
          </p>
          {canCreate && (
            <Button asChild className="mt-4">
              <Link href="/campaigns/new">
                <Plus className="mr-2 h-4 w-4" />
                Nueva campaña
              </Link>
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => {
            const pipelineTotal = c.opportunities.reduce(
              (acc, o) => acc + (o.estimatedValue ? Number(o.estimatedValue) : 0),
              0
            );
            return (
              <Link key={c.id} href={`/campaigns/${c.id}`}>
                <Card className="group relative h-full p-5 transition-all hover:border-sysde-red/40 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-sysde-gray group-hover:text-sysde-red">
                        {c.name}
                      </h3>
                      {c.code && (
                        <p className="mt-0.5 font-mono text-[11px] text-sysde-mid">{c.code}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                        CAMPAIGN_STATUS_STYLE[c.status]
                      )}
                    >
                      {CAMPAIGN_STATUS_LABELS[c.status]}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-md bg-sysde-bg px-2 py-0.5 text-sysde-mid">
                      {CAMPAIGN_TYPE_LABELS[c.type]}
                    </span>
                    <span className="rounded-md bg-sysde-bg px-2 py-0.5 text-sysde-mid">
                      {CAMPAIGN_GOAL_LABELS[c.goal]}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-sysde-border pt-3">
                    <div>
                      <div className="text-base font-semibold text-sysde-gray">
                        {c._count.contacts}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-sysde-mid">
                        Contactos
                      </div>
                    </div>
                    <div>
                      <div className="text-base font-semibold text-sysde-gray">
                        {c._count.opportunities}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-sysde-mid">
                        Opps
                      </div>
                    </div>
                    <div>
                      <div className="text-base font-semibold text-sysde-gray">
                        {c._count.steps}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-sysde-mid">
                        Pasos
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-sysde-mid">
                    <span>{moneyFmt(pipelineTotal, c.currency)} pipeline</span>
                    {c.startDate && (
                      <span>
                        {formatDistanceToNow(c.startDate, { addSuffix: true, locale: es })}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-5">
      <div className="rounded-lg bg-sysde-bg p-2 inline-flex">{icon}</div>
      <div className="mt-3 text-2xl font-semibold text-sysde-gray">{value}</div>
      <div className="text-xs text-sysde-mid">{label}</div>
    </Card>
  );
}
