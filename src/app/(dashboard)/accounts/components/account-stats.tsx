import { Building2, TrendingUp, Users, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatMoney } from '@/lib/shared/labels';

type Stats = {
  total: number;
  prospects: number;
  customers: number;
  pipelineTotal: number;
};

export function AccountStats({ stats }: { stats: Stats }) {
  const items = [
    { label: 'Total cuentas', value: stats.total.toLocaleString('es-MX'), icon: Building2 },
    { label: 'Prospectos', value: stats.prospects.toLocaleString('es-MX'), icon: Users },
    { label: 'Clientes', value: stats.customers.toLocaleString('es-MX'), icon: TrendingUp },
    { label: 'Pipeline total', value: formatMoney(stats.pipelineTotal), icon: Wallet },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <div className="text-[28px] font-semibold leading-tight text-sysde-gray">
                {value}
              </div>
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
