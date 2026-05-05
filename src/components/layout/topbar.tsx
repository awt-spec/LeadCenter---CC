'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import type { Notification } from '@prisma/client';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { CommandPalette } from './command-palette';

const TITLES: Record<string, string> = {
  '/': 'Home',
  '/contacts': 'Contactos',
  '/accounts': 'Cuentas',
  '/opportunities': 'Oportunidades',
  '/pipeline': 'Pipeline',
  '/heatmap': 'Mapa de calor',
  '/sprint': 'Sprint',
  '/reports': 'Reportes',
  '/activities': 'Actividad',
  '/inbox': 'Inbox',
  '/settings': 'Ajustes',
  '/settings/users': 'Usuarios',
  '/settings/integrations': 'Integraciones',
};

function resolveTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname]!;
  const segments = pathname.split('/').filter(Boolean);
  while (segments.length) {
    const candidate = '/' + segments.join('/');
    if (TITLES[candidate]) return TITLES[candidate]!;
    segments.pop();
  }
  return 'Lead Center';
}

type Props = {
  notifications: Notification[];
  unreadCount: number;
};

export function Topbar({ notifications, unreadCount }: Props) {
  const pathname = usePathname();
  const title = resolveTitle(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-sysde-border bg-white px-4 pl-14 sm:px-6 lg:px-8 lg:pl-8">
      <h1 className="font-display text-[15px] font-semibold uppercase tracking-wider text-sysde-gray">
        {title}
      </h1>

      <div className="flex items-center gap-3">
        <SearchTrigger />
        <NotificationBell
          initialNotifications={notifications}
          initialUnread={unreadCount}
        />
      </div>
      <CommandPalette />
    </header>
  );
}

function SearchTrigger() {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toLowerCase().includes('mac'));
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        // Send a synthetic Cmd+K to toggle the palette (it listens globally)
        const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: !isMac });
        document.dispatchEvent(ev);
      }}
      className="hidden md:flex h-9 w-64 items-center justify-between rounded-lg border border-sysde-border bg-sysde-bg px-3 text-left text-sm text-sysde-mid transition-colors hover:bg-white"
    >
      <span className="flex items-center gap-2">
        <Search className="h-4 w-4" />
        Buscar…
      </span>
      <kbd className="hidden rounded border border-sysde-border bg-white px-1.5 py-0.5 text-[10px] font-medium text-sysde-mid lg:inline">
        {isMac ? '⌘K' : 'Ctrl+K'}
      </kbd>
    </button>
  );
}
