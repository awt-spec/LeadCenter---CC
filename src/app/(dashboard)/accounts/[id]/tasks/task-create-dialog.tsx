'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Tag, Palette, Link2, Search } from 'lucide-react';
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
import { createTask } from '@/lib/tasks/mutations';
import {
  type TaskStatus,
  type TaskPriority,
} from '@/lib/tasks/schemas';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_DOT,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_DOT,
  TASK_COLOR_PRESETS,
  KANBAN_COLUMNS,
} from '@/lib/tasks/labels';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials, cn } from '@/lib/utils';

type UserOption = { id: string; name: string; avatarUrl?: string | null; email?: string };
type DependencyOption = { id: string; title: string; status: string; color: string | null };

const PRIORITY_ORDER: TaskPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export function TaskCreateDialog({
  accountId,
  defaultStatus,
  users,
  dependencyCandidates = [],
}: {
  accountId: string;
  defaultStatus?: TaskStatus;
  users: UserOption[];
  dependencyCandidates?: DependencyOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus ?? 'TODO');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [dependsOnIds, setDependsOnIds] = useState<string[]>([]);
  const [depQuery, setDepQuery] = useState('');
  const [userQuery, setUserQuery] = useState('');

  function reset() {
    setTitle('');
    setDescription('');
    setStatus(defaultStatus ?? 'TODO');
    setPriority('NORMAL');
    setDueDate('');
    setStartDate('');
    setAssigneeIds([]);
    setTags([]);
    setTagDraft('');
    setColor(null);
    setDependsOnIds([]);
    setDepQuery('');
    setUserQuery('');
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleDep(id: string) {
    setDependsOnIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function addTag(raw: string) {
    const t = raw.trim().replace(/,$/, '').slice(0, 32);
    if (!t) return;
    setTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setTagDraft('');
  }
  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
  }

  const filteredUsers = useMemo(() => {
    const q = userQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q));
  }, [users, userQuery]);

  const filteredDeps = useMemo(() => {
    const q = depQuery.toLowerCase().trim();
    if (!q) return dependencyCandidates.slice(0, 30);
    return dependencyCandidates.filter((d) => d.title.toLowerCase().includes(q)).slice(0, 30);
  }, [dependencyCandidates, depQuery]);

  function onSubmit() {
    if (!title.trim()) {
      toast.error('El título es obligatorio');
      return;
    }
    startTransition(async () => {
      const r = await createTask({
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        dueDate: dueDate || null,
        startDate: startDate || null,
        accountId,
        opportunityId: null,
        contactId: null,
        parentTaskId: null,
        assigneeIds,
        tags,
        color,
        dependsOnIds,
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
        <Button size="sm" className="gap-1.5 bg-sysde-red hover:bg-sysde-red-dark">
          <Plus className="h-3.5 w-3.5" />
          Nueva tarea
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <div
          className="h-1.5 w-full transition-colors"
          style={{ backgroundColor: color ?? '#E5E7EB' }}
        />
        <div className="space-y-4 p-6">
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
          </DialogHeader>

          <div>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de la tarea…"
              className="border-0 px-0 text-lg font-medium shadow-none focus-visible:ring-0"
            />
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción opcional…"
              className="resize-none border-0 px-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>

          {/* Status quick-row */}
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-sysde-mid">Estado</Label>
            <div className="flex flex-wrap gap-1.5">
              {KANBAN_COLUMNS.map((c) => {
                const s = c.status as TaskStatus;
                const sel = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                      sel
                        ? 'border-sysde-red bg-sysde-red text-white shadow-sm'
                        : 'border-sysde-border text-sysde-gray hover:border-sysde-red/40'
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', sel ? 'bg-white' : TASK_STATUS_DOT[s])} />
                    {TASK_STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority + dates row */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-sysde-mid">Prioridad</Label>
              <div className="flex gap-1">
                {PRIORITY_ORDER.map((p) => {
                  const sel = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={cn(
                        'inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-all',
                        sel
                          ? 'border-sysde-red bg-sysde-red-light text-sysde-red'
                          : 'border-sysde-border text-sysde-gray hover:border-sysde-red/40'
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', TASK_PRIORITY_DOT[p])} />
                      {TASK_PRIORITY_LABELS[p]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-sysde-mid">Inicio</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-sysde-mid">Vencimiento</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Color picker */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-sysde-mid">
              <Palette className="h-3 w-3" /> Color de acento
            </Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setColor(null)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] transition-all',
                  color === null ? 'border-sysde-red text-sysde-red' : 'border-sysde-border text-sysde-mid'
                )}
                title="Sin color"
              >
                ∅
              </button>
              {TASK_COLOR_PRESETS.map((c) => {
                const sel = color === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    title={c.label}
                    style={{ backgroundColor: c.value }}
                    className={cn(
                      'h-7 w-7 rounded-full transition-all',
                      sel ? 'ring-2 ring-sysde-gray ring-offset-2' : 'hover:scale-110'
                    )}
                  />
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-sysde-mid">
              <Tag className="h-3 w-3" /> Tags
            </Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-sysde-border bg-white px-2 py-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded bg-sysde-bg px-1.5 py-0.5 text-[11px] text-sysde-gray"
                >
                  {t}
                  <button type="button" onClick={() => removeTag(t)} className="text-sysde-mid hover:text-danger">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag(tagDraft);
                  }
                  if (e.key === 'Backspace' && !tagDraft && tags.length) {
                    setTags((prev) => prev.slice(0, -1));
                  }
                }}
                onBlur={() => addTag(tagDraft)}
                placeholder={tags.length ? '' : 'Escribe y enter…'}
                className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-sysde-mid"
              />
            </div>
          </div>

          {/* Assignees */}
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-sysde-mid">
              Responsables {assigneeIds.length > 0 && <span className="text-sysde-red">· {assigneeIds.length}</span>}
            </Label>
            <div className="rounded-md border border-sysde-border bg-white p-2">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-sysde-mid" />
                <Input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Buscar usuario…"
                  className="h-8 pl-7 text-xs"
                />
              </div>
              <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <span className="px-1 text-xs text-sysde-mid">Sin resultados.</span>
                ) : (
                  filteredUsers.map((u) => {
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

          {/* Dependencies */}
          {dependencyCandidates.length > 0 && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-sysde-mid">
                <Link2 className="h-3 w-3" /> Bloqueada por
                {dependsOnIds.length > 0 && <span className="text-sysde-red">· {dependsOnIds.length}</span>}
              </Label>
              <div className="rounded-md border border-sysde-border bg-white p-2">
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-sysde-mid" />
                  <Input
                    value={depQuery}
                    onChange={(e) => setDepQuery(e.target.value)}
                    placeholder="Buscar tarea bloqueante…"
                    className="h-8 pl-7 text-xs"
                  />
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {filteredDeps.length === 0 ? (
                    <span className="px-1 text-xs text-sysde-mid">Sin resultados.</span>
                  ) : (
                    filteredDeps.map((d) => {
                      const sel = dependsOnIds.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleDep(d.id)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
                            sel ? 'bg-sysde-red-light' : 'hover:bg-sysde-bg'
                          )}
                        >
                          <span
                            className={cn('h-2 w-2 shrink-0 rounded-full', TASK_STATUS_DOT[d.status])}
                          />
                          {d.color && (
                            <span
                              className="h-2 w-1 shrink-0 rounded-full"
                              style={{ backgroundColor: d.color }}
                            />
                          )}
                          <span className="flex-1 truncate text-sysde-gray">{d.title}</span>
                          {sel && <span className="text-[10px] font-medium text-sysde-red">Seleccionada</span>}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-sysde-border bg-sysde-bg/50 px-6 py-3">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={pending || !title.trim()}
            className="bg-sysde-red hover:bg-sysde-red-dark"
          >
            {pending ? 'Creando…' : 'Crear tarea'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
