import type { Session } from 'next-auth';
import { prisma } from '@/lib/db';

export async function listNotifications(session: Session, limit = 20) {
  return prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function countUnreadNotifications(session: Session) {
  return prisma.notification.count({
    where: { userId: session.user.id, isRead: false },
  });
}
