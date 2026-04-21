import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  if (!params.userId) return null;
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
      metadata: params.metadata,
    },
  });
}

export async function createNotificationsMany(
  items: Parameters<typeof createNotification>[0][]
) {
  if (!items.length) return [];
  return Promise.all(items.map((i) => createNotification(i)));
}
