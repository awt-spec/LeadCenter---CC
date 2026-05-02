'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ColumnDef } from '@tanstack/react-table';
import { Building2 } from 'lucide-react';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_VARIANTS,
  COMPANY_SIZE_LABELS,
  SEGMENT_LABELS_EXTENDED,
  formatMoney,
} from '@/lib/shared/labels';
import { getInitials } from '@/lib/utils';
import { PriorityCell, type Priority } from './priority-cell';

export type AccountRow = {
  id: string;
  name: string;
  domain: string | null;
  needsDomainReview: boolean;
  country: string | null;
  segment: string | null;
  size: string;
  status: string;
  priority: Priority;
  updatedAt: Date;
  owner: { id: string; name: string; avatarUrl: string | null } | null;
  _count: { contacts: number; opportunities: number };
  pipelineTotal: number;
};

export function AccountsTable({ rows, total, page, pageSize }: {
  rows: AccountRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<AccountRow, unknown>[]>(() => [
    {
      id: 'name',
      header: 'Cuenta',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sysde-red text-xs font-semibold text-white">
            {getInitials(row.original.name) || <Building2 className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sysde-gray">{row.original.name}</div>
            {row.original.needsDomainReview ? (
              <div className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Sin dominio · revisar
              </div>
            ) : (
              <div className="text-xs text-sysde-mid">{row.original.domain}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'country',
      header: 'País',
      cell: ({ row }) => <span className="text-sm">{row.original.country ?? '—'}</span>,
    },
    {
      id: 'segment',
      header: 'Segmento',
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.segment
            ? SEGMENT_LABELS_EXTENDED[row.original.segment as keyof typeof SEGMENT_LABELS_EXTENDED] ??
              row.original.segment
            : '—'}
        </span>
      ),
    },
    {
      id: 'size',
      header: 'Tamaño',
      cell: ({ row }) => (
        <span className="text-sm">
          {COMPANY_SIZE_LABELS[row.original.size as keyof typeof COMPANY_SIZE_LABELS] ?? row.original.size}
        </span>
      ),
    },
    {
      id: 'priority',
      header: 'Prioridad',
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <PriorityCell accountId={row.original.id} initial={row.original.priority} />
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge
          variant={
            ACCOUNT_STATUS_VARIANTS[row.original.status as keyof typeof ACCOUNT_STATUS_VARIANTS] ??
            'secondary'
          }
        >
          {ACCOUNT_STATUS_LABELS[row.original.status as keyof typeof ACCOUNT_STATUS_LABELS] ??
            row.original.status}
        </Badge>
      ),
    },
    {
      id: 'owner',
      header: 'Owner',
      cell: ({ row }) => {
        const o = row.original.owner;
        if (!o) return <span className="text-sm text-sysde-mid">—</span>;
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
      id: 'contacts',
      header: 'Contactos',
      cell: ({ row }) => <span className="text-sm">{row.original._count.contacts}</span>,
    },
    {
      id: 'opps',
      header: 'Oports.',
      cell: ({ row }) => <span className="text-sm">{row.original._count.opportunities}</span>,
    },
    {
      id: 'pipeline',
      header: 'Pipeline',
      cell: ({ row }) => (
        <span className="text-sm font-medium">{formatMoney(row.original.pipelineTotal)}</span>
      ),
    },
    {
      id: 'updatedAt',
      header: 'Actualizada',
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
        onRowClick={(r) => router.push(`/accounts/${r.id}`)}
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
