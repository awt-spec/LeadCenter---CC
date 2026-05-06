'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit/write';

type Result = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Sesión requerida');
  if (!hasRole(session, 'admin')) {
    return { session, isAdmin: false };
  }
  return { session, isAdmin: true };
}

export async function togglePermission(
  roleId: string,
  permissionId: string,
  enabled: boolean
): Promise<Result> {
  const { session, isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: 'Solo admins pueden modificar permisos' };

  if (enabled) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId },
    });
  } else {
    await prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId, permissionId } },
    });
  }

  await writeAuditLog({
    userId: session.user.id,
    action: enabled ? 'permission_grant' : 'permission_revoke',
    resource: 'roles',
    resourceId: roleId,
    changes: { permissionId, enabled },
  });

  revalidatePath('/settings/roles');
  return { ok: true };
}

export async function assignUserRole(
  userId: string,
  roleId: string,
  enabled: boolean
): Promise<Result> {
  const { session, isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: 'Solo admins.' };

  if (enabled) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  } else {
    await prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });
  }

  await writeAuditLog({
    userId: session.user.id,
    action: enabled ? 'role_grant' : 'role_revoke',
    resource: 'users',
    resourceId: userId,
    changes: { roleId, enabled },
  });

  revalidatePath('/settings/users');
  revalidatePath('/settings/roles');
  return { ok: true };
}
