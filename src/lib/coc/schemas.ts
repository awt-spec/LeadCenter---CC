import { z } from 'zod';

export const AUDIENCES = ['INTERNAL', 'PROSPECT', 'FINANCE', 'TECHNICAL', 'EXECUTIVE'] as const;
export type Audience = typeof AUDIENCES[number];

export const LINK_TYPES = [
  'PRESENTATION',
  'DOCUMENT',
  'SPREADSHEET',
  'LOVABLE',
  'FIGMA',
  'VIDEO',
  'WEBSITE',
  'REPO',
  'OTHER',
] as const;
export type LinkType = typeof LINK_TYPES[number];

// Update top-level strategy fields.
export const cocStrategySchema = z.object({
  accountId: z.string().min(1),
  headline: z.string().trim().max(200).optional().nullable(),
  strategy: z.string().trim().max(10000).optional().nullable(),
  goals: z.string().trim().max(10000).optional().nullable(),
  risks: z.string().trim().max(10000).optional().nullable(),
  nextSteps: z.string().trim().max(10000).optional().nullable(),
});
export type CocStrategyInput = z.infer<typeof cocStrategySchema>;

// Update one audience version.
export const cocVersionSchema = z.object({
  accountId: z.string().min(1),
  audience: z.enum(AUDIENCES),
  body: z.string().max(20000).optional().nullable(),
});
export type CocVersionInput = z.infer<typeof cocVersionSchema>;

// Add a link.
export const cocLinkCreateSchema = z.object({
  accountId: z.string().min(1),
  url: z.string().url('URL inválida').max(2000),
  title: z.string().trim().min(1, 'Título requerido').max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  type: z.enum(LINK_TYPES).optional(),
  audience: z.enum(AUDIENCES).optional().nullable(),
});
export type CocLinkCreateInput = z.infer<typeof cocLinkCreateSchema>;

// Update an existing link.
export const cocLinkUpdateSchema = z.object({
  linkId: z.string().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  type: z.enum(LINK_TYPES).optional(),
  audience: z.enum(AUDIENCES).optional().nullable(),
});
export type CocLinkUpdateInput = z.infer<typeof cocLinkUpdateSchema>;

// URL preview request.
export const cocPreviewSchema = z.object({
  url: z.string().url().max(2000),
});

export const AUDIENCE_LABELS: Record<Audience, string> = {
  INTERNAL: 'Interno',
  PROSPECT: 'Prospecto',
  FINANCE: 'Finanzas',
  TECHNICAL: 'Técnico',
  EXECUTIVE: 'Ejecutivo',
};

export const AUDIENCE_DESCRIPTIONS: Record<Audience, string> = {
  INTERNAL: 'Versión interna completa — todo el equipo de LeadCenter',
  PROSPECT: 'Lo que le contaríamos al cliente / lo que sabe del proyecto',
  FINANCE: 'Para conversaciones con CFO, área financiera, pricing',
  TECHNICAL: 'Para áreas técnicas, integración, operaciones',
  EXECUTIVE: '1-pager para leadership — máxima síntesis',
};

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  PRESENTATION: 'Presentación',
  DOCUMENT: 'Documento',
  SPREADSHEET: 'Hoja de cálculo',
  LOVABLE: 'Lovable',
  FIGMA: 'Figma',
  VIDEO: 'Video',
  WEBSITE: 'Sitio web',
  REPO: 'Repositorio',
  OTHER: 'Otro',
};
