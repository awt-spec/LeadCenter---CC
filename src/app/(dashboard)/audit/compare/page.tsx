import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { Card } from '@/components/ui/card';
import { Forbidden } from '@/components/shared/forbidden';
import { Badge } from '@/components/ui/badge';
import { getUserDrilldown } from '@/lib/audit/queries';
import { ACTION_LABEL, ACTION_VARIANT, RESOURCE_LABEL } from '../components/labels';

export const metadata = { title: 'Comparar usuarios · Auditoría' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ users?: string | string[] }>;

function formatMin(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!can(session, 'audit:read')) {
    return <Forbidden message="No tienes permiso para ver la auditoría." />;
  }

  const sp = await searchParams;
  const raw = sp.users;
  const users = (Array.isArray(raw) ? raw : raw ? raw.split(',') : [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (users.length === 0) {
    return (
      <div className="p-8 text-center text-sysde-mid">
        <p className="mb-4">No seleccionaste usuarios. Volvé al listado y elegí.</p>
        <Link href="/audit" className="text-sysde-red hover:underline">
          Ir a auditoría
        </Link>
      </div>
    );
  }
  if (users.length === 1) {
    redirect(`/audit?userId=${users[0]}`);
  }

  const drilldowns = await Promise.all(users.map((id) => getUserDrilldown(id, 30)));
  const valid = drilldowns.filter((d): d is NonNullable<typeof d> => !!d);

  // Encontrar las acciones y recursos compartidos para alinear las filas
  const allActions = new Set<string>();
  const allResources = new Set<string>();
  for (const d of valid) {
    for (const a of d.byAction) allActions.add(a.action);
    for (const r of d.byResource) allResources.add(r.resource);
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/audit"
          className="inline-flex items-center gap-1 text-xs text-sysde-mid hover:text-sysde-red mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a auditoría
        </Link>
        <h1 className="text-2xl font-bold text-sysde-gray">
          Comparar usuarios ({valid.length})
        </h1>
        <p className="text-sm text-sysde-mid mt-1">
          Stats de los últimos 30 días lado a lado.
        </p>
      </header>

      {/* Cabecera con stats clave */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${valid.length}, 1fr)` }}
      >
        {valid.map((d) => {
          const initials = d.name
            .split(' ')
            .map((w) => w[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase();
          return (
            <Card key={d.userId} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-sysde-red text-white font-bold flex items-center justify-center text-sm">
                  {initials || '·'}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/audit?userId=${d.userId}`}
                    className="text-sm font-semibold text-sysde-gray hover:text-sysde-red truncate block"
                  >
                    {d.name}
                  </Link>
                  <div className="text-[11px] text-sysde-mid truncate">{d.email}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xl font-bold text-sysde-gray">
                    {d.totalActions30d.toLocaleString('es')}
                  </div>
                  <div className="text-[10px] text-sysde-mid uppercase tracking-wider">
                    Acciones
                  </div>
                </div>
                <div>
                  <div className="text-xl font-bold text-sysde-gray">
                    {d.daysActive30d}
                  </div>
                  <div className="text-[10px] text-sysde-mid uppercase tracking-wider">
                    Días
                  </div>
                </div>
                <div>
                  <div className="text-xl font-bold text-sysde-gray">
                    {formatMin(d.estimatedActiveMinutes30d)}
                  </div>
                  <div className="text-[10px] text-sysde-mid uppercase tracking-wider">
                    Tiempo
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Comparativa por acción */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-sysde-gray mb-3">Acciones por tipo</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-sysde-border">
                <th className="text-left py-2 pr-3 font-medium text-sysde-mid">Acción</th>
                {valid.map((d) => (
                  <th
                    key={d.userId}
                    className="text-right py-2 px-2 font-medium text-sysde-mid min-w-[80px]"
                  >
                    {d.name.split(' ')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...allActions].sort().map((action) => (
                <tr key={action} className="border-b border-sysde-border/50">
                  <td className="py-1.5 pr-3">
                    <Badge variant={ACTION_VARIANT[action] ?? 'secondary'}>
                      {ACTION_LABEL[action] ?? action}
                    </Badge>
                  </td>
                  {valid.map((d) => {
                    const found = d.byAction.find((a) => a.action === action);
                    return (
                      <td key={d.userId} className="text-right py-1.5 px-2 font-mono">
                        {found ? found.count.toLocaleString('es') : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Comparativa por recurso */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-sysde-gray mb-3">Recursos tocados</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-sysde-border">
                <th className="text-left py-2 pr-3 font-medium text-sysde-mid">Recurso</th>
                {valid.map((d) => (
                  <th
                    key={d.userId}
                    className="text-right py-2 px-2 font-medium text-sysde-mid min-w-[80px]"
                  >
                    {d.name.split(' ')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...allResources].sort().map((resource) => (
                <tr key={resource} className="border-b border-sysde-border/50">
                  <td className="py-1.5 pr-3 text-sysde-gray">
                    {RESOURCE_LABEL[resource] ?? resource}
                  </td>
                  {valid.map((d) => {
                    const found = d.byResource.find((r) => r.resource === resource);
                    return (
                      <td key={d.userId} className="text-right py-1.5 px-2 font-mono">
                        {found ? found.count.toLocaleString('es') : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
