'use client';

import { useState, useTransition } from 'react';
import { format, formatDistanceToNow, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Flag, Plus, CheckCircle2, RotateCcw, Trash2, AlertTriangle, Loader2, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  createCheckpoint, completeCheckpoint, reopenCheckpoint, deleteCheckpoint,
} from '@/lib/checkpoints/mutations';

interface Checkpoint {
  id: string;
  label: string;
  description: string | null;
  type: string;
  priority: string;
  dueDate: Date | null;
  completedAt: Date | null;
  assignee: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  createdAt: Date;
}

const TYPE_LABEL: Record<string, string> = {
  MILESTONE: 'Hito',
  REVIEW: 'Revisión interna',
  CLIENT_TOUCH: 'Contacto cliente',
  DECISION: 'Decisión externa',
  CUSTOM: 'Otro',
};

const PRIORITY_BG: Record<string, string> = {
  LOW: 'bg-neutral-100 text-neutral-700',
  NORMAL: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

export function CheckpointPanel({
  opportunityId,
  checkpoints,
  canEdit,
}: {
  opportunityId: string;
  checkpoints: Checkpoint[];
  canEdit: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const pending = checkpoints.filter((c) => !c.completedAt);
  const done = checkpoints.filter((c) => c.completedAt);
  const overdue = pending.filter((c) => c.dueDate && isAfter(new Date(), c.dueDate));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Flag className="h-4 w-4 text-sysde-red" />
            Puntos de control
            {overdue.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-800">
                <AlertTriangle className="h-3 w-3" />
                {overdue.length} vencido{overdue.length === 1 ? '' : 's'}
              </span>
            )}
          </CardTitle>
          <p className="mt-0.5 text-[11px] text-sysde-mid">
            Hitos con dueño y fecha objetivo. {pending.length} pendiente{pending.length === 1 ? '' : 's'} · {done.length} completado{done.length === 1 ? '' : 's'}
          </p>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setShowForm((s) => !s)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {showForm ? 'Cancelar' : 'Agregar'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <NewCheckpointForm
            opportunityId={opportunityId}
            onClose={() => setShowForm(false)}
          />
        )}

        {checkpoints.length === 0 && !showForm && (
          <div className="rounded-md border border-dashed border-sysde-border bg-sysde-bg/50 p-6 text-center text-sm text-sysde-mid">
            Sin puntos de control. Agregá hitos como "Demo confirmada", "Propuesta enviada", "Decisión del comité".
          </div>
        )}

        {pending.length > 0 && (
          <div className="space-y-1.5">
            {pending.map((c) => (
              <CheckpointRow key={c.id} c={c} canEdit={canEdit} />
            ))}
          </div>
        )}
        {done.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-sysde-mid hover:text-sysde-gray">
              Completados ({done.length})
            </summary>
            <div className="mt-2 space-y-1.5 opacity-70">
              {done.map((c) => (
                <CheckpointRow key={c.id} c={c} canEdit={canEdit} done />
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function CheckpointRow({ c, canEdit, done = false }: { c: Checkpoint; canEdit: boolean; done?: boolean }) {
  const [pending, start] = useTransition();
  const overdue = c.dueDate && !c.completedAt && isAfter(new Date(), c.dueDate);

  function onComplete() {
    start(async () => {
      const r = await completeCheckpoint(c.id);
      if (r.ok) toast.success('Marcado como completado');
      else toast.error(r.error);
    });
  }
  function onReopen() {
    start(async () => {
      const r = await reopenCheckpoint(c.id);
      if (r.ok) toast.success('Reabierto');
      else toast.error(r.error);
    });
  }
  function onDelete() {
    if (!confirm('¿Eliminar este punto de control?')) return;
    start(async () => {
      const r = await deleteCheckpoint(c.id);
      if (r.ok) toast.success('Eliminado');
      else toast.error(r.error);
    });
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
        overdue
          ? 'border-red-300 bg-red-50'
          : done
            ? 'border-sysde-border bg-sysde-bg/40 line-through'
            : 'border-sysde-border bg-white hover:bg-sysde-bg/30'
      }`}
    >
      {canEdit && !done && (
        <button
          type="button"
          onClick={onComplete}
          disabled={pending}
          aria-label="Marcar como completado"
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-sysde-mid hover:border-sysde-red"
        >
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
        </button>
      )}
      {done && (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sysde-gray">{c.label}</span>
          <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[c.type] ?? c.type}</Badge>
          {c.priority !== 'NORMAL' && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${PRIORITY_BG[c.priority]}`}>
              {c.priority.toLowerCase()}
            </span>
          )}
        </div>
        {c.description && <p className="mt-0.5 text-xs text-sysde-mid">{c.description}</p>}
        <div className="mt-0.5 flex flex-wrap gap-3 text-[11px] text-sysde-mid">
          {c.dueDate && (
            <span className={overdue ? 'text-red-700 font-medium' : ''}>
              <Calendar className="mr-1 inline h-3 w-3" />
              {format(c.dueDate, 'd LLL yyyy', { locale: es })}
              {overdue && ' · VENCIDO'}
              {!overdue && !done && ` · ${formatDistanceToNow(c.dueDate, { addSuffix: true, locale: es })}`}
            </span>
          )}
          {c.assignee && <span>👤 {c.assignee.name}</span>}
          {done && c.completedAt && (
            <span>✓ Completado {format(c.completedAt, 'd LLL', { locale: es })}</span>
          )}
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-1">
          {done && (
            <Button size="sm" variant="ghost" onClick={onReopen} disabled={pending}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDelete} disabled={pending}>
            <Trash2 className="h-3.5 w-3.5 text-red-600" />
          </Button>
        </div>
      )}
    </div>
  );
}

function NewCheckpointForm({
  opportunityId,
  onClose,
}: {
  opportunityId: string;
  onClose: () => void;
}) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'MILESTONE' | 'REVIEW' | 'CLIENT_TOUCH' | 'DECISION' | 'CUSTOM'>('MILESTONE');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'>('NORMAL');
  const [dueDate, setDueDate] = useState('');
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await createCheckpoint({
        opportunityId,
        label: label.trim(),
        description: description.trim() || null,
        type,
        priority,
        dueDate: dueDate || null,
      });
      if (r.ok) {
        toast.success('Checkpoint creado');
        onClose();
      } else {
        toast.error(r.error);
      }
    });
  }

  const inputCls = 'h-8 rounded-md border border-sysde-border bg-white px-2 text-sm focus:border-sysde-red focus:outline-none focus:ring-1 focus:ring-sysde-red';

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-md border border-sysde-border bg-sysde-bg/30 p-3">
      <Input
        placeholder="Ej. Demo confirmada con CFO"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        required
        autoFocus
      />
      <Textarea
        placeholder="Descripción opcional (contexto, notas)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />
      <div className="flex flex-wrap gap-2">
        <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as never)}>
          {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as never)}>
          <option value="LOW">Prioridad: Baja</option>
          <option value="NORMAL">Prioridad: Normal</option>
          <option value="HIGH">Prioridad: Alta</option>
          <option value="CRITICAL">Prioridad: Crítica</option>
        </select>
        <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={pending || !label.trim()}>
          {pending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          Crear
        </Button>
      </div>
    </form>
  );
}
