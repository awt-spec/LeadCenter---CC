'use client';

import { signOut } from 'next-auth/react';
import { LogOut, ChevronUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROLE_LABELS } from '@/lib/constants';
import { getInitials } from '@/lib/utils';

type UserMenuProps = {
  user: {
    name: string;
    email: string;
    image?: string | null;
    roles: string[];
  };
};

export function UserMenu({ user }: UserMenuProps) {
  const primaryRole = user.roles[0];
  const roleLabel = primaryRole ? ROLE_LABELS[primaryRole] ?? primaryRole : 'Sin rol';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30">
        <Avatar className="h-9 w-9 shrink-0">
          {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">{user.name}</div>
          <div className="truncate text-xs text-neutral-300">{roleLabel}</div>
        </div>
        <ChevronUp className="h-4 w-4 text-neutral-300" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-2">
          <div className="text-sm font-medium text-sysde-gray">{user.name}</div>
          <div className="truncate text-xs text-sysde-mid">{user.email}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-danger focus:text-danger"
          onSelect={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
