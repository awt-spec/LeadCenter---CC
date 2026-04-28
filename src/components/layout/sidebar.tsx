'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  Kanban,
  BarChart3,
  Settings,
  Activity as ActivityIcon,
  Inbox,
  Megaphone,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserMenu } from '@/components/layout/user-menu';

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
};

const PRIMARY_NAV: NavItem[] = [
  { label: 'Home', href: '/', icon: LayoutDashboard },
  { label: 'Inbox', href: '/inbox', icon: Inbox },
  { label: 'Base de datos', href: '/contacts', icon: Users },
  { label: 'Cuentas', href: '/accounts', icon: Building2 },
  { label: 'Oportunidades', href: '/opportunities', icon: Briefcase },
  { label: 'Pipeline', href: '/pipeline', icon: Kanban },
  { label: 'Campañas', href: '/campaigns', icon: Megaphone },
  { label: 'Actividad', href: '/activities', icon: ActivityIcon },
  { label: 'Reportes', href: '/reports', icon: BarChart3 },
];

const SECONDARY_NAV: NavItem[] = [
  { label: 'Ajustes', href: '/settings/users', icon: Settings, permission: 'settings:read' },
];

type SidebarProps = {
  user: {
    name: string;
    email: string;
    image?: string | null;
    roles: string[];
  };
  permissions: string[];
};

export function Sidebar({ user, permissions }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderItem = (item: NavItem) => {
    if (item.permission && !permissions.includes(item.permission)) return null;
    const Icon = item.icon;
    const isActive =
      item.href === '/'
        ? pathname === '/'
        : pathname === item.href || pathname.startsWith(`${item.href}/`);

    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sysde-red text-white'
            : 'text-neutral-200 hover:bg-white/10 hover:text-white'
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span>{item.label}</span>
      </Link>
    );
  };

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-6 pb-6 pt-8 lg:pb-6">
        <div>
          <div className="font-display text-xl font-bold tracking-wide text-white">
            SYSDE
          </div>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-neutral-300">
            Lead Center
          </div>
        </div>
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1.5 text-neutral-300 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {PRIMARY_NAV.map(renderItem)}

        {SECONDARY_NAV.some((i) => !i.permission || permissions.includes(i.permission)) && (
          <div className="my-4 h-px bg-white/10" />
        )}

        {SECONDARY_NAV.map(renderItem)}
      </nav>

      <div className="border-t border-white/10 p-3">
        <UserMenu user={user} />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button — fixed top-left */}
      <button
        type="button"
        aria-label="Abrir menú"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 inline-flex items-center justify-center rounded-md border border-sysde-border bg-white p-2 text-sysde-gray shadow-sm transition-colors hover:bg-sysde-bg lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          aria-hidden
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-sysde-gray transition-transform lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col bg-sysde-gray lg:flex">
        {sidebarContent}
      </aside>
    </>
  );
}
