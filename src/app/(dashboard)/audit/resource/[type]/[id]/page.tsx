import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Forbidden } from '@/components/shared/forbidden';
import { getResourceTrail } from '@/lib/audit/queries';
import { ACTION_LABEL, ACTION_VARIANT, RESOURCE_LABEL } from '../../../components/labels';
import { ChangesDiff } from '../../../components/changes-diff';

export const metadata = { title: 'Trail de recurso · Auditoría' };
export const dynamic = 'force-dynamic';

type Params = Promise<{ type: string; id: string }>;

const RESOURCE_LINKS: Record<string, (id: string) => string> = {
  accounts: (id) => `/accounts/${id}`,
  contacts: (id) => `/contacts/${id}`,
  opportunities: (id) => `/opportunities/${id}`,
  tasks: (id) => `/sprint?taskId=${id}`,
  campaigns: (id) => `/campaigns/${id}`,
};

export default async function ResourceTrailPage({ params }: { params: Params }) {
  const { type, id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!can(session, 'audit:read')) {
    return <Forbidden message="No tienes permiso para ver la auditoría." />;
  }

  const decodedType = decodeURIComponent(type);
  const decodedId = decodeURIComponent(id);

  const events = await getResourceTrail(decodedType, decodedId, 200);

  const resourceLink = RESOURCE_LINKS[decodedType]?.(decodedId);
  const resourceLabel = RESOURCE_LABEL[decodedType] ?? decodedType;

  // Stats de la trail
  const byUser = new Map<string, { name: string; email: string; count: number }>();
  const byAction = new Map<string, number>();
  for (const e of events) {
    if (e.user) {
      const existing = byUser.get(e.user.id);
      if (existing) existing.count += 1;
      else
        byUser.set(e.user.id, {
          name: e.user.name ?? e.user.email,
          email: e.user.email,
          count: 1,
        });
    }
    byAction.set(e.action, (byAction.get(e.action) ?? 0) + 1);
  }
  const involvedUsers = Array.from(byUser.values()).sort((a, b) => b.count - a.count);
  const actionCounts = Array.from(byAction.entries()).sort((a, b) => b[1] - a[1]);

  const firstEvent = events[events.length - 1];
  const lastEvent = events[0];

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/audit"
          className="inline-flex items-center gap-1 text-xs text-sysde-mid hover:text-sysde-red mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a auditoría
        </Link>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-sysde-gray">
              Trail · {resourceLabel}
            </h1>
            <code className="text-xs text-sysde-mid font-mono">{decodedId}</code>
          </div>
          {resourceLink ? (
            <Link
              href={resourceLink}
              className="inline-flex items-center gap-1 text-sm text-sysde-red hover:underline"
            >
              Abrir registro <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </header>

      {events.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-sysde-mid">Sin eventos registrados para este recurso.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-sysde-mid">Eventos</div>
              <div className="mt-2 text-2xl font-bold text-sysde-gray">{events.length}</div>
              <div className="mt-0.5 text-xs text-sysde-mid">
                últimos {events.length} (cap 200)
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-sysde-mid">
                Usuarios involucrados
              </div>
              <div className="mt-2 text-2xl font-bold text-sysde-gray">{involvedUsers.length}</div>
              <div className="mt-0.5 text-xs text-sysde-mid">
                {involvedUsers.slice(0, 2).map((u) => u.name).join(', ') || '—'}
                {involvedUsers.length > 2 ? ` +${involvedUsers.length - 2}` : ''}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-sysde-mid">
                Primer evento
              </div>
              <div className="mt-2 text-sm font-semibold text-sysde-gray">
                {firstEvent
                  ? format(firstEvent.createdAt, "d MMM yyyy", { locale: es })
                  : '—'}
              </div>
              <div className="mt-0.5 text-xs text-sysde-mid">
                {firstEvent
                  ? formatDistanceToNow(firstEvent.createdAt, { addSuffix: true, locale: es })
                  : ''}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-sysde-mid">
                Última actividad
              </div>
              <div className="mt-2 text-sm font-semibold text-sysde-gray">
                {lastEvent
                  ? format(lastEvent.createdAt, "d MMM yyyy HH:mm", { locale: es })
                  : '—'}
              </div>
              <div className="mt-0.5 text-xs text-sysde-mid">
                {lastEvent
                  ? formatDistanceToNow(lastEvent.createdAt, { addSuffix: true, locale: es })
                  : ''}
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-sysde-border">
                <h3 className="text-sm font-semibold text-sysde-gray">Cronología</h3>
              </div>
              <ol className="divide-y divide-sysde-border">
                {events.map((e) => {
                  const userName = e.user?.name ?? e.user?.email ?? 'Sistema';
                  const initials = userName
                    .split(' ')
                    .map((w) => w[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();
                  return (
                    <li key={e.id} className="p-4 hover:bg-sysde-bg/50">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center pt-1">
                          {e.user ? (
                            <Link href={`/audit?userId=${e.user.id}`}>
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sysde-red text-white text-[10px] font-bold">
                                {initials || '·'}
                              </span>
                            </Link>
                          ) : (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sysde-mid text-white text-[10px] font-bold">
                              ?
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-sysde-gray">
                                {userName}
                              </span>
                              <Badge variant={ACTION_VARIANT[e.action] ?? 'secondary'}>
                                {ACTION_LABEL[e.action] ?? e.action}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-sysde-mid font-mono">
                              {format(e.createdAt, "d MMM HH:mm:ss", { locale: es })}
                              <span className="ml-1">
                                ·{' '}
                                {formatDistanceToNow(e.createdAt, {
                                  addSuffix: true,
                                  locale: es,
                                })}
                              </span>
                            </div>
                          </div>
                          {e.changes ? (
                            <div className="mt-2">
                              <ChangesDiff changes={e.changes} />
                            </div>
                          ) : null}
                          {e.metadata ? (
                            <details className="mt-1.5">
                              <summary className="text-[10px] text-sysde-mid cursor-pointer hover:text-sysde-red">
                                metadata
                              </summary>
                              <pre className="text-[10px] font-mono whitespace-pre-wrap break-words text-sysde-gray bg-sysde-bg p-2 rounded mt-1">
                                {JSON.stringify(e.metadata, null, 2)}
                              </pre>
                            </details>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            <aside className="space-y-4">
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-sysde-gray mb-3">Quién tocó esto</h3>
                {involvedUsers.length === 0 ? (
                  <p className="text-xs text-sysde-mid italic">Sin usuarios identificados</p>
                ) : (
                  <ul className="space-y-1.5">
                    {involvedUsers.slice(0, 10).map((u) => (
                      <li
                        key={u.email}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="truncate">{u.name}</span>
                        <span className="text-sysde-mid font-mono ml-2">{u.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-4">
                <h3 className="text-sm font-semibold text-sysde-gray mb-3">Acciones</h3>
                <ul className="space-y-1.5">
                  {actionCounts.map(([action, count]) => (
                    <li key={action} className="flex items-center justify-between">
                      <Badge variant={ACTION_VARIANT[action] ?? 'secondary'}>
                        {ACTION_LABEL[action] ?? action}
                      </Badge>
                      <span className="text-xs text-sysde-mid font-mono">{count}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
