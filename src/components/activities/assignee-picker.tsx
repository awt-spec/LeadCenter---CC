'use client';

import { useState, useTransition } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { assignActivity, unassignActivity } from '@/lib/activities/assignees';
import { getInitials, cn } from '@/lib/utils';

export type AssigneeUser = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  email?: string;
};

export function AssigneePicker({
  activityId,
  initial,
  allUsers,
  size = 'sm',
}: {
  activityId: string;
  initial: AssigneeUser[];
  allUsers: AssigneeUser[];
  size?: 'xs' | 'sm';
}) {
  const router = useRouter();
  const [assignees, setAssignees] = useState(initial);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [pending, startTransition] = useTransition();

  const filtered = q
    ? allUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(q.toLowerCase()) ||
          (u.email ?? '').toLowerCase().includes(q.toLowerCase())
      )
    : allUsers;

  function isAssigned(userId: string) {
    return assignees.some((a) => a.id === userId);
  }

  function persist(next: AssigneeUser[]) {
    const userIds = next.map((a) => a.id);
    startTransition(async () => {
      const r = await assignActivity(activityId, userIds);
      if (!r.ok) {
        toast.error('No se pudo actualizar');
        setAssignees(initial);
        return;
      }
      router.refresh();
    });
  }

  function toggle(user: AssigneeUser) {
    const next = isAssigned(user.id)
      ? assignees.filter((a) => a.id !== user.id)
      : [...assignees, user];
    setAssignees(next);
    persist(next);
  }

  function remove(userId: string) {
    const next = assignees.filter((a) => a.id !== userId);
    setAssignees(next);
    startTransition(async () => {
      const r = await unassignActivity(activityId, userId);
      if (!r.ok) {
        toast.error('No se pudo quitar');
        setAssignees(initial);
        return;
      }
      router.refresh();
    });
  }

  const avatarSize = size === 'xs' ? 'h-5 w-5' : 'h-6 w-6';
  const fontSize = size === 'xs' ? 'text-[8px]' : 'text-[9px]';

  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-1.5">
        {assignees.slice(0, 4).map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => remove(a.id)}
            title={`${a.name} · click para quitar`}
            className="group relative"
          >
            <Avatar className={cn(avatarSize, 'ring-2 ring-white transition-all group-hover:opacity-50')}>
              {a.avatarUrl ? <AvatarImage src={a.avatarUrl} alt={a.name} /> : null}
              <AvatarFallback className={fontSize}>{getInitials(a.name)}</AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 hidden items-center justify-center group-hover:flex">
              <X className="h-3 w-3 text-danger" />
            </span>
          </button>
        ))}
        {assignees.length > 4 && (
          <span
            className={cn(
              avatarSize,
              'flex items-center justify-center rounded-full bg-sysde-bg ring-2 ring-white text-[9px] font-medium text-sysde-mid'
            )}
          >
            +{assignees.length - 4}
          </span>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={pending}
            className={cn(
              avatarSize,
              'flex items-center justify-center rounded-full border border-dashed border-sysde-border text-sysde-mid transition-all hover:border-sysde-red hover:text-sysde-red'
            )}
          >
            <UserPlus className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <div className="border-b border-sysde-border p-2">
            <Input
              autoFocus
              placeholder="Buscar usuario…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-sysde-mid">
                Ningún usuario encontrado.
              </div>
            ) : (
              filtered.map((u) => {
                const assigned = isAssigned(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-sysde-bg"
                  >
                    <Avatar className="h-6 w-6">
                      {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={u.name} /> : null}
                      <AvatarFallback className="text-[9px]">
                        {getInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{u.name}</div>
                      {u.email && (
                        <div className="truncate text-[10px] text-sysde-mid">{u.email}</div>
                      )}
                    </div>
                    {assigned && <Check className="h-3.5 w-3.5 text-sysde-red" />}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
