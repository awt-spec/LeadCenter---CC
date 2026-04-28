import { z } from 'zod';
import {
  ContactSource,
  ContactStatus,
  MarketSegment,
  ProductInterest,
  SeniorityLevel,
  DedupeStrategy,
} from '@prisma/client';

export const contactSourceEnum = z.nativeEnum(ContactSource);
export const contactStatusEnum = z.nativeEnum(ContactStatus);
export const marketSegmentEnum = z.nativeEnum(MarketSegment);
export const productInterestEnum = z.nativeEnum(ProductInterest);
export const seniorityLevelEnum = z.nativeEnum(SeniorityLevel);
export const dedupeStrategyEnum = z.nativeEnum(DedupeStrategy);

const optionalString = z
  .union([z.string(), z.literal('')])
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : null));

const optionalUrl = z
  .union([z.string().url({ message: 'URL inválida' }), z.literal('')])
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : null));

export const contactFormSchema = z.object({
  email: z.string().email('Email inválido'),
  firstName: z.string().min(1, 'Nombre requerido').max(80),
  lastName: z.string().min(1, 'Apellido requerido').max(80),

  jobTitle: optionalString,
  department: optionalString,
  seniorityLevel: seniorityLevelEnum.default('UNKNOWN'),

  companyName: optionalString,
  accountId: z.string().optional().nullable(),

  country: optionalString,
  city: optionalString,
  timezone: optionalString,

  phone: optionalString,
  mobilePhone: optionalString,
  linkedinUrl: optionalUrl,
  website: optionalUrl,

  source: contactSourceEnum.default('UNKNOWN'),
  sourceDetail: optionalString,
  status: contactStatusEnum.default('ACTIVE'),
  ownerId: z.string().optional().nullable(),

  marketSegment: marketSegmentEnum.optional().nullable(),
  productInterest: z.array(productInterestEnum).default([]),

  optIn: z.boolean().default(false),
  doNotContact: z.boolean().default(false),

  notes: optionalString,

  tagIds: z.array(z.string()).default([]),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const contactFilterSchema = z.object({
  q: z.string().optional(),
  country: z.array(z.string()).optional(),
  status: z.array(contactStatusEnum).optional(),
  source: z.array(contactSourceEnum).optional(),
  ownerId: z.array(z.string()).optional(),
  marketSegment: z.array(marketSegmentEnum).optional(),
  productInterest: z.array(productInterestEnum).optional(),
  tagIds: z.array(z.string()).optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  importBatchId: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(10000).default(50),
  sortBy: z.string().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type ContactFilters = z.infer<typeof contactFilterSchema>;

export const bulkUpdateSchema = z.object({
  contactIds: z.array(z.string().min(1)).min(1),
  action: z.enum(['assign_owner', 'add_tags', 'change_status', 'delete']),
  ownerId: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional(),
  status: contactStatusEnum.optional(),
});

export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;

export const importOptionsSchema = z.object({
  fileName: z.string().min(1),
  fileSize: z.number().int().min(1),
  columnMapping: z.record(z.string()),
  dedupeStrategy: dedupeStrategyEnum.default('SKIP'),
  defaultOwnerId: z.string().optional().nullable(),
  defaultSource: contactSourceEnum.default('CSV_IMPORT'),
  defaultStatus: contactStatusEnum.default('ACTIVE'),
  applyTagIds: z.array(z.string()).default([]),
  markOptIn: z.boolean().default(false),
  rows: z.array(z.record(z.string())).min(1),
});

export type ImportOptionsInput = z.infer<typeof importOptionsSchema>;

export const IMPORT_FIELD_KEYS = [
  'email',
  'firstName',
  'lastName',
  'companyName',
  'jobTitle',
  'seniorityLevel',
  'country',
  'city',
  'phone',
  'mobilePhone',
  'linkedinUrl',
  'website',
  'source',
  'sourceDetail',
  'marketSegment',
  'notes',
  'tags',
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELD_KEYS)[number];

export const REQUIRED_IMPORT_FIELDS: ImportFieldKey[] = ['email', 'firstName', 'lastName'];
