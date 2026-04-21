import { z } from 'zod';
import {
  AccountStatus,
  CompanySize,
  MarketSegment,
} from '@prisma/client';

const optionalString = z
  .union([z.string(), z.literal('')])
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : null));

const optionalUrl = z
  .union([z.string().url({ message: 'URL inválida' }), z.literal('')])
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : null));

export const accountFormSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200),
  legalName: optionalString,
  domain: optionalString,
  website: optionalUrl,
  segment: z.nativeEnum(MarketSegment).optional().nullable(),
  industry: optionalString,
  subIndustry: optionalString,
  size: z.nativeEnum(CompanySize).default('UNKNOWN'),
  employeeCount: z
    .union([z.number().int().positive(), z.string().length(0), z.null(), z.undefined()])
    .transform((v) => (typeof v === 'number' ? v : null))
    .optional(),
  annualRevenue: z
    .union([z.number().positive(), z.string().length(0), z.null(), z.undefined()])
    .transform((v) => (typeof v === 'number' ? v : null))
    .optional(),
  currency: z.string().default('USD'),
  country: optionalString,
  region: optionalString,
  city: optionalString,
  address: optionalString,
  status: z.nativeEnum(AccountStatus).default('PROSPECT'),
  ownerId: z.string().optional().nullable(),
  parentAccountId: z.string().optional().nullable(),
  description: optionalString,
  internalNotes: optionalString,
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;

export const accountFilterSchema = z.object({
  q: z.string().optional(),
  country: z.array(z.string()).optional(),
  segment: z.array(z.nativeEnum(MarketSegment)).optional(),
  status: z.array(z.nativeEnum(AccountStatus)).optional(),
  size: z.array(z.nativeEnum(CompanySize)).optional(),
  ownerId: z.array(z.string()).optional(),
  hasActiveOpps: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
  sortBy: z.string().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type AccountFilters = z.infer<typeof accountFilterSchema>;
