import { Card } from '@/components/ui/card';
import { Activity, Users, Zap, Database, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { AuditStats, StatsWithDeltas } from '@/lib/audit/queries';
import { ACTION_LABEL, RESOURCE_LABEL } from './labels';

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function DeltaPill({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-sysde-mid">
        <Minus className="h-3 w-3" /> sin base
      </span>
    );
  }
  const sign = pct > 0 ? '+' : '';
  // Heurística: >0% subió (rojo si ↑ es malo? no, en auditoría más actividad es neutral/positiva)
  const color =
    Math.abs(pct) < 5
      ? 'text-sysde-mid bg-sysde-bg'
      : pct > 0
        ? 'text-green-700 bg-green-50'
        : 'text-amber-700 bg-amber-50';
  const Icon = Math.abs(pct) < 5 ? Minus : pct > 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold rounded px-1.5 py-0.5 ${color}`}
      title="vs período anterior"
    >
      <Icon className="h-3 w-3" />
      {sign}
      {pct.toFixed(0)}%
    </span>
  );
}

export function AuditStatsBar({ stats }: { stats: AuditStats | StatsWithDeltas }) {
  const withDeltas = 'delta24h' in stats ? (stats as StatsWithDeltas) : null;

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<Activity className="h-4 w-4" />}
        label="Acciones (24h)"
        value={fmt(stats.total24h)}
        sub={`${fmt(stats.total7d)} en 7d · ${fmt(stats.total30d)} en 30d`}
        delta={withDeltas?.delta24h ?? null}
      />
      <StatCard
        icon={<Users className="h-4 w-4" />}
        label="Usuarios activos (30d)"
        value={fmt(stats.uniqueUsers30d)}
        sub="con al menos una acción"
        delta={withDeltas?.delta30d ?? null}
        deltaLabel="vs mes anterior"
      />
      <StatCard
        icon={<Zap className="h-4 w-4" />}
        label="Acción más frecuente"
        value={
          stats.topAction ? ACTION_LABEL[stats.topAction.action] ?? stats.topAction.action : '—'
        }
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
  delta,
  deltaLabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  delta?: number | null;
  deltaLabel?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-sysde-mid">
          <span className="text-sysde-red">{icon}</span>
          {label}
        </div>
        {delta !== undefined ? <DeltaPill pct={delta} /> : null}
      </div>
      <div className="mt-2 text-2xl font-bold text-sysde-gray">{value}</div>
      <div className="mt-0.5 text-xs text-sysde-mid">
        {sub}
        {deltaLabel && delta !== undefined && delta !== null ? (
          <span className="ml-1 italic">· {deltaLabel}</span>
        ) : null}
      </div>
    </Card>
  );
}
