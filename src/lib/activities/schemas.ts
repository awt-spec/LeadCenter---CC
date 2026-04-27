import { z } from 'zod';
import {
  ActivityOutcome,
  ActivityTag,
  ActivityType,
  NextActionType,
} from '@prisma/client';

const optionalString = z
  .union([z.string(), z.literal('')])
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : null));

const dateOrNull = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((v) => {
    if (!v) return null;
    const d = typeof v === 'string' ? new Date(v) : v;
    return Number.isNaN(d.getTime()) ? null : d;
  });

export const activityFormSchema = z
  .object({
    type: z.nativeEnum(ActivityType),
    subtype: optionalString,
    subject: z.string().min(1, 'Asunto requerido').max(160),
    bodyJson: z.unknown().optional().nullable(),
    bodyText: optionalString,
    tags: z.array(z.nativeEnum(ActivityTag)).default([]),

    occurredAt: dateOrNull,
    durationMinutes: z.number().int().positive().optional().nullable(),

    contactId: z.string().optional().nullable(),
    accountId: z.string().optional().nullable(),
    opportunityId: z.string().optional().nullable(),

    participantContactIds: z.array(z.string()).default([]),
    mentionUserIds: z.array(z.string()).default([]),

    nextActionType: z.nativeEnum(NextActionType).optional().nullable(),
    nextActionNote: optionalString,
    nextActionDate: dateOrNull,
    nextActionAssigneeId: z.string().optional().nullable(),

    outcome: z.nativeEnum(ActivityOutcome).optional().nullable(),

    templateKey: optionalString,
  })
  .refine(
    (data) => data.contactId || data.accountId || data.opportunityId,
    { message: 'Debes vincular a un contacto, cuenta u oportunidad', path: ['contactId'] }
  );

export type ActivityFormValues = z.infer<typeof activityFormSchema>;

export const completeNextActionSchema = z.object({
  activityId: z.string().min(1),
});

export const activityFilterSchema = z.object({
  q: z.string().optional(),
  type: z.array(z.nativeEnum(ActivityType)).optional(),
  tags: z.array(z.nativeEnum(ActivityTag)).optional(),
  createdById: z.array(z.string()).optional(),
  contactId: z.string().optional(),
  accountId: z.string().optional(),
  opportunityId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  pendingNextAction: z.boolean().optional(),
  onlyMyMentions: z.boolean().optional(),
  includeSystem: z.boolean().optional().default(false),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export type ActivityFilters = z.infer<typeof activityFilterSchema>;
