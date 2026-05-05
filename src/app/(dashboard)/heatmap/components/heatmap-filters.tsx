'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

interface UserOpt { id: string; name: string; email: string; avatarUrl: string | null }

const SEGMENTS = ['BANK', 'FINANCE_COMPANY', 'MICROFINANCE', 'COOPERATIVE', 'PENSION_FUND', 'INSURANCE', 'FINTECH', 'RETAIL', 'CONSULTING', 'OTHER'] as const;
const SEGMENT_LABELS: Record<string, string> = {
  BANK: 'Banco', FINANCE_COMPANY: 'Financiera', MICROFINANCE: 'Microfinanciera',
  COOPERATIVE: 'Cooperativa', PENSION_FUND: 'Fondo de pensión', INSURANCE: 'Seguros',
  FINTECH: 'Fintech', RETAIL: 'Retail', CONSULTING: 'Consultora', OTHER: 'Otro',
};

const STATUSES = ['PROSPECT', 'ACTIVE', 'CUSTOMER', 'PARTNER', 'INACTIVE'] as const;
const STATUS_LABELS: Record<string, string> = {
  PROSPECT: 'Prospecto', ACTIVE: 'Activa', CUSTOMER: 'Cliente',
  PARTNER: 'Partner', INACTIVE: 'Inactiva',
};

export function HeatmapFiltersBar({
  countries,
  users,
  canSeeAll,
}: {
  countries: string[];
  users: UserOpt[];
  canSeeAll: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function update(key: string, value: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (value && value !== '__all__') sp.set(key, value);
    else sp.delete(key);
    start(() => router.push(`/heatmap?${sp.toString()}`));
  }

  const inputCls =
    'h-8 rounded-md border border-sysde-border bg-white px-2 text-xs text-sysde-gray focus:border-sysde-red focus:outline-none focus:ring-1 focus:ring-sysde-red';

  return (
    <div className={`flex flex-wrap items-end gap-2 ${pending ? 'opacity-60 pointer-events-none' : ''}`}>
      {canSeeAll && (
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-sysde-mid">Alcance</span>
          <select className={inputCls} value={params.get('scope') ?? 'all'} onChange={(e) => update('scope', e.target.value)}>
            <option value="all">Todas las cuentas</option>
            <option value="mine">Solo las mías</option>
          </select>
        </label>
      )}

      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wide text-sysde-mid">Owner</span>
        <select className={inputCls} value={params.get('owner') ?? '__all__'} onChange={(e) => update('owner', e.target.value)}>
          <option value="__all__">Todos</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wide text-sysde-mid">Segmento</span>
        <select className={inputCls} value={params.get('segment') ?? '__all__'} onChange={(e) => update('segment', e.target.value)}>
          <option value="__all__">Todos</option>
          {SEGMENTS.map((s) => <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wide text-sysde-mid">País</span>
        <select className={inputCls} value={params.get('country') ?? '__all__'} onChange={(e) => update('country', e.target.value)}>
          <option value="__all__">Todos</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wide text-sysde-mid">Status</span>
        <select className={inputCls} value={params.get('status') ?? '__all__'} onChange={(e) => update('status', e.target.value)}>
          <option value="__all__">Todos</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wide text-sysde-mid">Ventana</span>
        <select className={inputCls} value={params.get('weeks') ?? '12'} onChange={(e) => update('weeks', e.target.value)}>
          <option value="4">4 semanas</option>
          <option value="8">8 semanas</option>
          <option value="12">12 semanas</option>
          <option value="16">16 semanas</option>
          <option value="26">26 semanas</option>
        </select>
      </label>
    </div>
  );
}
