import { Card } from '@/components/ui/card';
import { Crown } from 'lucide-react';
import type { Performer } from '@/lib/reports/exec-queries';

function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

export function TopPerformers({ performers }: { performers: Performer[] }) {
  return (
    <Card className="p-5">
      <header className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-sysde-gray flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-500" />
          Top performers
        </h3>
        <span className="text-[10px] text-sysde-mid">
          ranking por valor cerrado
        </span>
      </header>

      {performers.length === 0 ? (
        <div className="text-sm text-sysde-mid text-center py-6">
          Sin actividad comercial en este período.
        </div>
      ) : (
        <ol className="space-y-2">
          {performers.map((p, i) => {
            const initials = p.name
              .split(' ')
              .map((w) => w[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase();
            const medal =
              i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            return (
              <li key={p.userId} className="flex items-center gap-3 py-2">
                <span className="text-base shrink-0 w-7 text-center">{medal}</span>
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-sysde-red text-white font-bold text-xs shrink-0">
                  {initials || '·'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-sysde-gray truncate">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-sysde-mid">
                    {p.wonCount} ganado{p.wonCount === 1 ? '' : 's'} ·{' '}
                    {p.activities} actividades · {fmtUSD(p.pipelineValue)}{' '}
                    pipeline
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-bold text-sysde-red">
                    {fmtUSD(p.wonValue)}
                  </div>
                  <div className="text-[10px] text-sysde-mid">cerrado</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
