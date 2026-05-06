import type { AnomalyFlag } from '@/lib/audit/anomalies';
import { ANOMALY_LABEL } from '@/lib/audit/anomalies';
import {
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  Clock,
  Zap,
  Plus,
  Trash2,
} from 'lucide-react';

const SEVERITY_STYLE: Record<1 | 2 | 3, string> = {
  1: 'bg-blue-50 text-blue-700 border-blue-200',
  2: 'bg-amber-50 text-amber-700 border-amber-200',
  3: 'bg-red-50 text-red-700 border-red-300',
};

function iconFor(kind: AnomalyFlag['kind']) {
  switch (kind) {
    case 'high_volume':
      return <Zap className="h-3 w-3" />;
    case 'unusual_hour':
    case 'after_hours':
      return <Clock className="h-3 w-3" />;
    case 'new_resource_type':
      return <Plus className="h-3 w-3" />;
    case 'mass_delete':
      return <Trash2 className="h-3 w-3" />;
    case 'admin_action':
      return <ShieldAlert className="h-3 w-3" />;
    default:
      return <AlertCircle className="h-3 w-3" />;
  }
}

export function AnomalyBadges({ flags }: { flags: AnomalyFlag[] | undefined }) {
  if (!flags || flags.length === 0) return null;
  // Mostramos máximo 2 chips inline; el resto en el +N
  const visible = flags.slice(0, 2);
  const overflow = flags.length - visible.length;
  return (
    <div className="inline-flex items-center gap-1 flex-wrap">
      {visible.map((f, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium ${SEVERITY_STYLE[f.severity]}`}
          title={f.reason}
        >
          {iconFor(f.kind)}
          <span>{ANOMALY_LABEL[f.kind]}</span>
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className="text-[10px] text-sysde-mid"
          title={flags
            .slice(2)
            .map((f) => `${ANOMALY_LABEL[f.kind]}: ${f.reason}`)
            .join('\n')}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

export function AnomalySummary({
  flags,
}: {
  flags: AnomalyFlag[] | undefined;
}) {
  if (!flags || flags.length === 0) return null;
  // Variante para el detail drawer — muestra todos
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-sysde-mid mb-1 flex items-center gap-1">
        <AlertTriangle className="h-3 w-3 text-amber-500" /> Anomalías detectadas
      </div>
      {flags.map((f, i) => (
        <div
          key={i}
          className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border ${SEVERITY_STYLE[f.severity]} mr-1.5`}
        >
          {iconFor(f.kind)}
          <span className="font-semibold">{ANOMALY_LABEL[f.kind]}</span>
          <span className="opacity-75">— {f.reason}</span>
        </div>
      ))}
    </div>
  );
}
