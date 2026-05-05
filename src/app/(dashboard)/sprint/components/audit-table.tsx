import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Mail, Phone, Users, FileText, ListChecks, Building2, Clock,
  TrendingUp, Sparkles, ArrowUpRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import type { AuditUser } from '@/lib/sprint/queries';

function fmtMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function AuditTable({ users }: { users: AuditUser[] }) {
  if (users.length === 0) {
    return (
      <div className="rounded-md border border-sysde-border bg-white p-8 text-center text-sm text-sysde-mid">
        Sin actividad registrada en los últimos 14 días.
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {users.map((u) => (
        <UserAuditCard key={u.id} u={u} />
      ))}
    </div>
  );
}

function UserAuditCard({ u }: { u: AuditUser }) {
  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-sysde-border bg-gradient-to-r from-sysde-bg/60 to-white px-5 py-4">
        <Avatar className="h-10 w-10 ring-2 ring-white">
          <AvatarFallback className="bg-sysde-red text-white text-xs font-semibold">{getInitials(u.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sysde-gray">{u.name}</p>
          <p className="text-[11px] text-sysde-mid">{u.email}</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px bg-sysde-border md:grid-cols-5">
        <Stat
          label="Esta semana"
          value={u.totalThisWeek.toLocaleString('es-MX')}
          sub="actividades"
          accent="red"
          icon={<Sparkles className="h-3.5 w-3.5" />}
        />
        <Stat
          label="Tiempo trabajado"
          value={fmtMinutes(u.estimatedMinutesThisWeek)}
          sub={`14d: ${fmtMinutes(u.estimatedMinutesTotal)}`}
          icon={<Clock className="h-3.5 w-3.5" />}
        />
        <Stat
          label="Cuentas tocadas"
          value={u.uniqueAccountsTouched.toLocaleString('es-MX')}
          sub="distintas, 14d"
          icon={<Building2 className="h-3.5 w-3.5" />}
        />
        <Stat
          label="Tareas cerradas"
          value={u.tasksCompleted.toLocaleString('es-MX')}
          sub="14d"
          icon={<ListChecks className="h-3.5 w-3.5" />}
        />
        <Stat
          label="Total ventana"
          value={u.total.toLocaleString('es-MX')}
          sub="14d"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Breakdown by type */}
      <div className="border-b border-sysde-border bg-sysde-bg/30 px-5 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sysde-mid">
          Mix de actividad (14 días)
        </p>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Pill icon={<Mail className="h-3 w-3" />} label="Emails enviados" value={u.breakdown.emailsSent} tone="text-blue-700 bg-blue-50" />
          <Pill icon={<Mail className="h-3 w-3" />} label="Emails recibidos" value={u.breakdown.emailsReceived} tone="text-blue-700 bg-blue-50" />
          <Pill icon={<Phone className="h-3 w-3" />} label="Llamadas" value={u.breakdown.calls} tone="text-amber-700 bg-amber-50" />
          <Pill icon={<Users className="h-3 w-3" />} label="Reuniones" value={u.breakdown.meetings} tone="text-emerald-700 bg-emerald-50" />
          <Pill icon={<Users className="h-3 w-3" />} label="Demos" value={u.breakdown.demos} tone="text-emerald-700 bg-emerald-50" />
          <Pill icon={<FileText className="h-3 w-3" />} label="Propuestas" value={u.breakdown.proposals} tone="text-violet-700 bg-violet-50" />
          <Pill icon={<FileText className="h-3 w-3" />} label="Notas" value={u.breakdown.notes} tone="text-sysde-mid bg-neutral-100" />
          <Pill icon={<TrendingUp className="h-3 w-3" />} label="Cambios stage" value={u.breakdown.stageChanges} tone="text-sysde-red bg-sysde-red/10" />
        </div>
      </div>

      {/* Body: top accounts + daily timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr]">
        {/* Top accounts */}
        <div className="border-b border-sysde-border bg-white p-4 lg:border-b-0 lg:border-r">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sysde-mid">
            Cuentas más gestionadas
          </p>
          {u.topAccounts.length === 0 ? (
            <p className="text-xs text-sysde-mid">Sin cuentas en esta ventana.</p>
          ) : (
            <div className="space-y-1">
              {u.topAccounts.map((a) => (
                <Link
                  key={a.accountId}
                  href={`/accounts/${a.accountId}`}
                  className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition hover:bg-sysde-bg/60"
                >
                  <Building2 className="h-3 w-3 shrink-0 text-sysde-red" />
                  <span className="flex-1 min-w-0 truncate font-medium text-sysde-gray group-hover:text-sysde-red">
                    {a.accountName}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-sysde-mid">
                    {a.count} acts
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-sysde-mid opacity-0 group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Daily timeline */}
        <div className="bg-white p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sysde-mid">
            Por día (últimos 14)
          </p>
          {u.days.length === 0 ? (
            <p className="text-xs text-sysde-mid">Sin actividad por día.</p>
          ) : (
            <div className="divide-y divide-sysde-border">
              {u.days.slice(0, 14).map((d) => (
                <div key={d.date} className="grid grid-cols-[100px_1fr_60px_60px] items-center gap-3 py-1.5 text-xs">
                  <div className="font-medium text-sysde-gray">
                    {format(parseISO(d.date), "EEE d 'de' LLL", { locale: es })}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {d.emails > 0 && <DayMetric icon={<Mail className="h-3 w-3" />} value={d.emails} tone="text-blue-700" />}
                    {d.calls > 0 && <DayMetric icon={<Phone className="h-3 w-3" />} value={d.calls} tone="text-amber-700" />}
                    {d.meetings > 0 && <DayMetric icon={<Users className="h-3 w-3" />} value={d.meetings} tone="text-emerald-700" />}
                    {d.notes > 0 && <DayMetric icon={<FileText className="h-3 w-3" />} value={d.notes} tone="text-sysde-mid" />}
                    {d.tasks > 0 && <DayMetric icon={<ListChecks className="h-3 w-3" />} value={d.tasks} tone="text-violet-700" />}
                    {d.total === 0 && <span className="text-sysde-mid">—</span>}
                  </div>
                  <div className="text-right text-[11px] tabular-nums text-sysde-mid">
                    {d.estimatedMinutes > 0 ? fmtMinutes(d.estimatedMinutes) : '—'}
                  </div>
                  <div className="text-right font-display text-sm font-bold tabular-nums text-sysde-gray">
                    {d.total}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function Stat({
  label, value, sub, accent, icon,
}: {
  label: string; value: string; sub?: string; accent?: 'red'; icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-sysde-mid">
        {icon}
        {label}
      </div>
      <p className={`mt-1 font-display text-xl font-bold tabular-nums leading-none ${accent === 'red' ? 'text-sysde-red' : 'text-sysde-gray'}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-[10px] text-sysde-mid">{sub}</p>}
    </div>
  );
}

function Pill({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  if (value === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${tone}`}>
      {icon}
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="opacity-75">{label}</span>
    </span>
  );
}

function DayMetric({ icon, value, tone }: { icon: React.ReactNode; value: number; tone: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${tone}`}>
      {icon}
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}
