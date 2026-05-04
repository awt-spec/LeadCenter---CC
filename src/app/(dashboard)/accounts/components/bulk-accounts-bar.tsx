'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2, UserCheck, CircleDot, Flame, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { bulkUpdateAccounts } from '@/lib/accounts/mutations';

type UserLite = { id: string; name: string };

const STATUSES = [
  { value: 'PROSPECT', label: 'Prospecto' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'CUSTOMER', label: 'Cliente' },
  { value: 'PARTNER', label: 'Partner' },
  { value: 'LOST', label: 'Perdido' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'BLOCKED', label: 'Bloqueado' },
] as const;

const PRIORITIES = [
  { value: 'LOW', label: 'Baja' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
] as const;

export function BulkAccountsBar({
  selectedIds,
  users,
  canUpdateAll,
  canDelete,
  onClear,
}: {
  selectedIds: string[];
  users: UserLite[];
  canUpdateAll: boolean;
  canDelete: boolean;
  onClear: () => void;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (selectedIds.length === 0) return null;

  async function run(action: Parameters<typeof bulkUpdateAccounts>[0]) {
    const res = await bulkUpdateAccounts(action);
    if (res.ok) {
      toast.success(`${res.data.affected} cuentas actualizadas`);
      onClear();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <>
      <div className="sticky top-14 z-20 -mx-8 mb-4 flex items-center justify-between bg-sysde-red px-8 py-3 text-white shadow-sm">
        <div className="flex items-center gap-4 text-sm font-medium">
          <span>
            {selectedIds.length} cuenta{selectedIds.length !== 1 ? 's' : ''} seleccionada
            {selectedIds.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canUpdateAll && (
            <>
              <AssignOwnerPopover
                users={users}
                onApply={(ownerId) => run({ action: 'assign_owner', accountIds: selectedIds, ownerId })}
              />
              <SetStatusPopover
                onApply={(status) => run({ action: 'set_status', accountIds: selectedIds, status })}
              />
              <SetPriorityPopover
                onApply={(priority) => run({ action: 'set_priority', accountIds: selectedIds, priority })}
              />
            </>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="gap-1.5 text-white hover:bg-white/15"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="gap-1.5 text-white hover:bg-white/15"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Eliminar ${selectedIds.length} cuentas`}
        description="Las cuentas se borran permanentemente junto con sus contactos, oportunidades y actividades vinculadas. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => run({ action: 'delete', accountIds: selectedIds })}
      />
    </>
  );
}

// ===== Sub-popovers =====

function AssignOwnerPopover({
  users,
  onApply,
}: {
  users: UserLite[];
  onApply: (ownerId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>('');
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-white hover:bg-white/15">
          <UserCheck className="h-3.5 w-3.5" />
          Owner
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-sysde-mid">Asignar owner</div>
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Seleccionar usuario…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin owner</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="w-full"
          disabled={!value}
          onClick={() => {
            onApply(value === '__none__' ? null : value);
            setOpen(false);
            setValue('');
          }}
        >
          Aplicar
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function SetStatusPopover({
  onApply,
}: {
  onApply: (status: 'PROSPECT' | 'ACTIVE' | 'CUSTOMER' | 'PARTNER' | 'LOST' | 'INACTIVE' | 'BLOCKED') => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-white hover:bg-white/15">
          <CircleDot className="h-3.5 w-3.5" />
          Estado
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 space-y-1">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-sysde-mid">Cambiar estado</div>
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-sysde-bg"
            onClick={() => {
              onApply(s.value);
              setOpen(false);
            }}
          >
            {s.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function SetPriorityPopover({
  onApply,
}: {
  onApply: (priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT') => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-white hover:bg-white/15">
          <Flame className="h-3.5 w-3.5" />
          Prioridad
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 space-y-1">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-sysde-mid">Cambiar prioridad</div>
        {PRIORITIES.map((p) => (
          <button
            key={p.value}
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-sysde-bg"
            onClick={() => {
              onApply(p.value);
              setOpen(false);
            }}
          >
            {p.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
