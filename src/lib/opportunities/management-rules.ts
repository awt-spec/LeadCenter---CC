import type { ActivityDirection, ActivityType } from '@prisma/client';

/**
 * Reglas de gestión sobre oportunidades.
 *
 * Una opp sin gestión efectiva (call/email/meeting/propuesta) en las
 * últimas:
 *   - 24h         → 🟡 amarillo
 *   - 48h         → 🟠 naranja
 *   - 72h+        → 🔴 rojo
 * Si la última gestión fue del cliente (INBOUND), badge azul "responder"
 * indica que la pelota está en nuestro campo.
 *
 * Las notas internas y los eventos de sistema (STAGE_CHANGE, etc.) se
 * cuentan en `lastActivityAt` igualmente — el operador escogió cuándo
 * registrarlos. Si querés que NO cuenten, filtralos al setear
 * `lastActivityAt` desde el mutator.
 */

export type StalenessLevel = 'fresh' | 'yellow' | 'orange' | 'red' | 'never';

export type StalenessInfo = {
  level: StalenessLevel;
  hoursAgo: number | null;
  label: string;
  // Tailwind classes para badge inline
  badgeClass: string;
  // Color hex para SVGs / charts
  color: string;
};

const HOURS = 60 * 60 * 1000;

export function computeStaleness(
  lastActivityAt: Date | null | undefined,
  now: Date = new Date()
): StalenessInfo {
  if (!lastActivityAt) {
    return {
      level: 'never',
      hoursAgo: null,
      label: 'Sin gestión',
      badgeClass: 'bg-red-100 text-red-700 border-red-200',
      color: '#dc2626',
    };
  }
  const ms = now.getTime() - lastActivityAt.getTime();
  const hoursAgo = ms / HOURS;

  if (hoursAgo < 24) {
    return {
      level: 'fresh',
      hoursAgo,
      label: 'Al día',
      badgeClass: 'bg-green-100 text-green-700 border-green-200',
      color: '#16a34a',
    };
  }
  if (hoursAgo < 48) {
    return {
      level: 'yellow',
      hoursAgo,
      label: '24h sin gestión',
      badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      color: '#ca8a04',
    };
  }
  if (hoursAgo < 72) {
    return {
      level: 'orange',
      hoursAgo,
      label: '48h sin gestión',
      badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
      color: '#ea580c',
    };
  }
  return {
    level: 'red',
    hoursAgo,
    label: hoursAgo < 168 ? '72h+ sin gestión' : `${Math.floor(hoursAgo / 24)}d sin gestión`,
    badgeClass: 'bg-red-100 text-red-700 border-red-300',
    color: '#dc2626',
  };
}

/**
 * Detecta si la pelota está en nuestro campo (cliente nos respondió).
 * Si la última actividad fue INBOUND y ya pasó tiempo, urgencia.
 */
export type BallInCourtInfo = {
  needsResponse: boolean;
  // Si needsResponse, hace cuánto el cliente nos escribió/llamó.
  hoursWaiting: number | null;
};

export function computeBallInCourt(
  lastActivityAt: Date | null | undefined,
  lastActivityDirection: ActivityDirection | null | undefined,
  now: Date = new Date()
): BallInCourtInfo {
  const isInbound = lastActivityDirection === 'INBOUND';
  if (!isInbound || !lastActivityAt) {
    return { needsResponse: false, hoursWaiting: null };
  }
  const hours = (now.getTime() - lastActivityAt.getTime()) / HOURS;
  return { needsResponse: true, hoursWaiting: hours };
}

/**
 * Deriva ActivityDirection del ActivityType cuando el caller no la
 * setea explícitamente. Mismo mapping que el SQL backfill.
 *
 *   EMAIL_RECEIVED                                → INBOUND
 *   INTERNAL_NOTE / STAGE_CHANGE / STATUS_CHANGE  → INTERNAL
 *   CONTACT_LINKED                                → INTERNAL
 *   resto                                          → OUTBOUND
 */
export function deriveDirectionFromType(type: ActivityType): ActivityDirection {
  if (type === 'EMAIL_RECEIVED') return 'INBOUND';
  if (
    type === 'INTERNAL_NOTE' ||
    type === 'STAGE_CHANGE' ||
    type === 'STATUS_CHANGE' ||
    type === 'CONTACT_LINKED'
  ) {
    return 'INTERNAL';
  }
  return 'OUTBOUND';
}

/**
 * Filtros sintéticos sobre staleness — usados para chips de filtro.
 * Se traducen a `where` clauses en runtime.
 */
export type StalenessFilter =
  | 'fresh'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'needs_response'
  | 'all';

export function stalenessRanges(
  filter: StalenessFilter,
  now: Date = new Date()
): { gte?: Date; lte?: Date } | null {
  if (filter === 'all') return null;
  if (filter === 'needs_response') return null; // se filtra por direction, no por tiempo
  const baseEnd = (h: number) => new Date(now.getTime() - h * HOURS);
  if (filter === 'fresh') return { gte: baseEnd(24) };
  if (filter === 'yellow') return { gte: baseEnd(48), lte: baseEnd(24) };
  if (filter === 'orange') return { gte: baseEnd(72), lte: baseEnd(48) };
  if (filter === 'red') return { lte: baseEnd(72) };
  return null;
}
