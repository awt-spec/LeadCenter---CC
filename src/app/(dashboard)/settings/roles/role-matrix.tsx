'use client';

import { useState } from 'react';
import { ChevronDown, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PermissionToggle } from './permission-toggle';
import { ROLE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';

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

type Permission = {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
};

type Role = { id: string; key: string; name: string };

export function RoleMatrix({
  groups,
  roles,
  rolePerms,
}: {
  groups: { resource: string; permissions: Permission[] }[];
  roles: Role[];
  rolePerms: Record<string, string[]>; // roleId -> permissionId[]
}) {
  // First group expanded by default; rest collapsed for fast initial paint
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(groups[0] ? [groups[0].resource] : [])
  );

  function toggle(resource: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(resource)) next.delete(resource);
      else next.add(resource);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {groups.map(({ resource, permissions }) => {
        const isOpen = expanded.has(resource);
        const grantedCount = roles.reduce(
          (acc, r) =>
            acc +
            permissions.filter((p) => rolePerms[r.id]?.includes(p.id)).length,
          0
        );
        const total = permissions.length * roles.length;

        return (
          <Card key={resource} className="overflow-hidden p-0">
            <button
              type="button"
              onClick={() => toggle(resource)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-sysde-bg/50"
            >
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-sysde-mid" />
                <div className="text-left">
                  <div className="font-display text-[13px] font-semibold uppercase tracking-wider text-sysde-gray">
                    {RESOURCE_LABEL[resource] ?? resource}
                  </div>
                  <div className="text-[11px] text-sysde-mid">
                    {permissions.length} permisos · {grantedCount} de {total}{' '}
                    asignados
                  </div>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-sysde-mid transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </button>

            {isOpen && (
              <div className="overflow-x-auto border-t border-sysde-border">
                <table className="w-full text-sm">
                  <thead className="bg-sysde-bg/40">
                    <tr>
                      <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-sysde-mid">
                        Permiso
                      </th>
                      {roles.map((r) => (
                        <th
                          key={r.id}
                          className="px-2 py-2 text-center text-[10px] font-semibold text-sysde-gray"
                        >
                          {ROLE_LABELS[r.key] ?? r.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {permissions.map((p) => (
                      <tr
                        key={p.id}
                        className="border-t border-sysde-border transition-colors hover:bg-sysde-bg/40"
                      >
                        <td className="px-4 py-2">
                          <div className="font-mono text-[11px] text-sysde-gray">
                            {p.key}
                          </div>
                          {p.description && (
                            <div className="mt-0.5 text-[11px] text-sysde-mid">
                              {p.description}
                            </div>
                          )}
                        </td>
                        {roles.map((r) => {
                          const has = rolePerms[r.id]?.includes(p.id) ?? false;
                          return (
                            <td key={r.id} className="px-2 py-2 text-center">
                              <div className="flex items-center justify-center">
                                <PermissionToggle
                                  roleId={r.id}
                                  permissionId={p.id}
                                  initial={has}
                                  disabled={r.key === 'admin'}
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
