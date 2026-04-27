'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { assignUserRole } from '@/lib/rbac-admin';
import { cn } from '@/lib/utils';

export function RoleToggle({
  userId,
  roleId,
  roleLabel,
  initial,
}: {
  userId: string;
  roleId: string;
  roleLabel: string;
  initial: boolean;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();

  function onClick() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const r = await assignUserRole(userId, roleId, next);
      if (!r.ok) {
        setEnabled(!next);
        toast.error(r.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-all',
        enabled
          ? 'bg-sysde-red-light text-sysde-red ring-sysde-red/30 hover:scale-105'
          : 'bg-white text-sysde-mid ring-sysde-border hover:bg-sysde-bg',
        pending && 'opacity-60'
      )}
    >
      {enabled && <Check className="h-3 w-3" />}
      {roleLabel}
    </button>
  );
}
