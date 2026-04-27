'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { togglePermission } from '@/lib/rbac-admin';
import { cn } from '@/lib/utils';

export function PermissionToggle({
  roleId,
  permissionId,
  initial,
  disabled,
}: {
  roleId: string;
  permissionId: string;
  initial: boolean;
  disabled?: boolean;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (disabled) return;
    const next = !enabled;
    setEnabled(next); // optimistic
    startTransition(async () => {
      const r = await togglePermission(roleId, permissionId, next);
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
      disabled={disabled || pending}
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded border transition-all',
        disabled
          ? 'cursor-not-allowed border-sysde-border bg-sysde-bg opacity-50'
          : enabled
          ? 'border-sysde-red bg-sysde-red hover:scale-110'
          : 'border-sysde-border hover:border-sysde-red/50',
        pending && 'opacity-60'
      )}
    >
      {enabled && <Check className="h-3 w-3 text-white" />}
    </button>
  );
}
