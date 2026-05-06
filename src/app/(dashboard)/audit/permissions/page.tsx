import Link from 'next/link';
import { ArrowLeft, ShieldCheck, ShieldAlert, AlertCircle } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { Card } from '@/components/ui/card';
import { Forbidden } from '@/components/shared/forbidden';
import {
  getRolePermissionMatrix,
  getInactiveUsers,
  isSensitivePermission,
} from '@/lib/audit/queries';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { RESOURCE_LABEL } from '../components/labels';

export const metadata = { title: 'Permisos · Auditoría' };
export const dynamic = 'force-dynamic';

export default async function PermissionsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!can(session, 'audit:read')) {
    return <Forbidden message="No tienes permiso para ver la matriz." />;
  }

  const [{ roles, permissions, matrix }, inactiveUsers] = await Promise.all([
    getRolePermissionMatrix(),
    getInactiveUsers(14),
  ]);

  // Agrupar permisos por resource
  const grouped = new Map<string, typeof permissions>();
  for (const p of permissions) {
    const list = grouped.get(p.resource) ?? [];
    list.push(p);
    grouped.set(p.resource, list);
  }
  const resourceKeys = [...grouped.keys()].sort();

  // Cuántos roles tienen cada permiso sensible (over-grant detector)
  const sensitiveOverGrants: Array<{ key: string; count: number }> = [];
  for (const p of permissions.filter((x) => isSensitivePermission(x.key))) {
    let count = 0;
    for (const r of roles) {
      if (matrix[r.key]?.has(p.key)) count += 1;
    }
    if (count >= 3) sensitiveOverGrants.push({ key: p.key, count });
  }
  sensitiveOverGrants.sort((a, b) => b.count - a.count);

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
            <h1 className="text-2xl font-bold text-sysde-gray flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-sysde-red" />
              Matriz de permisos
            </h1>
            <p className="text-sm text-sysde-mid mt-1">
              {roles.length} roles · {permissions.length} permisos · click en celda muestra detalle.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sysde-border bg-sysde-bg">
                  <th className="text-left px-3 py-2 sticky left-0 bg-sysde-bg z-10 min-w-[280px]">
                    Permiso
                  </th>
                  {roles.map((r) => (
                    <th
                      key={r.id}
                      className="text-center px-2 py-2 font-medium text-sysde-gray text-xs min-w-[100px]"
                      title={r.name}
                    >
                      {r.key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resourceKeys.map((resource) => {
                  const perms = grouped.get(resource) ?? [];
                  return (
                    <>
                      <tr key={`${resource}-header`} className="bg-sysde-bg/50">
                        <td
                          colSpan={roles.length + 1}
                          className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-sysde-mid font-semibold"
                        >
                          {RESOURCE_LABEL[resource] ?? resource}
                        </td>
                      </tr>
                      {perms.map((p) => {
                        const sensitive = isSensitivePermission(p.key);
                        return (
                          <tr key={p.id} className="border-b border-sysde-border/50">
                            <td className="px-3 py-2 sticky left-0 bg-white">
                              <div className="flex items-start gap-1.5">
                                {sensitive ? (
                                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                                ) : null}
                                <div className="min-w-0">
                                  <div className="font-mono text-xs text-sysde-gray">
                                    {p.action}
                                  </div>
                                  {p.description ? (
                                    <div className="text-[10px] text-sysde-mid leading-snug">
                                      {p.description}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            {roles.map((r) => {
                              const granted = matrix[r.key]?.has(p.key) ?? false;
                              return (
                                <td key={r.id} className="text-center px-2 py-2">
                                  {granted ? (
                                    sensitive ? (
                                      <span
                                        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700"
                                        title={`${r.name} tiene "${p.key}" (sensible)`}
                                      >
                                        ●
                                      </span>
                                    ) : (
                                      <span
                                        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700"
                                        title={`${r.name} tiene "${p.key}"`}
                                      >
                                        ✓
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-sysde-mid/40">·</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <aside className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-sysde-gray mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Permisos sensibles
            </h3>
            <p className="text-[11px] text-sysde-mid mb-3">
              Permisos que dan capacidad de borrado, cambio de roles, o acceso a la
              auditoría. Si demasiados roles los tienen, considerá restringir.
            </p>
            {sensitiveOverGrants.length === 0 ? (
              <div className="text-xs text-sysde-mid italic">
                Ninguno está sobre-asignado.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {sensitiveOverGrants.map((s) => (
                  <li
                    key={s.key}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-sysde-gray">{s.key}</span>
                    <span className="text-amber-700 font-semibold">{s.count} roles</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-sysde-gray mb-3">
              Usuarios inactivos (14d)
            </h3>
            {inactiveUsers.length === 0 ? (
              <div className="text-xs text-sysde-mid italic">
                Todos los usuarios activos tienen actividad reciente.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {inactiveUsers.slice(0, 10).map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <Link
                      href={`/audit?userId=${u.id}`}
                      className="truncate hover:text-sysde-red"
                    >
                      {u.name}
                    </Link>
                    <span className="text-sysde-mid ml-2 shrink-0 text-[10px]">
                      {u.lastSeen
                        ? formatDistanceToNow(u.lastSeen, { locale: es })
                        : 'nunca'}
                    </span>
                  </li>
                ))}
                {inactiveUsers.length > 10 ? (
                  <li className="text-[10px] text-sysde-mid italic">
                    +{inactiveUsers.length - 10} más
                  </li>
                ) : null}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-sysde-gray mb-2">Leyenda</h3>
            <ul className="text-xs space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700">
                  ✓
                </span>
                Permiso otorgado
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700">
                  ●
                </span>
                Otorgado y sensible
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 text-sysde-mid/40">
                  ·
                </span>
                No otorgado
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
