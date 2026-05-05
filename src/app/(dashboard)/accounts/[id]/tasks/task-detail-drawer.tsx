'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns';
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
  Lock,
  Link2,
  Palette,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Hash,
  User as UserIcon,
  FileText,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_DOT,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_DOT,
  TASK_COLOR_PRESETS,
} from '@/lib/tasks/labels';
import {
  TASK_STATUSES, TASK_PRIORITIES, type TaskStatus, type TaskPriority,
} from '@/lib/tasks/schemas';
import {
  updateTask, deleteTask, addTaskComment, deleteTaskComment,
  addTaskAttachment, deleteTaskAttachment, removeTaskDependency,
} from '@/lib/tasks/mutations';
import { cn, getInitials } from '@/lib/utils';

type UserOption = { id: string; name: string; avatarUrl?: string | null; email?: string };

type DepLink = {
  blockedByTaskId?: string;
  taskId?: string;
  task?: { id: string; title: string; status: TaskStatus; priority: TaskPriority; color: string | null };
  blockedBy?: { id: string; title: string; status: TaskStatus; priority: TaskPriority; color: string | null };
};

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  tags: string[];
  color: string | null;
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
  blockedBy: DepLink[];
  blocking: DepLink[];
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
  const [showAssignees, setShowAssignees] = useState(false);
  const [showColors, setShowColors] = useState(false);

  useEffect(() => {
    if (!taskId || !open) {
      setTask(null);
      return;
    }
    setLoading(true);
    fetch(`/api/tasks/${taskId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.task) setTask(hydrate(data.task));
      })
      .finally(() => setLoading(false));
  }, [taskId, open]);

  function persist(patch: Partial<{
    status: TaskStatus; priority: TaskPriority; title: string;
    description: string | null; dueDate: string | null; tags: string[];
    assigneeIds: string[]; color: string | null;
  }>) {
    if (!task) return;
    setTask({ ...task, ...patch } as TaskDetail);
    startTransition(async () => {
      const r = await updateTask(task.id, patch);
      if (!r.ok) toast.error(r.error);
      else router.refresh();
    });
  }

  function refetch() {
    if (!task) return;
    void fetch(`/api/tasks/${task.id}`)
      .then((r) => r.json())
      .then((data) => { if (data?.task) setTask(hydrate(data.task)); });
  }

  function onAddComment() {
    if (!task || !commentDraft.trim()) return;
    const body = commentDraft.trim();
    setCommentDraft('');
    startTransition(async () => {
      const r = await addTaskComment({ taskId: task.id, body });
      if (!r.ok) { toast.error(r.error); return; }
      refetch();
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
    try { parsed = new URL(attachUrl.trim()); }
    catch { toast.error('URL inválida'); return; }
    const fileName = attachName.trim() || decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname);
    startTransition(async () => {
      const r = await addTaskAttachment(task.id, fileName, parsed.toString());
      if (!r.ok) { toast.error(r.error); return; }
      toast.success('Adjunto agregado');
      setAttachUrl(''); setAttachName(''); setShowAttach(false);
      refetch(); router.refresh();
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
      if (!r.ok) { toast.error(r.error); return; }
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

  function markDone() {
    if (!task) return;
    persist({ status: 'DONE' });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto !max-w-[min(960px,95vw)] p-0"
      >
        {loading || !task ? (
          <div className="grid h-[80vh] place-items-center text-sm text-sysde-mid">Cargando…</div>
        ) : (
          <div className="flex flex-col">
            {/* HEADER — color stripe + title + quick actions */}
            <TaskHeader
              task={task}
              setTask={setTask}
              persist={persist}
              onClose={() => onOpenChange(false)}
              markDone={markDone}
              pending={pending}
            />

            {/* BODY — 2 columns */}
            <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_320px]">
              {/* LEFT — main content */}
              <div className="space-y-6 border-b border-sysde-border p-6 lg:border-b-0 lg:border-r">
                {/* Description */}
                <Section
                  icon={<FileText className="h-3.5 w-3.5" />}
                  label="Descripción"
                >
                  <Textarea
                    rows={5}
                    value={task.description ?? ''}
                    onChange={(e) => setTask({ ...task, description: e.target.value })}
                    onBlur={() => persist({ description: task.description })}
                    placeholder="Notas, requisitos, links de referencia…"
                    className="resize-none border-0 bg-sysde-bg/40 focus-visible:ring-1 focus-visible:ring-sysde-red/30"
                  />
                </Section>

                {/* Subtasks */}
                {task.subtasks.length > 0 && (
                  <Section
                    icon={<ListTree className="h-3.5 w-3.5" />}
                    label={`Subtareas (${task.subtasks.filter((s) => s.status === 'DONE').length}/${task.subtasks.length})`}
                  >
                    <SubtaskProgressBar subtasks={task.subtasks} />
                    <div className="mt-2 space-y-1">
                      {task.subtasks.map((s) => {
                        const done = s.status === 'DONE';
                        return (
                          <div
                            key={s.id}
                            className={cn(
                              'flex items-center gap-3 rounded-md border p-2.5 text-sm transition-colors',
                              done
                                ? 'border-emerald-200 bg-emerald-50/40 line-through opacity-70'
                                : 'border-sysde-border bg-white hover:border-sysde-red/30'
                            )}
                          >
                            <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', TASK_STATUS_DOT[s.status])} />
                            <span className="flex-1 truncate">{s.title}</span>
                            <span className="text-[10px] uppercase tracking-wide text-sysde-mid">
                              {TASK_STATUS_LABELS[s.status]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </Section>
                )}

                {/* Dependencies */}
                {(task.blockedBy.length > 0 || task.blocking.length > 0) && (
                  <Section
                    icon={<Link2 className="h-3.5 w-3.5" />}
                    label="Dependencias"
                  >
                    {task.blockedBy.length > 0 && (
                      <div className="mb-3">
                        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          <Lock className="h-3 w-3" /> Bloqueada por ({task.blockedBy.length})
                        </div>
                        <div className="space-y-1">
                          {task.blockedBy.map((d) => {
                            const t = d.blockedBy;
                            if (!t) return null;
                            return (
                              <DepRow
                                key={t.id}
                                t={t}
                                tone="amber"
                                onRemove={() => {
                                  startTransition(async () => {
                                    await removeTaskDependency(task.id, t.id);
                                    setTask({ ...task, blockedBy: task.blockedBy.filter((x) => x.blockedBy?.id !== t.id) });
                                    router.refresh();
                                  });
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {task.blocking.length > 0 && (
                      <div>
                        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                          <Link2 className="h-3 w-3" /> Bloquea ({task.blocking.length})
                        </div>
                        <div className="space-y-1">
                          {task.blocking.map((d) => {
                            const t = d.task;
                            if (!t) return null;
                            return <DepRow key={t.id} t={t} tone="violet" />;
                          })}
                        </div>
                      </div>
                    )}
                  </Section>
                )}

                {/* Comments timeline */}
                <Section
                  icon={<MessageCircle className="h-3.5 w-3.5" />}
                  label={`Comentarios (${task.comments.length})`}
                >
                  <div className="space-y-3">
                    {task.comments.length === 0 ? (
                      <p className="text-xs text-sysde-mid">Sin comentarios todavía. Sé el primero.</p>
                    ) : (
                      task.comments.map((c) => (
                        <CommentRow key={c.id} c={c} onDelete={() => onDeleteComment(c.id)} />
                      ))
                    )}
                  </div>
                  {/* Composer */}
                  <div className="mt-4 rounded-lg border border-sysde-border bg-white p-2 focus-within:border-sysde-red/40 focus-within:ring-1 focus-within:ring-sysde-red/20">
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
                      placeholder="Escribir comentario… (⌘+Enter para enviar)"
                      className="resize-none border-0 p-0 text-sm shadow-none focus-visible:ring-0"
                    />
                    <div className="mt-1.5 flex items-center justify-between border-t border-sysde-border/60 pt-1.5">
                      <span className="text-[10px] text-sysde-mid">⌘+Enter para enviar</span>
                      <Button
                        size="sm"
                        onClick={onAddComment}
                        disabled={!commentDraft.trim() || pending}
                        className="h-7"
                      >
                        <Send className="mr-1 h-3 w-3" />
                        Enviar
                      </Button>
                    </div>
                  </div>
                </Section>
              </div>

              {/* RIGHT — sticky meta sidebar */}
              <aside className="space-y-5 bg-sysde-bg/30 p-6">
                {/* Assignees */}
                <MetaBlock
                  icon={<UserIcon className="h-3.5 w-3.5" />}
                  label="Responsables"
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowAssignees((s) => !s)}
                      className="text-[11px] font-medium text-sysde-red hover:underline"
                    >
                      {showAssignees ? 'Cerrar' : task.assignees.length > 0 ? 'Editar' : '+ Agregar'}
                    </button>
                  }
                >
                  {task.assignees.length === 0 && !showAssignees && (
                    <p className="text-xs text-sysde-mid">Sin asignar</p>
                  )}
                  {task.assignees.length > 0 && (
                    <div className="-space-x-2 flex">
                      {task.assignees.map((a) => (
                        <Avatar key={a.user.id} className="h-7 w-7 ring-2 ring-white">
                          {a.user.avatarUrl ? <AvatarImage src={a.user.avatarUrl} alt={a.user.name} /> : null}
                          <AvatarFallback className="text-[10px]">{getInitials(a.user.name)}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  )}
                  {showAssignees && (
                    <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border border-sysde-border bg-white p-1">
                      {users.map((u) => {
                        const sel = task.assignees.some((a) => a.user.id === u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleAssignee(u.id)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors',
                              sel ? 'bg-sysde-red/10 text-sysde-red' : 'hover:bg-sysde-bg'
                            )}
                          >
                            <Avatar className="h-5 w-5">
                              {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={u.name} /> : null}
                              <AvatarFallback className="text-[9px]">{getInitials(u.name)}</AvatarFallback>
                            </Avatar>
                            <span className="flex-1 text-left truncate">{u.name}</span>
                            {sel && <CheckCircle2 className="h-3.5 w-3.5 text-sysde-red" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </MetaBlock>

                {/* Due date */}
                <MetaBlock
                  icon={<CalendarDays className="h-3.5 w-3.5" />}
                  label="Vencimiento"
                >
                  <Input
                    type="date"
                    value={task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ''}
                    onChange={(e) => persist({ dueDate: e.target.value || null })}
                    className="h-8"
                  />
                  {task.dueDate && (
                    <p className={cn(
                      'mt-1 text-[11px]',
                      isPast(task.dueDate) && task.status !== 'DONE'
                        ? 'font-medium text-red-600'
                        : isToday(task.dueDate) ? 'font-medium text-amber-600' : 'text-sysde-mid'
                    )}>
                      {dueLabel(task.dueDate)}
                    </p>
                  )}
                </MetaBlock>

                {/* Tags */}
                {task.tags.length > 0 && (
                  <MetaBlock
                    icon={<Tag className="h-3.5 w-3.5" />}
                    label="Tags"
                  >
                    <div className="flex flex-wrap gap-1">
                      {task.tags.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                          <Hash className="h-2.5 w-2.5" />
                          {t}
                        </span>
                      ))}
                    </div>
                  </MetaBlock>
                )}

                {/* Color */}
                <MetaBlock
                  icon={<Palette className="h-3.5 w-3.5" />}
                  label="Color"
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowColors((s) => !s)}
                      className="text-[11px] font-medium text-sysde-red hover:underline"
                    >
                      {showColors ? 'Cerrar' : 'Cambiar'}
                    </button>
                  }
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-5 w-5 rounded-full border border-sysde-border"
                      style={task.color ? { backgroundColor: task.color } : { background: 'repeating-linear-gradient(45deg,#ddd 0 4px,#fff 4px 8px)' }}
                    />
                    <span className="text-xs text-sysde-mid">
                      {task.color ? TASK_COLOR_PRESETS.find((c) => c.value === task.color)?.label ?? task.color : 'Sin color'}
                    </span>
                  </div>
                  {showColors && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => persist({ color: null })}
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px]',
                          task.color === null ? 'border-sysde-red text-sysde-red' : 'border-sysde-border text-sysde-mid'
                        )}
                        title="Sin color"
                      >∅</button>
                      {TASK_COLOR_PRESETS.map((c) => {
                        const sel = task.color === c.value;
                        return (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => persist({ color: c.value })}
                            title={c.label}
                            style={{ backgroundColor: c.value }}
                            className={cn(
                              'h-6 w-6 rounded-full transition',
                              sel ? 'ring-2 ring-sysde-gray ring-offset-2' : 'hover:scale-110'
                            )}
                          />
                        );
                      })}
                    </div>
                  )}
                </MetaBlock>

                {/* Attachments */}
                <MetaBlock
                  icon={<Paperclip className="h-3.5 w-3.5" />}
                  label={`Adjuntos (${task.attachments.length})`}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowAttach((s) => !s)}
                      className="text-[11px] font-medium text-sysde-red hover:underline"
                    >
                      {showAttach ? 'Cerrar' : '+ Agregar'}
                    </button>
                  }
                >
                  {showAttach && (
                    <div className="mb-2 space-y-2 rounded-md border border-sysde-border bg-white p-2">
                      <Input className="h-8 text-xs" placeholder="URL" value={attachUrl} onChange={(e) => setAttachUrl(e.target.value)} />
                      <Input className="h-8 text-xs" placeholder="Nombre (opcional)" value={attachName} onChange={(e) => setAttachName(e.target.value)} />
                      <Button size="sm" onClick={onAddAttachment} disabled={!attachUrl.trim() || pending} className="w-full h-7">
                        Adjuntar
                      </Button>
                    </div>
                  )}
                  {task.attachments.length === 0 && !showAttach && (
                    <p className="text-xs text-sysde-mid">Sin adjuntos</p>
                  )}
                  {task.attachments.length > 0 && (
                    <div className="space-y-1">
                      {task.attachments.map((a) => (
                        <div
                          key={a.id}
                          className="group flex items-center gap-2 rounded-md border border-sysde-border bg-white p-2 text-xs"
                        >
                          <Paperclip className="h-3 w-3 shrink-0 text-sysde-mid" />
                          <a
                            href={a.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 truncate font-medium text-sysde-gray hover:text-sysde-red"
                            title={a.fileName}
                          >
                            {a.fileName}
                          </a>
                          <button
                            type="button"
                            onClick={() => onDeleteAttachment(a.id)}
                            className="opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </MetaBlock>

                {/* Audit footer */}
                <div className="border-t border-sysde-border/60 pt-3 text-[11px] text-sysde-mid">
                  <p>Creada por <strong className="text-sysde-gray">{task.createdBy.name}</strong></p>
                  <p className="mt-0.5">{format(task.createdAt, "d 'de' MMMM 'de' yyyy", { locale: es })}</p>
                </div>

                {/* Delete */}
                <Button variant="ghost" size="sm" onClick={onDeleteTask} className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Eliminar tarea
                </Button>
              </aside>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ───────────────────────────────────────────────────────────
// Sub-components

function TaskHeader({
  task,
  setTask,
  persist,
  onClose,
  markDone,
  pending,
}: {
  task: TaskDetail;
  setTask: (t: TaskDetail) => void;
  persist: (patch: Partial<{ status: TaskStatus; priority: TaskPriority; title: string; description: string | null; dueDate: string | null; tags: string[]; assigneeIds: string[]; color: string | null }>) => void;
  onClose: () => void;
  markDone: () => void;
  pending: boolean;
}) {
  const overdue = task.dueDate && isPast(task.dueDate) && task.status !== 'DONE';
  const isDone = task.status === 'DONE';
  return (
    <header className="sticky top-0 z-10 border-b border-sysde-border bg-white">
      {/* Color stripe */}
      {task.color && (
        <div className="h-1" style={{ backgroundColor: task.color }} />
      )}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start gap-2">
          <div className="flex-1 space-y-2">
            {/* Title — big, inline-editable */}
            <input
              value={task.title}
              onChange={(e) => setTask({ ...task, title: e.target.value })}
              onBlur={() => persist({ title: task.title })}
              className={cn(
                'w-full rounded-md border border-transparent bg-transparent px-2 py-1 -mx-2 text-2xl font-semibold leading-tight tracking-tight text-sysde-gray transition-colors hover:bg-sysde-bg/40 focus:border-sysde-red/30 focus:bg-white focus:outline-none',
                isDone && 'line-through opacity-60'
              )}
              placeholder="Título de la tarea"
            />
            {/* Quick row: status / priority / due */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status pill */}
              <Select value={task.status} onValueChange={(v) => persist({ status: v as TaskStatus })}>
                <SelectTrigger className="h-8 w-auto gap-1.5 border-sysde-border bg-white px-2.5">
                  <span className={cn('h-2 w-2 rounded-full', TASK_STATUS_DOT[task.status])} />
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

              {/* Priority pill */}
              <Select value={task.priority} onValueChange={(v) => persist({ priority: v as TaskPriority })}>
                <SelectTrigger className="h-8 w-auto gap-1.5 border-sysde-border bg-white px-2.5">
                  <span className={cn('h-2 w-2 rounded-full', TASK_PRIORITY_DOT[task.priority])} />
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

              {/* Due chip */}
              {task.dueDate && (
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium',
                  overdue ? 'border-red-300 bg-red-50 text-red-700'
                  : isToday(task.dueDate) ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-sysde-border bg-white text-sysde-gray'
                )}>
                  {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {dueLabel(task.dueDate)}
                </span>
              )}

              <div className="ml-auto flex items-center gap-2">
                {!isDone && (
                  <Button size="sm" onClick={markDone} disabled={pending} className="h-8">
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Completar
                  </Button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-8 w-8 place-items-center rounded-md text-sysde-mid hover:bg-sysde-bg hover:text-sysde-gray"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Section({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sysde-mid">
        {icon}
        {label}
      </div>
      {children}
    </section>
  );
}

function MetaBlock({
  icon,
  label,
  trailing,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sysde-mid">
          {icon}
          {label}
        </span>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function SubtaskProgressBar({ subtasks }: { subtasks: { status: TaskStatus }[] }) {
  const done = subtasks.filter((s) => s.status === 'DONE').length;
  const pct = subtasks.length === 0 ? 0 : Math.round((done / subtasks.length) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-[10px] font-semibold tabular-nums text-sysde-mid">{pct}%</span>
    </div>
  );
}

function DepRow({
  t,
  tone,
  onRemove,
}: {
  t: { id: string; title: string; status: TaskStatus; color: string | null };
  tone: 'amber' | 'violet';
  onRemove?: () => void;
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md border p-2 text-xs',
        tone === 'amber' ? 'border-amber-300/60 bg-amber-50/50' : 'border-violet-200 bg-violet-50/50'
      )}
    >
      {t.color && <span className="h-3 w-1 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />}
      <span className={cn('h-2 w-2 shrink-0 rounded-full', TASK_STATUS_DOT[t.status])} />
      <span className="flex-1 truncate text-sysde-gray">{t.title}</span>
      <span className="text-[10px] uppercase tracking-wide text-sysde-mid">{TASK_STATUS_LABELS[t.status]}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function CommentRow({
  c,
  onDelete,
}: {
  c: TaskDetail['comments'][number];
  onDelete: () => void;
}) {
  return (
    <div className="group flex gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        {c.user.avatarUrl ? <AvatarImage src={c.user.avatarUrl} alt={c.user.name} /> : null}
        <AvatarFallback className="text-[10px]">{getInitials(c.user.name)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 rounded-lg border border-sysde-border bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-sysde-gray">{c.user.name}</span>
          <span className="text-[10px] text-sysde-mid" title={format(c.createdAt, "d 'de' MMM yyyy 'a las' HH:mm", { locale: es })}>
            hace {formatDistanceToNow(c.createdAt, { locale: es })}
          </span>
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-sysde-gray">{c.body}</p>
        <button
          type="button"
          onClick={onDelete}
          className="mt-1.5 text-[10px] text-sysde-mid opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Helpers

function hydrate(raw: Record<string, unknown>): TaskDetail {
  const t = raw as unknown as {
    id: string; title: string; description: string | null;
    status: TaskStatus; priority: TaskPriority;
    dueDate: string | null; createdAt: string;
    tags: string[]; color: string | null;
    createdBy: { id: string; name: string };
    assignees: { user: { id: string; name: string; avatarUrl: string | null } }[];
    subtasks: { id: string; title: string; status: TaskStatus }[];
    comments: { id: string; body: string; createdAt: string; user: { id: string; name: string; avatarUrl: string | null } }[];
    attachments: { id: string; fileName: string; fileUrl: string; uploadedAt: string; uploadedBy: { id: string; name: string } }[];
    blockedBy?: DepLink[];
    blocking?: DepLink[];
  };
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    tags: t.tags,
    color: t.color ?? null,
    createdBy: t.createdBy,
    assignees: t.assignees,
    subtasks: t.subtasks,
    createdAt: new Date(t.createdAt),
    dueDate: t.dueDate ? new Date(t.dueDate) : null,
    blockedBy: t.blockedBy ?? [],
    blocking: t.blocking ?? [],
    comments: t.comments.map((c) => ({ ...c, createdAt: new Date(c.createdAt) })),
    attachments: t.attachments.map((a) => ({ ...a, uploadedAt: new Date(a.uploadedAt) })),
  };
}

function dueLabel(d: Date): string {
  if (isToday(d)) return 'Vence hoy';
  if (isTomorrow(d)) return 'Vence mañana';
  if (isPast(d)) return `Vencida hace ${formatDistanceToNow(d, { locale: es })}`;
  return `Vence en ${formatDistanceToNow(d, { locale: es })}`;
}
