'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Paperclip,
  Plus,
  X,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileArchive,
  File as FileIcon,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { addAttachment, deleteAttachment } from '@/lib/activities/attachments';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Attachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
};

function iconFor(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return FileImage;
  if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) return FileVideo;
  if (['pdf'].includes(ext)) return FileText;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
  if (['zip', 'rar', '7z'].includes(ext)) return FileArchive;
  return FileIcon;
}

function formatSize(bytes: number) {
  if (bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectName(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    return decodeURIComponent(last || u.hostname);
  } catch {
    return 'Archivo';
  }
}

export function AttachmentsList({
  activityId,
  attachments,
  canEdit,
  compact = false,
}: {
  activityId: string;
  attachments: Attachment[];
  canEdit?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();

  function reset() {
    setUrl('');
    setName('');
  }

  function onSubmit() {
    const trimmed = url.trim();
    if (!trimmed) return;
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      toast.error('URL inválida');
      return;
    }
    const finalName = name.trim() || detectName(trimmed);
    startTransition(async () => {
      const r = await addAttachment({
        activityId,
        fileName: finalName,
        fileUrl: parsed.toString(),
        fileSize: 0,
        mimeType: 'application/octet-stream',
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Adjunto agregado');
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  function onDelete(id: string) {
    if (!confirm('¿Eliminar este adjunto?')) return;
    startTransition(async () => {
      const r = await deleteAttachment(id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Adjunto eliminado');
      router.refresh();
    });
  }

  if (compact && attachments.length === 0 && !canEdit) return null;

  return (
    <>
      <div className={cn(compact ? 'mt-2' : 'mt-3')}>
        {(attachments.length > 0 || canEdit) && (
          <div
            className={cn(
              'flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-sysde-mid',
              compact ? 'mb-1' : 'mb-2'
            )}
          >
            <Paperclip className="h-3 w-3" />
            Adjuntos ({attachments.length})
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => {
            const Icon = iconFor(a.fileName);
            return (
              <div
                key={a.id}
                className="group inline-flex items-center gap-1.5 rounded-md border border-sysde-border bg-white px-2 py-1.5 text-xs transition-colors hover:border-sysde-red/40"
              >
                <Icon className="h-3.5 w-3.5 text-sysde-mid" />
                <a
                  href={a.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="max-w-[160px] truncate font-medium text-sysde-gray hover:text-sysde-red"
                >
                  {a.fileName}
                </a>
                {a.fileSize > 0 && (
                  <span className="text-[10px] text-sysde-mid">{formatSize(a.fileSize)}</span>
                )}
                <ExternalLink className="h-3 w-3 text-sysde-mid opacity-0 transition-opacity group-hover:opacity-100" />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onDelete(a.id)}
                    className="ml-1 rounded p-0.5 text-sysde-mid opacity-0 transition-all hover:bg-red-50 hover:text-danger group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
          {canEdit && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-sysde-border px-2 py-1.5 text-[11px] text-sysde-mid transition-colors hover:border-sysde-red hover:text-sysde-red"
            >
              <Plus className="h-3 w-3" />
              Adjuntar
            </button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar adjunto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="att-url">URL del archivo</Label>
              <Input
                id="att-url"
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/…"
              />
              <p className="mt-1 text-[11px] text-sysde-mid">
                Pega un link de Google Drive, Dropbox, OneDrive, Notion, etc.
              </p>
            </div>
            <div>
              <Label htmlFor="att-name">Nombre (opcional)</Label>
              <Input
                id="att-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Propuesta v2.pdf"
              />
              <p className="mt-1 text-[11px] text-sysde-mid">
                Si lo dejas vacío usamos el nombre del archivo del URL.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={onSubmit} disabled={!url.trim() || pending}>
              {pending ? 'Agregando…' : 'Adjuntar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
