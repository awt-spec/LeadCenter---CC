'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/shared/labels';
import { cn } from '@/lib/utils';

type Props = {
  openCount: number;
  pipelineTotal: number;
  forecast: number;
  canCreate: boolean;
};

export function PipelineHeader({ openCount, pipelineTotal, forecast, canCreate }: Props) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-[24px] font-semibold text-sysde-gray">Pipeline</h2>
        <p className="mt-1 text-sm text-sysde-mid">
          {openCount} oportunidades abiertas · Pipeline {formatMoney(pipelineTotal)} · Forecast{' '}
          {formatMoney(forecast)}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-lg border border-sysde-border bg-white p-1 text-sm">
          <button
            type="button"
            onClick={() => router.push('/opportunities')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors',
              'text-sysde-mid hover:bg-sysde-bg hover:text-sysde-gray'
            )}
          >
            <TableIcon className="h-3.5 w-3.5" />
            Tabla
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-sysde-bg px-3 py-1 font-medium text-sysde-gray"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Kanban
          </button>
        </div>

        {canCreate && (
          <Button asChild>
            <Link href="/opportunities/new">
              <Plus className="mr-2 h-4 w-4" />
              Nueva oportunidad
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
