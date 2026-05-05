// Contact health classifier (semáforo rojo/amarillo/verde).
//
// Reglas que pidió el equipo:
//   🔴 RED    — sin email, email inválido, rebotó, o estamos en
//               DO_NOT_CONTACT / UNSUBSCRIBED. No es accionable.
//   🟡 YELLOW — escalation contact: tenemos su email pero no es quien
//               toma decisiones (analyst / manager / unknown level).
//               Sirve para abrir la cuenta pero no cierra el deal.
//   🟢 GREEN  — contacto deseado: decision-maker (Director, VP, C-level
//               o Owner) con email válido. Es el que realmente movemos.

import type { ContactStatus, SeniorityLevel } from '@prisma/client';

export type ContactHealth = 'red' | 'yellow' | 'green';

const DECISION_MAKER_LEVELS: ReadonlySet<SeniorityLevel> = new Set([
  'DIRECTOR', 'VP', 'C_LEVEL', 'OWNER',
]);

/// Email looks plausible. We don't validate strictly (DNS/MX); just check
/// shape so we catch obviously broken values from CSV imports.
export function isEmailUsable(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim();
  if (!e) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  if (/no.?email|sin.?email|n\/a|na@|email@example/i.test(e)) return false;
  return true;
}

export function classifyContactHealth(contact: {
  email?: string | null;
  status?: ContactStatus | null;
  seniorityLevel?: SeniorityLevel | null;
}): ContactHealth {
  // 🔴 RED — unactionable
  if (!isEmailUsable(contact.email)) return 'red';
  if (contact.status === 'BOUNCED') return 'red';
  if (contact.status === 'DO_NOT_CONTACT') return 'red';
  if (contact.status === 'UNSUBSCRIBED') return 'red';
  if (contact.status === 'ARCHIVED') return 'red';

  // 🟢 GREEN — decision maker with usable email
  if (contact.seniorityLevel && DECISION_MAKER_LEVELS.has(contact.seniorityLevel)) {
    return 'green';
  }

  // 🟡 YELLOW — escalation contact (analyst/manager/unknown), pero accionable
  return 'yellow';
}

export const HEALTH_LABELS: Record<ContactHealth, string> = {
  red: 'Sin email / Rebotado',
  yellow: 'Escalable (sin decisión)',
  green: 'Decision-maker',
};

export const HEALTH_BG: Record<ContactHealth, string> = {
  red: 'bg-red-500',
  yellow: 'bg-amber-400',
  green: 'bg-emerald-500',
};

export const HEALTH_BG_LIGHT: Record<ContactHealth, string> = {
  red: 'bg-red-50 text-red-700 border-red-200',
  yellow: 'bg-amber-50 text-amber-800 border-amber-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const HEALTH_RING: Record<ContactHealth, string> = {
  red: 'ring-2 ring-red-500',
  yellow: 'ring-2 ring-amber-400',
  green: 'ring-2 ring-emerald-500',
};
