'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTask } from '@/lib/tasks/mutations';
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  type TaskStatus,
  type TaskPriority,
} from '@/lib/tasks/schemas';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '@/lib/tasks/labels';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials, cn } from '@/lib/utils';

type UserOption = { id: string; name: string; avatarUrl?: string | null };

export function TaskCreateDialog({
  accountId,
  defaultStatus,
  users,
}: {
  accountId: string;
  defaultStatus?: TaskStatus;
  users: UserOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus ?? 'TODO');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [dueDate, setDueDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState('');

  function reset() {
    setTitle('');
    setDescription('');
    setStatus(defaultStatus ?? 'TODO');
    setPriority('NORMAL');
    setDueDate('');
    setAssigneeIds([]);
    setTagsInput('');
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function onSubmit() {
    if (!title.trim()) {
      toast.error('El título es obligatorio');
      return;
    }
    startTransition(async () => {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const r = await createTask({
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        dueDate: dueDate || null,
        startDate: null,
        accountId,
        opportunityId: null,
        contactId: null,
        parentTaskId: null,
        assigneeIds,
        tags,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Tarea creada');
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nueva tarea
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Llamar al sponsor para confirmar fecha"
            />
          </div>

          <div>
            <Label>Descripción</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles de la tarea…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Estado</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {TASK_PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vencimiento</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Tags (coma)</Label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="discovery, alta prioridad"
              />
            </div>
          </div>

          <div>
            <Label>Responsables</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {users.length === 0 ? (
                <span className="text-xs text-sysde-mid">Sin usuarios.</span>
              ) : (
                users.map((u) => {
                  const sel = assigneeIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleAssignee(u.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] transition-all',
                        sel
                          ? 'border-sysde-red bg-sysde-red-light text-sysde-red'
                          : 'border-sysde-border text-sysde-mid hover:border-sysde-red/40'
                      )}
                    >
                      <Avatar className="h-4 w-4">
                        {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={u.name} /> : null}
                        <AvatarFallback className="text-[8px]">{getInitials(u.name)}</AvatarFallback>
                      </Avatar>
                      {u.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={pending || !title.trim()}>
            {pending ? 'Creando…' : 'Crear tarea'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
