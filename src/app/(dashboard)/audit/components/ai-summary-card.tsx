'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';

type Result = {
  summary: string;
  highlights: string[];
  risks: string[];
  generatedAt: string;
};

export function AISummaryCard() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/audit/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Error generando resumen');
        return;
      }
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-4">
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-sysde-gray flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-sysde-red" />
          Resumen ejecutivo IA
        </h3>
        {data ? (
          <span className="text-[10px] text-sysde-mid">
            Generado{' '}
            {new Date(data.generatedAt).toLocaleTimeString('es', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        ) : null}
      </header>

      {!data && !loading ? (
        <div className="text-center py-8">
          <p className="text-sm text-sysde-mid mb-3">
            Generá un resumen automático de qué pasó este período. Claude analiza los stats,
            top usuarios, recursos y anomalías detectadas.
          </p>
          <Button
            onClick={generate}
            className="bg-sysde-red hover:bg-sysde-red-dk text-white"
            size="sm"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Generar resumen
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-sysde-mid">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Analizando los últimos 30 días…</span>
        </div>
      ) : null}

      {error ? (
        <div className="text-sm text-red-600 bg-red-50 rounded p-3 border border-red-200">
          {error}
        </div>
      ) : null}

      {data && !loading ? (
        <div className="space-y-4">
          <p className="text-sm text-sysde-gray leading-relaxed whitespace-pre-line">
            {data.summary}
          </p>

          {data.highlights.length > 0 ? (
            <div>
              <h4 className="text-[11px] uppercase tracking-wider text-sysde-mid mb-2 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Highlights
              </h4>
              <ul className="space-y-1.5">
                {data.highlights.map((h, i) => (
                  <li
                    key={i}
                    className="text-xs text-sysde-gray pl-4 relative before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-sysde-red"
                  >
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.risks.length > 0 ? (
            <div>
              <h4 className="text-[11px] uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Riesgos a revisar
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
          ) : (
            <div className="text-[11px] text-sysde-mid italic">
              Sin riesgos destacables en este período.
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-sysde-border">
            <Button onClick={generate} variant="outline" size="sm" disabled={loading}>
              <Sparkles className="h-3 w-3 mr-1" /> Regenerar
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
