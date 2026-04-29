import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft,
  Pencil,
  Mail,
  Phone,
  Linkedin,
  Globe,
  MapPin,
  Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import {
  getContactById,
  getContactAuditLog,
} from '@/lib/contacts/queries';
import {
  getContactsLite,
  getAccountsLite,
  getOpportunitiesLite,
  getUsersLite,
} from '@/lib/shared/lite-lists';
import { listActivities } from '@/lib/activities/queries';
import { activityFilterSchema } from '@/lib/activities/schemas';
import { TimelineWithComposer } from '@/components/activities/timeline-with-composer';
import { DeleteResourceButton } from '@/components/shared/delete-resource-button';
import { deleteContact } from '@/lib/contacts/mutations';
import {
  CONTACT_STATUS_LABELS,
  CONTACT_STATUS_VARIANTS,
  CONTACT_SOURCE_LABELS,
  SENIORITY_LABELS,
  SEGMENT_LABELS,
  PRODUCT_INTEREST_LABELS,
} from '@/lib/constants';
import { getInitials } from '@/lib/utils';

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const contact = await getContactById(session, id);
  if (!contact) notFound();

  const canEdit =
    can(session, 'contacts:update:all') ||
    (can(session, 'contacts:update:own') && contact.ownerId === session.user.id);
  const canSeeAudit = can(session, 'audit:read');

  const auditLog = canSeeAudit ? await getContactAuditLog(id) : [];

  const activityFilters = activityFilterSchema.parse({});
  const [{ rows: activities }, allContactsLite, allAccountsLite, allOppsLite, usersLite] =
    await Promise.all([
      listActivities(session, { contactId: id }, activityFilters),
      getContactsLite(),
      getAccountsLite(),
      getOpportunitiesLite(),
      getUsersLite(),
    ]);
  const composerContacts = allContactsLite.map((c) => ({ id: c.id, label: c.fullName }));
  const composerAccounts = allAccountsLite.map((a) => ({ id: a.id, label: a.name }));
  const composerOpps = allOppsLite.map((o) => ({ id: o.id, label: `${o.code ?? o.id} · ${o.name}` }));

  const engagement = Math.min(100, Math.max(0, contact.engagementScore));

  return (
    <div>
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1 text-sm text-sysde-mid transition-colors hover:text-sysde-gray"
      >
        <ChevronLeft className="h-4 w-4" />
        Contactos
      </Link>

      {/* Header */}
      <Card className="mt-4">
        <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">{getInitials(contact.fullName)}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-[28px] font-semibold leading-tight text-sysde-gray">
                {contact.fullName}
              </h2>
              <p className="mt-1 text-sm text-sysde-mid">
                {[contact.jobTitle, contact.companyName].filter(Boolean).join(' · ') || '—'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={CONTACT_STATUS_VARIANTS[contact.status] ?? 'secondary'}>
                  {CONTACT_STATUS_LABELS[contact.status] ?? contact.status}
                </Badge>
                <Badge variant="secondary">
                  {CONTACT_SOURCE_LABELS[contact.source] ?? contact.source}
                </Badge>
                {contact.doNotContact && <Badge variant="danger">No contactar</Badge>}
              </div>
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button asChild>
                <Link href={`/contacts/${contact.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Link>
              </Button>
              <DeleteResourceButton
                id={contact.id}
                resourceLabel="Contacto"
                resourceName={contact.fullName}
                action={deleteContact}
                redirectTo="/contacts"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: main */}
        <div className="space-y-6 lg:col-span-2">
          <Tabs defaultValue="info">
            <TabsList>
              <TabsTrigger value="info">Información</TabsTrigger>
              <TabsTrigger value="activity">Actividad</TabsTrigger>
              <TabsTrigger value="opportunities">Oportunidades</TabsTrigger>
              {canSeeAudit && <TabsTrigger value="audit">Auditoría</TabsTrigger>}
            </TabsList>

            <TabsContent value="info" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contacto</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <InfoRow icon={Mail} label="Email" value={contact.email} />
                  <InfoRow icon={Phone} label="Teléfono" value={contact.phone} />
                  <InfoRow icon={Phone} label="Móvil" value={contact.mobilePhone} />
                  <InfoRow icon={Linkedin} label="LinkedIn" value={contact.linkedinUrl} link />
                  <InfoRow icon={Globe} label="Web" value={contact.website} link />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Profesional</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <InfoRow icon={Building2} label="Empresa" value={contact.companyName} />
                  <InfoRow label="Cargo" value={contact.jobTitle} />
                  <InfoRow label="Departamento" value={contact.department} />
                  <InfoRow
                    label="Seniority"
                    value={SENIORITY_LABELS[contact.seniorityLevel] ?? contact.seniorityLevel}
                  />
                  <InfoRow
                    label="Segmento"
                    value={
                      contact.marketSegment
                        ? SEGMENT_LABELS[contact.marketSegment]
                        : null
                    }
                  />
                  <InfoRow
                    label="Productos de interés"
                    value={
                      contact.productInterest.length
                        ? contact.productInterest
                            .map((p) => PRODUCT_INTEREST_LABELS[p] ?? p)
                            .join(', ')
                        : null
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Geografía</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <InfoRow icon={MapPin} label="País" value={contact.country} />
                  <InfoRow label="Ciudad" value={contact.city} />
                  <InfoRow label="Timezone" value={contact.timezone} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notas</CardTitle>
                </CardHeader>
                <CardContent>
                  {contact.notes ? (
                    <p className="whitespace-pre-wrap text-sm text-sysde-gray">{contact.notes}</p>
                  ) : (
                    <p className="text-sm text-sysde-mid">Sin notas registradas.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity">
              <TimelineWithComposer
                activities={activities}
                currentUserId={session.user.id}
                composerDefaults={{
                  contactId: contact.id,
                  accountId: contact.accountId ?? undefined,
                }}
                contacts={composerContacts}
                accounts={composerAccounts}
                opportunities={composerOpps}
                users={usersLite.map((u) => ({ id: u.id, name: u.name }))}
                canCreate={can(session, 'activities:create')}
              />
            </TabsContent>

            <TabsContent value="opportunities">
              <Card>
                <CardHeader>
                  <CardTitle>Oportunidades vinculadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-sysde-border bg-sysde-bg text-sm text-sysde-mid">
                    Las oportunidades se implementarán en la Fase 3.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {canSeeAudit && (
              <TabsContent value="audit">
                <Card>
                  <CardHeader>
                    <CardTitle>Historial de auditoría</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {auditLog.length === 0 ? (
                      <p className="text-sm text-sysde-mid">Sin eventos registrados.</p>
                    ) : (
                      <ul className="space-y-3">
                        {auditLog.map((log) => (
                          <li
                            key={log.id}
                            className="flex items-start justify-between rounded-lg border border-sysde-border bg-sysde-bg px-3 py-2 text-sm"
                          >
                            <div>
                              <div className="font-medium text-sysde-gray">
                                {log.action}
                              </div>
                              <div className="text-xs text-sysde-mid">
                                {log.user?.name ?? 'Sistema'} ·{' '}
                                {format(log.createdAt, "d 'de' LLL yyyy HH:mm", { locale: es })}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              {contact.tags.length === 0 ? (
                <p className="text-sm text-sysde-mid">Sin tags asignados.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {contact.tags.map(({ tag }) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Owner</CardTitle>
            </CardHeader>
            <CardContent>
              {contact.owner ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {contact.owner.avatarUrl ? (
                      <AvatarImage src={contact.owner.avatarUrl} alt={contact.owner.name} />
                    ) : null}
                    <AvatarFallback>{getInitials(contact.owner.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium text-sysde-gray">
                      {contact.owner.name}
                    </div>
                    <div className="text-xs text-sysde-mid">{contact.owner.email}</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-sysde-mid">Sin owner asignado.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-2xl font-semibold text-sysde-gray">{engagement}</span>
                <span className="text-xs text-sysde-mid">/ 100</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-sysde-red transition-all"
                  style={{ width: `${engagement}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-sysde-mid">
                Score calculado automáticamente (placeholder).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <InfoKV
                label="Creado por"
                value={contact.createdBy?.name ?? 'Sistema'}
              />
              <InfoKV
                label="Creado"
                value={`${format(contact.createdAt, "d LLL yyyy", { locale: es })} · ${formatDistanceToNow(contact.createdAt, { addSuffix: true, locale: es })}`}
              />
              <InfoKV
                label="Última actualización"
                value={formatDistanceToNow(contact.updatedAt, { addSuffix: true, locale: es })}
              />
              {contact.importBatch && (
                <InfoKV
                  label="Import batch"
                  value={
                    <Link
                      href={`/contacts/import/${contact.importBatch.id}`}
                      className="text-sysde-red hover:underline"
                    >
                      {contact.importBatch.fileName}
                    </Link>
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  link,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  link?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-sysde-mid">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      {value ? (
        link ? (
          <a
            href={value.startsWith('http') ? value : `https://${value}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-sysde-red hover:underline"
          >
            {value}
          </a>
        ) : (
          <div className="text-sm text-sysde-gray">{value}</div>
        )
      ) : (
        <div className="text-sm text-sysde-mid">—</div>
      )}
    </div>
  );
}

function InfoKV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-sysde-mid">{label}</span>
      <span className="text-right text-xs text-sysde-gray">{value}</span>
    </div>
  );
}
