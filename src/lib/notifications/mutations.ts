'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

type Result = { ok: true } | { ok: false; error: string };

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Sesión requerida');
  return session;
}

export async function markNotificationRead(id: string): Promise<Result> {
  const session = await requireSession();
  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif || notif.userId !== session.user.id) {
    return { ok: false, error: 'No encontrada' };
  }
  await prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath('/inbox');
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<Result> {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath('/inbox');
  return { ok: true };
}

export async function markMentionRead(activityId: string): Promise<Result> {
  const session = await requireSession();
  await prisma.activityMention.updateMany({
    where: { activityId, mentionedUserId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath('/inbox');
  return { ok: true };
}
