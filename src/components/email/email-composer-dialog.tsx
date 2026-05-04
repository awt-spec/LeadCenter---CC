'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Send, Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  EMAIL_TEMPLATES,
  TEMPLATE_CATEGORIES,
  substitute,
  type EmailTemplate,
} from '@/lib/email/templates';
import { cn } from '@/lib/utils';

interface ContactCtx {
  id: string;
  email: string;
  firstName?: string | null;
  fullName?: string | null;
  company?: string | null;
  country?: string | null;
}

interface OpportunityCtx {
  id: string;
  product?: string | null;
}

interface SenderCtx {
  name: string;
}

export function EmailComposerDialog({
  contact,
  opportunity,
  accountId,
  sender,
  trigger,
}: {
  contact: ContactCtx;
  opportunity?: OpportunityCtx;
  accountId?: string;
  sender: SenderCtx;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [pickedTemplate, setPickedTemplate] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const vars = useMemo(
    () => ({
      firstName: contact.firstName ?? contact.fullName?.split(' ')[0] ?? '',
      fullName: contact.fullName ?? contact.email,
      company: contact.company ?? '',
      country: contact.country ?? '',
      product: opportunity?.product ?? 'la solución SYSDE',
      senderName: sender.name,
      lastSubject: '(asunto previo)',
    }),
    [contact, opportunity, sender]
  );

  function applyTemplate(t: EmailTemplate) {
    setSubject(substitute(t.subject, vars));
    setBody(substitute(t.body, vars));
    setPickedTemplate(t.id);
    setTimeout(() => bodyRef.current?.focus(), 50);
  }

  // Auto-grow body
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.height = 'auto';
      bodyRef.current.style.height = bodyRef.current.scrollHeight + 'px';
    }
  }, [body]);

  function reset() {
    setSubject('');
    setBody('');
    setPickedTemplate(null);
    setError(null);
  }

  async function send() {
    if (!subject.trim() || !body.trim()) {
      setError('Asunto y cuerpo son obligatorios');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contact.id,
          to: contact.email,
          subject: subject.trim(),
          body: body.trim(),
          accountId: accountId ?? null,
          opportunityId: opportunity?.id ?? null,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Error al enviar');
        return;
      }
      toast.success(`Email enviado a ${contact.email}`);
      reset();
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Enviar email
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-w-3xl gap-0 overflow-hidden p-0 sm:rounded-xl"
        onKeyDown={onKeyDown}
      >
        {/* Header strip with destinatario */}
        <div className="border-b border-sysde-border px-6 py-3">
          <div className="flex items-center gap-2 text-xs text-sysde-mid">
            <Mail className="h-3.5 w-3.5" />
            <span>Para</span>
            <span className="font-medium text-sysde-gray">{contact.fullName ?? contact.email}</span>
            <span className="text-sysde-mid">·</span>
            <span>{contact.email}</span>
          </div>
        </div>

        {/* Templates row */}
        <div className="border-b border-sysde-border bg-sysde-bg/40 px-6 py-2.5">
          <div className="flex items-center gap-1 overflow-x-auto">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-sysde-mid" />
            <span className="mr-2 text-[11px] font-medium uppercase tracking-wide text-sysde-mid">
              Plantillas
            </span>
            {TEMPLATE_CATEGORIES.map((cat) => {
              const templates = EMAIL_TEMPLATES.filter((t) => t.category === cat.key);
              if (templates.length === 0) return null;
              return templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className={cn(
                    'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                    pickedTemplate === t.id
                      ? 'border-sysde-red bg-sysde-red text-white'
                      : 'border-sysde-border bg-white text-sysde-gray hover:border-sysde-red/40'
                  )}
                  title={cat.label}
                >
                  {t.name}
                </button>
              ));
            })}
          </div>
        </div>

        {/* Subject + body */}
        <div className="space-y-3 px-6 py-4">
          <div>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto"
              className="border-0 px-0 text-base font-medium shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="-mx-6 border-t border-sysde-border" />
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escribí tu mensaje aquí…"
            className="min-h-[280px] w-full resize-none bg-transparent text-sm leading-relaxed text-sysde-gray placeholder:text-sysde-mid focus:outline-none"
            style={{ fontFamily: 'inherit' }}
          />

          {/* Variable hint when there are unresolved {{vars}} */}
          {/\{\{\w+\}\}/.test(body + subject) && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-700">
              <X className="mt-0.5 h-3 w-3" />
              <span>
                Hay variables sin resolver (<code className="rounded bg-amber-100 px-1">{'{{...}}'}</code>). Reemplazalas
                manualmente antes de enviar.
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-sysde-border bg-sysde-bg/50 px-6 py-3">
          <span className="text-[11px] text-sysde-mid">
            Reply-to: <span className="font-medium text-sysde-gray">{sender.name}</span> · ⌘+Enter para enviar
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={send}
              disabled={sending || !subject.trim() || !body.trim()}
              className="gap-1.5 bg-sysde-red hover:bg-sysde-red-dark"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {sending ? 'Enviando…' : 'Enviar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
