'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  List,
  Link2,
  AtSign,
  Phone,
  AlignLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createCustomField,
  deleteCustomField,
} from '@/lib/custom-fields/mutations';
import {
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_ENTITIES,
  type CustomFieldType,
  type CustomFieldEntity,
} from '@/lib/custom-fields/schemas';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: 'Texto corto',
  LONG_TEXT: 'Texto largo',
  NUMBER: 'Número',
  DATE: 'Fecha',
  BOOLEAN: 'Sí/No',
  SELECT: 'Selección única',
  MULTI_SELECT: 'Selección múltiple',
  URL: 'URL',
  EMAIL: 'Email',
  PHONE: 'Teléfono',
};

const TYPE_ICONS: Record<CustomFieldType, React.ComponentType<{ className?: string }>> = {
  TEXT: Type,
  LONG_TEXT: AlignLeft,
  NUMBER: Hash,
  DATE: Calendar,
  BOOLEAN: ToggleLeft,
  SELECT: List,
  MULTI_SELECT: List,
  URL: Link2,
  EMAIL: AtSign,
  PHONE: Phone,
};

const ENTITY_LABELS: Record<CustomFieldEntity, string> = {
  CONTACT: 'Contactos',
  ACCOUNT: 'Cuentas',
  OPPORTUNITY: 'Oportunidades',
};

type FieldDef = {
  id: string;
  entity: CustomFieldEntity;
  key: string;
  label: string;
  type: CustomFieldType;
  options: unknown;
  required: boolean;
  description: string | null;
};

export function CustomFieldsManager({ initial }: { initial: FieldDef[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<CustomFieldEntity>('CONTACT');
  const [fields, setFields] = useState(initial);
  const [createOpen, setCreateOpen] = useState(false);
  const [, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function onDelete(id: string) {
    if (!confirm('¿Eliminar este campo? Los valores asociados se borran.')) return;
    setFields((prev) => prev.filter((f) => f.id !== id));
    startTransition(async () => {
      const r = await deleteCustomField(id);
      if (!r.ok) {
        toast.error(r.error);
        refresh();
        return;
      }
      toast.success('Campo eliminado');
    });
  }

  const filtered = fields.filter((f) => f.entity === tab);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-sysde-bg p-1">
          {CUSTOM_FIELD_ENTITIES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setTab(e)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors',
                tab === e
                  ? 'bg-white text-sysde-red shadow-sm'
                  : 'text-sysde-mid hover:text-sysde-gray'
              )}
            >
              {ENTITY_LABELS[e]}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nuevo campo
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Type className="mx-auto h-10 w-10 text-sysde-mid" />
          <h3 className="mt-3 font-display text-base font-semibold uppercase tracking-wider">
            Sin campos personalizados
          </h3>
          <p className="mt-1 text-sm text-sysde-mid">
            Crea campos para extender la información de {ENTITY_LABELS[tab].toLowerCase()}.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-sysde-bg text-[10px] font-semibold uppercase tracking-wider text-sysde-mid">
              <tr>
                <th className="px-4 py-2.5 text-left">Etiqueta</th>
                <th className="px-4 py-2.5 text-left">Key</th>
                <th className="px-4 py-2.5 text-left">Tipo</th>
                <th className="px-4 py-2.5 text-left">Requerido</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sysde-border">
              {filtered.map((f) => {
                const Icon = TYPE_ICONS[f.type];
                return (
                  <tr key={f.id} className="hover:bg-sysde-bg/40">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-sysde-gray">{f.label}</div>
                      {f.description && (
                        <div className="mt-0.5 text-[11px] text-sysde-mid">{f.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-sysde-mid">
                      {f.key}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded bg-sysde-bg px-2 py-0.5 text-[11px]">
                        <Icon className="h-3 w-3" />
                        {TYPE_LABELS[f.type]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{f.required ? 'Sí' : 'No'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onDelete(f.id)}
                        className="rounded p-1.5 text-sysde-mid transition-colors hover:bg-red-50 hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <CreateFieldDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        entity={tab}
        onCreated={(f) => {
          setFields((prev) => [...prev, f]);
          refresh();
        }}
      />
    </div>
  );
}

function CreateFieldDialog({
  open,
  onOpenChange,
  entity,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entity: CustomFieldEntity;
  onCreated: (f: FieldDef) => void;
}) {
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [type, setType] = useState<CustomFieldType>('TEXT');
  const [options, setOptions] = useState('');
  const [required, setRequired] = useState(false);
  const [description, setDescription] = useState('');
  const [pending, startTransition] = useTransition();

  function reset() {
    setLabel('');
    setKey('');
    setType('TEXT');
    setOptions('');
    setRequired(false);
    setDescription('');
  }

  function autoKey(s: string) {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^([0-9])/, '_$1');
  }

  function onLabelChange(v: string) {
    setLabel(v);
    if (!key || key === autoKey(label)) {
      setKey(autoKey(v));
    }
  }

  function onSubmit() {
    if (!label.trim() || !key.trim()) {
      toast.error('Etiqueta y key son obligatorios');
      return;
    }
    const opts =
      type === 'SELECT' || type === 'MULTI_SELECT'
        ? options
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;

    if ((type === 'SELECT' || type === 'MULTI_SELECT') && (!opts || opts.length === 0)) {
      toast.error('Selección requiere al menos una opción');
      return;
    }

    startTransition(async () => {
      const r = await createCustomField({
        entity,
        key: key.trim(),
        label: label.trim(),
        type,
        options: opts,
        required,
        description: description.trim() || null,
        position: 0,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Campo creado');
      onCreated({
        id: r.data.id,
        entity,
        key: key.trim(),
        label: label.trim(),
        type,
        options: opts ?? null,
        required,
        description: description.trim() || null,
      });
      reset();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wider">
            Nuevo campo personalizado
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Etiqueta visible</Label>
            <Input
              autoFocus
              value={label}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="Ej: Origen del lead"
            />
          </div>
          <div>
            <Label>Key (identificador interno)</Label>
            <Input
              value={key}
              onChange={(e) => setKey(autoKey(e.target.value))}
              placeholder="origen_del_lead"
              className="font-mono text-xs"
            />
            <p className="mt-1 text-[10px] text-sysde-mid">
              Solo minúsculas, números y guion bajo.
            </p>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as CustomFieldType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(type === 'SELECT' || type === 'MULTI_SELECT') && (
            <div>
              <Label>Opciones (coma)</Label>
              <Input
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="Frío, Tibio, Caliente"
              />
            </div>
          )}
          <div>
            <Label>Descripción (opcional)</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="rounded"
            />
            Campo requerido
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={pending || !label.trim()}>
            {pending ? 'Creando…' : 'Crear campo'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
