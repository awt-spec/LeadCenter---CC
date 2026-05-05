// Opportunity aging classifier.
//
// Color coding requested by the user:
//   • <24h since last "gestión"           → fresh (sin badge)
//   • 24-48h                                → amarillo
//   • 48-72h                                → naranja
//   • >72h                                  → rojo
//
// "Gestión" = activity types that signal real movement on the deal — emails
// in either direction, calls, meetings, demos, proposals, materials sent,
// files shared, WhatsApp. Internal notes and system events (stage_change,
// status_change, contact_linked) are NOT gestión.
//
// Exception: when the most recent gestión was an INBOUND from the client
// (EMAIL_RECEIVED), we still apply the aging color but raise a separate flag
// `needsResponse` — the ball is in our court even though there IS recent
// activity. The user can filter "needs response" rows independently.

import type { Activity, ActivityType } from '@prisma/client';

/// Activity types that count as "gestión" on the deal. Internal notes and
/// system events are excluded — typing a note doesn't progress the deal.
export const GESTION_TYPES: ReadonlySet<ActivityType> = new Set([
  'EMAIL_SENT',
  'EMAIL_RECEIVED',
  'CALL',
  'WHATSAPP',
  'MEETING',
  'DEMO',
  'MATERIAL_SENT',
  'PROPOSAL_SENT',
  'LINKEDIN_MESSAGE',
  'FILE_SHARED',
]);

/// Activity types that signal an INBOUND signal from the client (we received
/// something). Currently just email-received and inbound LinkedIn — we treat
/// CALL/MEETING/DEMO as bidirectional (no clear inbound direction in LC).
export const INBOUND_TYPES: ReadonlySet<ActivityType> = new Set([
  'EMAIL_RECEIVED',
]);

export type AgingLevel = 'fresh' | 'warning' | 'orange' | 'red' | 'never';

export interface AgingClassification {
  /// Level for color coding.
  level: AgingLevel;
  /// Hours since last gestión activity. null when there's never been any.
  hoursSince: number | null;
  /// True if the most recent gestión was INBOUND from client (we owe a reply).
  needsResponse: boolean;
  /// The activity that anchors the calculation (if any).
  anchorAt: Date | null;
}

/// Classify an opportunity's aging based on its activity history.
/// Pass the activities sorted by occurredAt DESC for fastest result.
export function classifyAging(
  activities: Pick<Activity, 'type' | 'occurredAt'>[]
): AgingClassification {
  // Find the most recent gestión activity.
  const lastGestion = activities.find((a) => GESTION_TYPES.has(a.type));
  if (!lastGestion) {
    return { level: 'never', hoursSince: null, needsResponse: false, anchorAt: null };
  }
  const hoursSince = (Date.now() - lastGestion.occurredAt.getTime()) / 3_600_000;
  const needsResponse = INBOUND_TYPES.has(lastGestion.type);
  return {
    level: classifyLevel(hoursSince),
    hoursSince,
    needsResponse,
    anchorAt: lastGestion.occurredAt,
  };
}

export function classifyLevel(hoursSince: number): AgingLevel {
  if (hoursSince < 24) return 'fresh';
  if (hoursSince < 48) return 'warning';
  if (hoursSince < 72) return 'orange';
  return 'red';
}

/// Tailwind utility classes for each level — match the SYSDE rojo brand
/// (no purples / blues), conservative palette.
export const AGING_BG: Record<AgingLevel, string> = {
  fresh: 'bg-white',
  warning: 'bg-amber-100',
  orange: 'bg-orange-200',
  red: 'bg-red-200',
  never: 'bg-neutral-100',
};

export const AGING_RING: Record<AgingLevel, string> = {
  fresh: 'ring-1 ring-emerald-200',
  warning: 'ring-1 ring-amber-400',
  orange: 'ring-1 ring-orange-500',
  red: 'ring-2 ring-red-500',
  never: 'ring-1 ring-neutral-300',
};

export const AGING_DOT: Record<AgingLevel, string> = {
  fresh: 'bg-emerald-500',
  warning: 'bg-amber-500',
  orange: 'bg-orange-600',
  red: 'bg-red-600',
  never: 'bg-neutral-400',
};

export const AGING_LABEL: Record<AgingLevel, string> = {
  fresh: 'Activa',
  warning: '24h sin gestión',
  orange: '48h sin gestión',
  red: '72h+ sin gestión',
  never: 'Sin gestión',
};
