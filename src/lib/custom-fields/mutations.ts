'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit/write';
import {
  customFieldDefinitionSchema,
  type CustomFieldDefinitionInput,
  type CustomFieldEntity,
} from './schemas';

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function requireAdmin() {
  const s = await auth();
  if (!s?.user?.id) throw new Error('Sesión requerida');
  if (!hasRole(s, 'admin')) {
    return { session: s, isAdmin: false } as const;
  }
  return { session: s, isAdmin: true } as const;
}

async function audit(
  userId: string,
  action: string,
  resourceId?: string,
  changes?: unknown
) {
  await writeAuditLog({
    userId,
    action,
    resource: 'custom_fields',
    resourceId,
    changes: (changes ?? null) as Prisma.InputJsonValue,
  });
}

export async function createCustomField(
  input: CustomFieldDefinitionInput
): Promise<Result<{ id: string }>> {
  const { session, isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: 'Solo admins pueden crear campos' };

  const parsed = customFieldDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos' };
  }
  const v = parsed.data;

  const last = await prisma.customFieldDefinition.findFirst({
    where: { entity: v.entity },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (last?.position ?? -1) + 1;

  const created = await prisma.customFieldDefinition.create({
    data: {
      entity: v.entity,
      key: v.key,
      label: v.label,
      type: v.type,
      options: v.options ? (v.options as Prisma.InputJsonValue) : undefined,
      required: v.required,
      description: v.description ?? null,
      position,
    },
    select: { id: true },
  });

  await audit(session.user.id, 'create', created.id, v);
  revalidatePath('/settings/custom-fields');
  return { ok: true, data: { id: created.id } };
}

export async function deleteCustomField(id: string): Promise<Result> {
  const { session, isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: 'Solo admins' };

  await prisma.customFieldDefinition.delete({ where: { id } });
  await audit(session.user.id, 'delete', id);
  revalidatePath('/settings/custom-fields');
  return { ok: true, data: undefined };
}

export async function updateCustomField(
  id: string,
  input: Partial<Pick<CustomFieldDefinitionInput, 'label' | 'options' | 'required' | 'description' | 'position'>>
): Promise<Result> {
  const { session, isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: 'Solo admins' };

  await prisma.customFieldDefinition.update({
    where: { id },
    data: {
      ...(input.label !== undefined && { label: input.label }),
      ...(input.options !== undefined && {
        options: input.options as Prisma.InputJsonValue,
      }),
      ...(input.required !== undefined && { required: input.required }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.position !== undefined && { position: input.position }),
    },
  });

  await audit(session.user.id, 'update', id, input);
  revalidatePath('/settings/custom-fields');
  return { ok: true, data: undefined };
}

type RecordPointer =
  | { entity: 'CONTACT'; recordId: string }
  | { entity: 'ACCOUNT'; recordId: string }
  | { entity: 'OPPORTUNITY'; recordId: string };

export async function setCustomFieldValues(
  pointer: RecordPointer,
  values: Record<string, unknown>
): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Sesión requerida' };

  const definitions = await prisma.customFieldDefinition.findMany({
    where: { entity: pointer.entity },
  });
  const byKey = new Map(definitions.map((d) => [d.key, d]));

  for (const [key, raw] of Object.entries(values)) {
    const def = byKey.get(key);
    if (!def) continue;

    const wrapped = { v: raw } as { v: unknown };
    const where =
      pointer.entity === 'CONTACT'
        ? { fieldId_contactId: { fieldId: def.id, contactId: pointer.recordId } }
        : pointer.entity === 'ACCOUNT'
        ? { fieldId_accountId: { fieldId: def.id, accountId: pointer.recordId } }
        : { fieldId_opportunityId: { fieldId: def.id, opportunityId: pointer.recordId } };

    const data =
      pointer.entity === 'CONTACT'
        ? { fieldId: def.id, contactId: pointer.recordId, value: wrapped as Prisma.InputJsonValue }
        : pointer.entity === 'ACCOUNT'
        ? { fieldId: def.id, accountId: pointer.recordId, value: wrapped as Prisma.InputJsonValue }
        : {
            fieldId: def.id,
            opportunityId: pointer.recordId,
            value: wrapped as Prisma.InputJsonValue,
          };

    if (raw === null || raw === undefined || raw === '') {
      await prisma.customFieldValue
        .deleteMany({
          where:
            pointer.entity === 'CONTACT'
              ? { fieldId: def.id, contactId: pointer.recordId }
              : pointer.entity === 'ACCOUNT'
              ? { fieldId: def.id, accountId: pointer.recordId }
              : { fieldId: def.id, opportunityId: pointer.recordId },
        });
    } else {
      // upsert via composite unique
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.customFieldValue.upsert({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: where as any,
        update: { value: wrapped as Prisma.InputJsonValue },
        create: data,
      });
    }
  }

  await audit(session.user.id, 'set_values', pointer.recordId, {
    entity: pointer.entity,
    keys: Object.keys(values),
  });

  if (pointer.entity === 'CONTACT') revalidatePath(`/contacts/${pointer.recordId}`);
  if (pointer.entity === 'ACCOUNT') revalidatePath(`/accounts/${pointer.recordId}`);
  if (pointer.entity === 'OPPORTUNITY') revalidatePath(`/opportunities/${pointer.recordId}`);

  return { ok: true, data: undefined };
}

export async function reorderCustomFields(
  entity: CustomFieldEntity,
  orderedIds: string[]
): Promise<Result> {
  const { session, isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: 'Solo admins' };

  await Promise.all(
    orderedIds.map((id, idx) =>
      prisma.customFieldDefinition.update({
        where: { id },
        data: { position: idx },
      })
    )
  );

  await audit(session.user.id, 'reorder', undefined, { entity, orderedIds });
  revalidatePath('/settings/custom-fields');
  return { ok: true, data: undefined };
}
