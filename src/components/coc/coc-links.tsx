'use client';

import { useState, useTransition } from 'react';
import {
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  Link2,
  FileText,
  FileSpreadsheet,
  Presentation,
  Video,
  Github,
  Globe,
  Sparkles,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addCocLink, deleteCocLink, updateCocLink } from '@/lib/coc/mutations';
import {
  AUDIENCES,
  AUDIENCE_LABELS,
  LINK_TYPES,
  LINK_TYPE_LABELS,
  type Audience,
  type LinkType,
} from '@/lib/coc/schemas';

interface LinkView {
  id: string;
  url: string;
  title: string;
  description: string | null;
  type: LinkType;
  audience: Audience | null;
  domain: string | null;
  thumbnail: string | null;
  createdAt: Date;
  createdBy: { id: string; name: string; avatarUrl: string | null } | null;
}

const TYPE_ICONS: Record<LinkType, React.ComponentType<{ className?: string }>> = {
  PRESENTATION: Presentation,
  DOCUMENT: FileText,
  SPREADSHEET: FileSpreadsheet,
  LOVABLE: Sparkles,
  FIGMA: Sparkles,
  VIDEO: Video,
  WEBSITE: Globe,
  REPO: Github,
  OTHER: Link2,
};

const TYPE_BG: Record<LinkType, string> = {
  PRESENTATION: 'bg-orange-50 text-orange-700 border-orange-200',
  DOCUMENT: 'bg-blue-50 text-blue-700 border-blue-200',
  SPREADSHEET: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  LOVABLE: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  FIGMA: 'bg-violet-50 text-violet-700 border-violet-200',
  VIDEO: 'bg-rose-50 text-rose-700 border-rose-200',
  WEBSITE: 'bg-sysde-bg text-sysde-gray border-sysde-border',
  REPO: 'bg-neutral-100 text-neutral-800 border-neutral-300',
  OTHER: 'bg-sysde-bg text-sysde-mid border-sysde-border',
};

export function CocLinksGrid({
  accountId,
  links,
}: {
  accountId: string;
  links: LinkView[];
}) {
  const [filter, setFilter] = useState<'ALL' | Audience>('ALL');
  const visible = filter === 'ALL' ? links : links.filter((l) => !l.audience || l.audience === filter);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Link2 className="h-4 w-4 text-sysde-red" />
          Recursos
          <span className="text-[11px] font-normal text-sysde-mid">
            ({links.length} {links.length === 1 ? 'recurso' : 'recursos'})
          </span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as 'ALL' | Audience)}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las audiencias</SelectItem>
              {AUDIENCES.map((a) => (
                <SelectItem key={a} value={a}>
                  {AUDIENCE_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AddLinkDialog accountId={accountId} />
        </div>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <div className="rounded-md border border-dashed border-sysde-border bg-sysde-bg/50 px-6 py-10 text-center">
            <Link2 className="mx-auto mb-2 h-8 w-8 text-sysde-mid" />
            <p className="text-sm text-sysde-mid">
              Sin recursos {filter !== 'ALL' && `para ${AUDIENCE_LABELS[filter as Audience]}`}.
              Agregá Lovables, Slides, Figma, Notion o cualquier link relevante.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((l) => (
              <LinkCard key={l.id} link={l} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LinkCard({ link }: { link: LinkView }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const Icon = TYPE_ICONS[link.type];

  function onDelete() {
    if (!confirm(`¿Eliminar el link "${link.title}"?`)) return;
    start(async () => {
      const res = await deleteCocLink(link.id);
      if (res.ok) toast.success('Link eliminado');
      else toast.error(res.error);
    });
  }

  return (
    <div className="group relative overflow-hidden rounded-md border border-sysde-border bg-white transition hover:border-sysde-red">
      {link.thumbnail ? (
        <a href={link.url} target="_blank" rel="noreferrer" className="block">
          <div className="relative aspect-[16/9] overflow-hidden bg-sysde-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={link.thumbnail}
              alt=""
              className="h-full w-full object-cover transition group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
          </div>
        </a>
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center bg-sysde-bg">
          <Icon className="h-10 w-10 text-sysde-mid" />
        </div>
      )}

      <div className="p-3">
        <div className="mb-1.5 flex items-start gap-2">
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${TYPE_BG[link.type]}`}>
            <Icon className="h-3 w-3" />
            {LINK_TYPE_LABELS[link.type]}
          </span>
          {link.audience && (
            <Badge variant="outline" className="text-[10px]">
              {AUDIENCE_LABELS[link.audience]}
            </Badge>
          )}
        </div>
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="block text-sm font-medium text-sysde-gray hover:text-sysde-red"
        >
          {link.title}
        </a>
        {link.description && (
          <p className="mt-1 line-clamp-2 text-xs text-sysde-mid">{link.description}</p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-sysde-mid">{link.domain ?? '—'}</span>
          <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="rounded p-1 text-sysde-mid hover:bg-sysde-bg hover:text-sysde-gray"
              title="Abrir"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              onClick={() => setEditing(true)}
              className="rounded p-1 text-sysde-mid hover:bg-sysde-bg hover:text-sysde-gray"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              disabled={pending}
              className="rounded p-1 text-sysde-mid hover:bg-red-50 hover:text-red-600"
              title="Eliminar"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
      {editing && <EditLinkDialog link={link} open={editing} onOpenChange={setEditing} />}
    </div>
  );
}

function AddLinkDialog({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<LinkType>('OTHER');
  const [audience, setAudience] = useState<Audience | 'ALL'>('ALL');
  const [pending, start] = useTransition();
  const [previewing, setPreviewing] = useState(false);

  function reset() {
    setUrl('');
    setTitle('');
    setDescription('');
    setType('OTHER');
    setAudience('ALL');
  }

  async function onUrlBlur() {
    if (!url || !/^https?:\/\//i.test(url)) return;
    setPreviewing(true);
    try {
      const res = await fetch('/api/coc/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        title: string | null;
        description: string | null;
        type: LinkType;
      };
      if (data.title && !title) setTitle(data.title);
      if (data.description && !description) setDescription(data.description);
      if (data.type) setType(data.type);
    } catch {
      // ignore — user can fill manually
    } finally {
      setPreviewing(false);
    }
  }

  function onSubmit() {
    if (!url.trim() || !title.trim()) {
      toast.error('URL y título son requeridos');
      return;
    }
    start(async () => {
      const res = await addCocLink({
        accountId,
        url: url.trim(),
        title: title.trim(),
        description: description.trim() || null,
        type,
        audience: audience === 'ALL' ? null : audience,
      });
      if (res.ok) {
        toast.success('Recurso agregado');
        reset();
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Agregar recurso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Agregar recurso</DialogTitle>
          <DialogDescription>
            Pegá la URL — detectamos el tipo automáticamente y traemos el título y la imagen
            de previa si la página lo expone (Lovable, Slides, Figma, Notion, Loom…).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-sysde-mid">URL</label>
            <div className="relative">
              <Input
                placeholder="https://lovable.dev/projects/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={onUrlBlur}
              />
              {previewing && (
                <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-sysde-mid" />
              )}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-sysde-mid">Título</label>
            <Input
              placeholder="Demo BCP — interfaz Riesgos"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-sysde-mid">Descripción (opcional)</label>
            <Textarea
              rows={2}
              placeholder="Versión Lovable usada en la demo del 12 de mayo."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-sysde-mid">Tipo</label>
              <Select value={type} onValueChange={(v) => setType(v as LinkType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {LINK_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-sysde-mid">Audiencia</label>
              <Select value={audience} onValueChange={(v) => setAudience(v as Audience | 'ALL')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas (visible siempre)</SelectItem>
                  {AUDIENCES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {AUDIENCE_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={pending || !url.trim() || !title.trim()}>
            {pending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditLinkDialog({
  link,
  open,
  onOpenChange,
}: {
  link: LinkView;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [title, setTitle] = useState(link.title);
  const [description, setDescription] = useState(link.description ?? '');
  const [type, setType] = useState<LinkType>(link.type);
  const [audience, setAudience] = useState<Audience | 'ALL'>(link.audience ?? 'ALL');
  const [pending, start] = useTransition();

  function onSubmit() {
    start(async () => {
      const res = await updateCocLink({
        linkId: link.id,
        title: title.trim() || undefined,
        description: description.trim() || null,
        type,
        audience: audience === 'ALL' ? null : audience,
      });
      if (res.ok) {
        toast.success('Recurso actualizado');
        onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Editar recurso</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-sysde-mid">URL</label>
            <Input value={link.url} disabled />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-sysde-mid">Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-sysde-mid">Descripción</label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-sysde-mid">Tipo</label>
              <Select value={type} onValueChange={(v) => setType(v as LinkType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {LINK_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-sysde-mid">Audiencia</label>
              <Select value={audience} onValueChange={(v) => setAudience(v as Audience | 'ALL')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas (visible siempre)</SelectItem>
                  {AUDIENCES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {AUDIENCE_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
