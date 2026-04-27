'use client';

import { useState, useTransition } from 'react';
import { Mail, Phone, Clock, ListChecks, Linkedin, MessageCircle, GitBranch, CalendarDays, Plus, Trash2 } from 'lucide-react';
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
import { addCampaignStep, deleteCampaignStep } from '@/lib/campaigns/mutations';
import { CAMPAIGN_STEP_TYPES } from '@/lib/campaigns/schemas';
import { CAMPAIGN_STEP_TYPE_LABELS } from '@/lib/campaigns/labels';
import { cn } from '@/lib/utils';

type StepType = (typeof CAMPAIGN_STEP_TYPES)[number];

const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  EMAIL: Mail,
  WAIT: Clock,
  CALL: Phone,
  TASK: ListChecks,
  LINKEDIN: Linkedin,
  WHATSAPP: MessageCircle,
  EVENT_INVITE: CalendarDays,
  BRANCH: GitBranch,
};

const STEP_COLORS: Record<string, string> = {
  EMAIL: 'bg-blue-50 text-blue-700 ring-blue-200',
  WAIT: 'bg-slate-100 text-slate-700 ring-slate-200',
  CALL: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  TASK: 'bg-amber-50 text-amber-700 ring-amber-200',
  LINKEDIN: 'bg-sky-50 text-sky-700 ring-sky-200',
  WHATSAPP: 'bg-green-50 text-green-700 ring-green-200',
  EVENT_INVITE: 'bg-violet-50 text-violet-700 ring-violet-200',
  BRANCH: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
};

const TYPES: StepType[] = [...CAMPAIGN_STEP_TYPES];

export type FlowStep = {
  id: string;
  order: number;
  type: StepType;
  name: string;
  delayDays: number;
  emailSubject: string | null;
  emailBody: string | null;
  callScript: string | null;
  taskTitle: string | null;
  notes: string | null;
};

export function FlowEditor({
  campaignId,
  steps,
  canEdit,
}: {
  campaignId: string;
  steps: FlowStep[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    type: 'EMAIL' as StepType,
    name: '',
    delayDays: 0,
    emailSubject: '',
    emailBody: '',
    callScript: '',
    taskTitle: '',
    notes: '',
  });

  function reset() {
    setForm({
      type: 'EMAIL',
      name: '',
      delayDays: 0,
      emailSubject: '',
      emailBody: '',
      callScript: '',
      taskTitle: '',
      notes: '',
    });
  }

  function onAdd() {
    startTransition(async () => {
      const r = await addCampaignStep({
        campaignId,
        order: steps.length,
        type: form.type,
        name: form.name || CAMPAIGN_STEP_TYPE_LABELS[form.type],
        delayDays: form.delayDays,
        emailSubject: form.emailSubject || null,
        emailBody: form.emailBody || null,
        callScript: form.callScript || null,
        taskTitle: form.taskTitle || null,
        notes: form.notes || null,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Paso agregado');
      setOpen(false);
      reset();
    });
  }

  function onDelete(stepId: string) {
    if (!confirm('¿Eliminar este paso?')) return;
    startTransition(async () => {
      const r = await deleteCampaignStep(campaignId, stepId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Paso eliminado');
    });
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Flujo de la campaña</h3>
          <p className="text-xs text-sysde-mid">
            Secuencia de pasos que se ejecutan al enrolar un contacto.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Agregar paso
          </Button>
        )}
      </div>

      {steps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-sysde-border p-10 text-center">
          <p className="text-sm text-sysde-mid">
            Aún no hay pasos en este flujo. {canEdit && 'Agrega el primero para empezar.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((s, idx) => {
            const Icon = STEP_ICONS[s.type] ?? Mail;
            return (
              <div key={s.id} className="relative">
                <div className="flex items-start gap-3 rounded-lg border border-sysde-border bg-white p-3 transition-colors hover:bg-sysde-bg/40">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1',
                      STEP_COLORS[s.type] ?? STEP_COLORS.EMAIL
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-sysde-mid">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm font-medium text-sysde-gray">{s.name}</span>
                      <span className="rounded-md bg-sysde-bg px-1.5 py-0.5 text-[10px] text-sysde-mid">
                        {CAMPAIGN_STEP_TYPE_LABELS[s.type]}
                      </span>
                      {s.delayDays > 0 && (
                        <span className="text-[10px] text-sysde-mid">
                          espera {s.delayDays}d
                        </span>
                      )}
                    </div>
                    {s.emailSubject && (
                      <div className="mt-1 truncate text-xs text-sysde-mid">
                        Subject: {s.emailSubject}
                      </div>
                    )}
                    {s.taskTitle && (
                      <div className="mt-1 truncate text-xs text-sysde-mid">
                        Tarea: {s.taskTitle}
                      </div>
                    )}
                    {s.notes && (
                      <div className="mt-1 line-clamp-2 text-xs text-sysde-mid">{s.notes}</div>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => onDelete(s.id)}
                      disabled={pending}
                      className="rounded p-1 text-sysde-mid transition-colors hover:bg-red-50 hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div className="ml-[18px] h-3 w-px bg-sysde-border" />
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo paso del flujo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as StepType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {CAMPAIGN_STEP_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Espera (días)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.delayDays}
                  onChange={(e) => setForm({ ...form, delayDays: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label>Nombre del paso</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Email de bienvenida"
              />
            </div>

            {form.type === 'EMAIL' && (
              <>
                <div>
                  <Label>Subject del email</Label>
                  <Input
                    value={form.emailSubject}
                    onChange={(e) => setForm({ ...form, emailSubject: e.target.value })}
                    placeholder="Hola {{firstName}} — propuesta SAF+"
                  />
                </div>
                <div>
                  <Label>Cuerpo del email</Label>
                  <Textarea
                    rows={4}
                    value={form.emailBody}
                    onChange={(e) => setForm({ ...form, emailBody: e.target.value })}
                  />
                </div>
              </>
            )}

            {form.type === 'CALL' && (
              <div>
                <Label>Script de llamada</Label>
                <Textarea
                  rows={4}
                  value={form.callScript}
                  onChange={(e) => setForm({ ...form, callScript: e.target.value })}
                />
              </div>
            )}

            {form.type === 'TASK' && (
              <div>
                <Label>Título de la tarea</Label>
                <Input
                  value={form.taskTitle}
                  onChange={(e) => setForm({ ...form, taskTitle: e.target.value })}
                />
              </div>
            )}

            <div>
              <Label>Notas internas</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={onAdd} disabled={pending}>
              {pending ? 'Agregando…' : 'Agregar paso'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
