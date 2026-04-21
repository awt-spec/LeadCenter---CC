import {
  DollarSign,
  TrendingUp,
  Briefcase,
  Target,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatMoney } from '@/lib/shared/labels';
import type { PipelineStats } from '@/lib/pipeline/forecast';
import { cn } from '@/lib/utils';

type Item = {
  label: string;
  value: string;
  icon: typeof DollarSign;
  color: string;
  delta: number | null;
  deltaLabel: string;
};

export function PipelineStatsBar({ stats }: { stats: PipelineStats }) {
  const items: Item[] = [
    {
      label: 'Pipeline total',
      value: formatMoney(stats.pipelineTotal),
      icon: DollarSign,
      color: '#C8200F',
      delta: stats.pipelineDelta,
      deltaLabel: 'vs 30d previos',
    },
    {
      label: 'Forecast ponderado',
      value: formatMoney(stats.forecast),
      icon: TrendingUp,
      color: '#10B981',
      delta: stats.forecastDelta,
      deltaLabel: 'vs 30d previos',
    },
    {
      label: 'Oportunidades abiertas',
      value: stats.openCount.toLocaleString('es-MX'),
      icon: Briefcase,
      color: '#3B82F6',
      delta: stats.openCountDelta,
      deltaLabel: 'vs 30d previos',
    },
    {
      label: 'Tasa de cierre · 90d',
      value: `${stats.winRate.toFixed(0)}%`,
      icon: Target,
      color: '#F59E0B',
      delta: stats.winRateDelta,
      deltaLabel: 'vs 90d previos',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="relative p-5">
            <div
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${it.color}26`, color: it.color }}
            >
              <it.icon className="h-4 w-4" />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-sysde-mid">
              {it.label}
            </div>
            <div className="mt-2 text-[28px] font-semibold leading-none text-sysde-gray">
              {it.value}
            </div>
            {it.delta !== null && Number.isFinite(it.delta) && (
              <div
                className={cn(
                  'mt-2 inline-flex items-center gap-1 text-[11px] font-medium',
                  it.delta >= 0 ? 'text-success' : 'text-danger'
                )}
              >
                {it.delta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(it.delta).toFixed(0)}%{' '}
                <span className="text-sysde-mid">{it.deltaLabel}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
