import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { OnlineUser } from '@/lib/audit/queries';

export function OnlineNowCard({
  users,
  windowMin = 5,
}: {
  users: OnlineUser[];
  windowMin?: number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-sysde-gray flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full rounded-full ${
                users.length > 0 ? 'animate-ping bg-green-400 opacity-75' : 'bg-sysde-mid'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                users.length > 0 ? 'bg-green-500' : 'bg-sysde-mid'
              }`}
            />
          </span>
          Online ahora
        </h3>
        <span className="text-[10px] text-sysde-mid">
          últimos {windowMin}m
        </span>
      </div>
      {users.length === 0 ? (
        <div className="text-xs text-sysde-mid text-center py-6">
          Nadie con actividad reciente.
        </div>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => {
            const initials = u.name
              .split(' ')
              .map((w) => w[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase();
            return (
              <li key={u.userId}>
                <Link
                  href={`/audit?userId=${u.userId}`}
                  className="flex items-center gap-2 hover:bg-sysde-bg rounded px-1.5 py-1 -mx-1.5 transition-colors"
                >
                  <span className="relative inline-flex">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-sysde-red text-white text-[10px] font-bold">
                      {initials || '·'}
                    </span>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{u.name}</div>
                    <div className="text-[10px] text-sysde-mid">
                      {u.recentActions} acción{u.recentActions === 1 ? '' : 'es'} ·{' '}
                      {formatDistanceToNow(u.lastAction, {
                        addSuffix: true,
                        locale: es,
                      })}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
