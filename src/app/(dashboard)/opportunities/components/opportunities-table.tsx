'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StageBadge } from './stage-badge';
import { PRODUCT_LABELS, RATING_LABELS, formatMoney } from '@/lib/shared/labels';
import { getInitials, cn } from '@/lib/utils';

export type OpportunityRow = {
  id: string;
  code: string | null;
  name: string;
  stage: string;
  status: string;
  product: string;
  rating: string;
  estimatedValue: number | null;
  currency: string;
  probability: number;
  expectedCloseDate: Date | null;
  nextActionDate: Date | null;
  updatedAt: Date;
  account: { id: string; name: string; country: string | null };
  owner: { id: string; name: string; avatarUrl: string | null } | null;
};

export function OpportunitiesTable({
  rows,
  total,
  page,
  pageSize,
}: {
  rows: OpportunityRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<OpportunityRow, unknown>[]>(() => [
    {
      id: 'code',
      header: 'Código',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-sysde-mid">{row.original.code ?? '—'}</span>
      ),
    },
    {
      id: 'name',
      header: 'Oportunidad',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-sysde-gray">{row.original.name}</div>
          <Link
            href={`/accounts/${row.original.account.id}`}
            data-row-interactive
            className="text-xs text-sysde-red hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.account.name}
          </Link>
        </div>
      ),
    },
    {
      id: 'product',
      header: 'Producto',
      cell: ({ row }) => (
        <span className="text-sm">
          {PRODUCT_LABELS[row.original.product as keyof typeof PRODUCT_LABELS] ?? row.original.product}
        </span>
      ),
    },
    {
      id: 'stage',
      header: 'Fase',
      cell: ({ row }) => (
        <StageBadge
          stage={row.original.stage as Parameters<typeof StageBadge>[0]['stage']}
          size="sm"
        />
      ),
    },
    {
      id: 'rating',
      header: 'Rating',
      cell: ({ row }) => {
        const r = RATING_LABELS[row.original.rating as keyof typeof RATING_LABELS];
        if (!r) return '—';
        return (
          <span
            className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold text-white"
            style={{ backgroundColor: r.color }}
          >
            {r.label}
          </span>
        );
      },
    },
    {
      id: 'value',
      header: 'Valor',
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {formatMoney(row.original.estimatedValue, row.original.currency)}
        </span>
      ),
    },
    {
      id: 'prob',
      header: 'Prob.',
      cell: ({ row }) => <span className="text-sm">{row.original.probability}%</span>,
    },
    {
      id: 'close',
      header: 'Cierre esperado',
      cell: ({ row }) => (
        <span className="text-sm text-sysde-mid">
          {row.original.expectedCloseDate
            ? format(row.original.expectedCloseDate, 'd LLL yyyy', { locale: es })
            : '—'}
        </span>
      ),
    },
    {
      id: 'owner',
      header: 'Owner',
      cell: ({ row }) => {
        const o = row.original.owner;
        if (!o) return '—';
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              {o.avatarUrl ? <AvatarImage src={o.avatarUrl} alt={o.name} /> : null}
              <AvatarFallback className="text-[10px]">{getInitials(o.name)}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{o.name}</span>
          </div>
        );
      },
    },
    {
      id: 'nextAction',
      header: 'Próxima acción',
      cell: ({ row }) => {
        const d = row.original.nextActionDate;
        if (!d) return <span className="text-sm text-sysde-mid">—</span>;
        const overdue = isPast(d) && row.original.status === 'OPEN';
        return (
          <span className={cn('text-sm', overdue ? 'text-danger font-medium' : 'text-sysde-mid')}>
            {formatDistanceToNow(d, { addSuffix: true, locale: es })}
          </span>
        );
      },
    },
    {
      id: 'updatedAt',
      header: 'Actualización',
      cell: ({ row }) => (
        <span className="text-sm text-sysde-mid">
          {formatDistanceToNow(row.original.updatedAt, { addSuffix: true, locale: es })}
        </span>
      ),
    },
  ], []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/opportunities/${r.id}`)}
      />
      <div className="mt-4 flex items-center justify-between text-sm text-sysde-mid">
        <div>
          Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de{' '}
          {total.toLocaleString('es-MX')}
        </div>
        <div className="text-xs">Página {page} / {totalPages}</div>
      </div>
    </div>
  );
}
