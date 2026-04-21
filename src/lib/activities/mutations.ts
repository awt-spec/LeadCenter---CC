'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { activityFormSchema, type ActivityFormValues } from './schemas';
import { parseMentionsFromDoc, plainTextFromDoc } from '@/lib/mentions/parse-mentions';
import { createNotification } from '@/lib/notifications/create-notification';

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Sesión requerida');
  return session;
}

function fieldErrorsFromZod(error: import('zod').ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

async function writeAudit(params: {
  userId: string;
  action: string;
  resourceId?: string;
  changes?: unknown;
  metadata?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      resource: 'activities',
      resourceId: params.resourceId,
      changes: (params.changes ?? null) as Prisma.InputJsonValue,
      metadata: (params.metadata ?? null) as Prisma.InputJsonValue,
    },
  });
}

export async function createActivity(
  input: ActivityFormValues
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  if (!can(session, 'activities:create')) {
    return { ok: false, error: 'No tienes permiso para crear actividades.' };
  }

  const parsed = activityFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const data = parsed.data;

  const mentionUserIds = new Set<string>(data.mentionUserIds);
  for (const id of parseMentionsFromDoc(data.bodyJson)) mentionUserIds.add(id);
  mentionUserIds.delete(session.user.id); // don't notify self

  const bodyText = data.bodyText ?? plainTextFromDoc(data.bodyJson);
  const now = data.occurredAt ?? new Date();

  const activity = await prisma.$transaction(async (tx) => {
    const a = await tx.activity.create({
      data: {
        type: data.type,
        subtype: data.subtype,
        subject: data.subject,
        bodyJson: (data.bodyJson ?? null) as Prisma.InputJsonValue,
        bodyText,
        tags: data.tags,
        occurredAt: now,
        durationMinutes: data.durationMinutes ?? undefined,
        contactId: data.contactId ?? undefined,
        accountId: data.accountId ?? undefined,
        opportunityId: data.opportunityId ?? undefined,
        nextActionType: data.nextActionType ?? undefined,
        nextActionNote: data.nextActionNote,
        nextActionDate: data.nextActionDate ?? undefined,
        nextActionAssigneeId: data.nextActionAssigneeId ?? undefined,
        outcome: data.outcome ?? undefined,
        templateKey: data.templateKey,
        createdById: session.user.id,
      },
    });

    if (data.participantContactIds.length) {
      await tx.activityParticipant.createMany({
        data: data.participantContactIds.map((contactId) => ({
          activityId: a.id,
          contactId,
        })),
        skipDuplicates: true,
      });
    }

    if (mentionUserIds.size) {
      await tx.activityMention.createMany({
        data: Array.from(mentionUserIds).map((userId) => ({
          activityId: a.id,
          mentionedUserId: userId,
        })),
        skipDuplicates: true,
      });
    }

    // Update lastActivityAt on linked entities
    if (data.contactId) {
      await tx.contact.update({
        where: { id: data.contactId },
        data: { lastActivityAt: now, lastContactedAt: isClientFacing(data.type) ? now : undefined },
      });
    }
    if (data.opportunityId) {
      await tx.opportunity.update({
        where: { id: data.opportunityId },
        data: {
          lastActivityAt: now,
          ...(data.nextActionDate && {
            nextActionDate: data.nextActionDate,
            nextActionNote: data.nextActionNote,
          }),
        },
      });
    }

    return a;
  });

  // Notifications (outside transaction to avoid blocking)
  const linkFor = (): string => {
    if (activity.opportunityId) return `/opportunities/${activity.opportunityId}`;
    if (activity.contactId) return `/contacts/${activity.contactId}`;
    if (activity.accountId) return `/accounts/${activity.accountId}`;
    return '/activities';
  };

  for (const userId of mentionUserIds) {
    await createNotification({
      userId,
      type: 'MENTION',
      title: `${session.user.name ?? 'Alguien'} te mencionó`,
      body: activity.subject,
      link: linkFor(),
      metadata: { activityId: activity.id } as Prisma.InputJsonValue,
    });
  }

  if (
    data.nextActionAssigneeId &&
    data.nextActionAssigneeId !== session.user.id
  ) {
    await createNotification({
      userId: data.nextActionAssigneeId,
      type: 'ASSIGNED_NEXT_ACTION',
      title: 'Te asignaron una próxima acción',
      body:
        data.nextActionNote ??
        (data.nextActionType ? `Próxima acción: ${data.nextActionType}` : 'Nueva tarea'),
      link: linkFor(),
      metadata: { activityId: activity.id } as Prisma.InputJsonValue,
    });
  }

  await writeAudit({
    userId: session.user.id,
    action: 'activity_created',
    resourceId: activity.id,
    metadata: { type: activity.type, templateKey: activity.templateKey },
  });

  const paths = [
    '/activities',
    '/inbox',
    data.contactId ? `/contacts/${data.contactId}` : null,
    data.accountId ? `/accounts/${data.accountId}` : null,
    data.opportunityId ? `/opportunities/${data.opportunityId}` : null,
    '/pipeline',
  ].filter(Boolean) as string[];
  paths.forEach((p) => revalidatePath(p));

  return { ok: true, data: { id: activity.id } };
}

export async function updateActivity(
  id: string,
  input: ActivityFormValues
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  const existing = await prisma.activity.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: 'Actividad no encontrada' };
  if (existing.createdById !== session.user.id && !can(session, 'activities:update:own')) {
    return { ok: false, error: 'Sin permiso para editar esta actividad.' };
  }
  const parsed = activityFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const data = parsed.data;

  const bodyText = data.bodyText ?? plainTextFromDoc(data.bodyJson);
  const occurredAt = data.occurredAt ?? existing.occurredAt;

  await prisma.activity.update({
    where: { id },
    data: {
      type: data.type,
      subtype: data.subtype,
      subject: data.subject,
      bodyJson: (data.bodyJson ?? null) as Prisma.InputJsonValue,
      bodyText,
      tags: data.tags,
      occurredAt,
      durationMinutes: data.durationMinutes ?? null,
      nextActionType: data.nextActionType ?? null,
      nextActionNote: data.nextActionNote,
      nextActionDate: data.nextActionDate,
      nextActionAssigneeId: data.nextActionAssigneeId ?? null,
      outcome: data.outcome ?? null,
      templateKey: data.templateKey,
    },
  });

  await writeAudit({
    userId: session.user.id,
    action: 'activity_updated',
    resourceId: id,
  });

  revalidatePath('/activities');
  return { ok: true, data: { id } };
}

export async function deleteActivity(id: string): Promise<ActionResult> {
  const session = await requireSession();
  const existing = await prisma.activity.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: 'Actividad no encontrada' };
  if (existing.createdById !== session.user.id && !can(session, 'contacts:update:all')) {
    return { ok: false, error: 'Sin permiso para eliminar.' };
  }
  await prisma.activity.delete({ where: { id } });
  await writeAudit({
    userId: session.user.id,
    action: 'activity_deleted',
    resourceId: id,
    changes: { before: existing },
  });
  revalidatePath('/activities');
  return { ok: true, data: undefined };
}

export async function completeNextAction(activityId: string): Promise<ActionResult> {
  const session = await requireSession();
  const existing = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!existing) return { ok: false, error: 'Actividad no encontrada' };
  if (
    existing.nextActionAssigneeId !== session.user.id &&
    existing.createdById !== session.user.id &&
    !can(session, 'contacts:update:all')
  ) {
    return { ok: false, error: 'Solo el asignado puede marcar como completada.' };
  }

  await prisma.activity.update({
    where: { id: activityId },
    data: {
      nextActionCompleted: true,
      nextActionCompletedAt: new Date(),
    },
  });

  await writeAudit({
    userId: session.user.id,
    action: 'next_action_completed',
    resourceId: activityId,
  });

  revalidatePath('/activities');
  revalidatePath('/inbox');
  revalidatePath('/pipeline');
  if (existing.opportunityId) revalidatePath(`/opportunities/${existing.opportunityId}`);
  if (existing.contactId) revalidatePath(`/contacts/${existing.contactId}`);
  if (existing.accountId) revalidatePath(`/accounts/${existing.accountId}`);

  return { ok: true, data: undefined };
}

function isClientFacing(type: import('@prisma/client').ActivityType): boolean {
  return (
    type === 'CALL' ||
    type === 'EMAIL_SENT' ||
    type === 'EMAIL_RECEIVED' ||
    type === 'WHATSAPP' ||
    type === 'MEETING' ||
    type === 'DEMO' ||
    type === 'MATERIAL_SENT' ||
    type === 'PROPOSAL_SENT' ||
    type === 'LINKEDIN_MESSAGE'
  );
}

export async function searchUsersForMention(q: string) {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      email: { endsWith: '@sysde.com' },
      OR: q
        ? [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ]
        : undefined,
    },
    select: { id: true, name: true, email: true, avatarUrl: true },
    orderBy: { name: 'asc' },
    take: 10,
  });
  return users;
}
