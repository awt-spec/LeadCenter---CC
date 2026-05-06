'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Pause,
  Play,
  RefreshCw,
  Share2,
  Printer,
  Check,
} from 'lucide-react';

export function ExecToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [live, setLive] = useState(false);
  const [copied, setCopied] = useState(false);
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
      startTransition(() => router.refresh());
    }, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [live, router]);

  function copyShareLink() {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.search = sp?.toString() ?? '';
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    });
  }

  function printPage() {
    if (typeof window !== 'undefined') window.print();
  }

  return (
    <div className="flex items-center gap-2 flex-wrap print:hidden">
      <Button
        variant={live ? 'default' : 'outline'}
        size="sm"
        onClick={() => setLive((v) => !v)}
        className={live ? 'bg-sysde-red hover:bg-sysde-red-dk text-white' : ''}
      >
        {live ? (
          <>
            <Pause className="h-3.5 w-3.5 mr-1.5" /> Live · 30s
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
        Refrescar
      </Button>

      <Button variant="outline" size="sm" onClick={copyShareLink}>
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" /> Link copiado
          </>
        ) : (
          <>
            <Share2 className="h-3.5 w-3.5 mr-1.5" /> Compartir
          </>
        )}
      </Button>

      <Button variant="outline" size="sm" onClick={printPage}>
        <Printer className="h-3.5 w-3.5 mr-1.5" /> Imprimir
      </Button>

      {live ? (
        <span className="text-[11px] text-sysde-mid ml-1 inline-flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          en vivo
        </span>
      ) : null}
    </div>
  );
}
