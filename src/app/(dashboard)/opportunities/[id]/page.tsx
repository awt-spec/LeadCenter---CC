import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getOpportunityById,
  getOpportunityAuditLog,
} from '@/lib/opportunities/queries';
import { listActivities, getLatestPendingNextAction } from '@/lib/activities/queries';
import { activityFilterSchema } from '@/lib/activities/schemas';
import { getAccountsLite, getOpportunitiesLite, getUsersLite } from '@/lib/shared/lite-lists';
import { TimelineWithComposer } from '@/components/activities/timeline-with-composer';
import { NextActionCard } from '@/components/activities/next-action-card';
import {
  PRODUCT_LABELS,
  SUB_PRODUCT_LABELS,
  STATUS_LABELS,
  RATING_LABELS,
  COMMERCIAL_MODEL_LABELS,
  LOST_REASON_LABELS,
  formatMoney,
} from '@/lib/shared/labels';
import { CONTACT_SOURCE_LABELS } from '@/lib/constants';
import { StageBadge } from '../components/stage-badge';
import { StageProgress } from '../components/stage-progress';
import { ContactRolesManager } from '../components/contact-roles-manager';
import { DetailActions } from '../components/detail-actions';
import { getInitials } from '@/lib/utils';

// Cache the whole page for 60s. Mutations call revalidatePath.
export const revalidate = 60;

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const opp = await getOpportunityById(session, id);
  if (!opp) notFound();

  const canEdit =
    can(session, 'opportunities:update:all') ||
    (can(session, 'opportunities:update:own') && opp.ownerId === session.user.id);
  const canChangeStage = can(session, 'opportunities:change_stage');
  const canDelete = can(session, 'opportunities:delete');
  const canSeeAudit = can(session, 'audit:read');

  const auditLog = canSeeAudit ? await getOpportunityAuditLog(id) : [];

  const allContacts = await prisma.contact.findMany({
    select: { id: true, fullName: true, email: true, jobTitle: true },
    orderBy: { fullName: 'asc' },
    take: 200,
  });

  const activityFilters = activityFilterSchema.parse({ includeSystem: true });
  const [{ rows: activities }, latestPending, allAccountsLite, allOppsLite, usersLite] =
    await Promise.all([
      listActivities(session, { opportunityId: id }, activityFilters),
      getLatestPendingNextAction(id),
      getAccountsLite(),
      getOpportunitiesLite(),
      getUsersLite(),
    ]);
  const composerContacts = allContacts.map((c) => ({ id: c.id, label: c.fullName }));
  const composerAccounts = allAccountsLite.map((a) => ({ id: a.id, label: a.name }));
  const composerOpps = allOppsLite.map((o) => ({ id: o.id, label: `${o.code ?? o.id} · ${o.name}` }));

  const estValue = opp.estimatedValue ? Number(opp.estimatedValue) : null;
  const weightedValue = estValue !== null ? estValue * (opp.probability / 100) : null;

  const daysInCurrentStage = Math.floor(
    (Date.now() - opp.stageChangedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const totalCycleDays = Math.floor(
    (Date.now() - opp.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const nextActionOverdue =
    opp.nextActionDate && isPast(opp.nextActionDate) && opp.status === 'OPEN';

  return (
    <div>
      <Link
        href="/opportunities"
        className="inline-flex items-center gap-1 text-sm text-sysde-mid hover:text-sysde-gray"
      >
        <ChevronLeft className="h-4 w-4" />
        Oportunidades
      </Link>

      {nextActionOverdue && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-danger/30 bg-red-50 px-4 py-2.5 text-sm text-danger">
          <AlertTriangle className="h-4 w-4" />
          La próxima acción está vencida desde{' '}
          {formatDistanceToNow(opp.nextActionDate!, { addSuffix: false, locale: es })}.
        </div>
      )}

      <Card className="mt-4">
        <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            {opp.code && (
              <div className="mb-1 inline-block rounded-md bg-sysde-bg px-2 py-0.5 font-mono text-[11px] text-sysde-mid">
                {opp.code}
              </div>
            )}
            <h2 className="text-[28px] font-semibold leading-tight text-sysde-gray">{opp.name}</h2>
            <Link
              href={`/accounts/${opp.account.id}`}
              className="mt-1 inline-flex items-center gap-2 text-sm text-sysde-red hover:underline"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sysde-red text-[10px] font-semibold text-white">
                {getInitials(opp.account.name)}
              </div>
              {opp.account.name}
            </Link>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StageBadge stage={opp.stage} size="md" />
              <Badge variant="secondary">{STATUS_LABELS[opp.status]}</Badge>
              <span
                className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                style={{ backgroundColor: RATING_LABELS[opp.rating].color }}
              >
                Rating {RATING_LABELS[opp.rating].label}
              </span>
              <Badge variant="outline">{PRODUCT_LABELS[opp.product]}</Badge>
              {opp.subProduct && opp.subProduct !== 'NONE' && (
                <Badge variant="outline">{SUB_PRODUCT_LABELS[opp.subProduct]}</Badge>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[28px] font-semibold text-sysde-gray">
              {formatMoney(estValue, opp.currency)}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-sysde-mid">
              Valor · {opp.probability}% probabilidad
            </div>
            <div className="mt-4">
              <DetailActions
                opportunity={{
                  id: opp.id,
                  stage: opp.stage,
                  estimatedValue: estValue,
                  portfolioAmount: opp.portfolioAmount ? Number(opp.portfolioAmount) : null,
                  userCount: opp.userCount,
                  annualOperations: opp.annualOperations,
                  commercialModel: opp.commercialModel,
                  expectedCloseDate: opp.expectedCloseDate,
                  hasContacts: opp.contactRoles.length > 0,
                }}
                canChangeStage={canChangeStage}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-4">
          <StageProgress currentStage={opp.stage} />
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Tabs defaultValue="info">
            <TabsList>
              <TabsTrigger value="info">Información</TabsTrigger>
              <TabsTrigger value="contacts">
                Contactos ({opp.contactRoles.length})
              </TabsTrigger>
              <TabsTrigger value="activity">Actividad</TabsTrigger>
              <TabsTrigger value="history">Historia de fases</TabsTrigger>
              {canSeeAudit && <TabsTrigger value="audit">Auditoría</TabsTrigger>}
            </TabsList>

            <TabsContent value="info" className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Descripción</CardTitle></CardHeader>
                <CardContent>
                  {opp.description ? (
                    <p className="whitespace-pre-wrap text-sm">{opp.description}</p>
                  ) : <p className="text-sm text-sysde-mid">Sin descripción.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Dimensionamiento</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <Info label="Monto de cartera" value={opp.portfolioAmount ? formatMoney(Number(opp.portfolioAmount), opp.currency) : null} />
                  <Info label="Usuarios" value={opp.userCount?.toLocaleString('es-MX')} />
                  <Info label="Operaciones anuales" value={opp.annualOperations?.toLocaleString('es-MX')} />
                  <Info label="Clientes" value={opp.clientCount?.toLocaleString('es-MX')} />
                  <Info label="Oficinas" value={opp.officeCount?.toLocaleString('es-MX')} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Comercial</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Info label="Modelo comercial" value={COMMERCIAL_MODEL_LABELS[opp.commercialModel]} />
                  <Info label="Fuente" value={CONTACT_SOURCE_LABELS[opp.source] ?? opp.source} />
                  <Info label="Detalle de fuente" value={opp.sourceDetail} />
                  <Info
                    label="Prospección directa"
                    value={opp.isDirectProspecting ? 'Sí' : 'No'}
                  />
                </CardContent>
              </Card>

              {(opp.status === 'WON' || opp.status === 'LOST') && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {opp.status === 'WON' ? 'Ganancia' : 'Pérdida'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {opp.status === 'WON' && (
                      <Info label="Razón de ganancia" value={opp.wonReason} />
                    )}
                    {opp.status === 'LOST' && (
                      <>
                        <Info
                          label="Razón"
                          value={opp.lostReason ? LOST_REASON_LABELS[opp.lostReason] : null}
                        />
                        <Info label="Detalle" value={opp.lostReasonDetail} />
                        <Info label="Competidor ganador" value={opp.competitorWon} />
                      </>
                    )}
                    {opp.closedAt && (
                      <Info
                        label="Cerrada"
                        value={format(opp.closedAt, "d 'de' LLL yyyy", { locale: es })}
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              {opp.internalNotes && (
                <Card>
                  <CardHeader><CardTitle>Notas internas</CardTitle></CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm">{opp.internalNotes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="contacts">
              <Card className="overflow-hidden">
                <ContactRolesManager
                  opportunityId={opp.id}
                  roles={opp.contactRoles.map((r) => ({
                    contactId: r.contactId,
                    role: r.role,
                    isPrimary: r.isPrimary,
                    contact: r.contact,
                  }))}
                  allContacts={allContacts}
                  canEdit={canEdit}
                />
              </Card>
            </TabsContent>

            <TabsContent value="activity">
              <TimelineWithComposer
                activities={activities}
                currentUserId={session.user.id}
                composerDefaults={{
                  opportunityId: opp.id,
                  accountId: opp.account.id,
                  contactId: opp.contactRoles[0]?.contactId,
                }}
                contacts={composerContacts}
                accounts={composerAccounts}
                opportunities={composerOpps}
                users={usersLite.map((u) => ({ id: u.id, name: u.name }))}
                canCreate={can(session, 'activities:create')}
              />
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Historia de cambios de fase</CardTitle>
                </CardHeader>
                <CardContent>
                  {opp.stageHistory.length === 0 ? (
                    <p className="text-sm text-sysde-mid">Sin historial registrado.</p>
                  ) : (
                    <ol className="space-y-4">
                      {opp.stageHistory.map((h, i) => (
                        <li key={h.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="h-3 w-3 rounded-full bg-sysde-red" />
                            {i < opp.stageHistory.length - 1 && (
                              <div className="h-full w-px flex-1 bg-sysde-border" />
                            )}
                          </div>
                          <div className="flex-1 pb-2">
                            <div className="flex items-center gap-2">
                              {h.fromStage && <StageBadge stage={h.fromStage} size="sm" />}
                              {h.fromStage && <span className="text-sysde-mid">→</span>}
                              <StageBadge stage={h.toStage} size="sm" />
                            </div>
                            <div className="mt-1 text-xs text-sysde-mid">
                              {format(h.changedAt, "d LLL yyyy HH:mm", { locale: es })}
                              {h.changedBy ? ` · ${h.changedBy.name}` : ''}
                              {h.daysInPreviousStage !== null &&
                                ` · ${h.daysInPreviousStage} días en fase anterior`}
                            </div>
                            {h.notes && (
                              <p className="mt-1 text-sm text-sysde-gray">{h.notes}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {canSeeAudit && (
              <TabsContent value="audit">
                <Card>
                  <CardHeader><CardTitle>Audit log</CardTitle></CardHeader>
                  <CardContent>
                    {auditLog.length === 0 ? (
                      <p className="text-sm text-sysde-mid">Sin eventos.</p>
                    ) : (
                      <ul className="space-y-2">
                        {auditLog.map((a) => (
                          <li key={a.id} className="flex items-start justify-between rounded-lg border border-sysde-border bg-sysde-bg px-3 py-2 text-sm">
                            <div>
                              <div className="font-medium">{a.action}</div>
                              <div className="text-xs text-sysde-mid">
                                {a.user?.name ?? 'Sistema'} ·{' '}
                                {format(a.createdAt, "d LLL yyyy HH:mm", { locale: es })}
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

        {/* Sidebar */}
        <div className="space-y-6">
          <NextActionCard activity={latestPending} currentUserId={session.user.id} />

          <Card>
            <CardHeader><CardTitle>Timing</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Info
                label="Cierre esperado"
                value={opp.expectedCloseDate ? format(opp.expectedCloseDate, 'd LLL yyyy', { locale: es }) : null}
              />
              <Info label="Días en fase actual" value={`${daysInCurrentStage} días`} />
              <Info label="Ciclo total" value={`${totalCycleDays} días`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Owner</CardTitle></CardHeader>
            <CardContent>
              {opp.owner ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {opp.owner.avatarUrl ? <AvatarImage src={opp.owner.avatarUrl} alt={opp.owner.name} /> : null}
                    <AvatarFallback>{getInitials(opp.owner.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">{opp.owner.name}</div>
                    <div className="text-xs text-sysde-mid">{opp.owner.email}</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-sysde-mid">Sin owner.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Métricas</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-1 flex items-baseline justify-between text-xs text-sysde-mid">
                  <span>Probabilidad</span>
                  <span className="font-medium text-sysde-gray">{opp.probability}%</span>
                </div>
                <Progress value={opp.probability} />
              </div>
              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-sysde-mid">
                  Valor ponderado
                </div>
                <div className="text-lg font-semibold text-sysde-gray">
                  {weightedValue !== null ? formatMoney(weightedValue, opp.currency) : '—'}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-sysde-mid">Rating</div>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${RATING_LABELS[opp.rating].score}%`,
                        backgroundColor: RATING_LABELS[opp.rating].color,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-sysde-gray">
                    {RATING_LABELS[opp.rating].label}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <div className="mb-0.5 text-xs font-medium uppercase tracking-wide text-sysde-mid">{label}</div>
      <div className="text-sm text-sysde-gray">{value || '—'}</div>
    </div>
  );
}
