'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plug, RefreshCw, Power, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StatusPayload {
  status: 'NONE' | 'DISCONNECTED' | 'CONNECTED' | 'SYNCING' | 'ERROR';
  lastSyncedAt: string | null;
  lastError: string | null;
  counts: { accounts: number; contacts: number; opportunities: number; emails: number };
  totals: { accounts: number; contacts: number; opportunities: number; emails: number };
  progress: { accounts: number | null; contacts: number | null; opportunities: number | null; emails: number | null };
  phase: 'companies' | 'deals' | 'contacts' | 'emails' | 'idle';
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

  // Always fetch the latest status once on mount so the progress bar is
  // present even when no tick is running.
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch('/api/integrations/hubspot/status', { cache: 'no-store' });
        const j = (await r.json()) as StatusPayload;
        if (!cancelled) setStatus(j);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [connected]);

  const effectiveStatus = status?.status ?? initialStatus;
  const isSyncing = effectiveStatus === 'SYNCING' || status?.lastRun?.status === 'running';
  const isWired = effectiveStatus === 'CONNECTED' || effectiveStatus === 'SYNCING' || effectiveStatus === 'ERROR';
  // Phase still in progress means cursors are persisted — even outside an active tick.
  const phaseActive = status && status.phase !== 'idle';

  // Poll while syncing OR a phase is mid-flight (between cron ticks).
  useEffect(() => {
    if (!isSyncing && !phaseActive) {
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
  }, [isSyncing, phaseActive, router]);

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
        counts: status?.counts ?? { accounts: 0, contacts: 0, opportunities: 0, emails: 0 },
        totals: status?.totals ?? { accounts: 0, contacts: 0, opportunities: 0, emails: 0 },
        progress: status?.progress ?? { accounts: null, contacts: null, opportunities: null, emails: null },
        phase: status?.phase ?? 'companies',
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

      {(isSyncing || phaseActive || status) && status && (
        <div className="rounded-lg border border-sysde-border bg-sysde-bg p-3 text-xs text-sysde-mid">
          <div className="flex items-center gap-2 font-medium text-sysde-gray">
            {isSyncing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Sincronización activa · {phaseLabel(status.phase)}
              </>
            ) : phaseActive ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Sync pausado · próximo tick automático en &lt; 5 min ({phaseLabel(status.phase)})
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Al día
              </>
            )}
          </div>
          <div className="mt-2 space-y-2">
            <ProgressBar label="Empresas" current={status.counts.accounts} total={status.totals.accounts} />
            <ProgressBar label="Deals" current={status.counts.opportunities} total={status.totals.opportunities} />
            <ProgressBar label="Contactos" current={status.counts.contacts} total={status.totals.contacts} />
            <ProgressBar label="Correos" current={status.counts.emails} total={status.totals.emails} />
          </div>
          {status.lastRun && status.lastRun.itemsCreated + status.lastRun.itemsUpdated > 0 && (
            <div className="mt-2 text-[11px]">
              Última corrida: +{status.lastRun.itemsCreated.toLocaleString('es-MX')} nuevos · ~{status.lastRun.itemsUpdated.toLocaleString('es-MX')} actualizados
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function phaseLabel(p: 'companies' | 'deals' | 'contacts' | 'emails' | 'idle'): string {
  switch (p) {
    case 'companies': return 'procesando empresas';
    case 'deals': return 'procesando deals';
    case 'contacts': return 'procesando contactos';
    case 'emails': return 'procesando correos';
    default: return 'completando';
  }
}

function ProgressBar({ label, current, total }: { label: string; current: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-[11px] text-sysde-gray">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">
          {current.toLocaleString('es-MX')}
          {total > 0 ? ` / ${total.toLocaleString('es-MX')} (${pct.toFixed(1)}%)` : ''}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-sysde-red transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
