export const APP_NAME = 'Lead Center';
export const APP_ORG = 'SYSDE Internacional Inc.';
export const ALLOWED_EMAIL_DOMAIN = 'sysde.com';

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  senior_commercial: 'Comercial Senior',
  sdr: 'SDR / Outbound',
  reviewer: 'Revisor',
  functional_consultant: 'Consultor Funcional',
  external_partner: 'Partner Externo',
};

export const CONTACT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  NURTURE: 'En nutrición',
  COLD: 'Frío',
  DO_NOT_CONTACT: 'No contactar',
  UNSUBSCRIBED: 'Dado de baja',
  BOUNCED: 'Rebotado',
  ARCHIVED: 'Archivado',
};

export const CONTACT_STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline'
> = {
  ACTIVE: 'success',
  NURTURE: 'default',
  COLD: 'secondary',
  DO_NOT_CONTACT: 'danger',
  UNSUBSCRIBED: 'warning',
  BOUNCED: 'warning',
  ARCHIVED: 'outline',
};

export const CONTACT_SOURCE_LABELS: Record<string, string> = {
  UNKNOWN: 'Desconocido',
  WEBSITE_CHAT: 'Chat web',
  WEBSITE_FORM: 'Formulario web',
  LINKEDIN: 'LinkedIn',
  LINKEDIN_INBOUND: 'LinkedIn (inbound)',
  LINKEDIN_OUTBOUND: 'LinkedIn (outbound)',
  EMAIL_INBOUND: 'Email inbound',
  REFERRAL: 'Referido',
  EVENT: 'Evento',
  WEBINAR: 'Webinar',
  OUTBOUND_CAMPAIGN: 'Campaña outbound',
  CSV_IMPORT: 'Import CSV',
  MANUAL: 'Manual',
  PARTNER: 'Partner',
};

export const SENIORITY_LABELS: Record<string, string> = {
  UNKNOWN: 'Desconocido',
  ANALYST: 'Analista',
  MANAGER: 'Gerente',
  DIRECTOR: 'Director',
  VP: 'VP',
  C_LEVEL: 'C-Level',
  OWNER: 'Dueño',
};

export const SEGMENT_LABELS: Record<string, string> = {
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

export const PRODUCT_INTEREST_LABELS: Record<string, string> = {
  SAF_PLUS: 'SAF Plus',
  SAF_LEASING: 'SAF Leasing',
  SAF_FACTORING: 'SAF Factoring',
  FILEMASTER: 'Filemaster',
  FACTORAJE_ONCLOUD: 'Factoraje OnCloud',
  SYSDE_PENSION: 'SYSDE Pension',
  SENTINEL_PLD: 'Sentinel PLD',
};
