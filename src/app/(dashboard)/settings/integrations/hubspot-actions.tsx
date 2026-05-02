'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plug, RefreshCw, Power, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function HubspotActions({
  connected,
  hasCredentials,
  integrationId,
}: {
  connected: boolean;
  hasCredentials: boolean;
  integrationId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSync() {
    if (!integrationId) return;
    setSyncing(true);
    setMsg('Sincronizando…');
    try {
      const res = await fetch('/api/integrations/hubspot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; stats?: unknown };
      if (json.ok) {
        const s = json.stats as Record<string, { created: number; updated: number; skipped: number }> | undefined;
        const tot = s
          ? Object.values(s).reduce((a, b) => a + b.created + b.updated, 0)
          : 0;
        setMsg(`Listo — ${tot} registros sincronizados.`);
      } else {
        setMsg(`Error: ${json.error ?? 'desconocido'}`);
      }
      router.refresh();
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }

  function handleDisconnect() {
    if (!confirm('¿Desconectar HubSpot? Los datos sincronizados se quedan en LeadCenter.')) return;
    start(async () => {
      await fetch('/api/integrations/hubspot/sync', { method: 'DELETE' });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!connected ? (
        <Button asChild disabled={!hasCredentials}>
          <a href="/api/integrations/hubspot/connect">
            <Plug className="mr-2 h-4 w-4" />
            Conectar HubSpot
          </a>
        </Button>
      ) : (
        <>
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sincronizar ahora
          </Button>
          <Button variant="outline" onClick={handleDisconnect} disabled={pending}>
            <Power className="mr-2 h-4 w-4" />
            Desconectar
          </Button>
        </>
      )}
      {msg && <span className="text-xs text-sysde-mid">{msg}</span>}
    </div>
  );
}
