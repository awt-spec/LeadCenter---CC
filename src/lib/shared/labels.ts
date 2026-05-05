import {
  OpportunityStage,
  OpportunityStatus,
  OpportunityRating,
  SysdeProduct,
  SysdeSubProduct,
  CommercialModel,
  LostReason,
  ContactRole,
  CompanySize,
  AccountStatus,
  MarketSegment,
} from '@prisma/client';

/// Stage labels alineadas con el "Pipeline de ventas" de HubSpot SYSDE,
/// que tiene la probabilidad embebida en el nombre. Mantenemos el enum LC
/// estable (no rompemos data existente) pero las etiquetas que ve el usuario
/// son exactamente las de HubSpot — mismo lenguaje en ambos sistemas.
export const STAGE_LABELS: Record<OpportunityStage, string> = {
  LEAD: '10% Prospectos / Contacto iniciado',
  DISCOVERY: '25% Calificar (Dolor / Poder / Proceso)',
  SIZING: '25% Calificar (Dimensionamiento)',
  DEMO: '50% Poder / Validar (Visión de compra)',
  PROPOSAL: '75% Resolver / Decidir (Propuesta revisada)',
  NEGOTIATION: '90% Negociar / Acordar (Aprobación verbal)',
  CLOSING: '100% Firma de contrato / OC',
  HANDOFF: 'Handoff a Customer Success',
  WON: 'Ganado',
  LOST: 'Perdido',
  STAND_BY: 'Stand-by',
  NURTURE: 'Lost in Space (nurture pasivo)',
};

/// Versión corta para columnas y badges donde el % entero ya da el contexto.
export const STAGE_LABELS_SHORT: Record<OpportunityStage, string> = {
  LEAD: '10% · Prospecto',
  DISCOVERY: '25% · Calificar',
  SIZING: '25% · Dimensionar',
  DEMO: '50% · Validar',
  PROPOSAL: '75% · Decidir',
  NEGOTIATION: '90% · Negociar',
  CLOSING: '100% · Firma',
  HANDOFF: 'Handoff',
  WON: 'Ganado',
  LOST: 'Perdido',
  STAND_BY: 'Stand-by',
  NURTURE: 'Lost in Space',
};

/// Probabilidad por etapa, alineada con el Pipeline de ventas de HubSpot.
export const STAGE_PROBABILITY: Record<OpportunityStage, number> = {
  LEAD: 10,
  DISCOVERY: 25,
  SIZING: 25,
  DEMO: 50,
  PROPOSAL: 75,
  NEGOTIATION: 90,
  CLOSING: 100,
  HANDOFF: 100,
  WON: 100,
  LOST: 0,
  STAND_BY: 5,
  NURTURE: 5,
};

/// Funnel-coloreado: tonos fríos al inicio, rojo SYSDE en el cierre,
/// verde para Ganado, gris para Lost/Stand-by. Coherente con la paleta
/// SYSDE (rojo dominante = momentum hacia el cierre).
export const STAGE_COLORS: Record<
  OpportunityStage,
  { bg: string; text: string; border: string }
> = {
  LEAD: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  DISCOVERY: { bg: '#FEE2E2', text: '#7F1D1D', border: '#FCA5A5' },
  SIZING: { bg: '#FEE2E2', text: '#7F1D1D', border: '#FCA5A5' },
  DEMO: { bg: '#FECACA', text: '#991B1B', border: '#F87171' },
  PROPOSAL: { bg: '#FCA5A5', text: '#7F1D1D', border: '#EF4444' },
  NEGOTIATION: { bg: '#F87171', text: '#FFFFFF', border: '#DC2626' },
  CLOSING: { bg: '#DC2626', text: '#FFFFFF', border: '#B91C1C' },
  HANDOFF: { bg: '#DDD6FE', text: '#5B21B6', border: '#C4B5FD' },
  WON: { bg: '#D1FAE5', text: '#065F46', border: '#10B981' },
  LOST: { bg: '#F3F4F6', text: '#4B5563', border: '#D1D5DB' },
  STAND_BY: { bg: '#FEF9C3', text: '#713F12', border: '#FDE047' },
  NURTURE: { bg: '#ECFCCB', text: '#365314', border: '#BEF264' },
};

/// HubSpot stage internal IDs → LC stage. Used by the import mapper for
/// exact-id mapping when we know we're against the SYSDE pipelines.
/// Falls back to label-based heuristics for unknown ids.
export const HUBSPOT_STAGE_ID_TO_LC: Record<string, OpportunityStage> = {
  // Pipeline de ventas (default)
  appointmentscheduled: 'LEAD',
  qualifiedtobuy: 'DISCOVERY',
  presentationscheduled: 'DEMO',
  decisionmakerboughtin: 'PROPOSAL',
  contractsent: 'NEGOTIATION',
  closedwon: 'WON',
  '167572092': 'WON', // "Ganado"
  closedlost: 'LOST',
  '146799236': 'NURTURE', // "Lost In Space"
  // Pipeline EW (secundario, en inglés)
  '982752260': 'LEAD',
  '982752261': 'DISCOVERY',
  '982752262': 'DEMO',
  '982752263': 'PROPOSAL',
  '982752264': 'NEGOTIATION',
  '982752265': 'WON',
  '982752266': 'LOST',
};

export const STATUS_LABELS: Record<OpportunityStatus, string> = {
  OPEN: 'Abierta',
  WON: 'Ganada',
  LOST: 'Perdida',
  STAND_BY: 'Stand-by',
  NURTURE: 'Nurture',
};

export const RATING_LABELS: Record<
  OpportunityRating,
  { label: string; color: string; score: number }
> = {
  A_PLUS: { label: 'A+', color: '#10B981', score: 100 },
  A: { label: 'A', color: '#22C55E', score: 85 },
  B_PLUS: { label: 'B+', color: '#3B82F6', score: 70 },
  B: { label: 'B', color: '#60A5FA', score: 55 },
  C: { label: 'C', color: '#F59E0B', score: 35 },
  D: { label: 'D', color: '#EF4444', score: 15 },
  UNSCORED: { label: '—', color: '#94A3B8', score: 0 },
};

export const PRODUCT_LABELS: Record<SysdeProduct, string> = {
  SAF_PLUS: 'SAF+',
  FILEMASTER: 'FileMaster',
  FACTORAJE_ONCLOUD: 'Factoraje OnCloud',
  SYSDE_PENSION: 'SYSDE Pensión',
  SENTINEL_PLD: 'Sentinel / PLD',
  CUSTOM: 'Otro',
};

export const SUB_PRODUCT_LABELS: Record<SysdeSubProduct, string> = {
  SAF_CREDIT: 'SAF+ Crédito',
  SAF_LEASING: 'SAF+ Leasing',
  SAF_FACTORING: 'SAF+ Factoring',
  SAF_FULL: 'SAF+ Full (los 3 módulos)',
  FM_DOCUMENTS: 'FileMaster Documentos',
  FM_BPM: 'FileMaster BPM',
  FM_FULL: 'FileMaster Full',
  PENSION_RECORDKEEPING: 'Pensión Recordkeeping',
  PLD_FULL: 'PLD Full',
  PLD_MONITORING: 'PLD Monitoring',
  FACTORAJE_REVERSE: 'Factoraje Reverso',
  FACTORAJE_DIRECT: 'Factoraje Directo',
  NONE: '—',
};

export const SUB_PRODUCTS_BY_PRODUCT: Record<SysdeProduct, SysdeSubProduct[]> = {
  SAF_PLUS: ['SAF_CREDIT', 'SAF_LEASING', 'SAF_FACTORING', 'SAF_FULL'],
  FILEMASTER: ['FM_DOCUMENTS', 'FM_BPM', 'FM_FULL'],
  FACTORAJE_ONCLOUD: ['FACTORAJE_REVERSE', 'FACTORAJE_DIRECT'],
  SYSDE_PENSION: ['PENSION_RECORDKEEPING'],
  SENTINEL_PLD: ['PLD_FULL', 'PLD_MONITORING'],
  CUSTOM: ['NONE'],
};

export const COMMERCIAL_MODEL_LABELS: Record<CommercialModel, string> = {
  UNDEFINED: 'Sin definir',
  SAAS: 'SaaS',
  ON_PREMISE: 'On-premise',
  HYBRID: 'Híbrido',
  LICENSE_PERPETUAL: 'Licencia perpetua',
  TIME_AND_MATERIALS: 'T&M',
};

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  PRICE: 'Precio',
  COMPETITOR: 'Competidor',
  TIMING: 'Timing',
  NO_BUDGET: 'Sin presupuesto',
  NO_DECISION: 'Sin decisión',
  NO_FIT: 'No es fit',
  INTERNAL_DEV: 'Desarrollo interno',
  NO_RESPONSE: 'Sin respuesta',
  PROJECT_CANCELLED: 'Proyecto cancelado',
  OTHER: 'Otro',
};

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  SPONSOR: 'Patrocinador',
  DECISION_MAKER: 'Decisor',
  CHAMPION: 'Champion',
  TECHNICAL_BUYER: 'Comprador técnico',
  USER: 'Usuario final',
  INFLUENCER: 'Influenciador',
  BLOCKER: 'Bloqueador',
  GATEKEEPER: 'Gatekeeper',
};

export const CONTACT_ROLE_COLORS: Record<ContactRole, string> = {
  SPONSOR: '#C8200F',
  DECISION_MAKER: '#C8200F',
  CHAMPION: '#10B981',
  TECHNICAL_BUYER: '#3B82F6',
  USER: '#64748B',
  INFLUENCER: '#8B5CF6',
  BLOCKER: '#94A3B8',
  GATEKEEPER: '#F59E0B',
};

export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  UNKNOWN: 'Desconocido',
  MICRO: 'Micro (1-10)',
  SMALL: 'Pequeña (11-50)',
  MEDIUM: 'Mediana (51-250)',
  LARGE: 'Grande (251-1000)',
  ENTERPRISE: 'Enterprise (1000+)',
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  PROSPECT: 'Prospecto',
  ACTIVE: 'Activa',
  CUSTOMER: 'Cliente',
  PARTNER: 'Partner',
  LOST: 'Perdida',
  INACTIVE: 'Inactiva',
  BLOCKED: 'Bloqueada',
};

export const ACCOUNT_STATUS_VARIANTS: Record<
  AccountStatus,
  'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline'
> = {
  PROSPECT: 'default',
  ACTIVE: 'success',
  CUSTOMER: 'success',
  PARTNER: 'default',
  LOST: 'danger',
  INACTIVE: 'secondary',
  BLOCKED: 'danger',
};

export const SEGMENT_LABELS_EXTENDED: Record<MarketSegment, string> = {
  BANK: 'Banco',
  FINANCE_COMPANY: 'Financiera',
  MICROFINANCE: 'Microfinanciera',
  COOPERATIVE: 'Cooperativa',
  PENSION_FUND: 'Fondo de pensiones',
  INSURANCE: 'Aseguradora',
  FINTECH: 'Fintech',
  RETAIL: 'Retail',
  CONSULTING: 'Consultoría',
  OTHER: 'Otro',
};

export function formatMoney(value: number | string | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatMoneyCompact(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  let formatted: string;
  if (abs >= 1_000_000) formatted = `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  else if (abs >= 1_000) formatted = `${Math.round(value / 1_000)}k`;
  else formatted = value.toFixed(0);
  const symbol = currency === 'USD' ? '$' : '';
  return `${symbol}${formatted}`;
}

export const PRODUCT_CARD_COLORS: Record<string, { bg: string; text: string }> = {
  SAF_PLUS: { bg: '#FEE2E2', text: '#B91C1C' },
  FILEMASTER: { bg: '#E0E7FF', text: '#3730A3' },
  FACTORAJE_ONCLOUD: { bg: '#D1FAE5', text: '#065F46' },
  SYSDE_PENSION: { bg: '#FEF3C7', text: '#92400E' },
  SENTINEL_PLD: { bg: '#FCE7F3', text: '#BE185D' },
  CUSTOM: { bg: '#F3F4F6', text: '#4B5563' },
};
