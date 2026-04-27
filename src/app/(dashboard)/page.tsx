import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { can } from '@/lib/rbac';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Building2,
  Target,
  TrendingUp,
  ArrowUpRight,
  Clock,
  Activity as ActivityIcon,
} from 'lucide-react';
import { STAGE_PROBABILITY } from '@/lib/opportunities/stage-rules';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const metadata = { title: 'Dashboard' };

function formatMoney(n: number, currency = 'USD'): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${currency}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k ${currency}`;
  return `${n.toFixed(0)} ${currency}`;
}

async function loadDashboardData(userId: string, canReadAll: boolean) {
  const ownerScope = canReadAll ? {} : { ownerId: userId };

  const [
    contactsCount,
    accountsCount,
    openOpps,
    weeklyActivities,
    pipelineRows,
    upcomingActions,
    recentActivities,
  ] = await Promise.all([
    prisma.contact.count({ where: { status: { not: 'ARCHIVED' }, ...ownerScope } }),
    prisma.account.count({ where: ownerScope }),
    prisma.opportunity.count({ where: { status: 'OPEN', ...ownerScope } }),
    prisma.activity.count({
      where: {
        occurredAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        ...(canReadAll ? {} : { createdById: userId }),
      },
    }),
    prisma.opportunity.findMany({
      where: { status: 'OPEN', ...ownerScope },
      select: { stage: true, estimatedValue: true },
    }),
    prisma.opportunity.findMany({
      where: {
        status: 'OPEN',
        nextActionDate: { not: null, lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        ...ownerScope,
      },
      orderBy: { nextActionDate: 'asc' },
      take: 6,
      select: {
        id: true,
        name: true,
        nextActionDate: true,
        nextActionNote: true,
        stage: true,
        account: { select: { name: true } },
      },
    }),
    prisma.activity.findMany({
      where: canReadAll ? {} : { createdById: userId },
      orderBy: { occurredAt: 'desc' },
      take: 8,
      select: {
        id: true,
        type: true,
        subject: true,
        occurredAt: true,
        opportunity: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  let totalPipeline = 0;
  let weightedPipeline = 0;
  for (const o of pipelineRows) {
    const v = o.estimatedValue ? Number(o.estimatedValue) : 0;
    totalPipeline += v;
    weightedPipeline += v * (STAGE_PROBABILITY[o.stage] / 100);
  }

  return {
    contactsCount,
    accountsCount,
    openOpps,
    weeklyActivities,
    totalPipeline,
    weightedPipeline,
    upcomingActions,
    recentActivities,
  };
}

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

const ACTIVITY_LABEL: Record<string, string> = {
  CALL: 'Llamada',
  EMAIL_SENT: 'Email enviado',
  EMAIL_RECEIVED: 'Email recibido',
  WHATSAPP: 'WhatsApp',
  MEETING: 'Reunión',
  DEMO: 'Demo',
  MATERIAL_SENT: 'Material enviado',
  PROPOSAL_SENT: 'Propuesta enviada',
  INTERNAL_NOTE: 'Nota interna',
  TASK: 'Tarea',
  STAGE_CHANGE: 'Cambio de fase',
  CONTACT_LINKED: 'Contacto vinculado',
  STATUS_CHANGE: 'Cambio de estado',
  FILE_SHARED: 'Archivo compartido',
  LINKEDIN_MESSAGE: 'LinkedIn',
  EVENT_ATTENDED: 'Evento',
};

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const canReadAll = can(session, 'opportunities:read:all');
  const data = await loadDashboardData(session.user.id, canReadAll);
  const name = session.user.name?.split(' ')[0] ?? 'colega';

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-sysde-gray">
          Hola, {name}
        </h2>
        <p className="mt-1 text-sm text-sysde-mid">
          Resumen de tu pipeline y actividad reciente.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<Users className="h-5 w-5 text-sysde-red" />}
          label="Contactos"
          value={data.contactsCount.toLocaleString('es-CR')}
          href="/contacts"
        />
        <KpiCard
          icon={<Building2 className="h-5 w-5 text-sysde-red" />}
          label="Cuentas"
          value={data.accountsCount.toLocaleString('es-CR')}
          href="/accounts"
        />
        <KpiCard
          icon={<Target className="h-5 w-5 text-sysde-red" />}
          label="Oportunidades abiertas"
          value={data.openOpps.toLocaleString('es-CR')}
          href="/opportunities"
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5 text-sysde-red" />}
          label="Pipeline ponderado"
          value={formatMoney(data.weightedPipeline)}
          subtitle={`Total ${formatMoney(data.totalPipeline)}`}
          href="/pipeline"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between p-6 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-sysde-mid" />
              <h3 className="text-base font-semibold">Próximas acciones</h3>
            </div>
            <Link
              href="/inbox"
              className="text-xs font-medium text-sysde-red hover:underline"
            >
              Ver todo
            </Link>
          </div>
          <div className="divide-y divide-sysde-border">
            {data.upcomingActions.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-sysde-mid">
                No hay acciones programadas en los próximos 7 días.
              </div>
            ) : (
              data.upcomingActions.map((a) => {
                const overdue = a.nextActionDate && a.nextActionDate < new Date();
                return (
                  <Link
                    key={a.id}
                    href={`/opportunities/${a.id}`}
                    className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-sysde-bg"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-sysde-gray">
                          {a.name}
                        </span>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {STAGE_LABEL[a.stage] ?? a.stage}
                        </Badge>
                      </div>
                      <div className="truncate text-xs text-sysde-mid">
                        {a.account.name} · {a.nextActionNote ?? 'Seguimiento'}
                      </div>
                    </div>
                    <div
                      className={
                        overdue
                          ? 'shrink-0 text-xs font-semibold text-danger'
                          : 'shrink-0 text-xs text-sysde-mid'
                      }
                    >
                      {a.nextActionDate &&
                        formatDistanceToNow(a.nextActionDate, {
                          addSuffix: true,
                          locale: es,
                        })}
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-sysde-mid" />
                  </Link>
                );
              })
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between p-6 pb-3">
            <div className="flex items-center gap-2">
              <ActivityIcon className="h-5 w-5 text-sysde-mid" />
              <h3 className="text-base font-semibold">Actividad reciente</h3>
            </div>
            <Link
              href="/activities"
              className="text-xs font-medium text-sysde-red hover:underline"
            >
              Ver todo
            </Link>
          </div>
          <div className="divide-y divide-sysde-border">
            {data.recentActivities.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-sysde-mid">
                Sin actividad reciente.
              </div>
            ) : (
              data.recentActivities.map((a) => (
                <div key={a.id} className="px-6 py-3">
                  <div className="flex items-center gap-2 text-xs text-sysde-mid">
                    <Badge variant="outline" className="text-[10px]">
                      {ACTIVITY_LABEL[a.type] ?? a.type}
                    </Badge>
                    <span>
                      {formatDistanceToNow(a.occurredAt, {
                        addSuffix: true,
                        locale: es,
                      })}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm font-medium text-sysde-gray">
                    {a.subject}
                  </div>
                  {(a.opportunity || a.account) && (
                    <div className="mt-0.5 truncate text-xs text-sysde-mid">
                      {a.opportunity?.name ?? a.account?.name}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  subtitle,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="group relative overflow-hidden p-5 transition-all hover:border-sysde-red/40 hover:shadow-md">
        <div className="flex items-start justify-between">
          <div className="rounded-lg bg-sysde-red-light p-2">{icon}</div>
          <ArrowUpRight className="h-4 w-4 text-sysde-mid opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <div className="mt-4">
          <div className="text-2xl font-semibold text-sysde-gray">{value}</div>
          <div className="mt-0.5 text-xs text-sysde-mid">{label}</div>
          {subtitle && <div className="mt-1 text-[11px] text-sysde-mid">{subtitle}</div>}
        </div>
      </Card>
    </Link>
  );
}
