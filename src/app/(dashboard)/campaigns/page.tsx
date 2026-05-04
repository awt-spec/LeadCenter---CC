import Link from 'next/link';
import { Plus, Megaphone, Activity, CheckCircle2, Target } from 'lucide-react';
import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/rbac';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { listCampaigns, getCampaignStats } from '@/lib/campaigns/queries';
import { campaignFilterSchema, CAMPAIGN_STATUSES, CAMPAIGN_TYPES } from '@/lib/campaigns/schemas';
import {
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_STYLE,
  CAMPAIGN_GOAL_LABELS,
} from '@/lib/campaigns/labels';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CampaignsFilterBar } from './components/campaigns-filter-bar';
import { CampaignQuickActions } from './components/campaign-quick-actions';

export const metadata = { title: 'Campañas' };
export const dynamic = 'force-dynamic';

function moneyFmt(n: number, c = 'USD'): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M ${c}`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k ${c}`;
  return `$${n.toFixed(0)} ${c}`;
}

type AnyStatus = (typeof CAMPAIGN_STATUSES)[number];
type AnyType = (typeof CAMPAIGN_TYPES)[number];

function isValidStatus(s: string | undefined): s is AnyStatus {
  return !!s && (CAMPAIGN_STATUSES as readonly string[]).includes(s);
}
function isValidType(s: string | undefined): s is AnyType {
  return !!s && (CAMPAIGN_TYPES as readonly string[]).includes(s);
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const sp = await searchParams;
  const filters = campaignFilterSchema.parse({
    q: sp.q || undefined,
    status: isValidStatus(sp.status) ? [sp.status] : undefined,
    type: isValidType(sp.type) ? [sp.type] : undefined,
    page: sp.page ? Number(sp.page) : 1,
  });

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
            {stats.total.toLocaleString('es-CR')} totales · {stats.active} activas · {stats.oppCount} opps atribuidas
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
        <KpiCard icon={<Megaphone className="h-5 w-5 text-sysde-red" />} label="Total" value={stats.total.toString()} />
        <KpiCard icon={<Activity className="h-5 w-5 text-emerald-600" />} label="Activas" value={stats.active.toString()} />
        <KpiCard icon={<CheckCircle2 className="h-5 w-5 text-blue-600" />} label="Completadas" value={stats.completed.toString()} />
        <KpiCard icon={<Target className="h-5 w-5 text-amber-600" />} label="Opps atribuidas" value={stats.oppCount.toString()} />
      </div>

      <CampaignsFilterBar
        initialQ={sp.q ?? ''}
        initialStatus={sp.status ?? ''}
        initialType={sp.type ?? ''}
        totalShown={total}
      />

      {rows.length === 0 ? (
        <Card className="p-12 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-sysde-mid" />
          <h3 className="mt-4 text-base font-semibold">
            {sp.q || sp.status || sp.type ? 'Sin resultados' : 'Aún no hay campañas'}
          </h3>
          <p className="mt-1 text-sm text-sysde-mid">
            {sp.q || sp.status || sp.type
              ? 'Probá ajustar los filtros o limpiarlos.'
              : 'Crea tu primera campaña para empezar a atribuir oportunidades a fuentes específicas.'}
          </p>
          {canCreate && !sp.q && !sp.status && !sp.type && (
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
            const totalContacts = c._count.contacts;
            const cs = c.contactStatuses ?? {};
            const active = cs.ACTIVE ?? 0;
            const completed = cs.COMPLETED ?? 0;
            const paused = cs.PAUSED ?? 0;
            const dropped = (cs.UNSUBSCRIBED ?? 0) + (cs.BOUNCED ?? 0);

            return (
              <Card
                key={c.id}
                className="group relative h-full overflow-hidden p-5 transition-all hover:border-sysde-red/40 hover:shadow-md"
              >
                <Link
                  href={`/campaigns/${c.id}`}
                  className="absolute inset-0"
                  aria-label={`Abrir ${c.name}`}
                />

                <div className="relative flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-sysde-gray group-hover:text-sysde-red">
                      {c.name}
                    </h3>
                    {c.code && <p className="mt-0.5 font-mono text-[11px] text-sysde-mid">{c.code}</p>}
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                      CAMPAIGN_STATUS_STYLE[c.status]
                    )}
                  >
                    {CAMPAIGN_STATUS_LABELS[c.status]}
                  </span>
                  <div className="relative z-10">
                    <CampaignQuickActions campaignId={c.id} status={c.status} />
                  </div>
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
                  <Stat value={c._count.contacts} label="Contactos" />
                  <Stat value={c._count.opportunities} label="Opps" />
                  <Stat value={c._count.steps} label="Pasos" />
                </div>

                {/* Engagement bar — distribución por status del CampaignContact */}
                {totalContacts > 0 && (
                  <div className="mt-3 border-t border-sysde-border pt-3">
                    <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-sysde-mid">
                      <span>Engagement</span>
                      <span className="tabular-nums normal-case text-sysde-gray">
                        {Math.round(((completed + active) / totalContacts) * 100)}% activos+completados
                      </span>
                    </div>
                    <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-neutral-100">
                      {active > 0 && (
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${(active / totalContacts) * 100}%` }}
                          title={`Activos: ${active}`}
                        />
                      )}
                      {completed > 0 && (
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${(completed / totalContacts) * 100}%` }}
                          title={`Completados: ${completed}`}
                        />
                      )}
                      {paused > 0 && (
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${(paused / totalContacts) * 100}%` }}
                          title={`Pausados: ${paused}`}
                        />
                      )}
                      {dropped > 0 && (
                        <div
                          className="h-full bg-red-500"
                          style={{ width: `${(dropped / totalContacts) * 100}%` }}
                          title={`Bajas: ${dropped}`}
                        />
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between text-xs text-sysde-mid">
                  <span>{moneyFmt(pipelineTotal, c.currency)} pipeline</span>
                  {c.startDate && (
                    <span>{formatDistanceToNow(c.startDate, { addSuffix: true, locale: es })}</span>
                  )}
                </div>
              </Card>
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

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-base font-semibold text-sysde-gray">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-sysde-mid">{label}</div>
    </div>
  );
}
