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

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  LEAD: 'Lead entrante',
  DISCOVERY: 'Indagación',
  SIZING: 'Dimensionamiento',
  DEMO: 'Demo',
  PROPOSAL: 'Propuesta',
  NEGOTIATION: 'Negociación',
  CLOSING: 'Cierre',
  HANDOFF: 'Handoff',
  WON: 'Ganado',
  LOST: 'Perdido',
  STAND_BY: 'Stand-by',
  NURTURE: 'Nurture pasivo',
};

export const STAGE_COLORS: Record<
  OpportunityStage,
  { bg: string; text: string; border: string }
> = {
  LEAD: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  DISCOVERY: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  SIZING: { bg: '#E0E7FF', text: '#3730A3', border: '#A5B4FC' },
  DEMO: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  PROPOSAL: { bg: '#FFEDD5', text: '#9A3412', border: '#FDBA74' },
  NEGOTIATION: { bg: '#FED7AA', text: '#C2410C', border: '#FB923C' },
  CLOSING: { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' },
  HANDOFF: { bg: '#DDD6FE', text: '#5B21B6', border: '#C4B5FD' },
  WON: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
  LOST: { bg: '#F3F4F6', text: '#4B5563', border: '#D1D5DB' },
  STAND_BY: { bg: '#FEF9C3', text: '#713F12', border: '#FDE047' },
  NURTURE: { bg: '#ECFCCB', text: '#365314', border: '#BEF264' },
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
