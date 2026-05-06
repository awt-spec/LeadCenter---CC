'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Check, Loader2, ShieldCheck } from 'lucide-react';

/**
 * Botonera flotante para "marcar revisado". Aparece cuando hay
 * checkboxes (`input[data-audit-review]`) marcados en la página.
 *
 * Comunicación: usa un MutationObserver + addEventListener('change')
 * sobre todos los checkboxes con el atributo `data-audit-review`.
 * No requiere prop drilling ni context — la tabla solo mete los
 * checkboxes y este componente reacciona.
 */
export function ReviewBar() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function recount() {
      const checked = document.querySelectorAll<HTMLInputElement>(
        'input[data-audit-review]:checked'
      );
      setCount(checked.length);
    }
    recount();

    function onChange(e: Event) {
      if (
        e.target instanceof HTMLInputElement &&
        e.target.dataset.auditReview !== undefined
      ) {
        recount();
      }
    }

    document.addEventListener('change', onChange, true);

    // También recontamos cuando se navega (SPA) y los checkboxes cambian.
    const observer = new MutationObserver(recount);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('change', onChange, true);
      observer.disconnect();
    };
  }, []);

  function getSelectedIds(): string[] {
    return Array.from(
      document.querySelectorAll<HTMLInputElement>('input[data-audit-review]:checked')
    )
      .map((i) => i.value)
      .filter(Boolean);
  }

  async function submit() {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/audit/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, note: note.trim() || undefined }),
      });
      if (res.ok) {
        setOpen(false);
        setNote('');
        startTransition(() => router.refresh());
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (count === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-sysde-gray text-white rounded-lg shadow-xl px-4 py-2 flex items-center gap-3">
      <ShieldCheck className="h-4 w-4 text-sysde-red" />
      <span className="text-sm font-medium">
        {count} seleccionado{count === 1 ? '' : 's'}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            className="bg-sysde-red hover:bg-sysde-red-dk text-white h-7"
            disabled={pending}
          >
            <Check className="h-3 w-3 mr-1" /> Marcar revisado
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Marcar {count} evento{count === 1 ? '' : 's'} como revisado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-sysde-mid">
              Tu nombre y la fecha quedan registrados. Podés añadir una nota
              opcional sobre por qué los marcaste como revisados.
            </p>
            <Textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota opcional (e.g. 'Revisé las eliminaciones del lunes, todo OK')"
              rows={3}
              maxLength={2000}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={submit}
                disabled={submitting}
                className="bg-sysde-red hover:bg-sysde-red-dk text-white"
              >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
