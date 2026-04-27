import { z } from 'zod';
import {
  CommercialModel,
  ContactRole,
  ContactSource,
  LostReason,
  OpportunityRating,
  OpportunityStage,
  OpportunityStatus,
  SysdeProduct,
  SysdeSubProduct,
} from '@prisma/client';

const optionalString = z
  .union([z.string(), z.literal('')])
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : null));

const numberOrNull = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  });

const dateOrNull = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((v) => {
    if (!v) return null;
    const d = typeof v === 'string' ? new Date(v) : v;
    return Number.isNaN(d.getTime()) ? null : d;
  });

export const opportunityFormSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200),
  code: optionalString,
  accountId: z.string().min(1, 'Cuenta requerida'),
  product: z.nativeEnum(SysdeProduct),
  subProduct: z.nativeEnum(SysdeSubProduct).optional().nullable(),
  stage: z.nativeEnum(OpportunityStage).default('LEAD'),
  status: z.nativeEnum(OpportunityStatus).default('OPEN'),
  rating: z.nativeEnum(OpportunityRating).default('UNSCORED'),
  probability: z.number().int().min(0).max(100).default(10),
  estimatedValue: numberOrNull,
  currency: z.string().default('USD'),
  commercialModel: z.nativeEnum(CommercialModel).default('UNDEFINED'),
  portfolioAmount: numberOrNull,
  userCount: numberOrNull,
  annualOperations: numberOrNull,
  clientCount: numberOrNull,
  officeCount: numberOrNull,
  expectedCloseDate: dateOrNull,
  nextActionDate: dateOrNull,
  nextActionNote: optionalString,
  source: z.nativeEnum(ContactSource).default('UNKNOWN'),
  sourceDetail: optionalString,
  isDirectProspecting: z.boolean().default(false),
  referredById: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  description: optionalString,
  internalNotes: optionalString,
});

export type OpportunityFormValues = z.infer<typeof opportunityFormSchema>;

export const stageChangeSchema = z.object({
  toStage: z.nativeEnum(OpportunityStage),
  notes: optionalString,
  lostReason: z.nativeEnum(LostReason).optional(),
  lostReasonDetail: optionalString,
  competitorWon: optionalString,
  wonReason: optionalString,
});

export type StageChangeInput = z.infer<typeof stageChangeSchema>;

export const contactRoleSchema = z.object({
  contactId: z.string().min(1),
  role: z.nativeEnum(ContactRole),
  isPrimary: z.boolean().default(false),
  notes: optionalString,
});

export type ContactRoleInput = z.infer<typeof contactRoleSchema>;

export const opportunityFilterSchema = z.object({
  q: z.string().optional(),
  stage: z.array(z.nativeEnum(OpportunityStage)).optional(),
  status: z.array(z.nativeEnum(OpportunityStatus)).optional(),
  product: z.array(z.nativeEnum(SysdeProduct)).optional(),
  subProduct: z.array(z.nativeEnum(SysdeSubProduct)).optional(),
  rating: z.array(z.nativeEnum(OpportunityRating)).optional(),
  ownerId: z.array(z.string()).optional(),
  country: z.array(z.string()).optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  closeFrom: z.string().optional(),
  closeTo: z.string().optional(),
  onlyMine: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
  sortBy: z.string().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type OpportunityFilters = z.infer<typeof opportunityFilterSchema>;
