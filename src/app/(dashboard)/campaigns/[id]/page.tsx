import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Pencil, Calendar, Target, DollarSign, Users } from 'lucide-react';
import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/rbac';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { getCampaignById } from '@/lib/campaigns/queries';
import {
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_STYLE,
  CAMPAIGN_GOAL_LABELS,
  CAMPAIGN_CONTACT_STATUS_LABELS,
  CAMPAIGN_CONTACT_STATUS_STYLE,
} from '@/lib/campaigns/labels';
import {
  ContactStatusChart,
  OppByStageChart,
  FunnelChart,
} from '../components/campaign-charts';
import { FlowEditor } from '../components/flow-editor';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const STAGE_LABEL: Record<string, string> = {
  LEAD: 'Lead',
  DISCOVERY: 'Discovery',
  SIZING: 'Sizing',
  DEMO: 'Demo',
  PROPOSAL: 'Propuesta',
  NEGOTIATION: 'Negociación',
  CLOSING: 'Cierre',
  HANDOFF: 'Handoff',
  WON: 'Ganada',
  LOST: 'Perdida',
};

function moneyFmt(n: number, c = 'USD'): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M ${c}`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k ${c}`;
  return `$${n.toFixed(0)} ${c}`;
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const campaign = await getCampaignById(session, id);
  if (!campaign) notFound();

  const canEdit = hasRole(session, 'admin') || hasRole(session, 'senior_commercial');

  // Charts data
  const contactStatusMap = new Map<string, number>();
  for (const c of campaign.contacts) {
    contactStatusMap.set(c.status, (contactStatusMap.get(c.status) ?? 0) + 1);
  }
  const contactStatusData = Array.from(contactStatusMap.entries()).map(([k, v]) => ({
    name: CAMPAIGN_CONTACT_STATUS_LABELS[k] ?? k,
    value: v,
  }));

  const stageMap = new Map<string, { value: number; count: number }>();
  for (const o of campaign.opportunities) {
    const cur = stageMap.get(o.stage) ?? { value: 0, count: 0 };
    cur.value += o.estimatedValue ? Number(o.estimatedValue) : 0;
    cur.count += 1;
    stageMap.set(o.stage, cur);
  }
  const stageData = Array.from(stageMap.entries()).map(([k, v]) => ({
    stage: STAGE_LABEL[k] ?? k,
    value: v.value,
    count: v.count,
  }));

  const funnelData = [
    { stage: 'Enrolados', count: campaign._count.contacts },
    {
      stage: 'Activos',
      count: campaign.contacts.filter((c) => c.status === 'ACTIVE').length,
    },
    {
      stage: 'Respondió',
      count: campaign.contacts.filter((c) => c.status === 'REPLIED').length,
    },
    {
      stage: 'Convertido',
      count:
        campaign.contacts.filter((c) => c.status === 'CONVERTED').length +
        campaign._count.opportunities,
    },
  ];

  const totalPipeline = campaign.opportunities.reduce(
    (acc, o) => acc + (o.estimatedValue ? Number(o.estimatedValue) : 0),
    0
  );
  const wonValue = campaign.opportunities
    .filter((o) => o.status === 'WON')
    .reduce((acc, o) => acc + (o.estimatedValue ? Number(o.estimatedValue) : 0), 0);
  const wonCount = campaign.opportunities.filter((o) => o.status === 'WON').length;

  const roi =
    campaign.spent && Number(campaign.spent) > 0 && wonValue > 0
      ? ((wonValue / Number(campaign.spent)) * 100 - 100).toFixed(0)
      : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1 text-sm text-sysde-mid hover:text-sysde-gray"
      >
        <ChevronLeft className="h-4 w-4" />
        Campañas
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-semibold tracking-tight text-sysde-gray">
              {campaign.name}
            </h2>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium ring-1',
                CAMPAIGN_STATUS_STYLE[campaign.status]
              )}
            >
              {CAMPAIGN_STATUS_LABELS[campaign.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-sysde-mid">
            {CAMPAIGN_TYPE_LABELS[campaign.type]} · {CAMPAIGN_GOAL_LABELS[campaign.goal]}
            {campaign.code && ` · ${campaign.code}`}
          </p>
        </div>
        {canEdit && (
          <Button asChild variant="outline">
            <Link href={`/campaigns/${campaign.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card className="p-4">
          <Users className="h-4 w-4 text-sysde-mid" />
          <div className="mt-2 text-2xl font-semibold">{campaign._count.contacts}</div>
          <div className="text-xs text-sysde-mid">Contactos</div>
        </Card>
        <Card className="p-4">
          <Target className="h-4 w-4 text-sysde-mid" />
          <div className="mt-2 text-2xl font-semibold">{campaign._count.opportunities}</div>
          <div className="text-xs text-sysde-mid">Oportunidades</div>
        </Card>
        <Card className="p-4">
          <DollarSign className="h-4 w-4 text-sysde-mid" />
          <div className="mt-2 text-2xl font-semibold">{moneyFmt(totalPipeline, campaign.currency)}</div>
          <div className="text-xs text-sysde-mid">Pipeline</div>
        </Card>
        <Card className="p-4">
          <DollarSign className="h-4 w-4 text-emerald-600" />
          <div className="mt-2 text-2xl font-semibold">{moneyFmt(wonValue, campaign.currency)}</div>
          <div className="text-xs text-sysde-mid">Ganado · {wonCount} deals</div>
        </Card>
        <Card className="p-4">
          <Calendar className="h-4 w-4 text-sysde-mid" />
          <div className="mt-2 text-2xl font-semibold">
            {roi !== null ? `${roi}%` : '—'}
          </div>
          <div className="text-xs text-sysde-mid">ROI</div>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="flow">Flujo</TabsTrigger>
          <TabsTrigger value="contacts">Contactos ({campaign._count.contacts})</TabsTrigger>
          <TabsTrigger value="opps">Oportunidades ({campaign._count.opportunities})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <div className="mb-4">
                <h3 className="text-base font-semibold">Funnel</h3>
                <p className="text-xs text-sysde-mid">Recorrido del contacto.</p>
              </div>
              <FunnelChart data={funnelData} />
            </Card>

            <Card className="p-6">
              <div className="mb-4">
                <h3 className="text-base font-semibold">Distribución de contactos</h3>
                <p className="text-xs text-sysde-mid">Por estado dentro de la campaña.</p>
              </div>
              <ContactStatusChart data={contactStatusData} />
            </Card>

            <Card className="p-6 lg:col-span-2">
              <div className="mb-4">
                <h3 className="text-base font-semibold">Pipeline atribuido por fase</h3>
                <p className="text-xs text-sysde-mid">
                  Valor de las oportunidades que vienen de esta campaña.
                </p>
              </div>
              <OppByStageChart data={stageData} />
            </Card>
          </div>

          {campaign.description && (
            <Card className="p-6">
              <h3 className="mb-2 text-base font-semibold">Descripción</h3>
              <p className="whitespace-pre-wrap text-sm text-sysde-gray">{campaign.description}</p>
            </Card>
          )}

          <Card className="p-6">
            <h3 className="mb-3 text-base font-semibold">Configuración</h3>
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
              <Field label="Inicio" value={campaign.startDate ? format(campaign.startDate, "d LLL yyyy", { locale: es }) : '—'} />
              <Field label="Fin" value={campaign.endDate ? format(campaign.endDate, "d LLL yyyy", { locale: es }) : '—'} />
              <Field label="Owner" value={campaign.owner?.name ?? '—'} />
              <Field label="Presupuesto" value={moneyFmt(Number(campaign.budget ?? 0), campaign.currency)} />
              <Field label="Gastado" value={moneyFmt(Number(campaign.spent ?? 0), campaign.currency)} />
              <Field label="País objetivo" value={campaign.targetCountry ?? '—'} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="flow">
          <FlowEditor campaignId={campaign.id} steps={campaign.steps} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="contacts">
          <Card className="p-0">
            {campaign.contacts.length === 0 ? (
              <div className="p-10 text-center text-sm text-sysde-mid">
                Aún no hay contactos enrolados.
              </div>
            ) : (
              <div className="divide-y divide-sysde-border">
                {campaign.contacts.map((cc) => (
                  <Link
                    key={cc.contactId}
                    href={`/contacts/${cc.contactId}`}
                    className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-sysde-bg"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{cc.contact.fullName}</div>
                      <div className="truncate text-xs text-sysde-mid">{cc.contact.email}</div>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                        CAMPAIGN_CONTACT_STATUS_STYLE[cc.status]
                      )}
                    >
                      {CAMPAIGN_CONTACT_STATUS_LABELS[cc.status]}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="opps">
          <Card className="p-0">
            {campaign.opportunities.length === 0 ? (
              <div className="p-10 text-center text-sm text-sysde-mid">
                Sin oportunidades atribuidas.
              </div>
            ) : (
              <div className="divide-y divide-sysde-border">
                {campaign.opportunities.map((o) => (
                  <Link
                    key={o.id}
                    href={`/opportunities/${o.id}`}
                    className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-sysde-bg"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{o.name}</div>
                      <div className="truncate text-xs text-sysde-mid">
                        {o.account.name} · {STAGE_LABEL[o.stage]}
                      </div>
                    </div>
                    <span className="text-sm font-medium">
                      {moneyFmt(Number(o.estimatedValue ?? 0), o.currency)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-sysde-mid">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
