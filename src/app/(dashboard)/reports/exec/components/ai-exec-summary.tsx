'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  AlertTriangle,
  Trophy,
  Lightbulb,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { ExecPeriod } from '@/lib/reports/exec-queries';

type Result = {
  headline: string;
  summary: string;
  wins: string[];
  risks: string[];
  recommendations: string[];
  generatedAt: string;
};

export function AIExecSummary({
  period,
  autoLoad = false,
}: {
  period: ExecPeriod;
  autoLoad?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reports/ai-exec-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Error generando brief');
        return;
      }
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // Cuando cambia el período, limpiar para forzar regeneración manual
  useEffect(() => {
    setData(null);
    setError(null);
    if (autoLoad) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <Card className="p-6 bg-gradient-to-br from-white to-red-50/30 border-sysde-red/20">
      <header className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-sysde-gray flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-sysde-red" />
          Brief ejecutivo · IA
        </h2>
        {data ? (
          <Button
            variant="outline"
            size="sm"
            onClick={generate}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Regenerar
          </Button>
        ) : null}
      </header>

      {!data && !loading && !error ? (
        <div className="text-center py-8">
          <p className="text-sm text-sysde-mid mb-3 max-w-lg mx-auto">
            Claude analiza KPIs, top deals, performers y deals at-risk del
            período y genera un brief con highlights, riesgos y
            recomendaciones accionables.
          </p>
          <Button
            onClick={generate}
            className="bg-sysde-red hover:bg-sysde-red-dk text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generar brief ejecutivo
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-sysde-mid">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">
            Analizando deals, performers y métricas del período…
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="text-sm text-red-700 bg-red-50 rounded p-4 border border-red-200">
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      {data && !loading ? (
        <div className="space-y-5">
          <h3 className="text-2xl font-bold text-sysde-gray leading-tight">
            {data.headline}
          </h3>

          <div className="text-sm text-sysde-gray leading-relaxed whitespace-pre-line">
            {data.summary}
          </div>

          <div className="grid gap-4 md:grid-cols-2 pt-2">
            {data.wins.length > 0 ? (
              <div>
                <h4 className="text-[11px] uppercase tracking-wider text-green-700 mb-2 flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> Highlights
                </h4>
                <ul className="space-y-1.5">
                  {data.wins.map((w, i) => (
                    <li
                      key={i}
                      className="text-xs text-sysde-gray pl-3 relative before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-green-500"
                    >
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {data.risks.length > 0 ? (
              <div>
                <h4 className="text-[11px] uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Riesgos
                </h4>
                <ul className="space-y-1.5">
                  {data.risks.map((r, i) => (
                    <li
                      key={i}
                      className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {data.recommendations.length > 0 ? (
            <div className="border-t border-sysde-border pt-4">
              <h4 className="text-[11px] uppercase tracking-wider text-sysde-red mb-2 flex items-center gap-1">
                <Lightbulb className="h-3 w-3" /> Recomendaciones
              </h4>
              <ul className="space-y-1.5">
                {data.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="text-sm text-sysde-gray bg-white border border-sysde-border rounded p-2.5 flex items-start gap-2"
                  >
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sysde-red text-white text-[10px] font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-[10px] text-sysde-mid text-center pt-2 border-t border-sysde-border italic">
            Generado por Claude el{' '}
            {new Date(data.generatedAt).toLocaleString('es', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
