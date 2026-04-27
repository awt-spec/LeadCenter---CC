'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Notification } from '@prisma/client';
import {
  NOTIFICATION_TYPE_ICONS,
  NOTIFICATION_TYPE_LABELS,
} from '@/lib/activities/labels';
import { markNotificationRead } from '@/lib/notifications/mutations';
import { cn } from '@/lib/utils';

type Props = {
  notif: Notification;
  onClick?: () => void;
  compact?: boolean;
};

export function NotificationItem({ notif, onClick, compact }: Props) {
  const router = useRouter();
  const Icon = NOTIFICATION_TYPE_ICONS[notif.type];

  async function handleClick() {
    if (!notif.isRead) {
      await markNotificationRead(notif.id);
    }
    onClick?.();
    if (notif.link) router.push(notif.link);
  }

  const Wrapper: React.ElementType = notif.link ? 'button' : 'div';

  return (
    <Wrapper
      type={notif.link ? 'button' : undefined}
      onClick={notif.link ? handleClick : undefined}
      className={cn(
        'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors',
        !notif.isRead && 'bg-sysde-red-light/50',
        notif.link && 'hover:bg-sysde-bg cursor-pointer'
      )}
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sysde-bg text-sysde-gray">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'truncate text-sm',
            !notif.isRead ? 'font-semibold text-sysde-gray' : 'text-sysde-gray'
          )}
        >
          {notif.title}
        </div>
        {!compact && notif.body && (
          <div className="mt-0.5 line-clamp-2 text-xs text-sysde-mid">{notif.body}</div>
        )}
        <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-sysde-mid">
          <span>{NOTIFICATION_TYPE_LABELS[notif.type]}</span>
          <span>·</span>
          <span>{formatDistanceToNow(notif.createdAt, { addSuffix: true, locale: es })}</span>
        </div>
      </div>
      {!notif.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sysde-red" />}
    </Wrapper>
  );
}
