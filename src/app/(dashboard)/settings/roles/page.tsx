import { Fragment } from 'react';
import Link from 'next/link';
import { Shield, Users as UsersIcon } from 'lucide-react';
import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/card';
import { Forbidden } from '@/components/shared/forbidden';
import { ROLE_LABELS } from '@/lib/constants';
import { PermissionToggle } from './permission-toggle';

export const metadata = { title: 'Roles y permisos' };

export default async function RolesPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!hasRole(session, 'admin')) {
    return <Forbidden message="Solo administradores pueden gestionar roles." />;
  }

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      include: { permissions: { select: { permissionId: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] }),
  ]);

  // Group permissions by resource
  const grouped = new Map<string, typeof permissions>();
  for (const p of permissions) {
    const arr = grouped.get(p.resource) ?? [];
    arr.push(p);
    grouped.set(p.resource, arr);
  }

  // Map roleId -> Set of permission ids
  const rolePermMap = new Map<string, Set<string>>();
  for (const r of roles) {
    rolePermMap.set(r.id, new Set(r.permissions.map((rp) => rp.permissionId)));
  }

  const RESOURCE_LABEL: Record<string, string> = {
    contacts: 'Contactos',
    accounts: 'Cuentas',
    opportunities: 'Oportunidades',
    activities: 'Actividades',
    reports: 'Reportes',
    users: 'Usuarios',
    settings: 'Configuración',
    audit: 'Auditoría',
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-sysde-gray">
            Roles y permisos
          </h2>
          <p className="mt-1 text-sm text-sysde-mid">
            {roles.length} roles · {permissions.length} permisos · cambios se loggean en auditoría.
          </p>
        </div>
        <Link
          href="/settings/users"
          className="inline-flex items-center gap-1.5 rounded-md border border-sysde-border bg-white px-3 py-1.5 text-xs font-medium text-sysde-gray transition-colors hover:bg-sysde-bg"
        >
          <UsersIcon className="h-3.5 w-3.5" />
          Usuarios
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sysde-bg">
              <tr>
                <th className="sticky left-0 z-10 bg-sysde-bg px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sysde-mid">
                  Permiso
                </th>
                {roles.map((r) => (
                  <th
                    key={r.id}
                    className="px-3 py-3 text-center text-xs font-semibold text-sysde-gray"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <Shield className="h-3 w-3 text-sysde-mid" />
                      {ROLE_LABELS[r.key] ?? r.name}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] font-normal text-sysde-mid">
                      {r.key}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(grouped.entries()).map(([resource, perms]) => (
                <Fragment key={resource}>
                  <tr className="bg-sysde-bg/50">
                    <td
                      colSpan={roles.length + 1}
                      className="sticky left-0 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-sysde-mid"
                    >
                      {RESOURCE_LABEL[resource] ?? resource}
                    </td>
                  </tr>
                  {perms.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-sysde-border transition-colors hover:bg-sysde-bg/40"
                    >
                      <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                        <div className="font-mono text-[11px] text-sysde-gray">{p.key}</div>
                        {p.description && (
                          <div className="mt-0.5 text-[11px] text-sysde-mid">
                            {p.description}
                          </div>
                        )}
                      </td>
                      {roles.map((r) => {
                        const has = rolePermMap.get(r.id)?.has(p.id) ?? false;
                        const isAdminRole = r.key === 'admin';
                        return (
                          <td key={r.id} className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center">
                              <PermissionToggle
                                roleId={r.id}
                                permissionId={p.id}
                                initial={has}
                                disabled={isAdminRole}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold">Notas</h3>
        <ul className="mt-2 space-y-1 text-xs text-sysde-mid">
          <li>· El rol <strong>admin</strong> tiene todos los permisos por diseño y no se puede modificar.</li>
          <li>· Cambios se aplican en tiempo real y se registran en el audit log.</li>
          <li>· Los permisos siguen el patrón <code className="rounded bg-sysde-bg px-1 font-mono">recurso:acción[:scope]</code>.</li>
          <li>· Para asignar roles a usuarios, anda a <Link href="/settings/users" className="text-sysde-red hover:underline">Usuarios</Link>.</li>
        </ul>
      </Card>
    </div>
  );
}
