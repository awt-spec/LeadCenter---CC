'use client';

import { useEffect, useState, useTransition } from 'react';
import { Plus, Search, Check, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  enrollContactsBulk,
  searchContactsForEnroll,
} from '@/lib/campaigns/mutations';
import { cn } from '@/lib/utils';

type Match = {
  id: string;
  fullName: string;
  email: string;
  companyName: string | null;
  enrolled: boolean;
};

export function EnrollContactsDialog({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Match[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();

  // debounce search
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchContactsForEnroll(campaignId, q);
        setResults(r.data);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, campaignId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onConfirm() {
    if (!selected.size) return;
    startTransition(async () => {
      const r = await enrollContactsBulk(campaignId, Array.from(selected));
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`${r.data.enrolled} contacto${r.data.enrolled === 1 ? '' : 's'} enrolado${r.data.enrolled === 1 ? '' : 's'}`);
      setOpen(false);
      setSelected(new Set());
      setQ('');
      router.refresh();
    });
  }

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (!o) {
      setSelected(new Set());
      setQ('');
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="mr-1.5 h-3.5 w-3.5" />
        Enrolar contactos
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enrolar contactos a la campaña</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sysde-mid" />
            <Input
              autoFocus
              placeholder="Buscar por nombre, email o empresa…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="-mx-6 max-h-80 overflow-y-auto border-t border-sysde-border">
            {searching && results.length === 0 ? (
              <div className="px-6 py-8 text-center text-xs text-sysde-mid">Buscando…</div>
            ) : results.length === 0 ? (
              <div className="px-6 py-8 text-center text-xs text-sysde-mid">
                Ningún contacto coincide con la búsqueda.
              </div>
            ) : (
              <div className="divide-y divide-sysde-border">
                {results.map((c) => {
                  const isSelected = selected.has(c.id);
                  const disabled = c.enrolled;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(c.id)}
                      className={cn(
                        'flex w-full items-center gap-3 px-6 py-2.5 text-left transition-colors',
                        disabled
                          ? 'cursor-not-allowed opacity-50'
                          : isSelected
                          ? 'bg-sysde-red-light'
                          : 'hover:bg-sysde-bg'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all',
                          isSelected
                            ? 'border-sysde-red bg-sysde-red'
                            : 'border-sysde-border'
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-sysde-gray">
                          {c.fullName}
                        </div>
                        <div className="truncate text-xs text-sysde-mid">
                          {c.email} {c.companyName ? `· ${c.companyName}` : ''}
                        </div>
                      </div>
                      {c.enrolled && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                          Ya enrolado
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-sysde-mid">
              {selected.size > 0
                ? `${selected.size} seleccionado${selected.size === 1 ? '' : 's'}`
                : 'Selecciona uno o más para enrolar'}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={onConfirm} disabled={!selected.size || pending}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {pending ? 'Enrolando…' : `Enrolar ${selected.size || ''}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
