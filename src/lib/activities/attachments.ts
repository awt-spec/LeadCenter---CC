'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { z } from 'zod';

type Result =
  | { ok: true }
  | { ok: false; error: string };

const attachmentSchema = z.object({
  activityId: z.string(),
  fileName: z.string().min(1).max(200),
  fileUrl: z.string().url(),
  fileSize: z.number().int().min(0).default(0),
  mimeType: z.string().min(1).max(100).default('application/octet-stream'),
});

export type AttachmentInput = z.infer<typeof attachmentSchema>;

async function requireSession() {
  const s = await auth();
  if (!s?.user?.id) throw new Error('Sesión requerida');
  return s;
}

export async function addAttachment(input: AttachmentInput): Promise<Result> {
  const session = await requireSession();
  const parsed = attachmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const v = parsed.data;
  const activity = await prisma.activity.findUnique({
    where: { id: v.activityId },
    select: { contactId: true, accountId: true, opportunityId: true, createdById: true },
  });
  if (!activity) return { ok: false, error: 'Actividad no encontrada' };

  await prisma.activityAttachment.create({
    data: {
      activityId: v.activityId,
      fileName: v.fileName,
      fileUrl: v.fileUrl,
      fileSize: v.fileSize,
      mimeType: v.mimeType,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'attachment_add',
      resource: 'activities',
      resourceId: v.activityId,
      changes: { fileName: v.fileName, fileUrl: v.fileUrl },
    },
  });

  revalidatePath('/activities');
  if (activity.accountId) revalidatePath(`/accounts/${activity.accountId}`);
  if (activity.opportunityId) revalidatePath(`/opportunities/${activity.opportunityId}`);
  if (activity.contactId) revalidatePath(`/contacts/${activity.contactId}`);
  return { ok: true };
}

export async function deleteAttachment(attachmentId: string): Promise<Result> {
  await requireSession();
  await prisma.activityAttachment.delete({ where: { id: attachmentId } });
  revalidatePath('/activities');
  return { ok: true };
}
