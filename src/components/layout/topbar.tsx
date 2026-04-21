'use client';

import { usePathname } from 'next/navigation';
import { Bell, Search } from 'lucide-react';

const TITLES: Record<string, string> = {
  '/': 'Home',
  '/contacts': 'Contactos',
  '/accounts': 'Cuentas',
  '/opportunities': 'Oportunidades',
  '/pipeline': 'Pipeline',
  '/reports': 'Reportes',
  '/settings': 'Ajustes',
  '/settings/users': 'Usuarios',
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

export function Topbar() {
  const pathname = usePathname();
  const title = resolveTitle(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-sysde-border bg-white px-8">
      <h1 className="text-[18px] font-semibold text-sysde-gray">{title}</h1>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sysde-mid" />
          <input
            type="search"
            placeholder="Buscar…"
            className="h-9 w-64 rounded-lg border border-sysde-border bg-sysde-bg pl-9 pr-3 text-sm text-sysde-gray placeholder:text-sysde-mid focus:outline-none focus:ring-2 focus:ring-sysde-red focus:ring-offset-1"
          />
        </div>
        <button
          type="button"
          aria-label="Notificaciones"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-sysde-mid transition-colors hover:bg-sysde-bg hover:text-sysde-gray"
        >
          <Bell className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}
