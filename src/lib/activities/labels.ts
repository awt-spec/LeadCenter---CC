import {
  ActivityOutcome,
  ActivityTag,
  ActivityType,
  NextActionType,
  NotificationType,
} from '@prisma/client';
import type { LucideIcon } from 'lucide-react';
import {
  Phone,
  Mail,
  MessageCircle,
  Users,
  Presentation,
  FileText,
  FileCheck,
  StickyNote,
  ListTodo,
  ArrowRight,
  UserPlus,
  RefreshCw,
  Paperclip,
  Linkedin,
  Calendar,
  Send,
  Clock,
  HelpCircle,
  AlertOctagon,
  Bell,
  TrendingUp,
  Archive,
  Inbox,
} from 'lucide-react';

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CALL: 'Llamada',
  EMAIL_SENT: 'Email enviado',
  EMAIL_RECEIVED: 'Email recibido',
  WHATSAPP: 'WhatsApp',
  MEETING: 'Reunión',
  DEMO: 'Demo',
  MATERIAL_SENT: 'Material enviado',
  PROPOSAL_SENT: 'Propuesta enviada',
  INTERNAL_NOTE: 'Nota interna',
  TASK: 'Tarea',
  STAGE_CHANGE: 'Cambio de fase',
  CONTACT_LINKED: 'Contacto vinculado',
  STATUS_CHANGE: 'Cambio de estado',
  FILE_SHARED: 'Archivo compartido',
  LINKEDIN_MESSAGE: 'LinkedIn',
  EVENT_ATTENDED: 'Evento',
};

export const ACTIVITY_TYPE_ICONS: Record<ActivityType, LucideIcon> = {
  CALL: Phone,
  EMAIL_SENT: Send,
  EMAIL_RECEIVED: Mail,
  WHATSAPP: MessageCircle,
  MEETING: Users,
  DEMO: Presentation,
  MATERIAL_SENT: FileText,
  PROPOSAL_SENT: FileCheck,
  INTERNAL_NOTE: StickyNote,
  TASK: ListTodo,
  STAGE_CHANGE: ArrowRight,
  CONTACT_LINKED: UserPlus,
  STATUS_CHANGE: RefreshCw,
  FILE_SHARED: Paperclip,
  LINKEDIN_MESSAGE: Linkedin,
  EVENT_ATTENDED: Calendar,
};

export const ACTIVITY_TYPE_COLORS: Record<ActivityType, string> = {
  CALL: '#F59E0B',
  EMAIL_SENT: '#64748B',
  EMAIL_RECEIVED: '#64748B',
  WHATSAPP: '#10B981',
  MEETING: '#3B82F6',
  DEMO: '#8B5CF6',
  MATERIAL_SENT: '#3B82F6',
  PROPOSAL_SENT: '#C8200F',
  INTERNAL_NOTE: '#94A3B8',
  TASK: '#C8200F',
  STAGE_CHANGE: '#64748B',
  CONTACT_LINKED: '#64748B',
  STATUS_CHANGE: '#64748B',
  FILE_SHARED: '#3B82F6',
  LINKEDIN_MESSAGE: '#0A66C2',
  EVENT_ATTENDED: '#EC4899',
};

export const ACTIVITY_TAG_LABELS: Record<ActivityTag, string> = {
  BL: 'Bloqueo',
  INFO: 'Información',
  CONSUL: 'Consulta',
  SOLIC: 'Solicitud',
  URGENT: 'Urgente',
  FOLLOWUP: 'Follow-up',
  WIN_SIGNAL: 'Señal positiva',
  RISK_SIGNAL: 'Señal de riesgo',
};

export const ACTIVITY_TAG_COLORS: Record<ActivityTag, { bg: string; text: string }> = {
  BL: { bg: '#FEE2E2', text: '#B91C1C' },
  INFO: { bg: '#DBEAFE', text: '#1E40AF' },
  CONSUL: { bg: '#FEF3C7', text: '#92400E' },
  SOLIC: { bg: '#EDE9FE', text: '#5B21B6' },
  URGENT: { bg: '#FECACA', text: '#991B1B' },
  FOLLOWUP: { bg: '#F1F5F9', text: '#475569' },
  WIN_SIGNAL: { bg: '#D1FAE5', text: '#065F46' },
  RISK_SIGNAL: { bg: '#FFEDD5', text: '#9A3412' },
};

export const ACTIVITY_OUTCOME_LABELS: Record<ActivityOutcome, string> = {
  POSITIVE: 'Positivo',
  NEUTRAL: 'Neutro',
  NEGATIVE: 'Negativo',
  BLOCKER: 'Bloqueador',
  NO_RESPONSE: 'Sin respuesta',
};

export const ACTIVITY_OUTCOME_COLORS: Record<ActivityOutcome, string> = {
  POSITIVE: '#10B981',
  NEUTRAL: '#94A3B8',
  NEGATIVE: '#F59E0B',
  BLOCKER: '#EF4444',
  NO_RESPONSE: '#64748B',
};

export const NEXT_ACTION_TYPE_LABELS: Record<NextActionType, string> = {
  CALL: 'Llamada',
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  MEETING: 'Reunión',
  DEMO: 'Demo',
  SEND_PROPOSAL: 'Enviar propuesta',
  SEND_MATERIAL: 'Enviar material',
  INTERNAL_TASK: 'Tarea interna',
  WAIT_FOR_CLIENT: 'Esperar al cliente',
  OTHER: 'Otra',
};

export const NEXT_ACTION_TYPE_ICONS: Record<NextActionType, LucideIcon> = {
  CALL: Phone,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  MEETING: Users,
  DEMO: Presentation,
  SEND_PROPOSAL: FileCheck,
  SEND_MATERIAL: FileText,
  INTERNAL_TASK: ListTodo,
  WAIT_FOR_CLIENT: Clock,
  OTHER: HelpCircle,
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  MENTION: 'Mención',
  ASSIGNED_NEXT_ACTION: 'Acción asignada',
  NEXT_ACTION_DUE: 'Acción vencida',
  OPPORTUNITY_STALE: 'Oportunidad inactiva',
  STAGE_CHANGED: 'Cambio de fase',
  CONTACT_ASSIGNED: 'Contacto asignado',
  SYSTEM: 'Sistema',
};

export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  MENTION: UserPlus,
  ASSIGNED_NEXT_ACTION: ListTodo,
  NEXT_ACTION_DUE: AlertOctagon,
  OPPORTUNITY_STALE: Archive,
  STAGE_CHANGED: TrendingUp,
  CONTACT_ASSIGNED: UserPlus,
  SYSTEM: Bell,
};

export { Inbox };
