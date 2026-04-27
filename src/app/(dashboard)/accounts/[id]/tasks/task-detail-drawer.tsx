'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CalendarDays,
  Send,
  Trash2,
  X,
  MessageCircle,
  ListTree,
  Paperclip,
  Plus,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_DOT,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_DOT,
} from '@/lib/tasks/labels';
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  type TaskStatus,
  type TaskPriority,
} from '@/lib/tasks/schemas';
import {
  updateTask,
  deleteTask,
  addTaskComment,
  deleteTaskComment,
  addTaskAttachment,
  deleteTaskAttachment,
} from '@/lib/tasks/mutations';
import { cn, getInitials } from '@/lib/utils';

type UserOption = { id: string; name: string; avatarUrl?: string | null; email?: string };

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  tags: string[];
  createdAt: Date;
  createdBy: { id: string; name: string };
  assignees: { user: { id: string; name: string; avatarUrl: string | null } }[];
  subtasks: { id: string; title: string; status: TaskStatus }[];
  comments: {
    id: string;
    body: string;
    createdAt: Date;
    user: { id: string; name: string; avatarUrl: string | null };
  }[];
  attachments: {
    id: string;
    fileName: string;
    fileUrl: string;
    uploadedAt: Date;
    uploadedBy: { id: string; name: string };
  }[];
};

export function TaskDetailDrawer({
  taskId,
  open,
  onOpenChange,
  users,
}: {
  taskId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  users: UserOption[];
}) {
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [commentDraft, setCommentDraft] = useState('');
  const [attachUrl, setAttachUrl] = useState('');
  const [attachName, setAttachName] = useState('');
  const [showAttach, setShowAttach] = useState(false);

  useEffect(() => {
    if (!taskId || !open) {
      setTask(null);
      return;
    }
    setLoading(true);
    fetch(`/api/tasks/${taskId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.task) {
          setTask({
            ...data.task,
            createdAt: new Date(data.task.createdAt),
            dueDate: data.task.dueDate ? new Date(data.task.dueDate) : null,
            comments: data.task.comments.map((c: { createdAt: string }) => ({
              ...c,
              createdAt: new Date(c.createdAt),
            })),
            attachments: data.task.attachments.map((a: { uploadedAt: string }) => ({
              ...a,
              uploadedAt: new Date(a.uploadedAt),
            })),
          });
        }
      })
      .finally(() => setLoading(false));
  }, [taskId, open]);

  function persist(patch: Partial<{ status: TaskStatus; priority: TaskPriority; title: string; description: string | null; dueDate: string | null; tags: string[]; assigneeIds: string[] }>) {
    if (!task) return;
    setTask({ ...task, ...patch } as TaskDetail);
    startTransition(async () => {
      const r = await updateTask(task.id, patch);
      if (!r.ok) {
        toast.error(r.error);
      } else {
        router.refresh();
      }
    });
  }

  function onAddComment() {
    if (!task || !commentDraft.trim()) return;
    const body = commentDraft.trim();
    setCommentDraft('');
    startTransition(async () => {
      const r = await addTaskComment({ taskId: task.id, body });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      // refetch
      const data = await fetch(`/api/tasks/${task.id}`).then((x) => x.json());
      if (data?.task) {
        setTask({
          ...data.task,
          createdAt: new Date(data.task.createdAt),
          dueDate: data.task.dueDate ? new Date(data.task.dueDate) : null,
          comments: data.task.comments.map((c: { createdAt: string }) => ({
            ...c,
            createdAt: new Date(c.createdAt),
          })),
          attachments: data.task.attachments.map((a: { uploadedAt: string }) => ({
            ...a,
            uploadedAt: new Date(a.uploadedAt),
          })),
        });
      }
      router.refresh();
    });
  }

  function onDeleteComment(id: string) {
    if (!task) return;
    if (!confirm('¿Eliminar comentario?')) return;
    startTransition(async () => {
      await deleteTaskComment(id);
      setTask({ ...task, comments: task.comments.filter((c) => c.id !== id) });
      router.refresh();
    });
  }

  function onAddAttachment() {
    if (!task || !attachUrl.trim()) return;
    let parsed: URL;
    try {
      parsed = new URL(attachUrl.trim());
    } catch {
      toast.error('URL inválida');
      return;
    }
    const fileName = attachName.trim() || decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname);
    startTransition(async () => {
      const r = await addTaskAttachment(task.id, fileName, parsed.toString());
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Adjunto agregado');
      setAttachUrl('');
      setAttachName('');
      setShowAttach(false);
      const data = await fetch(`/api/tasks/${task.id}`).then((x) => x.json());
      if (data?.task) {
        setTask((prev) =>
          prev
            ? {
                ...prev,
                attachments: data.task.attachments.map((a: { uploadedAt: string }) => ({
                  ...a,
                  uploadedAt: new Date(a.uploadedAt),
                })),
              }
            : prev
        );
      }
      router.refresh();
    });
  }

  function onDeleteAttachment(id: string) {
    if (!task) return;
    if (!confirm('¿Eliminar adjunto?')) return;
    startTransition(async () => {
      await deleteTaskAttachment(id);
      setTask({ ...task, attachments: task.attachments.filter((a) => a.id !== id) });
      router.refresh();
    });
  }

  function onDeleteTask() {
    if (!task) return;
    if (!confirm(`¿Eliminar tarea "${task.title}"?`)) return;
    startTransition(async () => {
      const r = await deleteTask(task.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Tarea eliminada');
      onOpenChange(false);
      router.refresh();
    });
  }

  function toggleAssignee(uid: string) {
    if (!task) return;
    const cur = task.assignees.map((a) => a.user.id);
    const next = cur.includes(uid) ? cur.filter((x) => x !== uid) : [...cur, uid];
    persist({ assigneeIds: next });
    setTask({
      ...task,
      assignees: next
        .map((id) => users.find((u) => u.id === id))
        .filter((u): u is UserOption => !!u)
        .map((u) => ({ user: { id: u.id, name: u.name, avatarUrl: u.avatarUrl ?? null } })),
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-xl overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-base">Detalle de tarea</SheetTitle>
        </SheetHeader>

        {loading || !task ? (
          <div className="mt-8 text-center text-sm text-sysde-mid">Cargando…</div>
        ) : (
          <div className="mt-4 space-y-5">
            <div>
              <Input
                value={task.title}
                onChange={(e) => setTask({ ...task, title: e.target.value })}
                onBlur={() => persist({ title: task.title })}
                className="text-base font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-sysde-mid">
                  Estado
                </Label>
                <Select
                  value={task.status}
                  onValueChange={(v) => persist({ status: v as TaskStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full', TASK_STATUS_DOT[s])} />
                          {TASK_STATUS_LABELS[s]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-sysde-mid">
                  Prioridad
                </Label>
                <Select
                  value={task.priority}
                  onValueChange={(v) => persist({ priority: v as TaskPriority })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full', TASK_PRIORITY_DOT[p])} />
                          {TASK_PRIORITY_LABELS[p]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-[10px] uppercase tracking-wide text-sysde-mid">
                  Vencimiento
                </Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sysde-mid" />
                  <Input
                    type="date"
                    className="pl-9"
                    value={task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ''}
                    onChange={(e) => persist({ dueDate: e.target.value || null })}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wide text-sysde-mid">
                Responsables
              </Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {users.map((u) => {
                  const sel = task.assignees.some((a) => a.user.id === u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleAssignee(u.id)}
                      className={cn(
                        'flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition-all',
                        sel
                          ? 'border-sysde-red bg-sysde-red-light text-sysde-red'
                          : 'border-sysde-border text-sysde-mid hover:border-sysde-red/40'
                      )}
                    >
                      <Avatar className="h-4 w-4">
                        {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={u.name} /> : null}
                        <AvatarFallback className="text-[8px]">
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      {u.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wide text-sysde-mid">
                Descripción
              </Label>
              <Textarea
                rows={4}
                value={task.description ?? ''}
                onChange={(e) => setTask({ ...task, description: e.target.value })}
                onBlur={() => persist({ description: task.description })}
                placeholder="Notas, requisitos, links…"
              />
            </div>

            {task.tags.length > 0 && (
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-sysde-mid">
                  Tags
                </Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {task.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700"
                    >
                      <Tag className="h-3 w-3" />
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {task.subtasks.length > 0 && (
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-sysde-mid">
                  Subtareas ({task.subtasks.length})
                </Label>
                <div className="mt-1 space-y-1">
                  {task.subtasks.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 rounded-md border border-sysde-border p-2 text-xs"
                    >
                      <span className={cn('h-2 w-2 rounded-full', TASK_STATUS_DOT[s.status])} />
                      <span className="flex-1">{s.title}</span>
                      <span className="text-[10px] text-sysde-mid">
                        {TASK_STATUS_LABELS[s.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase tracking-wide text-sysde-mid">
                  <Paperclip className="mr-1 inline h-3 w-3" />
                  Adjuntos ({task.attachments.length})
                </Label>
                <button
                  type="button"
                  onClick={() => setShowAttach((s) => !s)}
                  className="text-[11px] font-medium text-sysde-red hover:underline"
                >
                  {showAttach ? 'Cerrar' : '+ Agregar'}
                </button>
              </div>
              {showAttach && (
                <div className="mt-2 space-y-2 rounded-md border border-sysde-border p-2">
                  <Input
                    placeholder="URL"
                    value={attachUrl}
                    onChange={(e) => setAttachUrl(e.target.value)}
                  />
                  <Input
                    placeholder="Nombre (opcional)"
                    value={attachName}
                    onChange={(e) => setAttachName(e.target.value)}
                  />
                  <Button size="sm" onClick={onAddAttachment} disabled={!attachUrl.trim() || pending}>
                    Adjuntar
                  </Button>
                </div>
              )}
              {task.attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {task.attachments.map((a) => (
                    <div
                      key={a.id}
                      className="group flex items-center gap-2 rounded-md border border-sysde-border p-2 text-xs"
                    >
                      <Paperclip className="h-3.5 w-3.5 text-sysde-mid" />
                      <a
                        href={a.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 truncate font-medium text-sysde-gray hover:text-sysde-red"
                      >
                        {a.fileName}
                      </a>
                      <span className="text-[10px] text-sysde-mid">{a.uploadedBy.name}</span>
                      <button
                        type="button"
                        onClick={() => onDeleteAttachment(a.id)}
                        className="opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comments timeline */}
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-sysde-mid">
                <MessageCircle className="mr-1 inline h-3 w-3" />
                Comentarios ({task.comments.length})
              </Label>
              <div className="mt-2 space-y-3">
                {task.comments.map((c) => (
                  <div key={c.id} className="group flex gap-2">
                    <Avatar className="h-7 w-7">
                      {c.user.avatarUrl ? (
                        <AvatarImage src={c.user.avatarUrl} alt={c.user.name} />
                      ) : null}
                      <AvatarFallback className="text-[10px]">
                        {getInitials(c.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 rounded-lg bg-sysde-bg/60 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{c.user.name}</span>
                        <span className="text-[10px] text-sysde-mid">
                          {format(c.createdAt, "d MMM HH:mm", { locale: es })}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-sysde-gray">
                        {c.body}
                      </p>
                      <button
                        type="button"
                        onClick={() => onDeleteComment(c.id)}
                        className="mt-1 text-[10px] text-sysde-mid opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Textarea
                  rows={2}
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      onAddComment();
                    }
                  }}
                  placeholder="Comentar… (⌘+Enter para enviar)"
                  className="text-sm"
                />
                <Button
                  size="sm"
                  onClick={onAddComment}
                  disabled={!commentDraft.trim() || pending}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-sysde-border pt-4 text-[11px] text-sysde-mid">
              <span>
                Creada por <strong className="text-sysde-gray">{task.createdBy.name}</strong> el{' '}
                {format(task.createdAt, "d MMM yyyy", { locale: es })}
              </span>
              <Button variant="ghost" size="sm" onClick={onDeleteTask}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5 text-danger" />
                <span className="text-danger">Eliminar tarea</span>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
