import { z } from 'zod';

export const TASK_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE', 'CANCELLED'] as const;
export const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const taskFormSchema = z.object({
  title: z.string().min(2, 'Título obligatorio').max(200),
  description: z.string().max(10000).optional().nullable(),
  status: z.enum(TASK_STATUSES).default('TODO'),
  priority: z.enum(TASK_PRIORITIES).default('NORMAL'),
  dueDate: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  opportunityId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  parentTaskId: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  dependsOnIds: z.array(z.string()).default([]),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const taskCommentSchema = z.object({
  taskId: z.string(),
  body: z.string().min(1).max(5000),
});

export type TaskCommentInput = z.infer<typeof taskCommentSchema>;
