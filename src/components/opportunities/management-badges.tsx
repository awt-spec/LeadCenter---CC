import type { ActivityDirection } from '@prisma/client';
import { Clock, Reply, AlertCircle } from 'lucide-react';
import {
  computeStaleness,
  computeBallInCourt,
} from '@/lib/opportunities/management-rules';

export function StalenessBadge({
  lastActivityAt,
  hideWhenFresh = false,
}: {
  lastActivityAt: Date | string | null | undefined;
  hideWhenFresh?: boolean;
}) {
  const date = lastActivityAt
    ? lastActivityAt instanceof Date
      ? lastActivityAt
      : new Date(lastActivityAt)
    : null;
  const info = computeStaleness(date);

  if (hideWhenFresh && info.level === 'fresh') return null;

  const Icon = info.level === 'never' ? AlertCircle : Clock;
  const tooltip = (() => {
    if (info.level === 'never') return 'Esta opp no tiene ninguna gestión registrada.';
    if (info.hoursAgo === null) return info.label;
    if (info.hoursAgo < 24) return `Última gestión hace ${Math.round(info.hoursAgo)}h`;
    const days = Math.floor(info.hoursAgo / 24);
    return `Última gestión hace ${days}d ${Math.round(info.hoursAgo % 24)}h`;
  })();

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium ${info.badgeClass}`}
      title={tooltip}
    >
      <Icon className="h-3 w-3" />
      {info.label}
    </span>
  );
}

export function BallInCourtBadge({
  lastActivityAt,
  lastActivityDirection,
  size = 'sm',
}: {
  lastActivityAt: Date | string | null | undefined;
  lastActivityDirection: ActivityDirection | null | undefined;
  size?: 'sm' | 'md';
}) {
  const date = lastActivityAt
    ? lastActivityAt instanceof Date
      ? lastActivityAt
      : new Date(lastActivityAt)
    : null;
  const info = computeBallInCourt(date, lastActivityDirection ?? null);
  if (!info.needsResponse) return null;

  const tooltipHours =
    info.hoursWaiting !== null
      ? info.hoursWaiting < 24
        ? `Cliente respondió hace ${Math.round(info.hoursWaiting)}h — toca responder`
        : `Cliente respondió hace ${Math.floor(info.hoursWaiting / 24)}d ${Math.round(info.hoursWaiting % 24)}h — toca responder`
      : 'Pelota en tu campo';

  const sizeClass =
    size === 'md'
      ? 'text-xs px-2 py-1 gap-1.5'
      : 'text-[10px] px-1.5 py-0.5 gap-1';

  return (
    <span
      className={`inline-flex items-center rounded border border-blue-300 bg-blue-50 text-blue-700 font-semibold ${sizeClass}`}
      title={tooltipHours}
    >
      <Reply className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
      Responder
    </span>
  );
}

/**
 * Combinación: ambas badges juntas en un wrapper, tipo "estado de gestión".
 * Para usar en pipeline card, opp list row, opp detail header.
 */
export function ManagementBadges({
  lastActivityAt,
  lastActivityDirection,
  hideWhenFresh = false,
}: {
  lastActivityAt: Date | string | null | undefined;
  lastActivityDirection: ActivityDirection | null | undefined;
  hideWhenFresh?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      <BallInCourtBadge
        lastActivityAt={lastActivityAt}
        lastActivityDirection={lastActivityDirection}
      />
      <StalenessBadge
        lastActivityAt={lastActivityAt}
        hideWhenFresh={hideWhenFresh}
      />
    </span>
  );
}
