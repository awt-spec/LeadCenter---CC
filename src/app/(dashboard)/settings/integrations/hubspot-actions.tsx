'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plug, RefreshCw, Power, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StatusPayload {
  status: 'NONE' | 'DISCONNECTED' | 'CONNECTED' | 'SYNCING' | 'ERROR';
  lastSyncedAt: string | null;
  lastError: string | null;
  counts: { accounts: number; contacts: number; opportunities: number };
  lastRun: {
    id: string;
    status: 'running' | 'ok' | 'error';
    itemsCreated: number;
    itemsUpdated: number;
    itemsSkipped: number;
    startedAt: string;
    finishedAt: string | null;
    error: string | null;
  } | null;
}

export function HubspotActions({
  connected,
  hasCredentials,
  integrationId,
  initialStatus,
}: {
  connected: boolean;
  hasCredentials: boolean;
  integrationId: string | null;
  initialStatus: 'CONNECTED' | 'SYNCING' | 'ERROR' | 'DISCONNECTED' | 'NONE';
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const effectiveStatus = status?.status ?? initialStatus;
  const isSyncing = effectiveStatus === 'SYNCING' || status?.lastRun?.status === 'running';
  const isWired = effectiveStatus === 'CONNECTED' || effectiveStatus === 'SYNCING' || effectiveStatus === 'ERROR';

  // Poll while syncing so the user sees live counts.
  useEffect(() => {
    if (!isSyncing) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch('/api/integrations/hubspot/status', { cache: 'no-store' });
        const j = (await r.json()) as StatusPayload;
        if (!cancelled) setStatus(j);
        if (j.status !== 'SYNCING' && j.lastRun?.status !== 'running') {
          // sync ended → refresh server card so counts stay in sync
          router.refresh();
        }
      } catch {
        /* ignore polling errors */
      }
    };
    void tick();
    pollRef.current = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [isSyncing, router]);

  async function handleSync() {
    if (!integrationId) return;
    setErrMsg(null);
    try {
      const res = await fetch('/api/integrations/hubspot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; alreadyRunning?: boolean };
      if (!json.ok) {
        setErrMsg(json.error ?? 'Error desconocido');
        return;
      }
      // Optimistically flip status so the polling effect kicks in immediately.
      setStatus({
        status: 'SYNCING',
        lastSyncedAt: null,
        lastError: null,
        counts: status?.counts ?? { accounts: 0, contacts: 0, opportunities: 0 },
        lastRun: {
          id: 'optimistic',
          status: 'running',
          itemsCreated: 0,
          itemsUpdated: 0,
          itemsSkipped: 0,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          error: null,
        },
      });
    } catch (e) {
      setErrMsg((e as Error).message);
    }
  }

  function handleDisconnect() {
    if (!confirm('¿Desconectar HubSpot? Los datos ya sincronizados se quedan en LeadCenter.')) return;
    start(async () => {
      await fetch('/api/integrations/hubspot/sync', { method: 'DELETE' });
      router.refresh();
    });
  }

  // Use server-rendered `connected` plus our live `isWired`; the bug we hit
  // before was treating SYNCING as "not connected" → showed the Connect button
  // again every time the user navigated away and came back.
  const showConnect = !connected && !isWired;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {showConnect ? (
          <Button asChild disabled={!hasCredentials}>
            <a href="/api/integrations/hubspot/connect">
              <Plug className="mr-2 h-4 w-4" />
              Conectar HubSpot
            </a>
          </Button>
        ) : (
          <>
            <Button onClick={handleSync} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {isSyncing ? 'Sincronizando…' : 'Sincronizar ahora'}
            </Button>
            <Button variant="outline" onClick={handleDisconnect} disabled={pending || isSyncing}>
              <Power className="mr-2 h-4 w-4" />
              Desconectar
            </Button>
          </>
        )}
        {errMsg && <span className="text-xs text-red-600">{errMsg}</span>}
      </div>

      {isSyncing && status && (
        <div className="rounded-lg border border-sysde-border bg-sysde-bg p-3 text-xs text-sysde-mid">
          <div className="flex items-center gap-2 font-medium text-sysde-gray">
            <Loader2 className="h-3 w-3 animate-spin" />
            Sincronización activa · puede tardar varios minutos
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            <Stat label="Empresas" value={status.counts.accounts} />
            <Stat label="Contactos" value={status.counts.contacts} />
            <Stat label="Deals" value={status.counts.opportunities} />
          </div>
          {status.lastRun && status.lastRun.itemsCreated + status.lastRun.itemsUpdated > 0 && (
            <div className="mt-1.5 text-[11px]">
              Esta corrida: +{status.lastRun.itemsCreated} nuevos · ~{status.lastRun.itemsUpdated} actualizados
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-white p-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-sysde-mid">{label}</div>
      <div className="text-base font-semibold text-sysde-gray">{value.toLocaleString('es-MX')}</div>
    </div>
  );
}
