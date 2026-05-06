'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';

type VerifyResult = {
  ok: boolean;
  totalChecked: number;
  firstBreak: {
    id: string;
    expectedHash: string;
    storedHash: string | null;
  } | null;
  days: number;
};

export function VerifyChainButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  async function verify() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/audit/verify?days=30', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setResult(json);
        // Auto-clear después de 10s si está OK
        if (json.ok) setTimeout(() => setResult(null), 10_000);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative inline-block">
      <Button variant="outline" size="sm" onClick={verify} disabled={loading}>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
        )}
        {loading ? 'Verificando…' : 'Verificar integridad'}
      </Button>
      {result ? (
        <div
          className={`absolute right-0 top-full mt-1 w-[300px] rounded-lg border shadow-lg z-20 p-3 text-xs ${
            result.ok
              ? 'bg-green-50 border-green-300 text-green-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}
        >
          {result.ok ? (
            <>
              <div className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="h-4 w-4" /> Integridad OK
              </div>
              <p className="mt-1">
                {result.totalChecked.toLocaleString('es')} eventos verificados en{' '}
                {result.days}d. Sin tampering.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="h-4 w-4" /> Cadena rota
              </div>
              <p className="mt-1">
                Quiebre en evento{' '}
                <code className="bg-red-100 px-1 rounded font-mono">
                  {result.firstBreak?.id}
                </code>{' '}
                tras {result.totalChecked.toLocaleString('es')} eventos válidos.
              </p>
              <p className="mt-1.5 text-[10px] opacity-75">
                Alguien editó/borró un row a mano en la base. Auditar urgente.
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
