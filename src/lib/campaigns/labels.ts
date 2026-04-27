export const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  EMAIL_DRIP: 'Email drip',
  COLD_OUTBOUND: 'Outbound frío',
  WEBINAR: 'Webinar',
  EVENT: 'Evento',
  REFERRAL: 'Referido',
  CONTENT: 'Contenido',
  PARTNER: 'Partner',
  PAID_ADS: 'Paid ads',
  MIXED: 'Mixto',
};

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activa',
  PAUSED: 'Pausada',
  COMPLETED: 'Completada',
  ARCHIVED: 'Archivada',
};

export const CAMPAIGN_STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PAUSED: 'bg-amber-50 text-amber-700 ring-amber-200',
  COMPLETED: 'bg-blue-50 text-blue-700 ring-blue-200',
  ARCHIVED: 'bg-neutral-100 text-neutral-500 ring-neutral-200',
};

export const CAMPAIGN_GOAL_LABELS: Record<string, string> = {
  AWARENESS: 'Awareness',
  LEAD_GEN: 'Lead generation',
  CONVERSION: 'Conversión',
  RETENTION: 'Retención',
  REFERRAL: 'Referidos',
  EVENT_REGISTRATION: 'Registro a evento',
};

export const CAMPAIGN_STEP_TYPE_LABELS: Record<string, string> = {
  EMAIL: 'Email',
  WAIT: 'Espera',
  CALL: 'Llamada',
  TASK: 'Tarea',
  LINKEDIN: 'LinkedIn',
  WHATSAPP: 'WhatsApp',
  EVENT_INVITE: 'Invitación a evento',
  BRANCH: 'Bifurcación',
};

export const CAMPAIGN_CONTACT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  PAUSED: 'Pausado',
  COMPLETED: 'Completado',
  UNSUBSCRIBED: 'Dado de baja',
  BOUNCED: 'Rebotado',
  REPLIED: 'Respondió',
  CONVERTED: 'Convertido',
};

export const CAMPAIGN_CONTACT_STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-blue-50 text-blue-700 ring-blue-200',
  PAUSED: 'bg-amber-50 text-amber-700 ring-amber-200',
  COMPLETED: 'bg-slate-100 text-slate-700 ring-slate-200',
  UNSUBSCRIBED: 'bg-red-50 text-red-700 ring-red-200',
  BOUNCED: 'bg-red-50 text-red-700 ring-red-200',
  REPLIED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  CONVERTED: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
};
