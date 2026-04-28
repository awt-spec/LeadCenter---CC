import Link from 'next/link';
import { Users as UsersIcon } from 'lucide-react';
import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { Forbidden } from '@/components/shared/forbidden';
import { RoleMatrix } from './role-matrix';

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

  const groupedMap = new Map<string, typeof permissions>();
  for (const p of permissions) {
    const arr = groupedMap.get(p.resource) ?? [];
    arr.push(p);
    groupedMap.set(p.resource, arr);
  }
  const groups = Array.from(groupedMap.entries()).map(([resource, perms]) => ({
    resource,
    permissions: perms,
  }));

  const rolePerms: Record<string, string[]> = {};
  for (const r of roles) rolePerms[r.id] = r.permissions.map((rp) => rp.permissionId);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-sysde-red">
            Configuración
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-sysde-gray sm:text-3xl">
            Roles y permisos
          </h2>
          <p className="mt-1 text-sm text-sysde-mid">
            {roles.length} roles · {permissions.length} permisos · cambios se loggean en
            auditoría.
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

      <RoleMatrix
        groups={groups.map((g) => ({
          resource: g.resource,
          permissions: g.permissions.map((p) => ({
            id: p.id,
            key: p.key,
            resource: p.resource,
            action: p.action,
            description: p.description,
          })),
        }))}
        roles={roles.map((r) => ({ id: r.id, key: r.key, name: r.name }))}
        rolePerms={rolePerms}
      />

      <div className="rounded-lg border border-sysde-border bg-white p-5 text-xs text-sysde-mid">
        <ul className="space-y-1">
          <li>
            · El rol <strong>admin</strong> tiene todos los permisos por diseño y no se
            puede modificar.
          </li>
          <li>· Cambios se aplican en tiempo real y se registran en el audit log.</li>
          <li>
            · Los permisos siguen el patrón{' '}
            <code className="rounded bg-sysde-bg px-1 font-mono">
              recurso:acción[:scope]
            </code>
            .
          </li>
        </ul>
      </div>
    </div>
  );
}
