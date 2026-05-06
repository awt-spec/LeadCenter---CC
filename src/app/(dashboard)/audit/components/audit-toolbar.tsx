'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Download, Pause, Play, RefreshCw } from 'lucide-react';
import { SavedViews } from './saved-views';

export function AuditToolbar() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [live, setLive] = useState(false);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!live) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setTick((t) => t + 1);
      startTransition(() => router.refresh());
    }, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [live, router]);

  const exportHref = (() => {
    const params = new URLSearchParams(sp?.toString());
    return `/api/audit/export?${params.toString()}`;
  })();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <SavedViews />
      <Button
        variant={live ? 'default' : 'outline'}
        size="sm"
        onClick={() => setLive((v) => !v)}
        className={live ? 'bg-sysde-red hover:bg-sysde-red-dk text-white' : ''}
      >
        {live ? (
          <>
            <Pause className="h-3.5 w-3.5 mr-1.5" /> Live · refresca cada 10s
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5 mr-1.5" /> Live
          </>
        )}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => startTransition(() => router.refresh())}
        disabled={pending}
      >
        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${pending ? 'animate-spin' : ''}`} />
        {pending ? 'Refrescando…' : 'Refrescar'}
      </Button>

      <a
        href={exportHref}
        className="inline-flex h-9 items-center gap-1.5 px-3 rounded-md border border-sysde-border bg-white text-sm hover:border-sysde-red hover:text-sysde-red transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
        Export CSV
      </a>

      {live ? (
        <span className="text-[11px] text-sysde-mid ml-1">
          {tick > 0 ? `actualizado hace pocos seg.` : 'esperando primer tick…'}
        </span>
      ) : null}
    </div>
  );
}
