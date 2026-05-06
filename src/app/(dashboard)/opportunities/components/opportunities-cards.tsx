'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  PRODUCT_LABELS,
  PRODUCT_CARD_COLORS,
  RATING_LABELS,
  STAGE_LABELS,
  formatMoney,
} from '@/lib/shared/labels';
import { ManagementBadges } from '@/components/opportunities/management-badges';
import {
  computeStaleness,
  computeBallInCourt,
} from '@/lib/opportunities/management-rules';
import type { OpportunityRow } from './opportunities-table';

/**
 * Vista de cards (alternativa a la tabla).
 *
 * Cada card es scannable rápido:
 *   - Left-border de color por prioridad (responder=azul / 72h+=rojo / 48h=naranja / 24h=amarillo)
 *   - Account name grande
 *   - Stage chip + product chip
 *   - Valor en grande a la derecha
 *   - Owner + última gestión
 *   - Badges de gestión inline
 */
export function OpportunitiesCards({
  rows,
  total,
  page,
  pageSize,
}: {
  rows: OpportunityRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-sysde-border bg-white p-12 text-center">
        <p className="text-sm text-sysde-mid">Sin oportunidades para los filtros actuales.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <OppCard key={r.id} row={r} />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-sysde-mid">
        <div>
          Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de{' '}
          {total.toLocaleString('es-MX')}
        </div>
        <div className="text-xs">
          Página {page} / {Math.max(1, Math.ceil(total / pageSize))}
        </div>
      </div>
    </div>
  );
}

function OppCard({ row }: { row: OpportunityRow }) {
  const productColors =
    PRODUCT_CARD_COLORS[row.product as keyof typeof PRODUCT_CARD_COLORS] ??
    PRODUCT_CARD_COLORS.CUSTOM!;
  const rating = RATING_LABELS[row.rating as keyof typeof RATING_LABELS];

  // Border color según prioridad
  const ball =
    row.status === 'OPEN'
      ? computeBallInCourt(row.lastActivityAt, row.lastActivityDirection)
      : { needsResponse: false };
  const stale =
    row.status === 'OPEN' ? computeStaleness(row.lastActivityAt) : null;

  let borderClass = 'border-l-sysde-border';
  if (ball.needsResponse) borderClass = 'border-l-blue-500';
  else if (stale?.level === 'red' || stale?.level === 'never') borderClass = 'border-l-red-500';
  else if (stale?.level === 'orange') borderClass = 'border-l-orange-500';
  else if (stale?.level === 'yellow') borderClass = 'border-l-yellow-400';

  const stageLabel = STAGE_LABELS[row.stage as keyof typeof STAGE_LABELS] ?? row.stage;

  const ownerInitials = row.owner?.name
    ? row.owner.name
        .split(' ')
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : null;

  return (
    <Link
      href={`/opportunities/${row.id}`}
      className={`group relative block rounded-lg border border-l-4 ${borderClass} border-y-sysde-border border-r-sysde-border bg-white p-4 transition-all hover:border-sysde-red/40 hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {row.code ? (
            <span className="font-mono text-[10px] text-sysde-mid">{row.code}</span>
          ) : null}
          <div className="text-base font-semibold text-sysde-gray group-hover:text-sysde-red truncate">
            {row.account.name}
          </div>
          <div className="text-xs text-sysde-mid truncate">{row.name}</div>
        </div>
        {rating ? (
          <span
            className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold text-white shrink-0"
            style={{ backgroundColor: rating.color }}
          >
            {rating.label}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        <span
          className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: productColors.bg, color: productColors.text }}
        >
          {PRODUCT_LABELS[row.product as keyof typeof PRODUCT_LABELS] ?? row.product}
        </span>
        <span className="text-[10px] text-sysde-mid">·</span>
        <span className="text-[11px] text-sysde-gray">{stageLabel}</span>
      </div>

      {row.status === 'OPEN' ? (
        <div className="mt-2">
          <ManagementBadges
            lastActivityAt={row.lastActivityAt}
            lastActivityDirection={row.lastActivityDirection}
            hideWhenFresh
          />
        </div>
      ) : null}

      <div className="my-3 h-px bg-sysde-border" />

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 text-xs text-sysde-mid truncate">
          {ownerInitials ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sysde-red text-white font-bold text-[9px]">
                {ownerInitials}
              </span>
              {row.owner?.name}
            </span>
          ) : (
            <span className="italic text-amber-700">Sin owner</span>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-sysde-gray tabular-nums">
            {formatMoney(row.estimatedValue, row.currency)}
          </div>
          {row.lastActivityAt ? (
            <div className="text-[10px] text-sysde-mid">
              {formatDistanceToNow(row.lastActivityAt, { addSuffix: true, locale: es })}
            </div>
          ) : null}
        </div>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sysde-mid opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}
