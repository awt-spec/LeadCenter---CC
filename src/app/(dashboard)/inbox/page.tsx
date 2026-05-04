import Link from 'next/link';
import { isPast, isToday, isThisWeek, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AtSign, AlertTriangle, Calendar, Snowflake, Mail, CheckSquare, ArrowRight, Briefcase,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { Forbidden } from '@/components/shared/forbidden';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActivityCard } from '@/components/activities/activity-card';
import {
  getInboxMentions,
  getAssignedNextActions,
  getMyCreatedActivities,
  getEmailsNeedingReply,
  getColdAccounts,
  getOverdueTasks,
  getInboxHeroStats,
} from '@/lib/activities/queries';
import { TASK_STATUS_DOT, TASK_STATUS_LABELS, TASK_PRIORITY_DOT } from '@/lib/tasks/labels';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Inbox' };
export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user?.id) return <Forbidden />;

  const [mentions, assigned, mine, hero, needReply, coldAccounts, overdueTasks] = await Promise.all([
    getInboxMentions(session, false),
    getAssignedNextActions(session),
    getMyCreatedActivities(session),
    getInboxHeroStats(session),
    getEmailsNeedingReply(session, 30),
    getColdAccounts(session, 14),
    getOverdueTasks(session),
  ]);

  const unreadMentions = mentions.filter((m) => !m.readAt);

  type AssignedItem = (typeof assigned)[number];
  const overdue: AssignedItem[] = [];
  const today: AssignedItem[] = [];
  const thisWeek: AssignedItem[] = [];
  const future: AssignedItem[] = [];
  for (const a of assigned) {
    if (!a.nextActionDate) continue;
    if (isToday(a.nextActionDate)) today.push(a);
    else if (isPast(a.nextActionDate)) overdue.push(a);
    else if (isThisWeek(a.nextActionDate, { weekStartsOn: 1 })) thisWeek.push(a);
    else future.push(a);
  }

  const totalUrgent = hero.overdueActivities + hero.overdueTasks + hero.unreadMentions;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h2 className="text-[28px] font-semibold tracking-tight text-sysde-gray">Inbox</h2>
        <p className="mt-1 text-sm text-sysde-mid">
          {totalUrgent > 0
            ? `Tenés ${totalUrgent} cosa${totalUrgent > 1 ? 's' : ''} que requieren atención hoy.`
            : 'Todo al día. ¡A descansar!'}
        </p>
      </div>

      {/* Hero stats grid — clickable cards leading to the right tab */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <HeroCard
          icon={AlertTriangle}
          label="Vencidas"
          value={hero.overdueActivities + hero.overdueTasks}
          accent="danger"
          href="#vencidas"
        />
        <HeroCard
          icon={AtSign}
          label="Menciones"
          value={hero.unreadMentions}
          accent="violet"
          href="#mentions"
        />
        <HeroCard
          icon={Mail}
          label="Por responder"
          value={needReply.length}
          accent="sky"
          href="#need-reply"
        />
        <HeroCard
          icon={Snowflake}
          label="Cuentas frías"
          value={hero.coldAccounts}
          accent="cyan"
          href="#cold"
        />
        <HeroCard
          icon={CheckSquare}
          label="Tareas vencidas"
          value={hero.overdueTasks}
          accent="amber"
          href="#tasks"
        />
      </div>

      <Tabs defaultValue="focus">
        <TabsList>
          <TabsTrigger value="focus">
            Foco del día
            {totalUrgent > 0 && <Badge variant="danger" className="ml-2">{totalUrgent}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="mentions">
            Menciones
            {unreadMentions.length > 0 && <Badge variant="default" className="ml-2">{unreadMentions.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="need-reply">
            Por responder
            {needReply.length > 0 && <Badge variant="secondary" className="ml-2">{needReply.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="cold">
            Cuentas frías
            {coldAccounts.length > 0 && <Badge variant="secondary" className="ml-2">{coldAccounts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="mine">Mis actividades</TabsTrigger>
        </TabsList>

        {/* ===== Foco del día ===== */}
        <TabsContent value="focus" className="space-y-6">
          {totalUrgent === 0 ? (
            <EmptyState icon={CheckSquare} message="Sin urgencias. Todo al día." />
          ) : (
            <>
              {overdueTasks.length > 0 && (
                <Section
                  id="tasks"
                  title="Tareas vencidas"
                  icon={CheckSquare}
                  count={overdueTasks.length}
                  accent="danger"
                >
                  <ul className="space-y-2">
                    {overdueTasks.map((t) => (
                      <li key={t.id}>
                        <Link
                          href={t.account ? `/accounts/${t.account.id}?tab=tasks` : '/'}
                          className="group flex items-center gap-3 rounded-lg border border-sysde-border bg-white p-3 transition-colors hover:border-sysde-red/40"
                        >
                          {t.color && (
                            <div className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                          )}
                          <span className={cn('h-2 w-2 shrink-0 rounded-full', TASK_STATUS_DOT[t.status])} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-sysde-gray">{t.title}</div>
                            <div className="text-xs text-sysde-mid">
                              {TASK_STATUS_LABELS[t.status]}
                              {t.account && (
                                <>
                                  {' · '}
                                  <span className="text-sysde-gray">{t.account.name}</span>
                                </>
                              )}
                              {' · '}
                              <span className="text-danger">
                                Venció {formatDistanceToNow(t.dueDate!, { addSuffix: true, locale: es })}
                              </span>
                            </div>
                          </div>
                          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TASK_PRIORITY_DOT[t.priority])} />
                          <ArrowRight className="h-4 w-4 text-sysde-mid opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {overdue.length > 0 && (
                <Section
                  id="vencidas"
                  title="Próximas acciones vencidas"
                  icon={AlertTriangle}
                  count={overdue.length}
                  accent="danger"
                >
                  <Timeline items={overdue} userId={session.user.id} />
                </Section>
              )}

              {today.length > 0 && (
                <Section id="hoy" title="Hoy" icon={Calendar} count={today.length} accent="amber">
                  <Timeline items={today} userId={session.user.id} />
                </Section>
              )}

              {unreadMentions.length > 0 && (
                <Section
                  id="mentions"
                  title="Mencionado en"
                  icon={AtSign}
                  count={unreadMentions.length}
                  accent="violet"
                >
                  <Timeline
                    items={unreadMentions.slice(0, 5).map((m) => m.activity) as unknown as ActivityCardArg[]}
                    userId={session.user.id}
                  />
                </Section>
              )}

              {thisWeek.length > 0 && (
                <Section id="semana" title="Esta semana" icon={Calendar} count={thisWeek.length}>
                  <Timeline items={thisWeek} userId={session.user.id} />
                </Section>
              )}
            </>
          )}
        </TabsContent>

        {/* ===== Menciones ===== */}
        <TabsContent value="mentions" className="space-y-4">
          {mentions.length === 0 ? (
            <EmptyState icon={AtSign} message="Nadie te ha mencionado todavía." />
          ) : (
            <Timeline items={mentions.map((m) => m.activity) as unknown as ActivityCardArg[]} userId={session.user.id} />
          )}
        </TabsContent>

        {/* ===== Por responder ===== */}
        <TabsContent value="need-reply" className="space-y-4">
          {needReply.length === 0 ? (
            <EmptyState
              icon={Mail}
              message="Nada esperando respuesta. Cuando lleguen emails de HubSpot que no respondiste, aparecerán acá."
            />
          ) : (
            <>
              <p className="text-xs text-sysde-mid">
                Emails recibidos en últimos 30 días sin respuesta enviada al mismo contacto.
              </p>
              <Timeline items={needReply as unknown as ActivityCardArg[]} userId={session.user.id} />
            </>
          )}
        </TabsContent>

        {/* ===== Cuentas frías ===== */}
        <TabsContent value="cold" className="space-y-3">
          {coldAccounts.length === 0 ? (
            <EmptyState icon={Snowflake} message="Todas tus cuentas tienen actividad reciente." />
          ) : (
            <>
              <p className="text-xs text-sysde-mid">
                Cuentas tuyas (PROSPECT/ACTIVE) sin ninguna actividad en los últimos 14 días.
              </p>
              <ul className="space-y-2">
                {coldAccounts.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/accounts/${a.id}`}
                      className="group flex items-center gap-3 rounded-lg border border-sysde-border bg-white p-3 transition-colors hover:border-sysde-red/40"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sysde-bg text-xs font-semibold text-sysde-gray">
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-sysde-gray">{a.name}</div>
                        <div className="text-xs text-sysde-mid">
                          {a.country ?? '—'}
                          {' · '}
                          {a._count.contacts} contactos · {a._count.opportunities} opps · {a._count.activities} activities
                          {' · '}
                          <span className="text-cyan-700">
                            Sin tocar {formatDistanceToNow(a.updatedAt, { addSuffix: true, locale: es })}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-sysde-mid opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </TabsContent>

        {/* ===== Mis actividades ===== */}
        <TabsContent value="mine" className="space-y-4">
          {mine.length === 0 ? (
            <EmptyState icon={CheckSquare} message="Aún no has creado actividades." />
          ) : (
            <Timeline items={mine as unknown as ActivityCardArg[]} userId={session.user.id} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== Reusable bits =====

function HeroCard({
  icon: Icon,
  label,
  value,
  accent,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: 'danger' | 'violet' | 'sky' | 'cyan' | 'amber';
  href: string;
}) {
  const map: Record<typeof accent, string> = {
    danger: 'border-red-300 bg-red-50 text-red-700',
    violet: 'border-violet-300 bg-violet-50 text-violet-700',
    sky:    'border-sky-300 bg-sky-50 text-sky-700',
    cyan:   'border-cyan-300 bg-cyan-50 text-cyan-700',
    amber:  'border-amber-300 bg-amber-50 text-amber-700',
  };
  const klass = value > 0 ? map[accent] : 'border-sysde-border bg-white text-sysde-mid';
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center justify-between rounded-lg border p-3 transition-shadow hover:shadow-sm',
        klass
      )}
    >
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide opacity-80">
          <Icon className="h-3 w-3" />
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString('es-MX')}</div>
      </div>
      <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function Section({
  id,
  title,
  icon: Icon,
  count,
  accent,
  children,
}: {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  accent?: 'danger' | 'amber' | 'violet';
  children: React.ReactNode;
}) {
  const accentColor =
    accent === 'danger' ? 'text-danger' : accent === 'amber' ? 'text-amber-600' : accent === 'violet' ? 'text-violet-600' : 'text-sysde-gray';
  return (
    <div id={id}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn('h-4 w-4', accentColor)} />
        <h3 className={cn('text-[12px] font-semibold uppercase tracking-wider', accentColor)}>{title}</h3>
        <Badge variant={accent === 'danger' ? 'danger' : 'secondary'}>{count}</Badge>
      </div>
      {children}
    </div>
  );
}

type ActivityCardArg = Parameters<typeof ActivityCard>[0]['activity'];

function Timeline({
  items,
  userId,
}: {
  items: ActivityCardArg[];
  userId: string;
}) {
  return (
    <div className="relative space-y-4">
      <div className="absolute left-4 bottom-2 top-2 w-px bg-sysde-border" />
      {items.map((a) => (
        <ActivityCard key={a.id} activity={a} currentUserId={userId} />
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Icon className="h-8 w-8 text-sysde-mid" />
      <p className="text-sm text-sysde-mid">{message}</p>
    </Card>
  );
}
