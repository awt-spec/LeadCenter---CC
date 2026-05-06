import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Session } from '@/lib/audit/queries';
import { RESOURCE_LABEL } from './labels';

function formatMin(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function SessionTimeline({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return (
      <div className="text-xs text-sysde-mid italic text-center py-4">
        Sin sesiones detectadas en este período.
      </div>
    );
  }

  return (
    <ol className="space-y-3 relative">
      {/* Línea vertical conectora */}
      <div className="absolute left-[5px] top-2 bottom-2 w-px bg-sysde-border" aria-hidden />

      {sessions.map((s, i) => {
        const sameDay =
          s.start.toDateString() === s.end.toDateString();
        return (
          <li key={i} className="relative pl-5">
            <div className="absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full bg-sysde-red border-2 border-white" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-sysde-mid font-mono">
                  {format(s.start, "EEE d MMM 'a' HH:mm", { locale: es })}
                  {' → '}
                  {sameDay
                    ? format(s.end, 'HH:mm', { locale: es })
                    : format(s.end, "EEE d HH:mm", { locale: es })}
                </div>
                <div className="text-xs text-sysde-gray mt-0.5">
                  <strong>{s.actionCount}</strong> acción{s.actionCount === 1 ? '' : 'es'}
                  {' · '}
                  {formatMin(s.durationMin)}
                </div>
                {s.resources.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {s.resources.slice(0, 5).map((r) => (
                      <span
                        key={r}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-sysde-bg border border-sysde-border text-sysde-mid"
                      >
                        {RESOURCE_LABEL[r] ?? r}
                      </span>
                    ))}
                    {s.resources.length > 5 ? (
                      <span className="text-[10px] text-sysde-mid">
                        +{s.resources.length - 5}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
