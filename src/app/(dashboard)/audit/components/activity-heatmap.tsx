import type { HeatmapCell, HourBucket } from '@/lib/audit/queries';

const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function ActivityHeatmap({ data }: { data: HeatmapCell[] }) {
  // 7 (días) × 24 (horas) grid. Densidad relativa al máximo.
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let max = 0;
  for (const c of data) {
    if (c.dow >= 0 && c.dow < 7 && c.hour >= 0 && c.hour < 24) {
      grid[c.dow][c.hour] = c.count;
      if (c.count > max) max = c.count;
    }
  }

  // 5 niveles de intensidad (rojo SYSDE)
  const colorFor = (n: number): string => {
    if (n === 0) return 'bg-sysde-bg';
    if (max === 0) return 'bg-sysde-bg';
    const ratio = n / max;
    if (ratio < 0.15) return 'bg-red-100';
    if (ratio < 0.35) return 'bg-red-200';
    if (ratio < 0.6) return 'bg-red-400';
    if (ratio < 0.85) return 'bg-sysde-red';
    return 'bg-sysde-red-dk';
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Header con horas */}
          <div className="grid grid-cols-[40px_repeat(24,minmax(20px,1fr))] gap-[2px] mb-1">
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="text-[9px] text-center text-sysde-mid font-mono"
              >
                {h % 3 === 0 ? h.toString().padStart(2, '0') : ''}
              </div>
            ))}
          </div>
          {/* Filas por día */}
          {grid.map((row, dow) => (
            <div
              key={dow}
              className="grid grid-cols-[40px_repeat(24,minmax(20px,1fr))] gap-[2px] mb-[2px]"
            >
              <div className="text-[10px] text-sysde-mid font-mono pr-2 text-right pt-0.5">
                {DOW_LABELS[dow]}
              </div>
              {row.map((count, hour) => (
                <div
                  key={hour}
                  className={`aspect-square rounded-sm ${colorFor(count)} cursor-default`}
                  title={`${DOW_LABELS[dow]} ${hour.toString().padStart(2, '0')}:00 — ${count} acción${count === 1 ? '' : 'es'}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center justify-end gap-1 text-[10px] text-sysde-mid">
        <span>menos</span>
        <div className="w-3 h-3 rounded-sm bg-sysde-bg border border-sysde-border" />
        <div className="w-3 h-3 rounded-sm bg-red-100" />
        <div className="w-3 h-3 rounded-sm bg-red-200" />
        <div className="w-3 h-3 rounded-sm bg-red-400" />
        <div className="w-3 h-3 rounded-sm bg-sysde-red" />
        <div className="w-3 h-3 rounded-sm bg-sysde-red-dk" />
        <span>más</span>
        <span className="ml-2">(max: {max})</span>
      </div>
    </div>
  );
}

export function HourDistribution({ data }: { data: HourBucket[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[repeat(24,1fr)] gap-[2px] items-end h-[100px]">
        {data.map((b) => {
          const ratio = b.count / max;
          const heightPct = Math.max(2, ratio * 100);
          return (
            <div
              key={b.hour}
              className="flex flex-col justify-end items-stretch h-full group relative"
            >
              <div
                className="bg-sysde-red rounded-sm transition-all group-hover:bg-sysde-red-dk"
                style={{ height: `${heightPct}%` }}
                title={`${b.hour.toString().padStart(2, '0')}:00 — ${b.count} acción${b.count === 1 ? '' : 'es'}`}
              />
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-[repeat(24,1fr)] gap-[2px] text-[9px] text-sysde-mid text-center font-mono">
        {data.map((b) => (
          <div key={b.hour}>{b.hour % 4 === 0 ? b.hour.toString().padStart(2, '0') : ''}</div>
        ))}
      </div>
    </div>
  );
}
