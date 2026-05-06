'use client';

import { memo, forwardRef, useMemo } from 'react';
import Link from 'next/link';
import { formatDistanceToNow, isPast, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertCircle,
  Building2,
  MoreVertical,
  Clock,
  Star,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  PRODUCT_LABELS,
  PRODUCT_CARD_COLORS,
  RATING_LABELS,
  STAGE_COLORS,
  formatMoneyCompact,
  formatMoney,
} from '@/lib/shared/labels';
import { getInitials, cn } from '@/lib/utils';
import { ManagementBadges } from '@/components/opportunities/management-badges';
import type { PipelineOpportunityCard } from '@/lib/pipeline/stats';

type Props = {
  card: PipelineOpportunityCard;
  isDragging?: boolean;
  isOverlay?: boolean;
  draggable: boolean;
  onQuickView?: (id: string) => void;
};

type IndicatorType = 'overdue' | 'stale' | 'highRating' | 'unassigned' | null;

function getIndicator(card: PipelineOpportunityCard): IndicatorType {
  if (card.nextActionDate && isPast(card.nextActionDate) && card.status === 'OPEN') return 'overdue';
  const baseline = card.lastActivityAt ?? card.updatedAt;
  if (baseline && differenceInDays(new Date(), baseline) >= 7 && card.status === 'OPEN') return 'stale';
  if (card.rating === 'A_PLUS' || card.rating === 'A') return 'highRating';
  if (!card.owner) return 'unassigned';
  return null;
}

export const OpportunityCard = memo(
  forwardRef<HTMLDivElement, Props & React.HTMLAttributes<HTMLDivElement>>(
    function OpportunityCard(
      { card, isDragging, isOverlay, draggable, onQuickView, className, ...rest },
      ref
    ) {
      const indicator = useMemo(() => getIndicator(card), [card]);
      const rating = RATING_LABELS[card.rating as keyof typeof RATING_LABELS];
      const productColors =
        PRODUCT_CARD_COLORS[card.product] ?? PRODUCT_CARD_COLORS.CUSTOM!;
      const stageColors = STAGE_COLORS[card.stage];

      const hoverDisabled = isDragging || isOverlay;

      const indicatorStyle: React.CSSProperties = (() => {
        switch (indicator) {
          case 'overdue':
            return { borderLeftColor: '#EF4444', borderLeftWidth: 3 };
          case 'stale':
            return { borderLeftColor: '#F59E0B', borderLeftWidth: 3 };
          case 'highRating':
            return { borderTopColor: '#10B981', borderTopWidth: 2 };
          default:
            return {};
        }
      })();

      const nextAction = card.nextActionDate;
      const nextOverdue = nextAction && isPast(nextAction) && card.status === 'OPEN';

      const cardInner = (
        <div
          className={cn(
            'relative select-none rounded-[10px] border border-sysde-border bg-white p-3 transition-all duration-150',
            !isOverlay && 'shadow-sm hover:-translate-y-px hover:border-neutral-300 hover:shadow-md',
            isOverlay && 'rotate-2 shadow-lg ring-1 ring-sysde-red/20',
            isDragging && !isOverlay && 'opacity-40',
            draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
            indicator === 'unassigned' && 'bg-[linear-gradient(135deg,rgba(148,163,184,0.04)_25%,transparent_25%,transparent_50%,rgba(148,163,184,0.04)_50%,rgba(148,163,184,0.04)_75%,transparent_75%)] bg-[length:12px_12px]',
            className
          )}
          style={indicatorStyle}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-5 min-w-[28px] items-center justify-center rounded-full px-2 text-[11px] font-semibold leading-none text-white"
                style={{ backgroundColor: rating?.color ?? '#94A3B8' }}
              >
                {rating?.label ?? '—'}
              </span>
              {card.code && (
                <span className="font-mono text-[11px] text-neutral-400">{card.code}</span>
              )}
            </div>

            {!isOverlay && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    data-no-drag
                    className="rounded text-sysde-mid opacity-0 transition-colors hover:bg-sysde-bg hover:text-sysde-gray group-hover:opacity-100"
                    aria-label="Acciones"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/opportunities/${card.id}`}>Ver detalle</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/opportunities/${card.id}/edit`}>Editar</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      onQuickView?.(card.id);
                    }}
                  >
                    Vista rápida
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-sysde-gray">
            {card.name}
          </div>

          <Link
            href={`/accounts/${card.account.id}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            data-no-drag
            className="mt-1.5 inline-flex items-center gap-1 text-xs text-sysde-mid transition-colors hover:text-sysde-red"
          >
            <Building2 className="h-3 w-3" />
            <span className="truncate">{card.account.name}</span>
          </Link>

          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: productColors.bg, color: productColors.text }}
            >
              {PRODUCT_LABELS[card.product as keyof typeof PRODUCT_LABELS] ?? card.product}
            </span>
            {card.status === 'OPEN' ? (
              <ManagementBadges
                lastActivityAt={card.lastActivityAt}
                lastActivityDirection={card.lastActivityDirection}
                hideWhenFresh
              />
            ) : null}
          </div>

          <div className="my-3 h-px bg-sysde-border" />

          <div className="flex items-baseline justify-between">
            <span className="text-base font-semibold text-sysde-gray">
              {formatMoneyCompact(card.estimatedValue, card.currency)}
              {card.estimatedValue !== null && (
                <span className="ml-1 text-[10px] font-medium uppercase text-sysde-mid">
                  {card.currency}
                </span>
              )}
            </span>
            <span className="text-xs text-sysde-mid">{card.probability}%</span>
          </div>

          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${card.probability}%`,
                backgroundColor: stageColors.border,
              }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              {card.owner ? (
                <>
                  <Avatar className="h-5 w-5">
                    {card.owner.avatarUrl ? (
                      <AvatarImage src={card.owner.avatarUrl} alt={card.owner.name} />
                    ) : null}
                    <AvatarFallback className="text-[9px]">
                      {getInitials(card.owner.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-[11px] text-sysde-mid">
                    {card.owner.name.split(' ')[0]}
                  </span>
                </>
              ) : (
                <span className="text-[11px] text-sysde-mid italic">Sin asignar</span>
              )}
            </div>

            <div
              className={cn(
                'flex shrink-0 items-center gap-1 text-[11px]',
                nextOverdue ? 'font-medium text-danger' : 'text-sysde-mid'
              )}
            >
              {nextOverdue ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {nextAction ? formatDistanceToNow(nextAction, { addSuffix: true, locale: es }) : '—'}
            </div>
          </div>
        </div>
      );

      // Wrap with HoverCard unless overlay/dragging
      if (hoverDisabled) {
        return (
          <div ref={ref} {...rest} className="group">
            {cardInner}
          </div>
        );
      }

      return (
        <div ref={ref} {...rest} className="group">
          <HoverCard openDelay={800} closeDelay={100}>
            <HoverCardTrigger asChild>
              <div>{cardInner}</div>
            </HoverCardTrigger>
            <HoverCardContent side="right" align="start" className="w-96">
              <HoverCardBody card={card} onQuickView={onQuickView} />
            </HoverCardContent>
          </HoverCard>
        </div>
      );
    }
  )
);

function HoverCardBody({
  card,
  onQuickView,
}: {
  card: PipelineOpportunityCard;
  onQuickView?: (id: string) => void;
}) {
  const weighted =
    card.estimatedValue !== null ? card.estimatedValue * (card.probability / 100) : null;

  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="font-semibold text-sysde-gray">{card.name}</div>
        <Link
          href={`/accounts/${card.account.id}`}
          className="text-xs text-sysde-red hover:underline"
        >
          {card.account.name}
        </Link>
      </div>

      {card.description && (
        <p className="line-clamp-3 whitespace-pre-wrap text-xs text-sysde-mid">
          {card.description}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 rounded-lg bg-sysde-bg p-3">
        <HoverStat label="Valor" value={formatMoney(card.estimatedValue, card.currency)} />
        <HoverStat label="Ponderado" value={formatMoney(weighted, card.currency)} />
        {card.portfolioAmount !== null && (
          <HoverStat label="Cartera" value={formatMoney(card.portfolioAmount, card.currency)} />
        )}
        {card.userCount !== null && (
          <HoverStat label="Usuarios" value={card.userCount.toLocaleString('es-MX')} />
        )}
        {card.annualOperations !== null && (
          <HoverStat label="Ops. anuales" value={card.annualOperations.toLocaleString('es-MX')} />
        )}
        {card.clientCount !== null && (
          <HoverStat label="Clientes" value={card.clientCount.toLocaleString('es-MX')} />
        )}
      </div>

      {card.primaryContact && (
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-sysde-mid">Contacto primario</div>
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              {card.primaryContact.avatarUrl ? (
                <AvatarImage src={card.primaryContact.avatarUrl} alt={card.primaryContact.fullName} />
              ) : null}
              <AvatarFallback className="text-[10px]">
                {getInitials(card.primaryContact.fullName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{card.primaryContact.fullName}</span>
            <Star className="h-3 w-3 fill-warning text-warning" />
          </div>
        </div>
      )}

      {onQuickView && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onQuickView(card.id);
          }}
          className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-sysde-red px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sysde-red-dark"
        >
          Abrir vista rápida
        </button>
      )}
    </div>
  );
}

function HoverStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-sysde-mid">{label}</div>
      <div className="text-sm font-medium text-sysde-gray">{value}</div>
    </div>
  );
}
