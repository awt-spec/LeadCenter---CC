'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Bookmark, BookmarkPlus, Trash2, Globe2, Loader2 } from 'lucide-react';

type View = {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  isShared: boolean;
  isOwn: boolean;
  ownerName?: string;
  createdAt: string;
};

const FILTER_KEYS = [
  'q',
  'product',
  'ownerId',
  'rating',
  'country',
  'segment',
  'commercialModel',
  'minValue',
  'maxValue',
  'closeFrom',
  'closeTo',
  'createdFrom',
  'createdTo',
  'onlyMine',
  'overdueNextAction',
  'stale7d',
  'staleness',
  'needsResponse',
  'includeWon',
  'includeLost',
  'includeStandBy',
  'includeNurture',
];

export function PipelineSavedViews() {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<View[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);

  async function fetchViews() {
    setLoading(true);
    try {
      const res = await fetch('/api/opportunities/views');
      const json = await res.json();
      if (json.ok) setViews(json.views as View[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) fetchViews();
  }, [open]);

  function applyView(v: View) {
    const params = new URLSearchParams();
    for (const [k, val] of Object.entries(v.filters)) {
      if (Array.isArray(val)) val.forEach((x) => params.append(k, String(x)));
      else if (val !== null && val !== undefined && val !== '') params.set(k, String(val));
    }
    router.replace(`/pipeline${params.toString() ? '?' + params.toString() : ''}`, {
      scroll: false,
    });
    setOpen(false);
  }

  async function deleteView(v: View) {
    if (!confirm(`¿Borrar la vista "${v.name}"?`)) return;
    await fetch(`/api/opportunities/views/${v.id}`, { method: 'DELETE' });
    fetchViews();
  }

  async function saveCurrent() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      // Capturar filtros actuales del URL
      const filters: Record<string, unknown> = {};
      for (const k of FILTER_KEYS) {
        const all = sp?.getAll(k) ?? [];
        if (all.length > 1) {
          filters[k] = all;
        } else if (all.length === 1 && all[0]) {
          filters[k] = all[0];
        }
      }

      const res = await fetch('/api/opportunities/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), filters, isShared: shared }),
      });
      if (res.ok) {
        setName('');
        setShared(false);
        setSaveOpen(false);
        fetchViews();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative inline-block">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
        <Bookmark className="h-3.5 w-3.5 mr-1.5" /> Vistas
      </Button>

      {open ? (
        <div className="absolute right-0 top-full mt-1 w-[320px] rounded-lg border border-sysde-border bg-white shadow-lg z-20">
          <div className="p-2 border-b border-sysde-border flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-sysde-mid">
              Vistas guardadas
            </span>
            <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-[11px]">
                  <BookmarkPlus className="h-3 w-3 mr-1" /> Guardar actual
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Guardar vista</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-sysde-mid mb-1 block">Nombre</label>
                    <Input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="ej. Mis deals 72h+ sin gestión"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-sysde-gray">
                    <input
                      type="checkbox"
                      checked={shared}
                      onChange={(e) => setShared(e.target.checked)}
                    />
                    <Globe2 className="h-3.5 w-3.5 text-sysde-mid" />
                    Compartir con el equipo
                  </label>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSaveOpen(false)}
                      disabled={saving}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveCurrent}
                      disabled={saving || !name.trim()}
                      className="bg-sysde-red hover:bg-sysde-red-dk text-white"
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Guardar'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="p-6 flex items-center justify-center text-sysde-mid">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : views.length === 0 ? (
            <div className="p-6 text-center text-xs text-sysde-mid">
              Sin vistas guardadas todavía. Aplica filtros y dale &ldquo;Guardar actual&rdquo;.
            </div>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto py-1">
              {views.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-sysde-bg group cursor-pointer"
                  onClick={() => applyView(v)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-sysde-gray flex items-center gap-1.5">
                      {v.name}
                      {v.isShared ? (
                        <Globe2 className="h-3 w-3 text-sysde-mid" aria-label="Compartida" />
                      ) : null}
                    </div>
                    {!v.isOwn && v.ownerName ? (
                      <div className="text-[10px] text-sysde-mid">por {v.ownerName}</div>
                    ) : null}
                  </div>
                  {v.isOwn ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteView(v);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-sysde-mid hover:text-red-600 transition-opacity"
                      aria-label="Borrar vista"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
