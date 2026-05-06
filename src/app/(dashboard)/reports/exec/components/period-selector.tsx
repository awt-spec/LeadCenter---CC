'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import type { ExecPeriod } from '@/lib/reports/exec-queries';

const OPTIONS: Array<{ key: ExecPeriod; label: string }> = [
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'quarter', label: 'Trimestre' },
  { key: 'year', label: 'Año' },
];

export function PeriodSelector({ current }: { current: ExecPeriod }) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function set(period: ExecPeriod) {
    const next = new URLSearchParams(sp?.toString());
    next.set('period', period);
    startTransition(() =>
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    );
  }

  return (
    <div className="inline-flex rounded-lg border border-sysde-border bg-white overflow-hidden">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => set(opt.key)}
          disabled={pending}
          className={`px-3.5 py-1.5 text-xs font-medium transition-colors ${
            current === opt.key
              ? 'bg-sysde-red text-white'
              : 'text-sysde-gray hover:bg-sysde-bg'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
