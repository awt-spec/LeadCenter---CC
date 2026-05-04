'use client';

import { useState } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, TrendingUp, Minus, ArrowRight, Loader2, Target } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AccountSummary {
  headline: string;
  momentum: 'positivo' | 'neutro' | 'riesgo';
  signals: string[];
  risks: string[];
  nextSteps: Array<{ action: string; owner?: string; horizon?: string }>;
  rating: string;
  generatedAt: string;
}

const MOMENTUM_STYLES = {
  positivo: { icon: TrendingUp, color: 'text-emerald-700 bg-emerald-50 border-emerald-300', label: 'Positivo' },
  neutro: { icon: Minus, color: 'text-sysde-mid bg-sysde-bg border-sysde-border', label: 'Neutro' },
  riesgo: { icon: AlertTriangle, color: 'text-red-700 bg-red-50 border-red-300', label: 'Riesgo' },
} as const;

export function AccountSummaryCard({ accountId }: { accountId: string }) {
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/account/${accountId}/summary`, { method: 'POST' });
      const json = (await res.json()) as { ok?: boolean; error?: string; summary?: AccountSummary };
      if (!res.ok || !json.ok || !json.summary) {
        setError(json.error ?? 'Error al generar resumen');
        return;
      }
      setSummary(json.summary);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-sysde-border bg-gradient-to-r from-sysde-red/5 to-violet-500/5 px-5 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-sysde-red" />
          <h3 className="text-sm font-semibold text-sysde-gray">Resumen IA</h3>
          {summary && (
            <span className="text-[11px] text-sysde-mid">
              · {new Date(summary.generatedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant={summary ? 'outline' : 'default'}
          onClick={generate}
          disabled={loading}
          className={cn('gap-1.5', !summary && 'bg-sysde-red hover:bg-sysde-red-dark')}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : summary ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {loading ? 'Generando…' : summary ? 'Regenerar' : 'Generar resumen'}
        </Button>
      </div>

      <div className="p-5">
        {!summary && !loading && !error && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Sparkles className="h-8 w-8 text-sysde-mid" />
            <p className="text-sm text-sysde-mid">
              Generá un resumen ejecutivo con IA basado en las últimas actividades, deals abiertos,
              tracking de emails y notas. Tarda 5-15 segundos.
            </p>
          </div>
        )}

        {loading && !summary && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-sysde-mid">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analizando actividad…
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            <strong>Error: </strong>
            {error}
          </div>
        )}

        {summary && (
          <div className="space-y-4">
            {/* Headline + momentum + rating */}
            <div className="space-y-2">
              <p className="text-base leading-relaxed text-sysde-gray">{summary.headline}</p>
              <div className="flex flex-wrap items-center gap-2">
                <MomentumBadge momentum={summary.momentum} />
                <Badge variant="outline" className="font-mono">
                  Rating {summary.rating}
                </Badge>
              </div>
            </div>

            {/* Signals + Risks side-by-side on lg */}
            {(summary.signals.length > 0 || summary.risks.length > 0) && (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {summary.signals.length > 0 && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      <TrendingUp className="h-3 w-3" />
                      Señales
                    </div>
                    <ul className="space-y-1">
                      {summary.signals.map((s, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-1.5 rounded-md border border-emerald-200 bg-emerald-50/50 px-2 py-1 text-xs text-sysde-gray"
                        >
                          <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.risks.length > 0 && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-700">
                      <AlertTriangle className="h-3 w-3" />
                      Riesgos
                    </div>
                    <ul className="space-y-1">
                      {summary.risks.map((r, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50/50 px-2 py-1 text-xs text-sysde-gray"
                        >
                          <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-red-500" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Next steps */}
            {summary.nextSteps.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-sysde-red">
                  <Target className="h-3 w-3" />
                  Próximos pasos
                </div>
                <ol className="space-y-1.5">
                  {summary.nextSteps.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-md border border-sysde-border bg-white p-2 text-xs"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sysde-red text-[10px] font-semibold text-white">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="text-sysde-gray">{s.action}</div>
                        {(s.owner || s.horizon) && (
                          <div className="mt-0.5 flex gap-2 text-[10px] text-sysde-mid">
                            {s.owner && <span>👤 {s.owner}</span>}
                            {s.horizon && (
                              <span className="inline-flex items-center gap-1">
                                <ArrowRight className="h-2.5 w-2.5" />
                                {s.horizon}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <p className="border-t border-sysde-border pt-2 text-[10px] text-sysde-mid">
              Generado por Claude Sonnet basado en datos de los últimos 90 días. Verificá los hechos
              antes de actuar — la IA puede equivocarse.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function MomentumBadge({ momentum }: { momentum: 'positivo' | 'neutro' | 'riesgo' }) {
  const s = MOMENTUM_STYLES[momentum];
  const Icon = s.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', s.color)}>
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}
