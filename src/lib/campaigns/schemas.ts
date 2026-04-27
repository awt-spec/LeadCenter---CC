import { z } from 'zod';

export const CAMPAIGN_TYPES = [
  'EMAIL_DRIP',
  'COLD_OUTBOUND',
  'WEBINAR',
  'EVENT',
  'REFERRAL',
  'CONTENT',
  'PARTNER',
  'PAID_ADS',
  'MIXED',
] as const;

export const CAMPAIGN_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED',
] as const;

export const CAMPAIGN_GOALS = [
  'AWARENESS',
  'LEAD_GEN',
  'CONVERSION',
  'RETENTION',
  'REFERRAL',
  'EVENT_REGISTRATION',
] as const;

export const CAMPAIGN_STEP_TYPES = [
  'EMAIL',
  'WAIT',
  'CALL',
  'TASK',
  'LINKEDIN',
  'WHATSAPP',
  'EVENT_INVITE',
  'BRANCH',
] as const;

export const campaignFormSchema = z.object({
  name: z.string().min(2, 'Nombre obligatorio').max(120),
  code: z.string().max(40).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(CAMPAIGN_TYPES).default('MIXED'),
  status: z.enum(CAMPAIGN_STATUSES).default('DRAFT'),
  goal: z.enum(CAMPAIGN_GOALS).default('LEAD_GEN'),
  targetSegment: z
    .enum([
      'BANK',
      'FINANCE_COMPANY',
      'MICROFINANCE',
      'COOPERATIVE',
      'PENSION_FUND',
      'INSURANCE',
      'FINTECH',
      'RETAIL',
      'CONSULTING',
      'OTHER',
    ])
    .optional()
    .nullable(),
  targetCountry: z.string().max(80).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  budget: z.number().nonnegative().optional().nullable(),
  spent: z.number().nonnegative().optional().nullable(),
  currency: z.string().min(3).max(3).default('USD'),
  ownerId: z.string().optional().nullable(),
});

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;

export const campaignStepFormSchema = z.object({
  campaignId: z.string(),
  order: z.number().int().min(0),
  type: z.enum(CAMPAIGN_STEP_TYPES),
  name: z.string().min(2).max(120),
  delayDays: z.number().int().min(0).default(0),
  emailSubject: z.string().max(200).optional().nullable(),
  emailBody: z.string().optional().nullable(),
  callScript: z.string().optional().nullable(),
  taskTitle: z.string().max(200).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CampaignStepFormValues = z.infer<typeof campaignStepFormSchema>;

export const campaignFilterSchema = z.object({
  q: z.string().optional(),
  status: z.array(z.enum(CAMPAIGN_STATUSES)).optional(),
  type: z.array(z.enum(CAMPAIGN_TYPES)).optional(),
  ownerId: z.array(z.string()).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export type CampaignFilters = z.infer<typeof campaignFilterSchema>;
