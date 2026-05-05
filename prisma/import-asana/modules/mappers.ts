// Asana → LeadCenter field mapping. Pure functions, no DB calls.
//
// All mappings here are conservative: when in doubt we land on a sane default
// (UNSCORED, LEAD, NORMAL) instead of guessing wrong. The user can fix the
// outliers manually in LC after import.

import type {
  OpportunityStage,
  OpportunityStatus,
  OpportunityRating,
  SysdeProduct,
  SysdeSubProduct,
  AccountPriority,
  AccountStatus,
} from '@prisma/client';
import type { AsanaTask, AsanaCustomField } from './asana-client';

const cf = (task: AsanaTask, name: string): string | null => {
  const f = task.custom_fields.find((c) => c.name === name);
  return f?.display_value ?? null;
};

/// "Sub" custom field uses values like "Fase 1: Indagación", "Fase 2: Sesión inicial",
/// "Fase 3: Demo", "Fase 4: Propuesta".
export function mapStage(task: AsanaTask): OpportunityStage {
  const sectionName = task.memberships?.[0]?.section?.name?.toLowerCase() ?? '';
  // Section overrides win/lost regardless of phase.
  if (/win prospect|prospectos won|won/.test(sectionName)) return 'WON';
  if (/loss|lost/.test(sectionName)) return 'LOST';
  if (/lost in space/.test(sectionName)) return 'LOST';

  const sub = (cf(task, 'Sub') ?? '').toLowerCase();
  if (sub.includes('fase 4') || sub.includes('propuesta')) return 'PROPOSAL';
  if (sub.includes('fase 3') || sub.includes('demo')) return 'DEMO';
  if (sub.includes('fase 2') || sub.includes('sesión inicial') || sub.includes('sesion inicial')) return 'DISCOVERY';
  if (sub.includes('fase 1') || sub.includes('indagaci')) return 'DISCOVERY';

  // Without "Sub" — section-based fallback
  if (/maduración vip|maduracion vip/.test(sectionName)) return 'NURTURE';
  if (/maduración|maduracion/.test(sectionName)) return 'NURTURE';
  if (/baja prioridad/.test(sectionName)) return 'STAND_BY';
  if (/seguimiento.*vip|vip/.test(sectionName)) return 'DISCOVERY';
  if (/leads accionables|iniciativas/.test(sectionName)) return 'LEAD';
  if (/telemarketing/.test(sectionName)) return 'LEAD';
  if (/sentinel|trully/.test(sectionName)) return 'LEAD';
  if (/gestión normal|gestion normal/.test(sectionName)) return 'LEAD';

  return 'LEAD';
}

export function mapStatus(stage: OpportunityStage, completed: boolean): OpportunityStatus {
  if (stage === 'WON') return 'WON';
  if (stage === 'LOST') return 'LOST';
  if (stage === 'NURTURE') return 'NURTURE';
  if (stage === 'STAND_BY') return 'STAND_BY';
  // If Asana marked task as completed but stage isn't WON/LOST → treat as WON
  // (the team usually completes tasks when the deal closes).
  if (completed) return 'WON';
  return 'OPEN';
}

export function mapRating(task: AsanaTask): OpportunityRating {
  const c = (cf(task, 'Calificación I.O.') ?? '').toUpperCase().trim();
  if (c === 'A+') return 'A_PLUS';
  if (c === 'A') return 'A';
  if (c === 'B+') return 'B_PLUS';
  if (c === 'B') return 'B';
  if (c === 'C') return 'C';
  if (c === 'D') return 'D';
  return 'UNSCORED';
}

export function mapProduct(task: AsanaTask): { product: SysdeProduct; subProduct: SysdeSubProduct } {
  const raw = (cf(task, 'Solución Sysde') ?? '').toLowerCase();
  // Multi-value: "SAF, Gestor de Cobro" — pick the first signal we recognise.

  // Sub-products first (more specific) so they win over the bare "SAF".
  if (raw.includes('arrendamiento') || raw.includes('leasing')) return { product: 'SAF_PLUS', subProduct: 'SAF_LEASING' };
  if (raw.includes('factoraje directo')) return { product: 'FACTORAJE_ONCLOUD', subProduct: 'FACTORAJE_DIRECT' };
  if (raw.includes('factoraje reverso')) return { product: 'FACTORAJE_ONCLOUD', subProduct: 'FACTORAJE_REVERSE' };
  if (raw.includes('factoraje') || raw.includes('factoring')) return { product: 'FACTORAJE_ONCLOUD', subProduct: 'SAF_FACTORING' };
  if (raw.includes('crédito') || raw.includes('credito')) return { product: 'SAF_PLUS', subProduct: 'SAF_CREDIT' };

  if (raw.includes('pension') || raw.includes('pensión')) return { product: 'SYSDE_PENSION', subProduct: 'PENSION_RECORDKEEPING' };
  if (raw.includes('pld') || raw.includes('sentinel')) return { product: 'SENTINEL_PLD', subProduct: 'PLD_FULL' };
  if (raw.includes('filemaster') || raw.includes('file master')) return { product: 'FILEMASTER', subProduct: 'FM_FULL' };
  if (raw.includes('bpm')) return { product: 'FILEMASTER', subProduct: 'FM_BPM' };
  if (raw.includes('documents') || raw.includes('documentos')) return { product: 'FILEMASTER', subProduct: 'FM_DOCUMENTS' };

  if (raw.includes('saf')) return { product: 'SAF_PLUS', subProduct: 'SAF_FULL' };
  if (raw.includes('banca')) return { product: 'SAF_PLUS', subProduct: 'SAF_FULL' };
  if (raw.includes('gestor de cobro') || raw.includes('cobranza')) return { product: 'SAF_PLUS', subProduct: 'SAF_CREDIT' };

  return { product: 'CUSTOM', subProduct: 'NONE' };
}

export function mapPriority(task: AsanaTask): AccountPriority {
  const sectionName = task.memberships?.[0]?.section?.name?.toLowerCase() ?? '';
  const prio = (cf(task, 'Prioridad y Acción requerida | LC') ?? '').toLowerCase();
  const corePrio = (cf(task, 'Priority') ?? '').toLowerCase();

  if (prio.includes('inmediata') || prio.includes('vip')) return 'HIGH';
  if (corePrio === 'high') return 'HIGH';
  if (sectionName.includes('vip')) return 'HIGH';
  if (sectionName.includes('baja prioridad')) return 'LOW';
  if (corePrio === 'low') return 'LOW';
  return 'NORMAL';
}

/// Country normalisation — Asana's "País" field has free text like "Perú",
/// "Republica Dominicana", "El Salvador ". We normalise to a stable set of
/// names so the dedup against existing Accounts (which already use ISO-like
/// names from HubSpot) doesn't fragment.
export function mapCountry(task: AsanaTask): string | null {
  const raw = (cf(task, 'País') ?? '').trim();
  if (!raw) return null;
  const k = raw.toLowerCase();
  if (k.includes('perú') || k.includes('peru')) return 'Peru';
  if (k.includes('rep') && (k.includes('dominicana') || k.includes('dom'))) return 'Dominican Republic';
  if (k.includes('el salvador') || k === 'salvador') return 'El Salvador';
  if (k.includes('guatemala')) return 'Guatemala';
  if (k.includes('honduras')) return 'Honduras';
  if (k.includes('nicaragua')) return 'Nicaragua';
  if (k.includes('costa rica')) return 'Costa Rica';
  if (k.includes('panamá') || k.includes('panama')) return 'Panama';
  if (k.includes('méxico') || k.includes('mexico')) return 'Mexico';
  if (k.includes('colombia')) return 'Colombia';
  if (k.includes('ecuador')) return 'Ecuador';
  if (k.includes('chile')) return 'Chile';
  if (k.includes('paraguay')) return 'Paraguay';
  if (k.includes('uruguay')) return 'Uruguay';
  if (k.includes('argentina')) return 'Argentina';
  if (k.includes('venezuela')) return 'Venezuela';
  if (k.includes('bolivia')) return 'Bolivia';
  if (k.includes('puerto rico') || k === 'pr') return 'Puerto Rico';
  if (k.includes('estados unidos') || k.includes('usa') || k.includes('united states')) return 'United States';
  if (k.includes('españa') || k.includes('espana') || k.includes('spain')) return 'Spain';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/// Extract a clean company name from an Asana task title. Patterns observed:
///   "Plaza Lama : Fernando Pou"          → "Plaza Lama"
///   "BCP - Leasing"                       → "BCP"
///   "Derrama.org / Fintec  => ***algo***" → "Derrama.org / Fintec"
///   "AMC :     Observaciones..."          → "AMC"
///   "Sura Perú :   "                      → "Sura Perú"
///   "CO.GLOBALEVEREST.SAF-CAMBIO CORE"    → "CO.GLOBALEVEREST"
export function extractCompanyName(taskName: string): string {
  let name = taskName.trim();

  // Strip trailing "=> ***whatever***" notes
  name = name.replace(/\s*=>.*$/u, '').trim();

  // Strip trailing "***notes***" or "[notes]"
  name = name.replace(/\s*\*\*\*.*\*\*\*\s*$/u, '').replace(/\s*\[.*?\]\s*$/u, '').trim();

  // Cut on first " : " or " - " (with spaces around) and keep the prefix
  const sepMatch = name.match(/^(.+?)\s*[:–—-]\s+(.+)$/u);
  if (sepMatch && sepMatch[1].trim().length >= 2) {
    name = sepMatch[1].trim();
  }

  // Cut on " / " if there's only one side worth keeping
  // (we keep both — "Derrama.org / Fintec" is the company name itself)

  // Drop leading "***", "—", "::", etc.
  name = name.replace(/^[*\s:>–—-]+/u, '').trim();

  return name || taskName.trim();
}

export function mapAccountStatus(stage: OpportunityStage, status: OpportunityStatus): AccountStatus {
  if (status === 'WON') return 'CUSTOMER';
  if (status === 'LOST') return 'LOST';
  if (status === 'OPEN') return 'ACTIVE';
  return 'PROSPECT';
}

/// Asana stories include both real comments and system events. We want the
/// real comments always; the system events are recorded as INTERNAL_NOTE
/// activities tagged "system" so the timeline keeps the audit trail without
/// drowning the timeline in noise.
export const SYSTEM_EVENTS_OF_INTEREST = new Set([
  'assigned',
  'unassigned',
  'marked_complete',
  'marked_incomplete',
  'due_date_changed',
  'section_changed',
  'added_to_project',
  'removed_from_project',
]);

/// Hosts/URL patterns that indicate a "Lovable" resource — we'll surface
/// these into the C.O.C. links so they're easy to find.
export const LOVABLE_URL = /https?:\/\/(?:[a-z0-9-]+\.)*lovable\.(?:dev|app)\/[^\s)<>"']+/gi;
