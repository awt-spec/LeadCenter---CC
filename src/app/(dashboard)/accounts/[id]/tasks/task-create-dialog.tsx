'use client';

import { useState, useTransition, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, X, Tag, Palette, Link2, Search, Paperclip, FileText,
  Image as ImageIcon, FileSpreadsheet, FileArchive, File as FileIcon,
  ChevronDown, Loader2, ListTree, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
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

interface AttachmentDraft {
  id: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  progress?: number; // 0..100 if still uploading
  error?: string;
}

interface SubtaskDraft {
  id: string;
  title: string;
  assigneeIds: string[];
}

const PRIORITY_ORDER: TaskPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf') return FileText;
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return FileSpreadsheet;
  if (mime.includes('zip') || mime.includes('compressed') || mime.includes('archive')) return FileArchive;
  return FileIcon;
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

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

  // Core fields
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

  // New-in-v3: subtasks + attachments
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // UI state
  const [showDeps, setShowDeps] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [depQuery, setDepQuery] = useState('');
  const [showUserPicker, setShowUserPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow description
  useEffect(() => {
    if (descRef.current) {
      descRef.current.style.height = 'auto';
      descRef.current.style.height = descRef.current.scrollHeight + 'px';
    }
  }, [description]);

  function reset() {
    setTitle(''); setDescription('');
    setStatus(defaultStatus ?? 'TODO');
    setPriority('NORMAL');
    setDueDate(''); setStartDate('');
    setAssigneeIds([]); setTags([]); setTagDraft('');
    setColor(null); setDependsOnIds([]);
    setSubtasks([]); setSubtaskDraft('');
    setAttachments([]);
    setUserQuery(''); setDepQuery('');
    setShowDeps(false); setShowUserPicker(false);
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  function toggleDep(id: string) {
    setDependsOnIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  function addTag(raw: string) {
    const t = raw.trim().replace(/,$/, '').slice(0, 32);
    if (!t) return;
    setTags((p) => (p.includes(t) ? p : [...p, t]));
    setTagDraft('');
  }
  function addSubtask() {
    const t = subtaskDraft.trim();
    if (!t) return;
    setSubtasks((p) => [
      ...p,
      { id: Math.random().toString(36).slice(2, 9), title: t, assigneeIds: [] },
    ]);
    setSubtaskDraft('');
  }

  // ---- Attachments ----

  async function uploadFile(file: File) {
    const draft: AttachmentDraft = {
      id: Math.random().toString(36).slice(2, 9),
      url: '',
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      progress: 0,
    };
    setAttachments((p) => [...p, draft]);

    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/tasks/upload', { method: 'POST', body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setAttachments((p) =>
          p.map((a) => (a.id === draft.id ? { ...a, error: json.error ?? 'Upload falló', progress: undefined } : a))
        );
        return;
      }
      setAttachments((p) =>
        p.map((a) => (a.id === draft.id ? { ...a, url: json.url!, progress: undefined } : a))
      );
    } catch (e) {
      setAttachments((p) =>
        p.map((a) => (a.id === draft.id ? { ...a, error: (e as Error).message, progress: undefined } : a))
      );
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((f) => uploadFile(f));
  }

  function removeAttachment(id: string) {
    setAttachments((p) => p.filter((a) => a.id !== id));
  }

  // ---- Filtered options ----

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

  // ---- Submit ----

  const incompleteUploads = attachments.some((a) => a.progress !== undefined);

  function onSubmit() {
    if (!title.trim()) {
      toast.error('El título es obligatorio');
      return;
    }
    if (incompleteUploads) {
      toast.error('Espera a que terminen los uploads');
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
        subtasks: subtasks.map((s) => ({ title: s.title, assigneeIds: s.assigneeIds })),
        attachments: attachments
          .filter((a) => a.url && !a.error)
          .map((a) => ({ url: a.url, fileName: a.fileName, fileSize: a.fileSize, mimeType: a.mimeType })),
      });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(
        subtasks.length
          ? `Tarea creada con ${subtasks.length} sub-tarea${subtasks.length > 1 ? 's' : ''}`
          : 'Tarea creada'
      );
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 bg-sysde-red hover:bg-sysde-red-dark">
          <Plus className="h-3.5 w-3.5" />
          Nueva tarea
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-5xl gap-0 overflow-hidden p-0 sm:rounded-xl"
        onKeyDown={onKeyDown}
      >
        {/* color stripe at the top */}
        <div className="h-1 w-full transition-colors" style={{ backgroundColor: color ?? '#E5E7EB' }} />

        <div className="grid max-h-[80vh] grid-cols-1 lg:grid-cols-[1fr_320px]">
          {/* ===== LEFT: title + description + subtasks + attachments ===== */}
          <div className="overflow-y-auto p-6">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="¿Qué hay que hacer?"
              className="w-full bg-transparent text-2xl font-semibold leading-tight text-sysde-gray placeholder:font-normal placeholder:text-sysde-mid focus:outline-none"
            />
            <textarea
              ref={descRef}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Agregá una descripción detallada — qué, por qué, contexto…"
              className="mt-3 w-full resize-none bg-transparent text-sm leading-relaxed text-sysde-gray placeholder:text-sysde-mid focus:outline-none"
              style={{ minHeight: '60px' }}
            />

            {/* Subtasks */}
            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-sysde-mid">
                <ListTree className="h-3.5 w-3.5" />
                Sub-tareas
                {subtasks.length > 0 && (
                  <span className="rounded-full bg-sysde-bg px-1.5 text-[10px] text-sysde-gray">{subtasks.length}</span>
                )}
              </div>
              <div className="space-y-1.5">
                {subtasks.map((s) => (
                  <div
                    key={s.id}
                    className="group flex items-center gap-2 rounded-md border border-sysde-border bg-white px-2 py-1.5"
                  >
                    <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-sysde-mid" />
                    <input
                      value={s.title}
                      onChange={(e) =>
                        setSubtasks((p) => p.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))
                      }
                      className="flex-1 bg-transparent text-sm focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setSubtasks((p) => p.filter((x) => x.id !== s.id))}
                      className="text-sysde-mid opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 rounded-md border border-dashed border-sysde-border px-2 py-1.5">
                  <Plus className="h-3.5 w-3.5 text-sysde-mid" />
                  <input
                    value={subtaskDraft}
                    onChange={(e) => setSubtaskDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSubtask();
                      }
                    }}
                    placeholder="Agregar sub-tarea (Enter para crear)"
                    className="flex-1 bg-transparent text-sm placeholder:text-sysde-mid focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Attachments */}
            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-sysde-mid">
                <Paperclip className="h-3.5 w-3.5" />
                Adjuntos
                {attachments.length > 0 && (
                  <span className="rounded-full bg-sysde-bg px-1.5 text-[10px] text-sysde-gray">{attachments.length}</span>
                )}
              </div>
              <div className="space-y-1.5">
                {attachments.map((a) => {
                  const Icon = fileIcon(a.mimeType);
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        'flex items-center gap-2 rounded-md border bg-white px-2 py-1.5 text-sm',
                        a.error ? 'border-red-300 bg-red-50' : 'border-sysde-border'
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', a.error ? 'text-red-500' : 'text-sysde-mid')} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sysde-gray">{a.fileName}</div>
                        <div className="text-[11px] text-sysde-mid">
                          {fmtBytes(a.fileSize)}
                          {a.progress !== undefined && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              subiendo…
                            </span>
                          )}
                          {a.error && <span className="ml-2 text-red-600">· {a.error}</span>}
                          {!a.error && !a.progress && a.url && <span className="ml-2 text-emerald-600">✓ subido</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(a.id)}
                        className="text-sysde-mid hover:text-danger"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleFiles(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed py-3 text-xs transition-colors',
                    dragOver
                      ? 'border-sysde-red bg-sysde-red-light text-sysde-red'
                      : 'border-sysde-border text-sysde-mid hover:border-sysde-red/40 hover:text-sysde-gray'
                  )}
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  Soltá archivos acá o cliqueá para seleccionar
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          </div>

          {/* ===== RIGHT: metadata sidebar ===== */}
          <aside className="overflow-y-auto border-t border-sysde-border bg-sysde-bg/30 p-5 lg:border-l lg:border-t-0">
            <SidebarSection label="Estado">
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
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all',
                        sel
                          ? 'border-sysde-red bg-sysde-red text-white shadow-sm'
                          : 'border-sysde-border bg-white text-sysde-gray hover:border-sysde-red/40'
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', sel ? 'bg-white' : TASK_STATUS_DOT[s])} />
                      {TASK_STATUS_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </SidebarSection>

            <SidebarSection label="Prioridad">
              <div className="grid grid-cols-4 gap-1">
                {PRIORITY_ORDER.map((p) => {
                  const sel = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={cn(
                        'inline-flex items-center justify-center gap-1 rounded-md border px-1 py-1.5 text-[11px] font-medium transition-all',
                        sel
                          ? 'border-sysde-red bg-sysde-red-light text-sysde-red'
                          : 'border-sysde-border bg-white text-sysde-gray hover:border-sysde-red/40'
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', TASK_PRIORITY_DOT[p])} />
                      {TASK_PRIORITY_LABELS[p]}
                    </button>
                  );
                })}
              </div>
            </SidebarSection>

            <SidebarSection label="Fechas">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-0.5 text-[10px] uppercase tracking-wide text-sysde-mid">Inicio</div>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <div className="mb-0.5 text-[10px] uppercase tracking-wide text-sysde-mid">Vence</div>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
            </SidebarSection>

            <SidebarSection label="Responsables">
              <div className="space-y-2">
                {assigneeIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {assigneeIds.map((id) => {
                      const u = users.find((x) => x.id === id);
                      if (!u) return null;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleAssignee(id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-sysde-red bg-sysde-red-light px-1.5 py-0.5 text-[11px] text-sysde-red"
                        >
                          <Avatar className="h-4 w-4">
                            {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={u.name} /> : null}
                            <AvatarFallback className="text-[8px]">{getInitials(u.name)}</AvatarFallback>
                          </Avatar>
                          {u.name}
                          <X className="h-3 w-3" />
                        </button>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowUserPicker((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-sysde-border bg-white px-2 py-1 text-[11px] text-sysde-mid hover:border-sysde-red/40 hover:text-sysde-gray"
                >
                  <Plus className="h-3 w-3" />
                  Asignar persona
                </button>
                {showUserPicker && (
                  <div className="rounded-md border border-sysde-border bg-white p-2">
                    <div className="relative mb-1.5">
                      <Search className="absolute left-2 top-1.5 h-3 w-3 text-sysde-mid" />
                      <Input
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        placeholder="Buscar…"
                        className="h-7 pl-6 text-[11px]"
                      />
                    </div>
                    <div className="max-h-32 space-y-0.5 overflow-y-auto">
                      {filteredUsers.length === 0 ? (
                        <div className="px-1 py-1 text-[11px] text-sysde-mid">Sin resultados.</div>
                      ) : (
                        filteredUsers.map((u) => {
                          const sel = assigneeIds.includes(u.id);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => toggleAssignee(u.id)}
                              className={cn(
                                'flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] transition-colors',
                                sel ? 'bg-sysde-red-light text-sysde-red' : 'hover:bg-sysde-bg'
                              )}
                            >
                              <Avatar className="h-5 w-5">
                                {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={u.name} /> : null}
                                <AvatarFallback className="text-[9px]">{getInitials(u.name)}</AvatarFallback>
                              </Avatar>
                              <span className="flex-1 truncate">{u.name}</span>
                              {sel && <span className="text-[10px]">✓</span>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </SidebarSection>

            <SidebarSection label={<><Tag className="h-3 w-3" /> Tags</>}>
              <div className="flex flex-wrap items-center gap-1 rounded-md border border-sysde-border bg-white px-1.5 py-1.5">
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-0.5 rounded bg-sysde-bg px-1 py-0.5 text-[10px] text-sysde-gray">
                    {t}
                    <button type="button" onClick={() => setTags((p) => p.filter((x) => x !== t))} className="text-sysde-mid hover:text-danger">
                      <X className="h-2.5 w-2.5" />
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
                      setTags((p) => p.slice(0, -1));
                    }
                  }}
                  onBlur={() => addTag(tagDraft)}
                  placeholder={tags.length ? '' : 'Tag y enter…'}
                  className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-sysde-mid"
                />
              </div>
            </SidebarSection>

            <SidebarSection label={<><Palette className="h-3 w-3" /> Color</>}>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setColor(null)}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] transition-all',
                    color === null ? 'border-sysde-red text-sysde-red' : 'border-sysde-border text-sysde-mid'
                  )}
                  title="Sin color"
                >∅</button>
                {TASK_COLOR_PRESETS.map((c) => {
                  const sel = color === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      title={c.label}
                      style={{ backgroundColor: c.value }}
                      className={cn('h-6 w-6 rounded-full transition-all', sel ? 'ring-2 ring-sysde-gray ring-offset-1' : 'hover:scale-110')}
                    />
                  );
                })}
              </div>
            </SidebarSection>

            {dependencyCandidates.length > 0 && (
              <SidebarSection
                label={
                  <button
                    type="button"
                    onClick={() => setShowDeps((v) => !v)}
                    className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-sysde-mid hover:text-sysde-gray"
                  >
                    <Link2 className="h-3 w-3" />
                    Bloqueada por
                    {dependsOnIds.length > 0 && <span className="text-sysde-red">· {dependsOnIds.length}</span>}
                    <ChevronDown className={cn('ml-auto h-3 w-3 transition-transform', showDeps && 'rotate-180')} />
                  </button>
                }
              >
                {showDeps && (
                  <div className="rounded-md border border-sysde-border bg-white p-1.5">
                    <div className="relative mb-1.5">
                      <Search className="absolute left-2 top-1.5 h-3 w-3 text-sysde-mid" />
                      <Input
                        value={depQuery}
                        onChange={(e) => setDepQuery(e.target.value)}
                        placeholder="Buscar tarea…"
                        className="h-7 pl-6 text-[11px]"
                      />
                    </div>
                    <div className="max-h-32 space-y-0.5 overflow-y-auto">
                      {filteredDeps.length === 0 ? (
                        <div className="px-1 py-1 text-[11px] text-sysde-mid">Sin resultados.</div>
                      ) : (
                        filteredDeps.map((d) => {
                          const sel = dependsOnIds.includes(d.id);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => toggleDep(d.id)}
                              className={cn(
                                'flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] transition-colors',
                                sel ? 'bg-sysde-red-light text-sysde-red' : 'hover:bg-sysde-bg'
                              )}
                            >
                              <span className={cn('h-2 w-2 shrink-0 rounded-full', TASK_STATUS_DOT[d.status])} />
                              <span className="flex-1 truncate text-sysde-gray">{d.title}</span>
                              {sel && <span className="text-[10px]">✓</span>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </SidebarSection>
            )}
          </aside>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-2 border-t border-sysde-border bg-sysde-bg/50 px-6 py-3">
          <span className="text-[11px] text-sysde-mid">
            <kbd className="rounded border border-sysde-border bg-white px-1 py-0.5 font-mono text-[10px]">⌘</kbd>+
            <kbd className="rounded border border-sysde-border bg-white px-1 py-0.5 font-mono text-[10px]">Enter</kbd>{' '}
            para crear · <kbd className="rounded border border-sysde-border bg-white px-1 py-0.5 font-mono text-[10px]">Esc</kbd> para cerrar
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={onSubmit}
              disabled={pending || !title.trim() || incompleteUploads}
              className="bg-sysde-red hover:bg-sysde-red-dark"
            >
              {pending ? 'Creando…' : 'Crear tarea'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SidebarSection({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-sysde-mid">
        {label}
      </div>
      {children}
    </div>
  );
}
