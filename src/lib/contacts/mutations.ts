'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit/write';
import {
  contactFormSchema,
  type ContactFormValues,
  bulkUpdateSchema,
  type BulkUpdateInput,
  importOptionsSchema,
  type ImportOptionsInput,
  REQUIRED_IMPORT_FIELDS,
  type ImportFieldKey,
} from './schemas';
import {
  ContactSource,
  ContactStatus,
  MarketSegment,
  SeniorityLevel,
} from '@prisma/client';

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Sesión requerida');
  }
  return session;
}

function buildDiff<T extends Record<string, unknown>>(before: T, after: T) {
  const changes: { before: Record<string, unknown>; after: Record<string, unknown> } = {
    before: {},
    after: {},
  };
  for (const key of Object.keys(after)) {
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changes.before[key] = b ?? null;
      changes.after[key] = a ?? null;
    }
  }
  return changes;
}

async function writeAudit(params: {
  userId: string;
  action: string;
  resourceId?: string;
  changes?: unknown;
  metadata?: unknown;
}) {
  await writeAuditLog({
    userId: params.userId,
    action: params.action,
    resource: 'contacts',
    resourceId: params.resourceId,
    changes: (params.changes ?? null) as Prisma.InputJsonValue,
    metadata: (params.metadata ?? null) as Prisma.InputJsonValue,
  });
}

export async function createContact(
  input: ContactFormValues
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  if (!can(session, 'contacts:create')) {
    return { ok: false, error: 'No tienes permiso para crear contactos.' };
  }

  const parsed = contactFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const data = parsed.data;

  const existing = await prisma.contact.findUnique({ where: { email: data.email } });
  if (existing) {
    return {
      ok: false,
      error: 'Ya existe un contacto con ese email.',
      fieldErrors: { email: 'Email duplicado' },
    };
  }

  const contact = await prisma.$transaction(async (tx) => {
    const { tagIds, accountId, ownerId, marketSegment, productInterest, optIn, ...rest } = data;
    const c = await tx.contact.create({
      data: {
        ...rest,
        fullName: `${data.firstName} ${data.lastName}`,
        accountId: accountId ?? undefined,
        ownerId: ownerId ?? undefined,
        marketSegment: marketSegment ?? undefined,
        productInterest: productInterest ?? [],
        optIn,
        optInDate: optIn ? new Date() : null,
        createdById: session.user.id,
      },
    });
    if (tagIds.length) {
      await tx.contactTag.createMany({
        data: tagIds.map((tagId) => ({ contactId: c.id, tagId })),
        skipDuplicates: true,
      });
    }
    return c;
  });

  await writeAudit({
    userId: session.user.id,
    action: 'create',
    resourceId: contact.id,
    changes: { after: contact },
  });

  revalidatePath('/contacts');
  return { ok: true, data: { id: contact.id } };
}

export async function updateContact(
  id: string,
  input: ContactFormValues
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  const existing = await prisma.contact.findUnique({
    where: { id },
    include: { tags: true },
  });
  if (!existing) return { ok: false, error: 'Contacto no encontrado' };

  const isOwn = existing.ownerId === session.user.id;
  const hasAll = can(session, 'contacts:update:all');
  const hasOwn = can(session, 'contacts:update:own');
  if (!hasAll && !(hasOwn && isOwn)) {
    return { ok: false, error: 'No tienes permiso para editar este contacto.' };
  }

  const parsed = contactFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const data = parsed.data;

  if (data.email !== existing.email) {
    const dup = await prisma.contact.findUnique({ where: { email: data.email } });
    if (dup) {
      return {
        ok: false,
        error: 'Ya existe un contacto con ese email.',
        fieldErrors: { email: 'Email duplicado' },
      };
    }
  }

  const before = { ...existing, tagIds: existing.tags.map((t) => t.tagId) };

  const updated = await prisma.$transaction(async (tx) => {
    const { tagIds, accountId, ownerId, marketSegment, productInterest, optIn, ...rest } = data;
    const c = await tx.contact.update({
      where: { id },
      data: {
        ...rest,
        fullName: `${data.firstName} ${data.lastName}`,
        accountId: accountId ?? null,
        ownerId: ownerId ?? null,
        marketSegment: marketSegment ?? null,
        productInterest: productInterest ?? [],
        optIn,
        optInDate: optIn && !existing.optIn ? new Date() : existing.optInDate,
      },
    });
    await tx.contactTag.deleteMany({ where: { contactId: id } });
    if (tagIds.length) {
      await tx.contactTag.createMany({
        data: tagIds.map((tagId) => ({ contactId: id, tagId })),
        skipDuplicates: true,
      });
    }
    return c;
  });

  const after = { ...updated, tagIds: data.tagIds };

  await writeAudit({
    userId: session.user.id,
    action: 'update',
    resourceId: id,
    changes: buildDiff(before as Record<string, unknown>, after as Record<string, unknown>),
  });

  revalidatePath('/contacts');
  revalidatePath(`/contacts/${id}`);
  return { ok: true, data: { id } };
}

export async function deleteContact(id: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!can(session, 'contacts:delete')) {
    return { ok: false, error: 'No tienes permiso para eliminar contactos.' };
  }

  const existing = await prisma.contact.findUnique({ where: { id }, include: { tags: true } });
  if (!existing) return { ok: false, error: 'Contacto no encontrado' };

  await prisma.contact.delete({ where: { id } });

  await writeAudit({
    userId: session.user.id,
    action: 'delete',
    resourceId: id,
    changes: { before: existing },
  });

  revalidatePath('/contacts');
  return { ok: true, data: undefined };
}

export async function bulkUpdateContacts(input: BulkUpdateInput): Promise<ActionResult<{ affected: number }>> {
  const session = await requireSession();

  const parsed = bulkUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const body = parsed.data;

  if (body.action === 'delete' && !can(session, 'contacts:delete')) {
    return { ok: false, error: 'Sin permiso para eliminar.' };
  }
  if (body.action !== 'delete' && !can(session, 'contacts:update:all')) {
    return { ok: false, error: 'Sin permiso para editar en masa.' };
  }

  let affected = 0;

  if (body.action === 'delete') {
    const res = await prisma.contact.deleteMany({ where: { id: { in: body.contactIds } } });
    affected = res.count;
  } else if (body.action === 'assign_owner') {
    const res = await prisma.contact.updateMany({
      where: { id: { in: body.contactIds } },
      data: { ownerId: body.ownerId ?? null },
    });
    affected = res.count;
  } else if (body.action === 'change_status') {
    if (!body.status) return { ok: false, error: 'Status requerido' };
    const res = await prisma.contact.updateMany({
      where: { id: { in: body.contactIds } },
      data: { status: body.status },
    });
    affected = res.count;
  } else if (body.action === 'add_tags') {
    if (!body.tagIds?.length) return { ok: false, error: 'Tags requeridos' };
    const pairs = body.contactIds.flatMap((contactId) =>
      body.tagIds!.map((tagId) => ({ contactId, tagId }))
    );
    await prisma.contactTag.createMany({ data: pairs, skipDuplicates: true });
    affected = body.contactIds.length;
  }

  await writeAudit({
    userId: session.user.id,
    action: 'bulk_update',
    metadata: { action: body.action, contactIds: body.contactIds, payload: body },
  });

  revalidatePath('/contacts');
  return { ok: true, data: { affected } };
}

export async function processImport(
  input: ImportOptionsInput
): Promise<ActionResult<{ batchId: string }>> {
  const session = await requireSession();
  if (!can(session, 'contacts:import_csv')) {
    return { ok: false, error: 'No tienes permiso para importar contactos.' };
  }

  const parsed = importOptionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const body = parsed.data;

  // Validate required mapping
  const mappedFields = new Set(Object.values(body.columnMapping));
  for (const f of REQUIRED_IMPORT_FIELDS) {
    if (!mappedFields.has(f)) {
      return { ok: false, error: `Falta mapear el campo requerido: ${f}` };
    }
  }

  const batch = await prisma.importBatch.create({
    data: {
      fileName: body.fileName,
      fileSize: body.fileSize,
      totalRows: body.rows.length,
      status: 'PROCESSING',
      columnMapping: body.columnMapping,
      dedupeStrategy: body.dedupeStrategy,
      defaultValues: {
        ownerId: body.defaultOwnerId ?? session.user.id,
        source: body.defaultSource,
        status: body.defaultStatus,
        tagIds: body.applyTagIds,
        optIn: body.markOptIn,
      },
      startedAt: new Date(),
      createdById: session.user.id,
    },
  });

  type RowError = { row: number; email?: string; message: string };
  const errors: RowError[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  const batchSize = 100;
  for (let i = 0; i < body.rows.length; i += batchSize) {
    const chunk = body.rows.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async (rawRow, idx) => {
        const rowIdx = i + idx + 1;
        try {
          const mapped = mapRow(rawRow, body.columnMapping as Record<string, ImportFieldKey | 'ignore'>);

          if (!mapped.email || !mapped.firstName || !mapped.lastName) {
            failedCount++;
            errors.push({
              row: rowIdx,
              email: mapped.email,
              message: 'Faltan campos requeridos (email, firstName, lastName)',
            });
            return;
          }

          const emailNormalized = mapped.email.toLowerCase().trim();
          const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized);
          if (!emailValid) {
            failedCount++;
            errors.push({ row: rowIdx, email: mapped.email, message: 'Email inválido' });
            return;
          }

          const existing = await prisma.contact.findUnique({ where: { email: emailNormalized } });

          if (existing) {
            if (body.dedupeStrategy === 'SKIP') {
              skippedCount++;
              return;
            }
            if (body.dedupeStrategy === 'UPDATE') {
              await prisma.contact.update({
                where: { email: emailNormalized },
                data: {
                  ...buildContactDataFromRow(mapped, body, session.user.id, true),
                  importBatchId: batch.id,
                },
              });
              if (body.applyTagIds.length) {
                await prisma.contactTag.createMany({
                  data: body.applyTagIds.map((tagId) => ({ contactId: existing.id, tagId })),
                  skipDuplicates: true,
                });
              }
              updatedCount++;
              return;
            }
            // CREATE_NEW -> fall through to create, but change email to avoid unique conflict
            // Actually unique constraint on email prevents this; record as skipped w/ message
            skippedCount++;
            errors.push({
              row: rowIdx,
              email: mapped.email,
              message: 'Email ya existe (CREATE_NEW no puede duplicar email único)',
            });
            return;
          }

          const baseData = buildContactDataFromRow(mapped, body, session.user.id, false);
          const created = await prisma.contact.create({
            data: {
              ...(baseData as Prisma.ContactUncheckedCreateInput),
              email: emailNormalized,
              firstName: mapped.firstName!,
              lastName: mapped.lastName!,
              fullName: `${mapped.firstName} ${mapped.lastName}`,
              createdById: session.user.id,
              importBatchId: batch.id,
            },
          });

          if (body.applyTagIds.length) {
            await prisma.contactTag.createMany({
              data: body.applyTagIds.map((tagId) => ({ contactId: created.id, tagId })),
              skipDuplicates: true,
            });
          }
          if (mapped.tags) {
            const names = mapped.tags
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean);
            for (const tagName of names) {
              const tag = await prisma.tag.upsert({
                where: { name: tagName },
                update: {},
                create: { name: tagName },
              });
              await prisma.contactTag.upsert({
                where: { contactId_tagId: { contactId: created.id, tagId: tag.id } },
                update: {},
                create: { contactId: created.id, tagId: tag.id },
              });
            }
          }
          createdCount++;
        } catch (err) {
          failedCount++;
          errors.push({
            row: rowIdx,
            message: err instanceof Error ? err.message : 'Error desconocido',
          });
        }
      })
    );
  }

  const finalStatus =
    failedCount > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status: finalStatus,
      createdCount,
      updatedCount,
      skippedCount,
      failedCount,
      errors: errors.length ? (errors as Prisma.InputJsonValue) : undefined,
      completedAt: new Date(),
    },
  });

  await writeAudit({
    userId: session.user.id,
    action: 'import',
    resourceId: batch.id,
    metadata: {
      fileName: body.fileName,
      totalRows: body.rows.length,
      createdCount,
      updatedCount,
      skippedCount,
      failedCount,
    },
  });

  revalidatePath('/contacts');
  return { ok: true, data: { batchId: batch.id } };
}

function mapRow(raw: Record<string, string>, mapping: Record<string, ImportFieldKey | 'ignore'>) {
  const out: Record<string, string | undefined> = {};
  for (const [csvCol, field] of Object.entries(mapping)) {
    if (field === 'ignore') continue;
    const value = raw[csvCol];
    if (value !== undefined && value !== '') {
      out[field] = String(value).trim();
    }
  }
  return out as {
    email?: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    jobTitle?: string;
    seniorityLevel?: string;
    country?: string;
    city?: string;
    phone?: string;
    mobilePhone?: string;
    linkedinUrl?: string;
    website?: string;
    source?: string;
    sourceDetail?: string;
    marketSegment?: string;
    notes?: string;
    tags?: string;
  };
}

function buildContactDataFromRow(
  mapped: ReturnType<typeof mapRow>,
  body: ImportOptionsInput,
  userId: string,
  isUpdate: boolean
): Prisma.ContactUncheckedUpdateInput {
  const seniority = mapped.seniorityLevel
    ? (Object.values(SeniorityLevel).find(
        (s) => s.toLowerCase() === mapped.seniorityLevel!.toLowerCase()
      ) as SeniorityLevel | undefined)
    : undefined;
  const source = mapped.source
    ? (Object.values(ContactSource).find(
        (s) => s.toLowerCase() === mapped.source!.toLowerCase()
      ) as ContactSource | undefined) ?? body.defaultSource
    : body.defaultSource;
  const segment = mapped.marketSegment
    ? (Object.values(MarketSegment).find(
        (s) => s.toLowerCase() === mapped.marketSegment!.toLowerCase()
      ) as MarketSegment | undefined)
    : undefined;

  const data: Prisma.ContactUncheckedUpdateInput = {
    jobTitle: mapped.jobTitle,
    companyName: mapped.companyName,
    country: mapped.country,
    city: mapped.city,
    phone: mapped.phone,
    mobilePhone: mapped.mobilePhone,
    linkedinUrl: mapped.linkedinUrl,
    website: mapped.website,
    source,
    sourceDetail: mapped.sourceDetail,
    notes: mapped.notes,
    status: body.defaultStatus as ContactStatus,
    ownerId: body.defaultOwnerId ?? userId,
    optIn: body.markOptIn,
    optInDate: body.markOptIn ? new Date() : undefined,
  };
  if (seniority) data.seniorityLevel = seniority;
  if (segment) data.marketSegment = segment;

  if (isUpdate) {
    // Don't override firstName/lastName on update to avoid clobbering
    data.firstName = mapped.firstName;
    data.lastName = mapped.lastName;
    if (mapped.firstName && mapped.lastName) {
      data.fullName = `${mapped.firstName} ${mapped.lastName}`;
    }
  }

  return data;
}

export async function logExportEvent(filters: unknown, count: number) {
  const session = await requireSession();
  if (!can(session, 'contacts:export_csv')) {
    throw new Error('Sin permiso para exportar.');
  }
  await writeAudit({
    userId: session.user.id,
    action: 'export',
    metadata: { filters, count },
  });
  return { ok: true };
}

function fieldErrorsFromZod(error: import('zod').ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
