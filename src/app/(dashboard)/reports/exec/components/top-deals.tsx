import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, AlertTriangle, ExternalLink } from 'lucide-react';
import type { DealEntry } from '@/lib/reports/exec-queries';

function fmtUSD(n: number | null, currency = 'USD'): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(0)}k`;
  return `${currency} ${n.toFixed(0)}`;
}

const STAGE_LABEL: Record<string, string> = {
  LEAD: 'Lead',
  DISCOVERY: 'Discovery',
  SIZING: 'Sizing',
  DEMO: 'Demo',
  PROPOSAL: 'Propuesta',
  NEGOTIATION: 'Negociación',
  CLOSING: 'Cierre',
  HANDOFF: 'Handoff',
};

export function TopWonDeals({ deals }: { deals: DealEntry[] }) {
  return (
    <Card className="p-5">
      <header className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-sysde-gray flex items-center gap-2">
          <Trophy className="h-4 w-4 text-green-600" />
          Top deals ganados
        </h3>
        <span className="text-[10px] text-sysde-mid">{deals.length} en el período</span>
      </header>

      {deals.length === 0 ? (
        <div className="text-sm text-sysde-mid text-center py-6">
          Sin deals cerrados en este período.
        </div>
      ) : (
        <ol className="space-y-2">
          {deals.map((d, i) => (
            <li key={d.id}>
              <Link
                href={`/opportunities/${d.id}`}
                className="flex items-center gap-3 rounded-lg p-2 -mx-2 hover:bg-sysde-bg transition-colors group"
              >
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-[10px] font-bold shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-sysde-gray truncate">
                    {d.account.name}
                  </div>
                  <div className="text-[11px] text-sysde-mid truncate">
                    {d.name}
                    {d.owner ? <> · {d.owner.name ?? d.owner.email}</> : null}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-green-700">
                    {fmtUSD(d.value, d.currency)}
                  </div>
                  {d.closedAt ? (
                    <div className="text-[10px] text-sysde-mid">
                      {d.closedAt.toLocaleDateString('es', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </div>
                  ) : null}
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-sysde-mid opacity-0 group-hover:opacity-100 shrink-0" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function TopOpenDeals({ deals }: { deals: DealEntry[] }) {
  return (
    <Card className="p-5">
      <header className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-sysde-gray flex items-center gap-2">
          <Trophy className="h-4 w-4 text-sysde-red" />
          Top deals abiertos
        </h3>
        <span className="text-[10px] text-sysde-mid">por valor</span>
      </header>

      {deals.length === 0 ? (
        <div className="text-sm text-sysde-mid text-center py-6">
          Sin deals abiertos.
        </div>
      ) : (
        <ol className="space-y-2">
          {deals.map((d, i) => (
            <li key={d.id}>
              <Link
                href={`/opportunities/${d.id}`}
                className="flex items-center gap-3 rounded-lg p-2 -mx-2 hover:bg-sysde-bg transition-colors group"
              >
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sysde-red/10 text-sysde-red text-[10px] font-bold shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-sysde-gray truncate">
                    {d.account.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-sysde-mid">
                    <Badge variant="outline">{STAGE_LABEL[d.stage] ?? d.stage}</Badge>
                    {d.daysInStage !== null ? (
                      <span>· {d.daysInStage}d en stage</span>
                    ) : null}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-sysde-red">
                    {fmtUSD(d.value, d.currency)}
                  </div>
                  {d.expectedCloseDate ? (
                    <div className="text-[10px] text-sysde-mid">
                      cierre{' '}
                      {d.expectedCloseDate.toLocaleDateString('es', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </div>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function DealsAtRisk({ deals }: { deals: DealEntry[] }) {
  if (deals.length === 0) return null;
  return (
    <Card className="p-5 border-amber-300 bg-amber-50/30">
      <header className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-sysde-gray flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Deals at-risk
        </h3>
        <span className="text-[10px] text-sysde-mid">sin actividad &gt;14d</span>
      </header>

      <ol className="space-y-2">
        {deals.map((d) => (
          <li key={d.id}>
            <Link
              href={`/opportunities/${d.id}`}
              className="flex items-center gap-3 rounded-lg p-2 -mx-2 hover:bg-amber-100/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-sysde-gray truncate">
                  {d.account.name}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-sysde-mid">
                  <Badge variant="warning">{STAGE_LABEL[d.stage] ?? d.stage}</Badge>
                  {d.daysInStage !== null ? (
                    <span>· {d.daysInStage}d sin movimiento</span>
                  ) : null}
                  {d.owner ? <span>· {d.owner.name ?? d.owner.email}</span> : null}
                </div>
              </div>
              <div className="text-sm font-bold text-amber-700 shrink-0">
                {fmtUSD(d.value, d.currency)}
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
