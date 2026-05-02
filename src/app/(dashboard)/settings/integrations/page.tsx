import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plug, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Forbidden } from '@/components/shared/forbidden';
import { HubspotActions } from './hubspot-actions';

export const metadata = { title: 'Integraciones' };

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; detail?: string }>;
}) {
  const session = await auth();
  if (!can(session, 'settings:read')) {
    return <Forbidden message="Solo administradores pueden ver integraciones." />;
  }
  const sp = await searchParams;

  const integ = await prisma.integration.findFirst({
    where: { provider: 'hubspot' },
    include: {
      runs: { orderBy: { startedAt: 'desc' }, take: 5 },
      connectedBy: { select: { name: true, email: true } },
    },
  });
  const counts = integ
    ? await prisma.integrationMapping.groupBy({
        by: ['internalType'],
        where: { integrationId: integ.id },
        _count: { _all: true },
      })
    : [];
  const countMap = Object.fromEntries(counts.map((c) => [c.internalType, c._count._all]));

  const canEdit = can(session, 'settings:update');
  const hasCredentials = !!process.env.HUBSPOT_CLIENT_ID;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-sysde-gray">Integraciones</h2>
        <p className="mt-1 text-sm text-sysde-mid">
          Conecta sistemas externos para que LeadCenter sincronice cuentas, contactos y oportunidades automáticamente.
        </p>
      </div>

      {sp.status === 'connected' && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          HubSpot conectado correctamente.
        </div>
      )}
      {sp.error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          Error al conectar: {sp.error}
          {sp.detail ? ` — ${sp.detail}` : ''}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <Plug className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>HubSpot</CardTitle>
              <p className="text-sm text-sysde-mid">CRM, contactos y deals.</p>
            </div>
          </div>
          <div>
            {integ?.status === 'CONNECTED' && <Badge variant="success">Conectado</Badge>}
            {integ?.status === 'SYNCING' && <Badge variant="secondary">Sincronizando…</Badge>}
            {integ?.status === 'ERROR' && <Badge variant="danger">Error</Badge>}
            {(!integ || integ.status === 'DISCONNECTED') && <Badge variant="outline">Desconectado</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasCredentials && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <strong>Configuración pendiente:</strong> falta definir{' '}
              <code className="rounded bg-amber-100 px-1">HUBSPOT_CLIENT_ID</code> y{' '}
              <code className="rounded bg-amber-100 px-1">HUBSPOT_CLIENT_SECRET</code> en Vercel
              (settings → environment variables). Crear primero un Public App en{' '}
              <a className="underline" href="https://developers.hubspot.com/" target="_blank" rel="noreferrer">
                developers.hubspot.com
              </a>{' '}
              con los scopes <code>crm.objects.{'{'}contacts,companies,deals{'}'}.read</code>.
            </div>
          )}

          {integ?.status === 'CONNECTED' && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Empresas" value={countMap['Account'] ?? 0} />
              <Stat label="Contactos" value={countMap['Contact'] ?? 0} />
              <Stat label="Deals" value={countMap['Opportunity'] ?? 0} />
              <Stat
                label="Última sync"
                value={
                  integ.lastSyncedAt
                    ? formatDistanceToNow(integ.lastSyncedAt, { addSuffix: true, locale: es })
                    : '—'
                }
              />
            </div>
          )}

          {integ?.lastError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <strong>Último error:</strong> {integ.lastError}
            </div>
          )}

          {integ?.connectedBy && (
            <div className="text-xs text-sysde-mid">
              Conectado por <span className="font-medium text-sysde-gray">{integ.connectedBy.name}</span>{' '}
              ({integ.ownerEmail})
            </div>
          )}

          {canEdit && (
            <HubspotActions
              connected={integ?.status === 'CONNECTED'}
              hasCredentials={hasCredentials}
              integrationId={integ?.id ?? null}
            />
          )}

          {integ?.runs.length ? (
            <div className="border-t border-sysde-border pt-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-sysde-mid">
                <RefreshCw className="h-3 w-3" />
                Historial reciente
              </div>
              <ul className="space-y-2">
                {integ.runs.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start justify-between rounded-lg border border-sysde-border bg-sysde-bg px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-medium text-sysde-gray">
                        {r.status === 'ok' ? '✓' : r.status === 'error' ? '✗' : '…'} {r.trigger}
                      </div>
                      <div className="text-sysde-mid">
                        {format(r.startedAt, "d LLL HH:mm", { locale: es })}
                        {r.finishedAt
                          ? ` · ${Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000)}s`
                          : ' · en curso'}
                      </div>
                      {r.error && <div className="mt-1 text-red-600">{r.error.slice(0, 200)}</div>}
                    </div>
                    <div className="text-right text-sysde-mid">
                      <div>+{r.itemsCreated} creados</div>
                      <div>~{r.itemsUpdated} actualizados</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-sysde-border bg-sysde-bg p-3">
      <div className="text-xs uppercase tracking-wide text-sysde-mid">{label}</div>
      <div className="mt-1 text-xl font-semibold text-sysde-gray">{value}</div>
    </div>
  );
}
