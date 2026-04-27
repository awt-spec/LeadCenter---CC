import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, Pencil, Plus, Globe, MapPin, Briefcase, Users } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { listActivities } from '@/lib/activities/queries';
import { activityFilterSchema } from '@/lib/activities/schemas';
import { listUsers } from '@/lib/contacts/queries';
import { TimelineWithComposer } from '@/components/activities/timeline-with-composer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClickableRow } from './clickable-row';
import { DeleteResourceButton } from '@/components/shared/delete-resource-button';
import { getAccountById } from '@/lib/accounts/queries';
import { deleteAccount } from '@/lib/accounts/mutations';
import { listTasksByAccount, getTaskStats } from '@/lib/tasks/queries';
import { TaskKanban } from './tasks/task-kanban';
import {
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_VARIANTS,
  COMPANY_SIZE_LABELS,
  SEGMENT_LABELS_EXTENDED,
  STAGE_LABELS,
  STAGE_COLORS,
  PRODUCT_LABELS,
  formatMoney,
} from '@/lib/shared/labels';
import { getInitials } from '@/lib/utils';

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const account = await getAccountById(session, id);
  if (!account) notFound();

  const canEdit =
    can(session, 'accounts:update:all') ||
    (can(session, 'accounts:update:own') && account.ownerId === session.user.id);

  const openOpps = account.opportunities.filter((o) => o.status === 'OPEN');
  const pipelineOpen = openOpps.reduce((acc, o) => acc + Number(o.estimatedValue ?? 0), 0);
  const closed = account.opportunities.filter((o) => o.status === 'WON' || o.status === 'LOST');
  const won = closed.filter((o) => o.status === 'WON').length;
  const winRate = closed.length > 0 ? Math.round((won / closed.length) * 100) : 0;

  const activityFilters = activityFilterSchema.parse({});
  const [
    { rows: activities },
    allContactsLite,
    allAccountsLite,
    allOppsLite,
    usersLite,
    tasks,
  ] = await Promise.all([
    listActivities(session, { accountId: id }, activityFilters),
    prisma.contact.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: 'asc' }, take: 200 }),
    prisma.account.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 200 }),
    prisma.opportunity.findMany({ select: { id: true, name: true, code: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
    listUsers(),
    listTasksByAccount(id),
  ]);
  const composerContacts = allContactsLite.map((c) => ({ id: c.id, label: c.fullName }));
  const composerAccounts = allAccountsLite.map((a) => ({ id: a.id, label: a.name }));
  const composerOpps = allOppsLite.map((o) => ({ id: o.id, label: `${o.code ?? o.id} · ${o.name}` }));

  return (
    <div>
      <Link href="/accounts" className="inline-flex items-center gap-1 text-sm text-sysde-mid hover:text-sysde-gray">
        <ChevronLeft className="h-4 w-4" />
        Cuentas
      </Link>

      <Card className="mt-4">
        <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sysde-red text-xl font-semibold text-white">
              {getInitials(account.name)}
            </div>
            <div>
              <h2 className="text-[28px] font-semibold leading-tight text-sysde-gray">{account.name}</h2>
              {account.legalName && (
                <p className="text-sm text-sysde-mid">{account.legalName}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={ACCOUNT_STATUS_VARIANTS[account.status]}>
                  {ACCOUNT_STATUS_LABELS[account.status]}
                </Badge>
                {account.segment && (
                  <Badge variant="secondary">
                    {SEGMENT_LABELS_EXTENDED[account.segment]}
                  </Badge>
                )}
                <Badge variant="outline">{COMPANY_SIZE_LABELS[account.size]}</Badge>
                {account.country && <Badge variant="outline">{account.country}</Badge>}
              </div>
              {(account.domain || account.website) && (
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  {account.domain && (
                    <span className="text-sysde-mid">
                      <Globe className="mr-1 inline h-3.5 w-3.5" />
                      {account.domain}
                    </span>
                  )}
                  {account.website && (
                    <a
                      href={account.website.startsWith('http') ? account.website : `https://${account.website}`}
                      className="text-sysde-red hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {account.website}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {can(session, 'opportunities:create') && (
              <Button variant="outline" asChild>
                <Link href={`/opportunities/new?accountId=${account.id}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva oportunidad
                </Link>
              </Button>
            )}
            {canEdit && (
              <>
                <Button asChild>
                  <Link href={`/accounts/${account.id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Link>
                </Button>
                <DeleteResourceButton
                  id={account.id}
                  resourceLabel="Cuenta"
                  resourceName={account.name}
                  action={deleteAccount}
                  redirectTo="/accounts"
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {account.parentAccount && (
        <div className="mt-3 text-sm text-sysde-mid">
          Parte de{' '}
          <Link className="text-sysde-red hover:underline" href={`/accounts/${account.parentAccount.id}`}>
            {account.parentAccount.name}
          </Link>
        </div>
      )}

      {account.childAccounts.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-sysde-mid">Subsidiarias:</span>
          {account.childAccounts.map((c) => (
            <Link
              key={c.id}
              href={`/accounts/${c.id}`}
              className="inline-flex items-center rounded-md border border-sysde-border bg-white px-2 py-0.5 text-xs text-sysde-gray hover:border-sysde-red"
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Pipeline activo" value={formatMoney(pipelineOpen)} />
        <StatCard label="Oportunidades abiertas" value={String(openOpps.length)} />
        <StatCard label="Contactos" value={String(account._count.contacts)} />
        <StatCard label="Tasa de cierre" value={`${winRate}%`} />
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tareas {tasks.length > 0 && `(${tasks.length})`}</TabsTrigger>
          <TabsTrigger value="activity">Actividad</TabsTrigger>
          <TabsTrigger value="contacts">Contactos</TabsTrigger>
          <TabsTrigger value="opps">Oportunidades</TabsTrigger>
          {(account.parentAccount || account.childAccounts.length > 0) && (
            <TabsTrigger value="hierarchy">Jerarquía</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Información</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Info icon={Briefcase} label="Industria" value={account.industry} />
              <Info label="Sub-industria" value={account.subIndustry} />
              <Info label="Empleados" value={account.employeeCount?.toLocaleString('es-MX')} />
              <Info
                label="Revenue anual"
                value={account.annualRevenue ? formatMoney(Number(account.annualRevenue), account.currency) : null}
              />
              <Info icon={MapPin} label="Ciudad" value={account.city} />
              <Info label="Región" value={account.region} />
              <Info label="Dirección" value={account.address} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Descripción</CardTitle></CardHeader>
            <CardContent>
              {account.description ? (
                <p className="whitespace-pre-wrap text-sm text-sysde-gray">{account.description}</p>
              ) : (
                <p className="text-sm text-sysde-mid">Sin descripción.</p>
              )}
            </CardContent>
          </Card>

          {account.internalNotes && (
            <Card>
              <CardHeader><CardTitle>Notas internas</CardTitle></CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-sysde-gray">{account.internalNotes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tasks">
          <TaskKanban
            accountId={account.id}
            initialTasks={tasks}
            users={usersLite.map((u) => ({ id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl }))}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="activity">
          <TimelineWithComposer
            activities={activities}
            currentUserId={session.user.id}
            composerDefaults={{ accountId: account.id }}
            contacts={composerContacts}
            accounts={composerAccounts}
            opportunities={composerOpps}
            users={usersLite.map((u) => ({ id: u.id, name: u.name }))}
            canCreate={can(session, 'activities:create')}
          />
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Contactos vinculados ({account.contacts.length})</CardTitle>
              {can(session, 'contacts:create') && (
                <Button size="sm" asChild>
                  <Link href={`/contacts/new`}>
                    <Plus className="mr-1 h-4 w-4" />
                    Crear nuevo contacto
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {account.contacts.length === 0 ? (
                <div className="p-10 text-center text-sm text-sysde-mid">
                  <Users className="mx-auto mb-2 h-6 w-6" />
                  No hay contactos vinculados.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-sysde-bg">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Nombre</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Owner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {account.contacts.map((c) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer"
                        onClick={() => { window.location.href = `/contacts/${c.id}`; }}
                      >
                        <TableCell className="font-medium">{c.fullName}</TableCell>
                        <TableCell>{c.jobTitle ?? '—'}</TableCell>
                        <TableCell className="text-sysde-mid">{c.email}</TableCell>
                        <TableCell>
                          {c.owner ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                {c.owner.avatarUrl ? <AvatarImage src={c.owner.avatarUrl} alt={c.owner.name} /> : null}
                                <AvatarFallback className="text-[10px]">{getInitials(c.owner.name)}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{c.owner.name}</span>
                            </div>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opps">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Oportunidades ({account.opportunities.length})</CardTitle>
              {can(session, 'opportunities:create') && (
                <Button size="sm" asChild>
                  <Link href={`/opportunities/new?accountId=${account.id}`}>
                    <Plus className="mr-1 h-4 w-4" />
                    Nueva oportunidad
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {account.opportunities.length === 0 ? (
                <div className="p-10 text-center text-sm text-sysde-mid">Sin oportunidades.</div>
              ) : (
                <Table>
                  <TableHeader className="bg-sysde-bg">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Fase</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Cierre esperado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {account.opportunities.map((o) => (
                      <ClickableRow key={o.id} href={`/opportunities/${o.id}`}>
                        <TableCell className="font-mono text-xs">{o.code}</TableCell>
                        <TableCell className="font-medium">{o.name}</TableCell>
                        <TableCell>{PRODUCT_LABELS[o.product]}</TableCell>
                        <TableCell>
                          <span
                            className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: STAGE_COLORS[o.stage].bg,
                              color: STAGE_COLORS[o.stage].text,
                              borderColor: STAGE_COLORS[o.stage].border,
                            }}
                          >
                            {STAGE_LABELS[o.stage]}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {formatMoney(o.estimatedValue ? Number(o.estimatedValue) : null, o.currency)}
                        </TableCell>
                        <TableCell className="text-sm text-sysde-mid">
                          {o.expectedCloseDate
                            ? format(o.expectedCloseDate, "d LLL yyyy", { locale: es })
                            : '—'}
                        </TableCell>
                      </ClickableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {(account.parentAccount || account.childAccounts.length > 0) && (
          <TabsContent value="hierarchy">
            <Card>
              <CardHeader><CardTitle>Jerarquía</CardTitle></CardHeader>
              <CardContent>
                {account.parentAccount && (
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-wide text-sysde-mid">Cuenta padre</div>
                    <Link
                      href={`/accounts/${account.parentAccount.id}`}
                      className="mt-1 inline-flex items-center gap-2 rounded-md border border-sysde-border bg-white px-3 py-2 text-sm hover:border-sysde-red"
                    >
                      {account.parentAccount.name}
                    </Link>
                  </div>
                )}
                {account.childAccounts.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-sysde-mid">Subsidiarias</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {account.childAccounts.map((c) => (
                        <Link
                          key={c.id}
                          href={`/accounts/${c.id}`}
                          className="inline-flex items-center gap-2 rounded-md border border-sysde-border bg-white px-3 py-2 text-sm hover:border-sysde-red"
                        >
                          {c.name}
                          <Badge variant="secondary" className="ml-1">
                            {ACCOUNT_STATUS_LABELS[c.status]}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-sysde-mid">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="text-sm text-sysde-gray">{value || '—'}</div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-semibold text-sysde-gray">{value}</div>
        <div className="mt-0.5 text-xs uppercase tracking-wide text-sysde-mid">{label}</div>
      </CardContent>
    </Card>
  );
}
