'use client';

import { useState, useTransition } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { setAccountPriority } from '@/lib/accounts/mutations';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Baja',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

const PRIORITY_STYLE: Record<Priority, string> = {
  LOW: 'bg-slate-100 text-slate-600 ring-slate-200',
  NORMAL: 'bg-blue-50 text-blue-700 ring-blue-200',
  HIGH: 'bg-amber-50 text-amber-700 ring-amber-200',
  URGENT: 'bg-red-50 text-red-700 ring-red-200',
};

const PRIORITY_DOT: Record<Priority, string> = {
  LOW: 'bg-slate-400',
  NORMAL: 'bg-blue-500',
  HIGH: 'bg-amber-500',
  URGENT: 'bg-red-600',
};

const ORDER: Priority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];

export function PriorityCell({
  accountId,
  initial,
  readOnly,
}: {
  accountId: string;
  initial: Priority;
  readOnly?: boolean;
}) {
  const [value, setValue] = useState<Priority>(initial);
  const [pending, startTransition] = useTransition();

  function onSelect(next: Priority) {
    if (next === value) return;
    const prev = value;
    setValue(next); // optimistic
    startTransition(async () => {
      const r = await setAccountPriority(accountId, next);
      if (!r.ok) {
        setValue(prev);
        toast.error(r.error);
      }
    });
  }

  if (readOnly) {
    return <PriorityBadge value={value} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-all',
          'hover:scale-105 focus:outline-none focus:ring-2 focus:ring-sysde-red/30',
          PRIORITY_STYLE[value],
          pending && 'opacity-50'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT[value])} />
        {PRIORITY_LABEL[value]}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onClick={(e) => e.stopPropagation()}
        className="w-36"
      >
        {ORDER.map((p) => (
          <DropdownMenuItem
            key={p}
            onSelect={() => onSelect(p)}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full', PRIORITY_DOT[p])} />
              {PRIORITY_LABEL[p]}
            </span>
            {p === value && <Check className="h-3 w-3 text-sysde-mid" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PriorityBadge({ value }: { value: Priority }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1',
        PRIORITY_STYLE[value]
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT[value])} />
      {PRIORITY_LABEL[value]}
    </span>
  );
}
