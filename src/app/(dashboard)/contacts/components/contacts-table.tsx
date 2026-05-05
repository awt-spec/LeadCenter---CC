'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { classifyContactHealth, HEALTH_BG, HEALTH_LABELS, type ContactHealth } from '@/lib/contacts/health';
import type { ContactStatus, SeniorityLevel } from '@prisma/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  CONTACT_STATUS_LABELS,
  CONTACT_STATUS_VARIANTS,
  CONTACT_SOURCE_LABELS,
} from '@/lib/constants';
import { getInitials, cn } from '@/lib/utils';
import { BulkActionsBar } from './bulk-actions-bar';
import type { ExportableContact } from '@/lib/export/csv-export';
import { deleteContact } from '@/lib/contacts/mutations';

type Owner = { id: string; name: string; email: string; avatarUrl: string | null };
type Tag = { id: string; name: string; color: string };
type ContactTag = { tagId: string; tag: Tag };

export type ContactRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  jobTitle: string | null;
  companyName: string | null;
  country: string | null;
  city: string | null;
  phone: string | null;
  mobilePhone: string | null;
  linkedinUrl: string | null;
  website: string | null;
  source: string;
  sourceDetail: string | null;
  status: string;
  marketSegment: string | null;
  productInterest: string[];
  optIn: boolean;
  notes: string | null;
  lastActivityAt: Date | null;
  createdAt: Date;
  owner: Owner | null;
  tags: ContactTag[];
  seniorityLevel?: string | null;
};

type Props = {
  rows: ContactRow[];
  total: number;
  page: number;
  pageSize: number;
  users: { id: string; name: string }[];
  tags: Tag[];
  can: {
    updateAll: boolean;
    updateOwn: boolean;
    delete: boolean;
    exportCsv: boolean;
  };
  currentUserId: string;
};

export function ContactsTable({
  rows,
  total,
  page,
  pageSize,
  users,
  tags,
  can,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [confirmDelete, setConfirmDelete] = useState<ContactRow | null>(null);

  const columns = useMemo<ColumnDef<ContactRow, unknown>[]>(
    () => [
      {
        id: 'select',
        size: 40,
        header: ({ table }) => (
          <div data-row-interactive>
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && 'indeterminate')
              }
              onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
              aria-label="Seleccionar todos"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div data-row-interactive>
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(v) => row.toggleSelected(!!v)}
              aria-label="Seleccionar fila"
            />
          </div>
        ),
        enableSorting: false,
      },
      {
        id: 'health',
        header: () => <span title="Salud del contacto">●</span>,
        size: 30,
        enableSorting: false,
        cell: ({ row }) => {
          const h = classifyContactHealth({
            email: row.original.email,
            status: row.original.status as ContactStatus,
            seniorityLevel: row.original.seniorityLevel as SeniorityLevel | null,
          });
          return (
            <div
              className={`mx-auto h-2.5 w-2.5 rounded-full ${HEALTH_BG[h]}`}
              title={HEALTH_LABELS[h]}
            />
          );
        },
      },
      {
        id: 'name',
        header: 'Nombre',
        size: 260,
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-sysde-gray">{row.original.fullName}</div>
            <div className="text-xs text-sysde-mid">{row.original.email}</div>
          </div>
        ),
      },
      {
        id: 'company',
        header: 'Empresa',
        cell: ({ row }) => (
          <span className="text-sm text-sysde-gray">{row.original.companyName ?? '—'}</span>
        ),
      },
      {
        id: 'jobTitle',
        header: 'Cargo',
        cell: ({ row }) => (
          <span className="text-sm text-sysde-gray">{row.original.jobTitle ?? '—'}</span>
        ),
      },
      {
        id: 'country',
        header: 'País',
        cell: ({ row }) => (
          <span className="text-sm text-sysde-gray">{row.original.country ?? '—'}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={CONTACT_STATUS_VARIANTS[row.original.status] ?? 'secondary'}>
            {CONTACT_STATUS_LABELS[row.original.status] ?? row.original.status}
          </Badge>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        cell: ({ row }) => (
          <Badge variant="secondary">
            {CONTACT_SOURCE_LABELS[row.original.source] ?? row.original.source}
          </Badge>
        ),
      },
      {
        id: 'owner',
        header: 'Owner',
        cell: ({ row }) => {
          const owner = row.original.owner;
          if (!owner) return <span className="text-sm text-sysde-mid">Sin asignar</span>;
          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                {owner.avatarUrl ? (
                  <AvatarImage src={owner.avatarUrl} alt={owner.name} />
                ) : null}
                <AvatarFallback className="text-[10px]">{getInitials(owner.name)}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-sysde-gray">{owner.name}</span>
            </div>
          );
        },
      },
      {
        id: 'tags',
        header: 'Tags',
        cell: ({ row }) => {
          const tags = row.original.tags;
          if (tags.length === 0) return <span className="text-sm text-sysde-mid">—</span>;
          const visible = tags.slice(0, 3);
          const extra = tags.length - visible.length;
          return (
            <div className="flex flex-wrap items-center gap-1">
              {visible.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
              {extra > 0 && (
                <span className="text-xs text-sysde-mid">+{extra}</span>
              )}
            </div>
          );
        },
      },
      {
        id: 'lastActivity',
        header: 'Última actividad',
        cell: ({ row }) => {
          const d = row.original.lastActivityAt ?? row.original.createdAt;
          return (
            <span className="text-sm text-sysde-mid">
              {formatDistanceToNow(d, { addSuffix: true, locale: es })}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        size: 48,
        cell: ({ row }) => {
          const c = row.original;
          const canEdit = can.updateAll || (can.updateOwn && c.owner?.id === currentUserId);
          return (
            <div data-row-interactive className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Acciones">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => router.push(`/contacts/${c.id}`)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Ver
                  </DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuItem
                      onSelect={() => router.push(`/contacts/${c.id}/edit`)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {can.delete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-danger focus:text-danger"
                        onSelect={(e) => {
                          e.preventDefault();
                          setConfirmDelete(c);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [can, currentUserId, router]
  );

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const selectedContacts: ExportableContact[] = rows
    .filter((r) => selectedIds.includes(r.id))
    .map(rowToExportable);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const setPage = (next: number) => {
    const sp = new URLSearchParams(window.location.search);
    sp.set('page', String(next));
    router.push(`/contacts?${sp.toString()}`);
  };

  const setPageSize = (size: number) => {
    const sp = new URLSearchParams(window.location.search);
    sp.set('pageSize', String(size));
    sp.delete('page');
    router.push(`/contacts?${sp.toString()}`);
  };

  async function handleDelete(id: string) {
    const res = await deleteContact(id);
    if (res.ok) {
      toast.success('Contacto eliminado');
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div>
      <BulkActionsBar
        selectedIds={selectedIds}
        selectedContacts={selectedContacts}
        users={users}
        tags={tags}
        canExport={can.exportCsv}
        canDelete={can.delete}
        canUpdateAll={can.updateAll}
        onClear={() => setRowSelection({})}
      />

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        onRowClick={(r) => router.push(`/contacts/${r.id}`)}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-sysde-mid">
        <div>
          Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de{' '}
          {total.toLocaleString('es-MX')} contactos
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <span>Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-md border border-sysde-border bg-white px-2 py-1 text-sm"
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <span className={cn('px-2 text-sysde-gray')}>
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="¿Eliminar contacto?"
        description={
          confirmDelete
            ? `Se eliminará ${confirmDelete.fullName} permanentemente. Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Sí, eliminar"
        destructive
        onConfirm={async () => {
          if (confirmDelete) await handleDelete(confirmDelete.id);
        }}
      />
    </div>
  );
}

function rowToExportable(r: ContactRow): ExportableContact {
  return {
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    jobTitle: r.jobTitle,
    companyName: r.companyName,
    country: r.country,
    city: r.city,
    phone: r.phone,
    mobilePhone: r.mobilePhone,
    linkedinUrl: r.linkedinUrl,
    website: r.website,
    source: r.source,
    sourceDetail: r.sourceDetail,
    status: r.status,
    marketSegment: r.marketSegment,
    productInterest: r.productInterest,
    owner: r.owner ? { name: r.owner.name, email: r.owner.email } : null,
    tags: r.tags.map((t) => t.tag.name),
    optIn: r.optIn,
    notes: r.notes,
    createdAt: r.createdAt,
  };
}
