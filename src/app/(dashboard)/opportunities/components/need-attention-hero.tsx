import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Reply, Flame, HelpCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { STAGE_LABELS } from '@/lib/shared/labels';
import type { NeedAttentionOpp } from '@/lib/opportunities/management-queries';

function fmtUSD(n: number | null, currency = 'USD'): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(0)}k`;
  return `${currency} ${n.toFixed(0)}`;
}

function reasonMeta(reason: NeedAttentionOpp['reason']) {
  switch (reason) {
    case 'needs_response':
      return {
        Icon: Reply,
        label: 'Responder',
        accentClass: 'border-l-blue-500',
        iconBg: 'bg-blue-100 text-blue-700',
        chipClass: 'bg-blue-100 text-blue-700 border-blue-200',
      };
    case 'red':
      return {
        Icon: Flame,
        label: '72h+',
        accentClass: 'border-l-red-500',
        iconBg: 'bg-red-100 text-red-700',
        chipClass: 'bg-red-100 text-red-700 border-red-200',
      };
    case 'never':
    default:
      return {
        Icon: HelpCircle,
        label: 'Sin gestión',
        accentClass: 'border-l-red-500',
        iconBg: 'bg-red-100 text-red-700',
        chipClass: 'bg-red-100 text-red-700 border-red-200',
      };
  }
}

export function NeedAttentionHero({
  opps,
  totalNeedsResponse,
  totalRed,
}: {
  opps: NeedAttentionOpp[];
  totalNeedsResponse: number;
  totalRed: number;
}) {
  // Empty state — todo bajo control
  if (opps.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-green-50 to-white border-green-200 p-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-sysde-gray">
              Todo bajo control
            </h2>
            <p className="mt-0.5 text-sm text-sysde-mid">
              No hay oportunidades que requieran atención inmediata. Buen ritmo.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-5 py-3 border-b border-sysde-border bg-gradient-to-r from-red-50/40 to-white">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700">
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-sysde-gray">
              Atención requerida
            </h2>
            <p className="text-[11px] text-sysde-mid">
              {totalNeedsResponse > 0
                ? `${totalNeedsResponse} opp${totalNeedsResponse === 1 ? '' : 's'} esperan tu respuesta`
                : null}
              {totalNeedsResponse > 0 && totalRed > 0 ? ' · ' : ''}
              {totalRed > 0
                ? `${totalRed} opp${totalRed === 1 ? '' : 's'} en rojo`
                : null}
            </p>
          </div>
        </div>
        {opps.length >= 6 ? (
          <Link
            href="/opportunities?needsResponse=true"
            className="text-xs text-sysde-red hover:underline inline-flex items-center gap-1"
          >
            Ver todas <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}
      </header>

      <ul className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {opps.map((o) => {
          const meta = reasonMeta(o.reason);
          const stageLabel = STAGE_LABELS[o.stage as keyof typeof STAGE_LABELS] ?? o.stage;
          const lastWhen = o.lastActivityAt
            ? formatDistanceToNow(o.lastActivityAt, { addSuffix: true, locale: es })
            : 'sin gestión registrada';
          const ownerInitial = o.owner?.name
            ? o.owner.name
                .split(' ')
                .map((w) => w[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase()
            : null;

          return (
            <li key={o.id}>
              <Link
                href={`/opportunities/${o.id}`}
                className={`group flex h-full flex-col gap-1.5 rounded-md border border-l-4 ${meta.accentClass} border-y-sysde-border border-r-sysde-border bg-white p-3 transition hover:border-sysde-red/40 hover:shadow-sm`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-sysde-gray group-hover:text-sysde-red truncate">
                      {o.account.name}
                    </p>
                    <p className="text-[11px] text-sysde-mid truncate">{o.name}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${meta.chipClass}`}
                  >
                    <meta.Icon className="h-3 w-3" />
                    {meta.label}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-[10px] text-sysde-mid">
                    {stageLabel} · {lastWhen}
                  </span>
                  <span className="text-sm font-bold text-sysde-red shrink-0">
                    {fmtUSD(o.estimatedValue, o.currency)}
                  </span>
                </div>
                {ownerInitial ? (
                  <div className="flex items-center gap-1 text-[10px] text-sysde-mid">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sysde-red text-white font-bold text-[9px]">
                      {ownerInitial}
                    </span>
                    {o.owner?.name ?? o.owner?.email}
                  </div>
                ) : (
                  <div className="text-[10px] text-amber-700 italic">Sin owner asignado</div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
