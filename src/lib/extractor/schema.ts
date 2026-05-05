// Extractor schema — entities, their queryable fields, and the operators
// each field type accepts. This is the source of truth for both the manual
// UI builder and the AI prompt (the AI is told these are the only fields
// it can use, so it can't hallucinate column names that don't exist).

export type FieldType = 'string' | 'number' | 'date' | 'enum' | 'boolean';

export type Operator =
  | 'eq' | 'ne'
  | 'contains' | 'starts_with' | 'ends_with'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'between'
  | 'in' | 'not_in'
  | 'is_null' | 'is_not_null';

export interface FieldDef {
  label: string;
  type: FieldType;
  /// Path inside Prisma — supports nested via dot, e.g. "account.country".
  /// We translate the path to a Prisma where clause server-side.
  path: string;
  /// For enum types: { value, label } pairs. The value is what's stored.
  options?: Array<{ value: string; label: string }>;
  /// True when this field can be selected as an output column. Some fields
  /// are filter-only (e.g. relations).
  selectable?: boolean;
}

export interface EntityDef {
  label: string;
  /// Prisma model accessor (e.g. 'opportunity', 'account', 'activity').
  model: 'opportunity' | 'account' | 'activity' | 'contact' | 'task';
  /// Fields available for filtering and selection. Key = stable identifier
  /// used in the config and AI output.
  fields: Record<string, FieldDef>;
  /// Default columns selected when the user picks this entity.
  defaultColumns: string[];
  /// Default order by [field, dir].
  defaultOrder: { field: string; dir: 'asc' | 'desc' };
}

const STAGE_OPTIONS = [
  { value: 'LEAD', label: '10% Prospecto' },
  { value: 'DISCOVERY', label: '25% Calificar' },
  { value: 'SIZING', label: '25% Dimensionar' },
  { value: 'DEMO', label: '50% Validar' },
  { value: 'PROPOSAL', label: '75% Decidir' },
  { value: 'NEGOTIATION', label: '90% Negociar' },
  { value: 'CLOSING', label: '100% Firma' },
  { value: 'HANDOFF', label: 'Handoff' },
  { value: 'WON', label: 'Ganado' },
  { value: 'LOST', label: 'Perdido' },
  { value: 'STAND_BY', label: 'Stand-by' },
  { value: 'NURTURE', label: 'Nurture' },
];

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Abierta' },
  { value: 'WON', label: 'Ganada' },
  { value: 'LOST', label: 'Perdida' },
  { value: 'STAND_BY', label: 'Stand-by' },
  { value: 'NURTURE', label: 'Nurture' },
];

const ACCOUNT_STATUS_OPTIONS = [
  { value: 'PROSPECT', label: 'Prospecto' },
  { value: 'ACTIVE', label: 'Activa' },
  { value: 'CUSTOMER', label: 'Cliente' },
  { value: 'PARTNER', label: 'Partner' },
  { value: 'LOST', label: 'Perdida' },
  { value: 'INACTIVE', label: 'Inactiva' },
  { value: 'BLOCKED', label: 'Bloqueada' },
];

const RATING_OPTIONS = [
  { value: 'A_PLUS', label: 'A+' },
  { value: 'A', label: 'A' },
  { value: 'B_PLUS', label: 'B+' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
  { value: 'UNSCORED', label: 'Sin score' },
];

const PRODUCT_OPTIONS = [
  { value: 'SAF_PLUS', label: 'SAF+' },
  { value: 'FILEMASTER', label: 'FileMaster' },
  { value: 'FACTORAJE_ONCLOUD', label: 'Factoraje OnCloud' },
  { value: 'SYSDE_PENSION', label: 'SYSDE Pensión' },
  { value: 'SENTINEL_PLD', label: 'Sentinel / PLD' },
  { value: 'CUSTOM', label: 'Otro' },
];

const SEGMENT_OPTIONS = [
  { value: 'BANK', label: 'Banco' },
  { value: 'FINANCE_COMPANY', label: 'Financiera' },
  { value: 'MICROFINANCE', label: 'Microfinanciera' },
  { value: 'COOPERATIVE', label: 'Cooperativa' },
  { value: 'PENSION_FUND', label: 'Fondo de pensión' },
  { value: 'INSURANCE', label: 'Seguros' },
  { value: 'FINTECH', label: 'Fintech' },
  { value: 'RETAIL', label: 'Retail' },
  { value: 'CONSULTING', label: 'Consultora' },
  { value: 'OTHER', label: 'Otro' },
];

const ACTIVITY_TYPE_OPTIONS = [
  { value: 'CALL', label: 'Llamada' },
  { value: 'EMAIL_SENT', label: 'Email enviado' },
  { value: 'EMAIL_RECEIVED', label: 'Email recibido' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'MEETING', label: 'Reunión' },
  { value: 'DEMO', label: 'Demo' },
  { value: 'PROPOSAL_SENT', label: 'Propuesta enviada' },
  { value: 'MATERIAL_SENT', label: 'Material enviado' },
  { value: 'INTERNAL_NOTE', label: 'Nota interna' },
  { value: 'STAGE_CHANGE', label: 'Cambio de fase' },
  { value: 'FILE_SHARED', label: 'Archivo compartido' },
  { value: 'LINKEDIN_MESSAGE', label: 'LinkedIn' },
];

export const ENTITIES: Record<string, EntityDef> = {
  opportunities: {
    label: 'Oportunidades',
    model: 'opportunity',
    defaultColumns: ['name', 'account.name', 'stage', 'estimatedValue', 'expectedCloseDate', 'owner.name'],
    defaultOrder: { field: 'createdAt', dir: 'desc' },
    fields: {
      'name': { label: 'Nombre', type: 'string', path: 'name', selectable: true },
      'code': { label: 'Código', type: 'string', path: 'code', selectable: true },
      'stage': { label: 'Fase', type: 'enum', path: 'stage', options: STAGE_OPTIONS, selectable: true },
      'status': { label: 'Status', type: 'enum', path: 'status', options: STATUS_OPTIONS, selectable: true },
      'rating': { label: 'Rating', type: 'enum', path: 'rating', options: RATING_OPTIONS, selectable: true },
      'product': { label: 'Producto', type: 'enum', path: 'product', options: PRODUCT_OPTIONS, selectable: true },
      'estimatedValue': { label: 'Valor estimado', type: 'number', path: 'estimatedValue', selectable: true },
      'currency': { label: 'Moneda', type: 'string', path: 'currency', selectable: true },
      'probability': { label: 'Probabilidad %', type: 'number', path: 'probability', selectable: true },
      'expectedCloseDate': { label: 'Cierre esperado', type: 'date', path: 'expectedCloseDate', selectable: true },
      'closedAt': { label: 'Cerrado en', type: 'date', path: 'closedAt', selectable: true },
      'createdAt': { label: 'Creado en', type: 'date', path: 'createdAt', selectable: true },
      'lastActivityAt': { label: 'Última actividad', type: 'date', path: 'lastActivityAt', selectable: true },
      'account.name': { label: 'Cuenta', type: 'string', path: 'account.name', selectable: true },
      'account.country': { label: 'País', type: 'string', path: 'account.country', selectable: true },
      'account.segment': { label: 'Segmento', type: 'enum', path: 'account.segment', options: SEGMENT_OPTIONS, selectable: true },
      'account.industry': { label: 'Industria', type: 'string', path: 'account.industry', selectable: true },
      'owner.name': { label: 'Owner', type: 'string', path: 'owner.name', selectable: true },
      'owner.email': { label: 'Email owner', type: 'string', path: 'owner.email', selectable: true },
      'description': { label: 'Descripción', type: 'string', path: 'description', selectable: true },
    },
  },
  accounts: {
    label: 'Cuentas',
    model: 'account',
    defaultColumns: ['name', 'country', 'segment', 'status', 'owner.name'],
    defaultOrder: { field: 'createdAt', dir: 'desc' },
    fields: {
      'name': { label: 'Nombre', type: 'string', path: 'name', selectable: true },
      'legalName': { label: 'Nombre legal', type: 'string', path: 'legalName', selectable: true },
      'domain': { label: 'Dominio', type: 'string', path: 'domain', selectable: true },
      'website': { label: 'Sitio web', type: 'string', path: 'website', selectable: true },
      'status': { label: 'Status', type: 'enum', path: 'status', options: ACCOUNT_STATUS_OPTIONS, selectable: true },
      'segment': { label: 'Segmento', type: 'enum', path: 'segment', options: SEGMENT_OPTIONS, selectable: true },
      'industry': { label: 'Industria', type: 'string', path: 'industry', selectable: true },
      'country': { label: 'País', type: 'string', path: 'country', selectable: true },
      'city': { label: 'Ciudad', type: 'string', path: 'city', selectable: true },
      'employeeCount': { label: 'Empleados', type: 'number', path: 'employeeCount', selectable: true },
      'annualRevenue': { label: 'Revenue anual', type: 'number', path: 'annualRevenue', selectable: true },
      'createdAt': { label: 'Creada en', type: 'date', path: 'createdAt', selectable: true },
      'owner.name': { label: 'Owner', type: 'string', path: 'owner.name', selectable: true },
      'owner.email': { label: 'Email owner', type: 'string', path: 'owner.email', selectable: true },
    },
  },
  contacts: {
    label: 'Contactos',
    model: 'contact',
    defaultColumns: ['fullName', 'email', 'jobTitle', 'companyName', 'country'],
    defaultOrder: { field: 'createdAt', dir: 'desc' },
    fields: {
      'fullName': { label: 'Nombre completo', type: 'string', path: 'fullName', selectable: true },
      'email': { label: 'Email', type: 'string', path: 'email', selectable: true },
      'phone': { label: 'Teléfono', type: 'string', path: 'phone', selectable: true },
      'mobilePhone': { label: 'Móvil', type: 'string', path: 'mobilePhone', selectable: true },
      'jobTitle': { label: 'Cargo', type: 'string', path: 'jobTitle', selectable: true },
      'companyName': { label: 'Empresa (libre)', type: 'string', path: 'companyName', selectable: true },
      'country': { label: 'País', type: 'string', path: 'country', selectable: true },
      'city': { label: 'Ciudad', type: 'string', path: 'city', selectable: true },
      'linkedinUrl': { label: 'LinkedIn', type: 'string', path: 'linkedinUrl', selectable: true },
      'engagementScore': { label: 'Engagement score', type: 'number', path: 'engagementScore', selectable: true },
      'createdAt': { label: 'Creado en', type: 'date', path: 'createdAt', selectable: true },
      'account.name': { label: 'Cuenta', type: 'string', path: 'account.name', selectable: true },
      'account.country': { label: 'País cuenta', type: 'string', path: 'account.country', selectable: true },
      'account.segment': { label: 'Segmento cuenta', type: 'enum', path: 'account.segment', options: SEGMENT_OPTIONS, selectable: true },
    },
  },
  activities: {
    label: 'Actividades',
    model: 'activity',
    defaultColumns: ['type', 'subject', 'occurredAt', 'account.name', 'createdBy.name'],
    defaultOrder: { field: 'occurredAt', dir: 'desc' },
    fields: {
      'type': { label: 'Tipo', type: 'enum', path: 'type', options: ACTIVITY_TYPE_OPTIONS, selectable: true },
      'subject': { label: 'Asunto', type: 'string', path: 'subject', selectable: true },
      'bodyText': { label: 'Cuerpo', type: 'string', path: 'bodyText', selectable: true },
      'occurredAt': { label: 'Ocurrió en', type: 'date', path: 'occurredAt', selectable: true },
      'durationMinutes': { label: 'Duración (min)', type: 'number', path: 'durationMinutes', selectable: true },
      'account.name': { label: 'Cuenta', type: 'string', path: 'account.name', selectable: true },
      'opportunity.name': { label: 'Oportunidad', type: 'string', path: 'opportunity.name', selectable: true },
      'contact.fullName': { label: 'Contacto', type: 'string', path: 'contact.fullName', selectable: true },
      'createdBy.name': { label: 'Creado por', type: 'string', path: 'createdBy.name', selectable: true },
      'createdAt': { label: 'Creado en', type: 'date', path: 'createdAt', selectable: true },
    },
  },
  tasks: {
    label: 'Tareas',
    model: 'task',
    defaultColumns: ['title', 'status', 'priority', 'dueDate', 'account.name'],
    defaultOrder: { field: 'dueDate', dir: 'asc' },
    fields: {
      'title': { label: 'Título', type: 'string', path: 'title', selectable: true },
      'status': { label: 'Status', type: 'enum', path: 'status', options: [
        { value: 'TODO', label: 'Por hacer' },
        { value: 'IN_PROGRESS', label: 'En progreso' },
        { value: 'BLOCKED', label: 'Bloqueada' },
        { value: 'DONE', label: 'Hecha' },
        { value: 'CANCELLED', label: 'Cancelada' },
      ], selectable: true },
      'priority': { label: 'Prioridad', type: 'enum', path: 'priority', options: [
        { value: 'LOW', label: 'Baja' },
        { value: 'NORMAL', label: 'Normal' },
        { value: 'HIGH', label: 'Alta' },
        { value: 'URGENT', label: 'Urgente' },
      ], selectable: true },
      'dueDate': { label: 'Vence', type: 'date', path: 'dueDate', selectable: true },
      'completedAt': { label: 'Completada', type: 'date', path: 'completedAt', selectable: true },
      'account.name': { label: 'Cuenta', type: 'string', path: 'account.name', selectable: true },
      'opportunity.name': { label: 'Oportunidad', type: 'string', path: 'opportunity.name', selectable: true },
      'createdBy.name': { label: 'Creada por', type: 'string', path: 'createdBy.name', selectable: true },
      'createdAt': { label: 'Creada en', type: 'date', path: 'createdAt', selectable: true },
    },
  },
};

/// Operadores por tipo de campo. La UI usa esto para mostrar solo lo válido.
export const OPS_BY_TYPE: Record<FieldType, Operator[]> = {
  string: ['eq', 'ne', 'contains', 'starts_with', 'ends_with', 'is_null', 'is_not_null'],
  number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
  date: ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
  enum: ['eq', 'ne', 'in', 'not_in', 'is_null', 'is_not_null'],
  boolean: ['eq'],
};

export const OP_LABELS: Record<Operator, string> = {
  eq: '=', ne: '≠',
  contains: 'contiene', starts_with: 'empieza con', ends_with: 'termina con',
  gt: '>', gte: '≥', lt: '<', lte: '≤',
  between: 'entre', in: 'en', not_in: 'no en',
  is_null: 'está vacío', is_not_null: 'tiene valor',
};

/// One filter row in a config.
export interface FilterRow {
  field: string;
  op: Operator;
  /// For most ops a single scalar; for `between` an array of two; for
  /// `in`/`not_in` an array.
  value?: unknown;
}

/// Full extractor config, persisted/serialised.
export interface ExtractorConfig {
  entity: keyof typeof ENTITIES;
  filters: FilterRow[];
  /// Stable field identifiers (keys of EntityDef.fields).
  columns: string[];
  orderBy?: { field: string; dir: 'asc' | 'desc' };
  limit?: number;
}

export function makeDefaultConfig(entityKey: keyof typeof ENTITIES): ExtractorConfig {
  const entity = ENTITIES[entityKey];
  return {
    entity: entityKey,
    filters: [],
    columns: entity.defaultColumns,
    orderBy: entity.defaultOrder,
    limit: 200,
  };
}
