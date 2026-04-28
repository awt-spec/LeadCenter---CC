import { z } from 'zod';

export const CUSTOM_FIELD_TYPES = [
  'TEXT',
  'LONG_TEXT',
  'NUMBER',
  'DATE',
  'BOOLEAN',
  'SELECT',
  'MULTI_SELECT',
  'URL',
  'EMAIL',
  'PHONE',
] as const;

export const CUSTOM_FIELD_ENTITIES = ['CONTACT', 'ACCOUNT', 'OPPORTUNITY'] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];
export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number];

export const customFieldDefinitionSchema = z.object({
  entity: z.enum(CUSTOM_FIELD_ENTITIES),
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, 'Solo minúsculas, números y guion bajo. Empieza con letra.'),
  label: z.string().min(2).max(120),
  type: z.enum(CUSTOM_FIELD_TYPES),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(false),
  position: z.number().int().default(0),
  description: z.string().max(500).optional().nullable(),
});

export type CustomFieldDefinitionInput = z.infer<typeof customFieldDefinitionSchema>;
