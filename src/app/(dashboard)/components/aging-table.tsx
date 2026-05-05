import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowUpRight, MessageSquareWarning } from 'lucide-react';
import type { AgingRow } from '@/lib/opportunities/aging-queries';
import { AGING_BG, AGING_DOT, AGING_LABEL, type AgingLevel } from '@/lib/opportunities/aging';
import { STAGE_LABELS_SHORT } from '@/lib/shared/labels';
import type { OpportunityStage } from '@prisma/client';

function fmtMoney(n: number | null, currency: string): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(0)}K`;
  return `${currency} ${n.toFixed(0)}`;
}

export function AgingTable({
  rows,
  counts,
  defaultLimit = 25,
}: {
  rows: AgingRow[];
  counts: Record<AgingLevel, number>;
  defaultLimit?: number;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-sysde-border bg-white p-8 text-center text-sm text-sysde-mid">
        No hay oportunidades abiertas en tu alcance. 🎉
      </div>
    );
  }

  const trimmed = rows.slice(0, defaultLimit);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <Counter level="red" count={counts.red} />
        <Counter level="orange" count={counts.orange} />
        <Counter level="warning" count={counts.warning} />
        <Counter level="never" count={counts.never} />
        <Counter level="fresh" count={counts.fresh} />
      </div>

      <div className="overflow-hidden rounded-md border border-sysde-border bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-sysde-border bg-sysde-bg text-xs uppercase tracking-wide text-sysde-mid">
            <tr>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-left">Oportunidad</th>
              <th className="px-3 py-2 text-left">Stage</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-left">Última gestión</th>
              <th className="px-3 py-2 text-left">Owner</th>
            </tr>
          </thead>
          <tbody>
            {trimmed.map((r) => (
              <tr
                key={r.opportunityId}
                className={`border-t border-sysde-border ${AGING_BG[r.level]} hover:brightness-95`}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${AGING_DOT[r.level]}`} />
                    <span className="text-[11px] font-medium uppercase tracking-wide text-sysde-gray">
                      {AGING_LABEL[r.level]}
                    </span>
                    {r.needsResponse && (
                      <span
                        title="El cliente respondió — toca a vos contestar"
                        className="ml-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-800"
                      >
                        <MessageSquareWarning className="h-3 w-3" />
                        responder
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/opportunities/${r.opportunityId}`}
                    className="group inline-flex items-center gap-1 font-medium text-sysde-gray hover:text-sysde-red"
                  >
                    <span className="max-w-[260px] truncate" title={r.opportunityName}>
                      {r.opportunityName}
                    </span>
                    <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                  </Link>
                  <div className="text-[11px] text-sysde-mid">{r.accountName}</div>
                </td>
                <td className="px-3 py-2 text-xs">
                  {STAGE_LABELS_SHORT[r.stage as OpportunityStage] ?? r.stage}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {fmtMoney(r.estimatedValue, r.currency)}
                </td>
                <td className="px-3 py-2 text-xs text-sysde-mid">
                  {r.lastActivityAt
                    ? `hace ${formatDistanceToNow(r.lastActivityAt, { locale: es })}`
                    : 'nunca'}
                  {r.lastActivityAt && (
                    <div className="text-[10px] text-sysde-mid/70">
                      {format(r.lastActivityAt, "d LLL HH:mm", { locale: es })}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-sysde-gray">{r.ownerName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > defaultLimit && (
        <div className="text-center text-xs text-sysde-mid">
          Mostrando {defaultLimit} de {rows.length}.{' '}
          <Link href="/opportunities?aging=red" className="text-sysde-red hover:underline">
            Ver todas →
          </Link>
        </div>
      )}
    </div>
  );
}

function Counter({ level, count }: { level: AgingLevel; count: number }) {
  if (count === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md ${AGING_BG[level]} px-2 py-1 text-[11px] font-medium`}>
      <span className={`h-1.5 w-1.5 rounded-full ${AGING_DOT[level]}`} />
      <span className="text-sysde-gray">
        {count} {AGING_LABEL[level].toLowerCase()}
      </span>
    </span>
  );
}
