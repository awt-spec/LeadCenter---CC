'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LayoutGrid, ListChecks, BarChart3 } from 'lucide-react';

const VIEWS = [
  { value: 'summary',  label: 'Resumen',   icon: LayoutGrid },
  { value: 'aging',    label: 'Mi gestión', icon: ListChecks },
  { value: 'charts',   label: 'Gráficos',  icon: BarChart3 },
] as const;

export function DashboardTabs({ active }: { active: string }) {
  const pathname = usePathname();
  const params = useSearchParams();

  function hrefFor(value: string): string {
    const sp = new URLSearchParams(params.toString());
    if (value === 'summary') sp.delete('view');
    else sp.set('view', value);
    const q = sp.toString();
    return q ? `${pathname}?${q}` : pathname;
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-sysde-border bg-white p-1">
      {VIEWS.map((v) => {
        const isActive = active === v.value;
        const Icon = v.icon;
        return (
          <Link
            key={v.value}
            href={hrefFor(v.value)}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition ${
              isActive
                ? 'bg-sysde-red text-white shadow-sm'
                : 'text-sysde-mid hover:bg-sysde-bg hover:text-sysde-gray'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {v.label}
          </Link>
        );
      })}
    </div>
  );
}
