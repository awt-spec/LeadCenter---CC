'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical, Play, Pause, Archive, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { setCampaignStatus } from '@/lib/campaigns/mutations';
import type { CampaignStatus } from '@prisma/client';

export function CampaignQuickActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: CampaignStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  function go(next: CampaignStatus) {
    start(async () => {
      const r = await setCampaignStatus(campaignId, next);
      if (r.ok) {
        toast.success(`Campaña → ${next}`);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <button
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sysde-mid hover:bg-sysde-bg hover:text-sysde-gray"
          aria-label="Acciones"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        {(status === 'PAUSED' || status === 'DRAFT') && (
          <DropdownMenuItem onSelect={() => go('ACTIVE')}>
            <Play className="mr-2 h-3.5 w-3.5 text-emerald-600" />
            Activar
          </DropdownMenuItem>
        )}
        {status === 'ACTIVE' && (
          <DropdownMenuItem onSelect={() => go('PAUSED')}>
            <Pause className="mr-2 h-3.5 w-3.5 text-amber-600" />
            Pausar
          </DropdownMenuItem>
        )}
        {status !== 'COMPLETED' && status !== 'ARCHIVED' && (
          <DropdownMenuItem onSelect={() => go('COMPLETED')}>
            <Archive className="mr-2 h-3.5 w-3.5 text-blue-600" />
            Marcar completada
          </DropdownMenuItem>
        )}
        {status !== 'ARCHIVED' && (
          <DropdownMenuItem onSelect={() => go('ARCHIVED')}>
            <Archive className="mr-2 h-3.5 w-3.5 text-sysde-mid" />
            Archivar
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/campaigns/${campaignId}/edit`} className="flex items-center">
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Editar
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
