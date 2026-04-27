import { Briefcase, TrendingUp, Target, PieChart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatMoney } from '@/lib/shared/labels';

type Stats = {
  pipelineTotal: number;
  forecast: number;
  openCount: number;
  winRate: number;
};

export function OpportunityStats({ stats }: { stats: Stats }) {
  const items = [
    { label: 'Pipeline abierto', value: formatMoney(stats.pipelineTotal), icon: Briefcase },
    { label: 'Forecast ponderado', value: formatMoney(stats.forecast), icon: TrendingUp },
    { label: 'Oportunidades abiertas', value: stats.openCount.toLocaleString('es-MX'), icon: Target },
    { label: 'Tasa de cierre (90d)', value: `${stats.winRate.toFixed(0)}%`, icon: PieChart },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <div className="text-[28px] font-semibold leading-tight text-sysde-gray">{value}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-sysde-mid">{label}</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sysde-red-light text-sysde-red">
              <Icon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
