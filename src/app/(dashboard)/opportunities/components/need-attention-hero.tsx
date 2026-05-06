import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Reply,
  Flame,
  HelpCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  UserX,
  Star,
  TrendingUp,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { STAGE_LABELS } from '@/lib/shared/labels';
import type {
  NeedAttentionOpp,
  AttentionReason,
  AttentionPerspective,
  OwnerBucket,
} from '@/lib/opportunities/management-queries';
import { PerspectiveTabs } from './perspective-tabs';

function fmtUSD(n: number | null, currency = 'USD'): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(0)}k`;
  return `${currency} ${n.toFixed(0)}`;
}

function reasonMeta(reason: AttentionReason) {
  switch (reason) {
    case 'needs_response':
      return {
        Icon: Reply,
        label: 'Responder',
        accentClass: 'border-l-blue-500',
        chipClass: 'bg-blue-100 text-blue-700 border-blue-200',
      };
    case 'red':
      return {
        Icon: Flame,
        label: '72h+ frío',
        accentClass: 'border-l-red-500',
        chipClass: 'bg-red-100 text-red-700 border-red-200',
      };
    case 'never':
      return {
        Icon: HelpCircle,
        label: 'Sin gestión',
        accentClass: 'border-l-red-500',
        chipClass: 'bg-red-100 text-red-700 border-red-200',
      };
    case 'high_value':
      return {
        Icon: TrendingUp,
        label: 'Alto valor',
        accentClass: 'border-l-purple-500',
        chipClass: 'bg-purple-100 text-purple-700 border-purple-200',
      };
    case 'unassigned':
      return {
        Icon: UserX,
        label: 'Sin owner',
        accentClass: 'border-l-amber-500',
        chipClass: 'bg-amber-100 text-amber-800 border-amber-200',
      };
  }
}

function whenLabel(date: Date | null): string {
  if (!date) return 'sin gestión';
  return formatDistanceToNow(date, { addSuffix: true, locale: es });
}

/// Card individual (reutilizable entre vistas grid y por-owner).
function OppCard({ opp, showScore }: { opp: NeedAttentionOpp; showScore?: boolean }) {
  const meta = reasonMeta(opp.reason);
  const stageLabel = STAGE_LABELS[opp.stage as keyof typeof STAGE_LABELS] ?? opp.stage;
  const lastWhen = whenLabel(opp.lastActivityAt);
  const ownerName = opp.owner?.name ?? opp.owner?.email ?? null;
  const ownerInitials = ownerName
    ? ownerName
        .split(' ')
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : null;
  const accountName = opp.account?.name ?? '(Sin empresa)';

  return (
    <Link
      href={`/opportunities/${opp.id}`}
      className={`group relative flex h-full flex-col gap-2 rounded-lg border border-l-4 ${meta.accentClass} border-y-sysde-border border-r-sysde-border bg-white p-3 transition hover:border-sysde-red/40 hover:shadow-sm`}
    >
      {/* Top row: code + reason chip + score */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {opp.code ? (
            <span className="font-mono text-[10px] text-sysde-mid">{opp.code}</span>
          ) : null}
          {showScore && opp.score !== undefined ? (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-sysde-red px-1 py-0.5 text-[9px] font-bold text-white"
              title={`Score smart: ${opp.score}/100`}
            >
              <Star className="h-2.5 w-2.5" /> {opp.score}
            </span>
          ) : null}
        </div>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${meta.chipClass}`}
        >
          <meta.Icon className="h-3 w-3" />
          {meta.label}
        </span>
      </div>

      {/* Account + opp name */}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-sysde-gray group-hover:text-sysde-red truncate">
          {accountName}
        </p>
        <p className="text-[11px] text-sysde-mid truncate">{opp.name}</p>
      </div>

      {/* Meta chips: stage + when */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-sysde-bg text-sysde-gray font-medium">
          {stageLabel}
        </span>
        <span
          className="inline-flex items-center gap-1 text-[10px] text-sysde-mid"
          title={opp.lastActivityAt ? opp.lastActivityAt.toISOString() : 'sin gestión'}
        >
          <Clock className="h-2.5 w-2.5" /> {lastWhen}
        </span>
      </div>

      <div className="mt-auto pt-2 border-t border-sysde-border flex items-center justify-between gap-2">
        {/* Owner — prominente */}
        <div className="flex items-center gap-1.5 min-w-0">
          {ownerInitials ? (
            <>
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sysde-red text-white font-bold text-[9px] shrink-0">
                {ownerInitials}
              </span>
              <span className="text-[11px] text-sysde-gray truncate">{ownerName}</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 italic">
              <UserX className="h-3 w-3" /> Sin owner
            </span>
          )}
        </div>
        <span className="text-sm font-bold text-sysde-red shrink-0 tabular-nums">
          {fmtUSD(opp.estimatedValue, opp.currency)}
        </span>
      </div>
    </Link>
  );
}

export function NeedAttentionHero({
  opps,
  totalNeedsResponse,
  totalRed,
  perspective,
  basePath,
  searchParams,
  byOwner,
}: {
  opps: NeedAttentionOpp[];
  totalNeedsResponse: number;
  totalRed: number;
  perspective: AttentionPerspective;
  basePath: string;
  searchParams: URLSearchParams;
  /// Si perspective === 'by_owner', se renderiza con secciones.
  byOwner?: OwnerBucket[];
}) {
  // Empty state — todo bajo control
  const isEmpty =
    perspective === 'by_owner' ? !byOwner || byOwner.length === 0 : opps.length === 0;

  return (
    <Card className="overflow-hidden">
      {/* Header con perspective tabs */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-sysde-border bg-gradient-to-r from-red-50/40 to-white">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700">
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-sysde-gray">Atención requerida</h2>
            <p className="text-[11px] text-sysde-mid">
              {totalNeedsResponse > 0
                ? `${totalNeedsResponse} esperan respuesta`
                : null}
              {totalNeedsResponse > 0 && totalRed > 0 ? ' · ' : ''}
              {totalRed > 0 ? `${totalRed} en rojo` : null}
              {totalNeedsResponse === 0 && totalRed === 0 ? 'Todo bajo control' : null}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PerspectiveTabs
            current={perspective}
            basePath={basePath}
            searchParams={searchParams}
          />
          <Link
            href={`${basePath}?needsResponse=true`}
            className="text-xs text-sysde-red hover:underline inline-flex items-center gap-1"
          >
            Ver todas <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </header>

      {isEmpty ? (
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-600 mb-3">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-sysde-gray">Todo bajo control</h3>
          <p className="text-xs text-sysde-mid mt-1 max-w-md mx-auto">
            {perspective === 'unassigned'
              ? 'Ninguna opp está sin owner asignado. Buen ritmo.'
              : perspective === 'value'
                ? 'Todas las opps de alto valor están al día.'
                : 'No hay oportunidades que requieran atención inmediata.'}
          </p>
        </div>
      ) : perspective === 'by_owner' && byOwner ? (
        // Vista por owner — secciones
        <div className="p-3 space-y-4">
          {byOwner.map((bucket) => (
            <section key={bucket.ownerId ?? '__unassigned__'}>
              <header className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  {bucket.ownerId ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sysde-red text-white font-bold text-[9px]">
                      {bucket.ownerName
                        .split(' ')
                        .map((w) => w[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700">
                      <UserX className="h-3 w-3" />
                    </span>
                  )}
                  <h3 className="text-sm font-semibold text-sysde-gray">
                    {bucket.ownerName}
                  </h3>
                  <span className="text-[10px] text-sysde-mid">
                    {bucket.opps.length} opp{bucket.opps.length === 1 ? '' : 's'}
                  </span>
                </div>
              </header>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {bucket.opps.map((o) => (
                  <li key={o.id}>
                    <OppCard opp={o} showScore />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        // Vista grid simple
        <ul className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {opps.map((o) => (
            <li key={o.id}>
              <OppCard opp={o} showScore={perspective === 'smart'} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
