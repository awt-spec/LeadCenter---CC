import { Card } from '@/components/ui/card';
import type { StageDistribution } from '@/lib/reports/exec-queries';

const STAGE_LABEL: Record<string, string> = {
  LEAD: 'Lead',
  DISCOVERY: 'Discovery',
  SIZING: 'Sizing',
  DEMO: 'Demo',
  PROPOSAL: 'Propuesta',
  NEGOTIATION: 'Negociación',
  CLOSING: 'Cierre',
  HANDOFF: 'Handoff',
};

function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

export function FunnelViz({ stages }: { stages: StageDistribution[] }) {
  const maxValue = Math.max(1, ...stages.map((s) => s.value));
  const totalCount = stages.reduce((acc, s) => acc + s.count, 0);
  const totalValue = stages.reduce((acc, s) => acc + s.value, 0);

  return (
    <Card className="p-5">
      <header className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-sysde-gray">
          Funnel del pipeline
        </h3>
        <span className="text-[11px] text-sysde-mid">
          {totalCount} opps · {fmtUSD(totalValue)}
        </span>
      </header>

      <div className="space-y-1.5">
        {stages.map((s) => {
          const widthPct = Math.max(8, (s.value / maxValue) * 100);
          const intensity = Math.max(0.4, s.value / maxValue);
          return (
            <div key={s.stage} className="flex items-center gap-2 text-xs">
              <div className="w-24 text-right text-sysde-mid font-medium shrink-0">
                {STAGE_LABEL[s.stage] ?? s.stage}
              </div>
              <div className="flex-1 relative h-7 bg-sysde-bg rounded">
                <div
                  className="absolute inset-y-0 left-0 rounded transition-all flex items-center px-2 text-white text-[11px] font-semibold"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: `rgba(200, 32, 15, ${intensity})`,
                  }}
                >
                  {s.count > 0 ? `${s.count}` : ''}
                </div>
              </div>
              <div className="w-20 text-right text-sysde-gray font-mono shrink-0">
                {s.value > 0 ? fmtUSD(s.value) : '—'}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
