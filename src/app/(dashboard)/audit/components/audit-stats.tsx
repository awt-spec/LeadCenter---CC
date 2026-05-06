import { Card } from '@/components/ui/card';
import { Activity, Users, Zap, Database } from 'lucide-react';
import type { AuditStats } from '@/lib/audit/queries';
import { ACTION_LABEL, RESOURCE_LABEL } from './labels';

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export function AuditStatsBar({ stats }: { stats: AuditStats }) {
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<Activity className="h-4 w-4" />}
        label="Acciones (24h)"
        value={fmt(stats.total24h)}
        sub={`${fmt(stats.total7d)} en 7d · ${fmt(stats.total30d)} en 30d`}
      />
      <StatCard
        icon={<Users className="h-4 w-4" />}
        label="Usuarios activos (30d)"
        value={fmt(stats.uniqueUsers30d)}
        sub="con al menos una acción"
      />
      <StatCard
        icon={<Zap className="h-4 w-4" />}
        label="Acción más frecuente"
        value={stats.topAction ? ACTION_LABEL[stats.topAction.action] ?? stats.topAction.action : '—'}
        sub={stats.topAction ? `${fmt(stats.topAction.count)} en 30d` : 'sin datos'}
      />
      <StatCard
        icon={<Database className="h-4 w-4" />}
        label="Recurso más tocado"
        value={
          stats.topResource
            ? RESOURCE_LABEL[stats.topResource.resource] ?? stats.topResource.resource
            : '—'
        }
        sub={stats.topResource ? `${fmt(stats.topResource.count)} en 30d` : 'sin datos'}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-sysde-mid">
        <span className="text-sysde-red">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-sysde-gray">{value}</div>
      <div className="mt-0.5 text-xs text-sysde-mid">{sub}</div>
    </Card>
  );
}
