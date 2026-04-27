import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { auth } from '@/lib/auth';

export function can(session: Session | null, permissionKey: string): boolean {
  if (!session?.user?.permissions) return false;
  return session.user.permissions.includes(permissionKey);
}

export function canAny(session: Session | null, permissionKeys: string[]): boolean {
  if (!session?.user?.permissions) return false;
  return permissionKeys.some((k) => session.user.permissions.includes(k));
}

export function hasRole(session: Session | null, roleKey: string): boolean {
  if (!session?.user?.roles) return false;
  return session.user.roles.includes(roleKey);
}

export async function getSessionWithPermissions(): Promise<Session | null> {
  return auth();
}

export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }
  return session;
}

export async function requirePermission(permissionKey: string): Promise<Session> {
  const session = await requireSession();
  if (!can(session, permissionKey)) {
    throw new Error(`Forbidden: missing permission "${permissionKey}"`);
  }
  return session;
}
