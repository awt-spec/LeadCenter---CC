import Link from 'next/link';
import { Shield, Mail, Settings2 } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can, hasRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Forbidden } from '@/components/shared/forbidden';
import { ROLE_LABELS } from '@/lib/constants';
import { RoleToggle } from './role-toggle';
import { getInitials } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const metadata = { title: 'Usuarios' };

export default async function UsersSettingsPage() {
  const session = await auth();
  if (!can(session, 'users:read')) {
    return <Forbidden message="Solo administradores pueden gestionar usuarios." />;
  }

  const isAdmin = hasRole(session, 'admin');

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      include: {
        roles: { include: { role: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.role.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-sysde-gray">Usuarios</h2>
          <p className="mt-1 text-sm text-sysde-mid">
            {users.length} usuarios · asigna roles tocando los pills.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/settings/roles"
            className="inline-flex items-center gap-1.5 rounded-md border border-sysde-border bg-white px-3 py-1.5 text-xs font-medium text-sysde-gray transition-colors hover:bg-sysde-bg"
          >
            <Shield className="h-3.5 w-3.5" />
            Roles y permisos
          </Link>
          <Link
            href="/settings/custom-fields"
            className="inline-flex items-center gap-1.5 rounded-md border border-sysde-border bg-white px-3 py-1.5 text-xs font-medium text-sysde-gray transition-colors hover:bg-sysde-bg"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Campos personalizados
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-sysde-bg text-xs font-semibold uppercase tracking-wide text-sysde-mid">
            <tr>
              <th className="px-4 py-3 text-left">Usuario</th>
              <th className="px-4 py-3 text-left">Roles</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Último login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sysde-border">
            {users.map((u) => {
              const userRoleIds = new Set(u.roles.map((ur) => ur.roleId));
              return (
                <tr key={u.id} className="transition-colors hover:bg-sysde-bg/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={u.name} /> : null}
                        <AvatarFallback className="text-xs">{getInitials(u.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sysde-gray">{u.name}</div>
                        <div className="flex items-center gap-1 text-xs text-sysde-mid">
                          <Mail className="h-3 w-3" />
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <div className="flex flex-wrap gap-1.5">
                        {roles.map((r) => (
                          <RoleToggle
                            key={r.id}
                            userId={u.id}
                            roleId={r.id}
                            roleLabel={ROLE_LABELS[r.key] ?? r.name}
                            initial={userRoleIds.has(r.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-sysde-mid">—</span>
                        ) : (
                          u.roles.map((ur) => (
                            <span
                              key={ur.roleId}
                              className="rounded-full bg-sysde-red-light px-2.5 py-1 text-[11px] font-medium text-sysde-red ring-1 ring-sysde-red/30"
                            >
                              {ROLE_LABELS[ur.role.key] ?? ur.role.name}
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.isActive
                          ? 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200'
                          : 'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200'
                      }
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
                      />
                      {u.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-sysde-mid">
                    {u.lastLoginAt
                      ? formatDistanceToNow(u.lastLoginAt, { addSuffix: true, locale: es })
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {!isAdmin && (
        <Card className="border-amber-200 bg-amber-50/50 p-4">
          <p className="text-xs text-amber-800">
            Solo administradores pueden modificar roles. Si necesitas cambios, contacta al admin.
          </p>
        </Card>
      )}
    </div>
  );
}
