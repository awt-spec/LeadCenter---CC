import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Mail, Phone, Users, FileText, ListChecks, Activity as ActivityIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import type { AuditUser } from '@/lib/sprint/queries';

export function AuditTable({ users }: { users: AuditUser[] }) {
  if (users.length === 0) {
    return (
      <div className="rounded-md border border-sysde-border bg-white p-8 text-center text-sm text-sysde-mid">
        Sin actividad en los últimos 14 días.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {users.map((u) => (
        <Card key={u.id} className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-sysde-border bg-sysde-bg/40 px-4 py-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs">{getInitials(u.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-sysde-gray">{u.name}</p>
              <p className="text-[11px] text-sysde-mid">{u.email}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-bold text-sysde-red tabular-nums">
                {u.totalThisWeek}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-sysde-mid">Esta semana</p>
            </div>
          </div>
          <div className="divide-y divide-sysde-border">
            {u.days.length === 0 ? (
              <div className="px-4 py-3 text-xs text-sysde-mid">Sin actividad registrada.</div>
            ) : (
              u.days.slice(0, 14).map((d) => (
                <div key={d.date} className="grid grid-cols-[120px_1fr_60px] items-center gap-3 px-4 py-2 text-xs">
                  <div className="font-medium text-sysde-gray">
                    {format(parseISO(d.date), "EEE d 'de' LLL", { locale: es })}
                  </div>
                  <div className="flex flex-wrap gap-3 text-[11px]">
                    {d.emails > 0 && <Stat icon={<Mail className="h-3 w-3" />} value={d.emails} label="emails" tone="text-blue-700" />}
                    {d.calls > 0 && <Stat icon={<Phone className="h-3 w-3" />} value={d.calls} label="calls" tone="text-amber-700" />}
                    {d.meetings > 0 && <Stat icon={<Users className="h-3 w-3" />} value={d.meetings} label="meetings" tone="text-emerald-700" />}
                    {d.notes > 0 && <Stat icon={<FileText className="h-3 w-3" />} value={d.notes} label="notas" tone="text-sysde-mid" />}
                    {d.tasks > 0 && <Stat icon={<ListChecks className="h-3 w-3" />} value={d.tasks} label="tasks" tone="text-violet-700" />}
                    {d.total === 0 && <span className="text-sysde-mid">—</span>}
                  </div>
                  <div className="text-right font-display text-sm font-bold tabular-nums text-sysde-gray">
                    {d.total}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function Stat({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${tone}`}>
      {icon}
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-sysde-mid">{label}</span>
    </span>
  );
}
