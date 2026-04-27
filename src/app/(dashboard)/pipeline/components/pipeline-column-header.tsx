'use client';

import Link from 'next/link';
import { MoreVertical, ExternalLink, Download } from 'lucide-react';
import type { OpportunityStage } from '@prisma/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { STAGE_COLORS, STAGE_LABELS, formatMoneyCompact } from '@/lib/shared/labels';

type Props = {
  stage: OpportunityStage;
  count: number;
  total: number;
  weighted: number;
  currency?: string;
};

export function PipelineColumnHeader({
  stage,
  count,
  total,
  weighted,
  currency = 'USD',
}: Props) {
  const colors = STAGE_COLORS[stage];

  return (
    <div
      className="sticky top-0 z-10 rounded-t-[10px] border-b border-l-4 px-4 py-3"
      style={{
        backgroundColor: colors.bg,
        borderLeftColor: colors.border,
        borderBottomColor: colors.border,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="text-[13px] font-semibold uppercase tracking-wide"
            style={{ color: colors.text }}
          >
            {STAGE_LABELS[stage]}
          </span>
          <span
            className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-semibold"
            style={{ color: colors.text }}
          >
            {count}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded text-[0.85rem] opacity-60 transition-opacity hover:opacity-100"
              style={{ color: colors.text }}
              aria-label="Opciones de columna"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/opportunities?stage=${stage}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver todas en tabla
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Download className="mr-2 h-4 w-4" />
              Exportar fase (próximamente)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-1 text-xs" style={{ color: colors.text }}>
        <span className="font-semibold">{formatMoneyCompact(total, currency)}</span>
        <span className="ml-1 opacity-70">· ponderado {formatMoneyCompact(weighted, currency)}</span>
      </div>
    </div>
  );
}
