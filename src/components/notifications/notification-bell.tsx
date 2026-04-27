'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Check } from 'lucide-react';
import type { Notification } from '@prisma/client';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { NotificationItem } from './notification-item';
import { markAllNotificationsRead } from '@/lib/notifications/mutations';
import { cn } from '@/lib/utils';

type Props = {
  initialNotifications: Notification[];
  initialUnread: number;
};

export function NotificationBell({ initialNotifications, initialUnread }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);

  async function handleMarkAll() {
    await markAllNotificationsRead();
    setUnread(0);
    router.refresh();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notificaciones"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-sysde-mid transition-colors hover:bg-sysde-bg hover:text-sysde-gray"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span
              className={cn(
                'absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sysde-red px-1 text-[10px] font-semibold text-white'
              )}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b border-sysde-border px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-sysde-gray">Notificaciones</div>
            <div className="text-xs text-sysde-mid">
              {unread > 0 ? `${unread} sin leer` : 'Todo al día'}
            </div>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAll}>
              <Check className="mr-1 h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[420px]">
          <div className="divide-y divide-sysde-border">
            {initialNotifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-sysde-mid">
                Sin notificaciones todavía.
              </div>
            ) : (
              initialNotifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notif={n}
                  onClick={() => setOpen(false)}
                  compact
                />
              ))
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-sysde-border px-4 py-2 text-center">
          <Link
            href="/inbox"
            onClick={() => setOpen(false)}
            className="text-xs font-medium text-sysde-red hover:underline"
          >
            Ver todas
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
