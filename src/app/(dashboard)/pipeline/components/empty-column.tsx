'use client';

import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { usePipelineFilters } from '@/lib/pipeline/use-pipeline-filters';

export function EmptyColumn() {
  const { activeCount, clear } = usePipelineFilters();
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-sysde-border bg-white/40 px-4 py-8 text-center">
      <Inbox className="mb-2 h-6 w-6 text-neutral-300" />
      <div className="text-xs font-medium text-sysde-mid">Sin oportunidades</div>
      {activeCount > 0 && (
        <button
          type="button"
          onClick={clear}
          className="mt-1 text-[11px] text-sysde-red hover:underline"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

export function OverLimitNotice({ stage, total }: { stage: string; total: number }) {
  return (
    <Link
      href={`/opportunities?stage=${stage}`}
      className="mt-1 block rounded-lg border border-dashed border-sysde-border bg-amber-50/60 px-3 py-2 text-center text-[11px] text-sysde-mid hover:border-warning hover:text-sysde-gray"
    >
      Mostrando primeras 20 de {total} · Ver todas
    </Link>
  );
}
