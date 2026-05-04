// Email templates for the in-app composer.
// Variables are inserted via {{name}} markers — see substitute() at the bottom.
//
// Categories map to common B2B sales scenarios at SYSDE.

export interface EmailTemplate {
  id: string;
  name: string;
  category: 'intro' | 'followup' | 'demo' | 'proposal' | 'closing';
  subject: string;
  body: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'intro_sysde',
    name: 'Introducción SYSDE',
    category: 'intro',
    subject: 'Hola {{firstName}} — soluciones SYSDE para {{company}}',
    body:
`Buen día {{firstName}},

Soy {{senderName}} de SYSDE Internacional. Vi que en {{company}} están en {{country}} y quería compartirte cómo nuestras soluciones (SAF+, Factoraje OnCloud, FileMaster) están ayudando a otras instituciones financieras de la región.

¿Tendrías 30 minutos esta semana o la próxima para conversar?

Saludos,
{{senderName}}
SYSDE Internacional`,
  },
  {
    id: 'followup_no_response',
    name: 'Follow-up · sin respuesta',
    category: 'followup',
    subject: 'Re: {{lastSubject}}',
    body:
`Hola {{firstName}},

Te dejo este recordatorio por si el correo anterior se perdió en la bandeja. Cualquier comentario o pregunta lo recibo encantado.

¿Te animás a coordinar una llamada corta?

{{senderName}}`,
  },
  {
    id: 'demo_invite',
    name: 'Invitación a demo',
    category: 'demo',
    subject: 'Demo SYSDE — opciones de horario para {{company}}',
    body:
`Hola {{firstName}},

Como conversamos, te paso opciones para una demo de 45 minutos:

  • Martes a las 10:00
  • Miércoles a las 15:00
  • Jueves a las 11:00

Si ninguna te calza, decime un par de bloques que funcionen y los reservo. La demo va a estar enfocada en {{product}} y los casos de uso de {{company}}.

Saludos,
{{senderName}}`,
  },
  {
    id: 'proposal_sent',
    name: 'Propuesta enviada',
    category: 'proposal',
    subject: 'Propuesta SYSDE para {{company}}',
    body:
`Hola {{firstName}},

Tal como acordamos, adjunto la propuesta para {{company}}. Resumen:

  • Solución: {{product}}
  • Modalidad: SaaS / On-Premise (a definir)
  • Tiempo de implementación estimado: 8-12 semanas
  • Inversión: detallada en el documento

Quedo atento a comentarios y preguntas. Si te resulta útil podemos agendar una llamada para repasarla en conjunto.

{{senderName}}`,
  },
  {
    id: 'closing_check',
    name: 'Cierre · estado de decisión',
    category: 'closing',
    subject: 'Estado del proyecto en {{company}}',
    body:
`Hola {{firstName}},

Quería darle un toque a la oportunidad. ¿Cómo está el estado interno de la decisión?

Si necesitan algo de mi lado para destrabar — referencias, ajustes a la propuesta, llamada con el equipo técnico — solo decime.

Saludos,
{{senderName}}`,
  },
];

export const TEMPLATE_CATEGORIES: { key: EmailTemplate['category']; label: string }[] = [
  { key: 'intro', label: 'Introducción' },
  { key: 'followup', label: 'Follow-up' },
  { key: 'demo', label: 'Demo' },
  { key: 'proposal', label: 'Propuesta' },
  { key: 'closing', label: 'Cierre' },
];

/// Replace {{var}} markers with values. Missing variables are left as-is so
/// the user notices them before sending.
export function substitute(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (full, key: string) => {
    const v = vars[key];
    return v ? String(v) : full;
  });
}
