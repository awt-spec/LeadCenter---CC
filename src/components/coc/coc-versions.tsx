'use client';

import { useState, useTransition, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Save, Loader2, Layers, CheckCircle2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { saveCocVersion } from '@/lib/coc/mutations';
import { AUDIENCES, AUDIENCE_LABELS, AUDIENCE_DESCRIPTIONS, type Audience } from '@/lib/coc/schemas';

interface VersionView {
  audience: Audience;
  body: string | null;
  updatedAt: Date | null;
  updatedBy: { id: string; name: string; avatarUrl: string | null } | null;
}

export function CocVersionsEditor({
  accountId,
  versions,
}: {
  accountId: string;
  versions: VersionView[];
}) {
  // Map by audience for fast lookup
  const initialByAudience = useMemo(() => {
    const m = new Map<Audience, VersionView>();
    for (const v of versions) m.set(v.audience, v);
    return m;
  }, [versions]);

  const [active, setActive] = useState<Audience>('INTERNAL');
  const [bodies, setBodies] = useState<Record<Audience, string>>(() => {
    const out = {} as Record<Audience, string>;
    for (const a of AUDIENCES) out[a] = initialByAudience.get(a)?.body ?? '';
    return out;
  });
  const [dirty, setDirty] = useState<Record<Audience, boolean>>(() => {
    const out = {} as Record<Audience, boolean>;
    for (const a of AUDIENCES) out[a] = false;
    return out;
  });
  const [pending, start] = useTransition();
  const [drafting, setDrafting] = useState<Audience | null>(null);

  function setBody(audience: Audience, body: string) {
    setBodies((b) => ({ ...b, [audience]: body }));
    setDirty((d) => ({ ...d, [audience]: true }));
  }

  function onSave(audience: Audience) {
    start(async () => {
      const res = await saveCocVersion({
        accountId,
        audience,
        body: bodies[audience].trim() || null,
      });
      if (res.ok) {
        toast.success(`${AUDIENCE_LABELS[audience]} guardado`);
        setDirty((d) => ({ ...d, [audience]: false }));
      } else {
        toast.error(res.error);
      }
    });
  }

  /// Generate this audience's body via Claude, using tasks/emails/opps + the
  /// existing strategy. Loads the result into the textarea (no auto-save) so
  /// the user can review before persisting.
  async function onDraftAI(audience: Audience) {
    if (bodies[audience].trim().length > 0) {
      const ok = confirm(`Hay contenido en "${AUDIENCE_LABELS[audience]}". ¿Lo reemplazo con la versión IA? (podés revisar antes de guardar)`);
      if (!ok) return;
    }
    setDrafting(audience);
    try {
      const res = await fetch(`/api/coc/${accountId}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'version', audience }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; draft?: { body: string } };
      if (!res.ok || !json.ok || !json.draft) {
        toast.error(json.error ?? 'Error al generar borrador');
        return;
      }
      setBodies((b) => ({ ...b, [audience]: json.draft!.body }));
      setDirty((d) => ({ ...d, [audience]: true }));
      toast.success(`Borrador IA listo — revisá y guardá`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDrafting(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4 text-sysde-red" />
          Versiones por audiencia
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={active} onValueChange={(v) => setActive(v as Audience)}>
          <TabsList className="flex w-full flex-wrap gap-1">
            {AUDIENCES.map((a) => {
              const has = (initialByAudience.get(a)?.body?.length ?? 0) > 0;
              return (
                <TabsTrigger key={a} value={a} className="relative gap-1.5">
                  {AUDIENCE_LABELS[a]}
                  {has && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                  {dirty[a] && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-amber-500" />}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {AUDIENCES.map((a) => {
            const meta = initialByAudience.get(a);
            return (
              <TabsContent key={a} value={a} className="mt-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-sysde-mid">{AUDIENCE_DESCRIPTIONS[a]}</p>
                  {meta?.updatedAt && (
                    <span className="shrink-0 text-[11px] text-sysde-mid">
                      {meta.updatedBy?.name ?? '—'} · {format(meta.updatedAt, "d LLL HH:mm", { locale: es })}
                    </span>
                  )}
                </div>

                <Textarea
                  rows={10}
                  className="font-[ui-monospace,SFMono-Regular,Menlo,monospace] text-[13px] leading-relaxed"
                  placeholder={placeholderFor(a)}
                  value={bodies[a]}
                  onChange={(e) => setBody(a, e.target.value)}
                  maxLength={20000}
                />

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-sysde-mid">
                    {bodies[a].length.toLocaleString('es-MX')} / 20,000 caracteres
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDraftAI(a)}
                      disabled={drafting !== null || pending}
                      className="gap-1.5 border-sysde-red/30 text-sysde-red hover:bg-sysde-red/5 hover:text-sysde-red"
                      title={`Genera el cuerpo de "${AUDIENCE_LABELS[a]}" con IA usando tareas, emails, oportunidades y la estrategia compartida.`}
                    >
                      {drafting === a ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {drafting === a ? 'Analizando…' : 'Redactar con IA'}
                    </Button>
                    <Button size="sm" onClick={() => onSave(a)} disabled={pending || !dirty[a]}>
                      {pending ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="mr-1 h-3.5 w-3.5" />
                      )}
                      Guardar {AUDIENCE_LABELS[a]}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function placeholderFor(a: Audience): string {
  switch (a) {
    case 'INTERNAL':
      return 'Versión interna completa: contexto del prospect, players internos, dinámica política, incumbente, lo que NO les estamos contando, reservas comerciales…';
    case 'PROSPECT':
      return 'Lo que le contaríamos al cliente — value prop, beneficios, plan de implementación. Nada de pricing interno ni notas confidenciales.';
    case 'FINANCE':
      return 'Para CFO / Finanzas: pricing, modelo comercial, ROI esperado, condiciones de pago, riesgo crediticio.';
    case 'TECHNICAL':
      return 'Para áreas técnicas: stack actual del cliente, integraciones requeridas, supuestos de migración, dependencias.';
    case 'EXECUTIVE':
      return '1-pager para leadership: por qué vale la pena, cuánto, cuándo, cuál es el riesgo, qué necesitamos.';
  }
}
