'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2, UserCheck, Tag as TagIcon, CircleDot, Download, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { bulkUpdateContacts } from '@/lib/contacts/mutations';
import {
  CONTACT_STATUS_LABELS,
} from '@/lib/constants';
import { contactsToCsvString, triggerCsvDownload, type ExportableContact } from '@/lib/export/csv-export';

type UserLite = { id: string; name: string };
type TagLite = { id: string; name: string; color: string };

type Props = {
  selectedIds: string[];
  selectedContacts: ExportableContact[];
  users: UserLite[];
  tags: TagLite[];
  canExport: boolean;
  canDelete: boolean;
  canUpdateAll: boolean;
  onClear: () => void;
};

export function BulkActionsBar({
  selectedIds,
  selectedContacts,
  users,
  tags,
  canExport,
  canDelete,
  canUpdateAll,
  onClear,
}: Props) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (selectedIds.length === 0) return null;

  async function run(action: Parameters<typeof bulkUpdateContacts>[0]) {
    const res = await bulkUpdateContacts(action);
    if (res.ok) {
      toast.success(`${res.data.affected} contactos actualizados`);
      onClear();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function handleExport() {
    const csv = contactsToCsvString(selectedContacts);
    triggerCsvDownload(csv, 'contactos-seleccionados');
    toast.success(`${selectedContacts.length} contactos exportados`);
  }

  return (
    <>
      <div className="sticky top-14 z-20 -mx-8 mb-4 flex items-center justify-between bg-sysde-red px-8 py-3 text-white shadow-sm">
        <div className="flex items-center gap-4 text-sm font-medium">
          <span>{selectedIds.length} contactos seleccionados</span>
        </div>
        <div className="flex items-center gap-2">
          {canUpdateAll && (
            <>
              <AssignOwnerPopover
                users={users}
                onApply={(ownerId) =>
                  run({ action: 'assign_owner', contactIds: selectedIds, ownerId })
                }
              />
              <AddTagsPopover
                tags={tags}
                onApply={(tagIds) =>
                  run({ action: 'add_tags', contactIds: selectedIds, tagIds })
                }
              />
              <ChangeStatusPopover
                onApply={(status) =>
                  run({ action: 'change_status', contactIds: selectedIds, status: status as never })
                }
              />
            </>
          )}
          {canExport && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <Download className="mr-1.5 h-4 w-4" />
              Exportar
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="bg-white text-danger hover:bg-neutral-100"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Eliminar
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-white hover:bg-white/10"
          >
            <X className="mr-1 h-4 w-4" />
            Deseleccionar
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`¿Eliminar ${selectedIds.length} contactos?`}
        description="Esta acción no se puede deshacer. Se registrará en el audit log."
        confirmLabel="Sí, eliminar"
        destructive
        onConfirm={() => run({ action: 'delete', contactIds: selectedIds })}
      />
    </>
  );
}

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
        <Button
          size="sm"
          variant="secondary"
          className="border-white/20 bg-white/10 text-white hover:bg-white/20"
        >
          <UserCheck className="mr-1.5 h-4 w-4" />
          Owner
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <Label className="mb-2 block">Asignar owner</Label>
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un usuario" />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="mt-3 w-full"
          disabled={!value}
          onClick={() => {
            onApply(value);
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

function AddTagsPopover({
  tags,
  onApply,
}: {
  tags: TagLite[];
  onApply: (tagIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          className="border-white/20 bg-white/10 text-white hover:bg-white/20"
        >
          <TagIcon className="mr-1.5 h-4 w-4" />
          Tags
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <Label className="mb-2 px-2 block">Agregar tags</Label>
        <div className="max-h-60 space-y-1 overflow-y-auto">
          {tags.map((t) => (
            <Label
              key={t.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sysde-bg"
            >
              <Checkbox
                checked={selected.includes(t.id)}
                onCheckedChange={() =>
                  setSelected((prev) =>
                    prev.includes(t.id) ? prev.filter((v) => v !== t.id) : [...prev, t.id]
                  )
                }
              />
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: t.color }}
              />
              {t.name}
            </Label>
          ))}
        </div>
        <Button
          size="sm"
          className="mt-3 w-full"
          disabled={selected.length === 0}
          onClick={() => {
            onApply(selected);
            setOpen(false);
            setSelected([]);
          }}
        >
          Agregar
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function ChangeStatusPopover({ onApply }: { onApply: (status: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>('');
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          className="border-white/20 bg-white/10 text-white hover:bg-white/20"
        >
          <CircleDot className="mr-1.5 h-4 w-4" />
          Status
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <Label className="mb-2 block">Cambiar status</Label>
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona status" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CONTACT_STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="mt-3 w-full"
          disabled={!value}
          onClick={() => {
            onApply(value);
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
