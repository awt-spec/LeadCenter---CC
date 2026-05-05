import Link from 'next/link';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { HeatmapAccountRow, HeatmapWeek } from '@/lib/heatmap/queries';
import { intensityToColor, intensityNeedsLightText } from './heat-color';

export function HeatmapGrid({
  weeks,
  rows,
}: {
  weeks: HeatmapWeek[];
  rows: HeatmapAccountRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-sysde-border bg-white p-10 text-center text-sm text-sysde-mid">
        No hay actividad en el rango seleccionado. Probá ampliar la ventana o cambiar los filtros.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-sysde-border bg-white">
      <table className="min-w-full text-xs">
        <thead className="sticky top-0 bg-sysde-bg">
          <tr>
            <th className="sticky left-0 z-10 min-w-[260px] bg-sysde-bg px-3 py-2 text-left font-semibold uppercase tracking-wide text-sysde-mid">
              Cuenta
            </th>
            <th className="px-2 py-2 text-right font-semibold uppercase tracking-wide text-sysde-mid">
              Total
            </th>
            {weeks.map((w) => (
              <th key={w.start} className="px-1 py-2 text-center font-medium text-[10px] text-sysde-mid">
                {w.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.accountId} className="border-t border-sysde-border hover:bg-sysde-bg/50">
              <td className="sticky left-0 z-10 bg-white px-3 py-1.5">
                <Link
                  href={`/accounts/${r.accountId}`}
                  className="flex items-center gap-2 font-medium text-sysde-gray hover:text-sysde-red"
                >
                  <span className="truncate max-w-[200px]" title={r.accountName}>{r.accountName}</span>
                  {r.heating && (
                    <TrendingUp
                      className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                      aria-label="Calentando — actividad reciente sin historia previa"
                    />
                  )}
                  {r.cooling && (
                    <TrendingDown
                      className="h-3.5 w-3.5 shrink-0 text-red-600"
                      aria-label="Enfriándose — sin actividad en las últimas 3 semanas"
                    />
                  )}
                </Link>
                <div className="mt-0.5 text-[10px] text-sysde-mid">
                  {[r.country, r.segment, r.ownerName].filter(Boolean).join(' · ') || '—'}
                </div>
              </td>
              <td className="px-2 text-right font-semibold tabular-nums text-sysde-gray">
                {r.total}
              </td>
              {r.counts.map((c, i) => (
                <td
                  key={i}
                  className="border-l border-white p-0"
                  title={
                    `${weeks[i].label}: ${c} actividad${c === 1 ? '' : 'es'}\n` +
                    `Emails: ${r.breakdown.emails} · Reuniones: ${r.breakdown.meetings} · Llamadas: ${r.breakdown.calls} · Notas: ${r.breakdown.notes}`
                  }
                  style={{ backgroundColor: intensityToColor(c) }}
                >
                  <div
                    className={`flex h-7 w-9 items-center justify-center text-[10px] font-medium ${
                      intensityNeedsLightText(c) ? 'text-white' : c > 0 ? 'text-sysde-gray' : 'text-transparent'
                    }`}
                  >
                    {c > 0 ? c : ''}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
