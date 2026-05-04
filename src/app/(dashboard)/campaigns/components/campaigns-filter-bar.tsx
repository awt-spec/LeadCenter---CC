'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = [
  { key: 'ALL', label: 'Todas', dot: 'bg-sysde-mid' },
  { key: 'DRAFT', label: 'Borrador', dot: 'bg-neutral-400' },
  { key: 'ACTIVE', label: 'Activas', dot: 'bg-emerald-500' },
  { key: 'PAUSED', label: 'Pausadas', dot: 'bg-amber-500' },
  { key: 'COMPLETED', label: 'Completadas', dot: 'bg-blue-500' },
  { key: 'ARCHIVED', label: 'Archivadas', dot: 'bg-neutral-300' },
] as const;

const TYPE_FILTERS = [
  { key: '', label: 'Todos los tipos' },
  { key: 'COLD_OUTBOUND', label: 'Cold outbound' },
  { key: 'EMAIL_DRIP', label: 'Email drip' },
  { key: 'WEBINAR', label: 'Webinar' },
  { key: 'EVENT', label: 'Evento' },
  { key: 'REFERRAL', label: 'Referido' },
  { key: 'CONTENT', label: 'Contenido' },
  { key: 'PARTNER', label: 'Partner' },
  { key: 'PAID_ADS', label: 'Paid ads' },
  { key: 'MIXED', label: 'Mixed' },
] as const;

export function CampaignsFilterBar({
  initialQ,
  initialStatus,
  initialType,
  totalShown,
}: {
  initialQ: string;
  initialStatus: string;
  initialType: string;
  totalShown: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(initialQ);

  useEffect(() => {
    setQ(initialQ);
  }, [initialQ]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      if (q === initialQ) return;
      pushParams({ q: q || null });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') params.delete(k);
      else params.set(k, v);
    }
    params.delete('page');
    startTransition(() => {
      router.push(`/campaigns?${params.toString()}`);
    });
  }

  const activeStatus = initialStatus || 'ALL';
  const activeType = initialType || '';
  const hasFilters = q || activeStatus !== 'ALL' || activeType;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-sysde-mid" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o código…"
            className="w-full rounded-md border border-sysde-border bg-white py-2 pl-9 pr-3 text-sm shadow-sm placeholder:text-sysde-mid focus:border-sysde-red focus:outline-none focus:ring-1 focus:ring-sysde-red"
          />
        </div>
        <select
          value={activeType}
          onChange={(e) => pushParams({ type: e.target.value || null })}
          className="rounded-md border border-sysde-border bg-white py-2 pl-3 pr-8 text-sm focus:border-sysde-red focus:outline-none"
        >
          {TYPE_FILTERS.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              pushParams({ q: null, status: null, type: null });
            }}
            className="inline-flex items-center gap-1 rounded-md border border-sysde-border bg-white px-2 py-1.5 text-xs text-sysde-mid transition-colors hover:text-sysde-gray"
          >
            <X className="h-3 w-3" />
            Limpiar
          </button>
        )}
        <span className="ml-auto text-xs text-sysde-mid">
          {totalShown.toLocaleString('es-CR')} resultado{totalShown !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((s) => {
          const sel = activeStatus === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => pushParams({ status: s.key === 'ALL' ? null : s.key })}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                sel
                  ? 'border-sysde-red bg-sysde-red text-white shadow-sm'
                  : 'border-sysde-border bg-white text-sysde-gray hover:border-sysde-red/40'
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', sel ? 'bg-white' : s.dot)} />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
