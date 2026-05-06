import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Calendar } from 'lucide-react';
import type { UserDrilldown } from '@/lib/audit/queries';
import { ACTION_LABEL, ACTION_VARIANT, RESOURCE_LABEL } from './labels';

function formatMin(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

export function UserActivityPanel({ drilldown }: { drilldown: UserDrilldown }) {
  const initials = drilldown.name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Card className="p-4 space-y-4">
      <header className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sysde-red text-white font-bold flex items-center justify-center text-sm">
            {initials || '·'}
          </div>
          <div>
            <div className="font-semibold text-sysde-gray">{drilldown.name}</div>
            <div className="text-xs text-sysde-mid">{drilldown.email}</div>
          </div>
        </div>
        <Link
          href="/audit"
          className="text-xs text-sysde-mid hover:text-sysde-red"
        >
          ✕
        </Link>
      </header>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-sysde-mid">Acciones</div>
          <div className="text-xl font-bold text-sysde-gray">
            {drilldown.totalActions30d.toLocaleString('es')}
          </div>
          <div className="text-[10px] text-sysde-mid">en 30d</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-sysde-mid flex items-center justify-center gap-1">
            <Calendar className="h-3 w-3" /> Días
          </div>
          <div className="text-xl font-bold text-sysde-gray">{drilldown.daysActive30d}</div>
          <div className="text-[10px] text-sysde-mid">activos en 30d</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-sysde-mid flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" /> Tiempo
          </div>
          <div className="text-xl font-bold text-sysde-gray">
            {formatMin(drilldown.estimatedActiveMinutes30d)}
          </div>
          <div className="text-[10px] text-sysde-mid">estimado*</div>
        </div>
      </div>

      <div className="border-t border-sysde-border pt-3">
        <div className="text-[11px] uppercase tracking-wider text-sysde-mid mb-2">
          Acciones por tipo
        </div>
        <div className="flex flex-wrap gap-1.5">
          {drilldown.byAction.length === 0 ? (
            <span className="text-xs text-sysde-mid italic">sin acciones</span>
          ) : (
            drilldown.byAction.map((a) => (
              <Badge key={a.action} variant={ACTION_VARIANT[a.action] ?? 'secondary'}>
                {ACTION_LABEL[a.action] ?? a.action} · {a.count.toLocaleString('es')}
              </Badge>
            ))
          )}
        </div>
      </div>

      <div className="border-t border-sysde-border pt-3">
        <div className="text-[11px] uppercase tracking-wider text-sysde-mid mb-2">
          Recursos tocados
        </div>
        <div className="flex flex-wrap gap-1.5">
          {drilldown.byResource.length === 0 ? (
            <span className="text-xs text-sysde-mid italic">—</span>
          ) : (
            drilldown.byResource.map((r) => (
              <Badge key={r.resource} variant="outline">
                {RESOURCE_LABEL[r.resource] ?? r.resource} · {r.count.toLocaleString('es')}
              </Badge>
            ))
          )}
        </div>
      </div>

      {drilldown.lastSeen ? (
        <div className="border-t border-sysde-border pt-3 text-xs text-sysde-mid">
          Última acción {formatDistanceToNow(drilldown.lastSeen, { addSuffix: true, locale: es })}
        </div>
      ) : null}

      <p className="text-[10px] text-sysde-mid italic leading-snug border-t border-sysde-border pt-3">
        * El tiempo activo se estima por día como (última acción − primera
        acción), capeado a 8h/día para evitar pestañas olvidadas. Es un
        proxy, no un contador exacto.
      </p>
    </Card>
  );
}
