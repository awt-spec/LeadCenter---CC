'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit/write';

type Result =
  | { ok: true }
  | { ok: false; error: string };

async function requireSession() {
  const s = await auth();
  if (!s?.user?.id) throw new Error('Sesión requerida');
  return s;
}

export async function assignActivity(
  activityId: string,
  userIds: string[]
): Promise<Result> {
  const session = await requireSession();

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { createdById: true, accountId: true, opportunityId: true, contactId: true },
  });
  if (!activity) return { ok: false, error: 'Actividad no encontrada' };

  // Anyone with activities:create can assign
  await prisma.activity.update({
    where: { id: activityId },
    data: {
      assignees: {
        deleteMany: {},
        create: userIds.map((userId) => ({ userId })),
      },
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: 'assign',
    resource: 'activities',
    resourceId: activityId,
    changes: { userIds },
  });

  // Notify each new assignee
  for (const uid of userIds) {
    if (uid === session.user.id) continue;
    await prisma.notification.create({
      data: {
        userId: uid,
        type: 'ASSIGNED_NEXT_ACTION',
        title: 'Te asignaron una actividad',
        body: 'Revisa la actividad para ver los detalles.',
        link: '/activities',
        isRead: false,
      },
    });
  }

  revalidatePath('/activities');
  if (activity.accountId) revalidatePath(`/accounts/${activity.accountId}`);
  if (activity.opportunityId) revalidatePath(`/opportunities/${activity.opportunityId}`);
  if (activity.contactId) revalidatePath(`/contacts/${activity.contactId}`);
  return { ok: true };
}

export async function unassignActivity(
  activityId: string,
  userId: string
): Promise<Result> {
  await requireSession();
  await prisma.activityAssignee.delete({
    where: { activityId_userId: { activityId, userId } },
  });
  revalidatePath('/activities');
  return { ok: true };
}
