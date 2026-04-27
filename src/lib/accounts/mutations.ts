'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { accountFormSchema, type AccountFormValues } from './schemas';

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Sesión requerida');
  return session;
}

async function writeAudit(params: {
  userId: string;
  action: string;
  resourceId?: string;
  changes?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      resource: 'accounts',
      resourceId: params.resourceId,
      changes: (params.changes ?? null) as Prisma.InputJsonValue,
    },
  });
}

function fieldErrorsFromZod(error: import('zod').ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function buildDiff<T extends Record<string, unknown>>(before: T, after: T) {
  const changes: { before: Record<string, unknown>; after: Record<string, unknown> } = {
    before: {},
    after: {},
  };
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes.before[key] = before[key] ?? null;
      changes.after[key] = after[key] ?? null;
    }
  }
  return changes;
}

export async function createAccount(input: AccountFormValues): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  if (!can(session, 'accounts:create')) {
    return { ok: false, error: 'Sin permiso para crear cuentas.' };
  }

  const parsed = accountFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const data = parsed.data;

  if (data.domain) {
    const dup = await prisma.account.findUnique({ where: { domain: data.domain } });
    if (dup) {
      return { ok: false, error: 'El dominio ya existe.', fieldErrors: { domain: 'Duplicado' } };
    }
  }

  const acc = await prisma.account.create({
    data: {
      ...data,
      segment: data.segment ?? undefined,
      ownerId: data.ownerId ?? undefined,
      parentAccountId: data.parentAccountId ?? undefined,
      employeeCount: data.employeeCount ?? undefined,
      annualRevenue: data.annualRevenue ?? undefined,
      createdById: session.user.id,
    },
  });

  await writeAudit({
    userId: session.user.id,
    action: 'create',
    resourceId: acc.id,
    changes: { after: acc },
  });

  revalidatePath('/accounts');
  return { ok: true, data: { id: acc.id } };
}

export async function updateAccount(
  id: string,
  input: AccountFormValues
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();

  const existing = await prisma.account.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: 'Cuenta no encontrada' };

  const isOwn = existing.ownerId === session.user.id;
  const hasAll = can(session, 'accounts:update:all');
  const hasOwn = can(session, 'accounts:update:own');
  if (!hasAll && !(hasOwn && isOwn)) {
    return { ok: false, error: 'Sin permiso para editar esta cuenta.' };
  }

  const parsed = accountFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const data = parsed.data;

  if (data.domain && data.domain !== existing.domain) {
    const dup = await prisma.account.findUnique({ where: { domain: data.domain } });
    if (dup) {
      return { ok: false, error: 'El dominio ya existe.', fieldErrors: { domain: 'Duplicado' } };
    }
  }

  const updated = await prisma.account.update({
    where: { id },
    data: {
      ...data,
      segment: data.segment ?? null,
      ownerId: data.ownerId ?? null,
      parentAccountId: data.parentAccountId ?? null,
      employeeCount: data.employeeCount ?? null,
      annualRevenue: data.annualRevenue ?? null,
    },
  });

  await writeAudit({
    userId: session.user.id,
    action: 'update',
    resourceId: id,
    changes: buildDiff(existing as Record<string, unknown>, updated as Record<string, unknown>),
  });

  revalidatePath('/accounts');
  revalidatePath(`/accounts/${id}`);
  return { ok: true, data: { id } };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!can(session, 'accounts:delete')) {
    return { ok: false, error: 'Sin permiso para eliminar cuentas.' };
  }
  const existing = await prisma.account.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: 'No encontrada' };

  await prisma.account.delete({ where: { id } });
  await writeAudit({
    userId: session.user.id,
    action: 'delete',
    resourceId: id,
    changes: { before: existing },
  });

  revalidatePath('/accounts');
  return { ok: true, data: undefined };
}

export async function linkContactToAccount(
  accountId: string,
  contactId: string
): Promise<ActionResult> {
  const session = await requireSession();
  if (!can(session, 'accounts:update:all') && !can(session, 'contacts:update:all')) {
    return { ok: false, error: 'Sin permiso para vincular contactos.' };
  }

  await prisma.contact.update({
    where: { id: contactId },
    data: { accountId },
  });

  await writeAudit({
    userId: session.user.id,
    action: 'contact_link',
    resourceId: accountId,
    changes: { contactId },
  });

  revalidatePath(`/accounts/${accountId}`);
  return { ok: true, data: undefined };
}
