import type { ActivityType, NextActionType } from '@prisma/client';
import type { LucideIcon } from 'lucide-react';
import {
  Phone,
  Mail,
  MessageCircle,
  Users,
  Presentation,
  Code2,
  FileText,
  FileCheck,
  StickyNote,
  HelpCircle,
} from 'lucide-react';

export type TemplateFieldType = 'text' | 'textarea' | 'list' | 'structured';

export type TemplateSection = {
  key: string;
  label: string;
  placeholder?: string;
  required: boolean;
  type: TemplateFieldType;
  helpText?: string;
};

export type ActivityTemplate = {
  key: string;
  type: ActivityType;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  sections: TemplateSection[];
  defaultNextAction?: NextActionType;
  requiresNextAction: boolean;
  requiresParticipants: boolean;
};

export const ACTIVITY_TEMPLATES: Record<string, ActivityTemplate> = {
  discovery_meeting: {
    key: 'discovery_meeting',
    type: 'MEETING',
    name: 'Reunión de indagación',
    description: 'Descubre necesidades y contexto del cliente',
    icon: Users,
    color: '#3B82F6',
    sections: [
      {
        key: 'context',
        label: 'Contexto del cliente',
        type: 'textarea',
        required: true,
        placeholder: 'Empresa, industria, tamaño, momento que atraviesan…',
      },
      {
        key: 'project_type',
        label: 'Tipo de proyecto',
        type: 'textarea',
        required: true,
        placeholder: '¿Qué están buscando exactamente?',
      },
      {
        key: 'client_need',
        label: 'Necesidad del cliente',
        type: 'list',
        required: true,
        helpText: 'Listar puntos de dolor específicos',
      },
      {
        key: 'selection_process',
        label: 'Proceso de selección',
        type: 'textarea',
        required: false,
        placeholder: '¿Hay RFP? ¿Evalúan más opciones? ¿Quién decide? ¿Timeline?',
      },
      {
        key: 'commitments_sysde',
        label: 'Compromisos de SYSDE',
        type: 'list',
        required: true,
      },
      {
        key: 'commitments_client',
        label: 'Compromisos del cliente',
        type: 'list',
        required: true,
      },
    ],
    defaultNextAction: 'MEETING',
    requiresNextAction: true,
    requiresParticipants: true,
  },

  demo_executive: {
    key: 'demo_executive',
    type: 'DEMO',
    name: 'Demo ejecutiva',
    description: 'Presentación de alto nivel a stakeholders',
    icon: Presentation,
    color: '#8B5CF6',
    sections: [
      { key: 'attendees_summary', label: 'Asistentes y roles', type: 'textarea', required: true },
      { key: 'modules_shown', label: 'Módulos mostrados', type: 'list', required: true },
      {
        key: 'client_reactions',
        label: 'Reacciones del cliente',
        type: 'textarea',
        required: true,
        placeholder: 'Qué resonó, qué les gustó, qué cuestionaron',
      },
      { key: 'questions_raised', label: 'Preguntas abiertas', type: 'list', required: false },
      { key: 'objections', label: 'Objeciones', type: 'list', required: false },
      {
        key: 'next_steps_agreed',
        label: 'Siguientes pasos acordados',
        type: 'list',
        required: true,
      },
    ],
    defaultNextAction: 'SEND_PROPOSAL',
    requiresNextAction: true,
    requiresParticipants: true,
  },

  demo_technical: {
    key: 'demo_technical',
    type: 'DEMO',
    name: 'Demo técnica',
    description: 'Evaluación técnica con consultor SYSDE',
    icon: Code2,
    color: '#10B981',
    sections: [
      { key: 'attendees_summary', label: 'Asistentes técnicos', type: 'textarea', required: true },
      { key: 'consultant_lead', label: 'Consultor SYSDE a cargo', type: 'text', required: true },
      { key: 'modules_shown', label: 'Módulos técnicos cubiertos', type: 'list', required: true },
      {
        key: 'gaps_identified',
        label: 'Gaps identificados',
        type: 'list',
        required: false,
        helpText: 'Funcionalidades pedidas que SAF+ no tiene',
      },
      {
        key: 'technical_questions',
        label: 'Preguntas técnicas abiertas',
        type: 'list',
        required: false,
      },
      {
        key: 'recommendation',
        label: 'Recomendación del consultor',
        type: 'textarea',
        required: true,
        placeholder: 'avanzar / no-go / más discovery',
      },
    ],
    defaultNextAction: 'INTERNAL_TASK',
    requiresNextAction: true,
    requiresParticipants: true,
  },

  call_quick: {
    key: 'call_quick',
    type: 'CALL',
    name: 'Llamada',
    description: 'Registra una llamada rápida',
    icon: Phone,
    color: '#F59E0B',
    sections: [
      {
        key: 'summary',
        label: 'Resumen de la llamada',
        type: 'textarea',
        required: true,
        placeholder: 'De qué se habló, qué se acordó',
      },
    ],
    defaultNextAction: 'EMAIL',
    requiresNextAction: true,
    requiresParticipants: false,
  },

  whatsapp_exchange: {
    key: 'whatsapp_exchange',
    type: 'WHATSAPP',
    name: 'Intercambio por WhatsApp',
    description: 'Conversación por WhatsApp con el cliente',
    icon: MessageCircle,
    color: '#10B981',
    sections: [
      {
        key: 'summary',
        label: 'Resumen de la conversación',
        type: 'textarea',
        required: true,
      },
    ],
    defaultNextAction: 'WHATSAPP',
    requiresNextAction: true,
    requiresParticipants: false,
  },

  email_sent: {
    key: 'email_sent',
    type: 'EMAIL_SENT',
    name: 'Email enviado',
    description: 'Registra un correo enviado al cliente',
    icon: Mail,
    color: '#64748B',
    sections: [
      { key: 'subject', label: 'Asunto', type: 'text', required: true },
      { key: 'body', label: 'Contenido', type: 'textarea', required: true },
    ],
    defaultNextAction: 'WAIT_FOR_CLIENT',
    requiresNextAction: false,
    requiresParticipants: false,
  },

  material_sent: {
    key: 'material_sent',
    type: 'MATERIAL_SENT',
    name: 'Envío de material',
    description: 'Colaterales, fichas, casos de estudio',
    icon: FileText,
    color: '#3B82F6',
    sections: [
      { key: 'materials', label: 'Materiales enviados', type: 'list', required: true },
      { key: 'notes', label: 'Notas', type: 'textarea', required: false },
    ],
    defaultNextAction: 'EMAIL',
    requiresNextAction: false,
    requiresParticipants: false,
  },

  proposal_sent: {
    key: 'proposal_sent',
    type: 'PROPOSAL_SENT',
    name: 'Propuesta enviada',
    description: 'Registra el envío formal de la propuesta',
    icon: FileCheck,
    color: '#C8200F',
    sections: [
      {
        key: 'proposal_version',
        label: 'Versión de propuesta',
        type: 'text',
        required: true,
        placeholder: 'v1, v2 final, etc.',
      },
      { key: 'commercial_model', label: 'Modelo comercial', type: 'text', required: true },
      { key: 'amount', label: 'Monto', type: 'text', required: true },
      { key: 'valid_until', label: 'Válida hasta', type: 'text', required: false },
      { key: 'notes', label: 'Notas internas', type: 'textarea', required: false },
    ],
    defaultNextAction: 'EMAIL',
    requiresNextAction: true,
    requiresParticipants: false,
  },

  internal_note: {
    key: 'internal_note',
    type: 'INTERNAL_NOTE',
    name: 'Nota interna',
    description: 'Observación no visible al cliente',
    icon: StickyNote,
    color: '#94A3B8',
    sections: [
      {
        key: 'note',
        label: 'Nota',
        type: 'textarea',
        required: true,
        placeholder: 'Observación interna, no visible al cliente',
      },
    ],
    requiresNextAction: false,
    requiresParticipants: false,
  },

  consul_internal: {
    key: 'consul_internal',
    type: 'INTERNAL_NOTE',
    name: 'Consulta al equipo',
    description: 'Pregunta interna con @menciones',
    icon: HelpCircle,
    color: '#F59E0B',
    sections: [
      {
        key: 'question',
        label: 'Consulta',
        type: 'textarea',
        required: true,
        helpText: 'Usa @ para mencionar a quien debe responder',
      },
    ],
    requiresNextAction: false,
    requiresParticipants: false,
  },
};

export const TEMPLATE_LIST = Object.values(ACTIVITY_TEMPLATES);

export function getTemplate(key: string | null | undefined): ActivityTemplate | null {
  if (!key) return null;
  return ACTIVITY_TEMPLATES[key] ?? null;
}
