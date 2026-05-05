import { Flame } from 'lucide-react';

export function HeatmapHeader({
  totalAccounts,
  totalActivities,
  weeksCount,
}: {
  totalAccounts: number;
  totalActivities: number;
  weeksCount: number;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold uppercase tracking-tight text-sysde-gray">
          <Flame className="h-6 w-6 text-sysde-red" />
          Mapa de calor
        </h1>
        <p className="mt-1 text-sm text-sysde-mid">
          Engagement por cuenta en las últimas {weeksCount} semanas. Detectá cuentas que se enfrían
          (riesgo) o que se calientan (oportunidad).
        </p>
      </div>
      <div className="flex gap-6 text-sm">
        <div>
          <div className="text-2xl font-semibold text-sysde-gray">{totalAccounts.toLocaleString('es-MX')}</div>
          <div className="text-xs uppercase tracking-wide text-sysde-mid">Cuentas activas</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-sysde-red">{totalActivities.toLocaleString('es-MX')}</div>
          <div className="text-xs uppercase tracking-wide text-sysde-mid">Actividades</div>
        </div>
      </div>
    </div>
  );
}
