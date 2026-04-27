'use client';

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
  { label: 'Contactos', href: '/contacts', icon: Users },
  { label: 'Cuentas', href: '/accounts', icon: Building2 },
  { label: 'Oportunidades', href: '/opportunities', icon: Briefcase },
  { label: 'Pipeline', href: '/pipeline', icon: Kanban },
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

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col bg-sysde-gray">
      <div className="px-6 pb-6 pt-8">
        <div className="text-xl font-bold tracking-tight text-white">SYSDE</div>
        <div className="mt-0.5 text-xs font-medium text-neutral-300">Lead Center</div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {PRIMARY_NAV.map(renderItem)}

        {SECONDARY_NAV.some((i) => !i.permission || permissions.includes(i.permission)) && (
          <div className="my-4 h-px bg-white/10" />
        )}

        {SECONDARY_NAV.map(renderItem)}
      </nav>

      <div className="border-t border-white/10 p-3">
        <UserMenu user={user} />
      </div>
    </aside>
  );
}
