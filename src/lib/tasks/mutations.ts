'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import {
  taskFormSchema,
  taskCommentSchema,
  type TaskFormValues,
  type TaskCommentInput,
  type TaskStatus,
  type TaskPriority,
} from './schemas';

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function requireSession() {
  const s = await auth();
  if (!s?.user?.id) throw new Error('Sesión requerida');
  return s;
}

async function audit(userId: string, action: string, resourceId: string, changes?: unknown) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      resource: 'tasks',
      resourceId,
      changes: (changes ?? null) as Prisma.InputJsonValue,
    },
  });
}

export async function createTask(input: TaskFormValues): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = taskFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const v = parsed.data;

  const lastInColumn = await prisma.task.findFirst({
    where: { accountId: v.accountId ?? undefined, status: v.status, parentTaskId: v.parentTaskId ?? null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (lastInColumn?.position ?? -1) + 1;

  const created = await prisma.task.create({
    data: {
      title: v.title,
      description: v.description || null,
      status: v.status,
      priority: v.priority,
      dueDate: v.dueDate ? new Date(v.dueDate) : null,
      startDate: v.startDate ? new Date(v.startDate) : null,
      accountId: v.accountId || null,
      opportunityId: v.opportunityId || null,
      contactId: v.contactId || null,
      parentTaskId: v.parentTaskId || null,
      tags: v.tags,
      position,
      createdById: session.user.id,
      assignees: {
        create: v.assigneeIds.map((userId) => ({ userId })),
      },
    },
    select: { id: true },
  });

  await audit(session.user.id, 'create', created.id, v);

  // Notify assignees
  for (const uid of v.assigneeIds) {
    if (uid === session.user.id) continue;
    await prisma.notification.create({
      data: {
        userId: uid,
        type: 'ASSIGNED_NEXT_ACTION',
        title: 'Te asignaron una tarea',
        body: v.title,
        link: v.accountId ? `/accounts/${v.accountId}?tab=tasks` : '/',
        isRead: false,
      },
    });
  }

  if (v.accountId) revalidatePath(`/accounts/${v.accountId}`);
  if (v.opportunityId) revalidatePath(`/opportunities/${v.opportunityId}`);
  return { ok: true, data: { id: created.id } };
}

export async function updateTask(id: string, input: Partial<TaskFormValues>): Promise<Result> {
  const session = await requireSession();

  const data: Prisma.TaskUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description || null;
  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === 'DONE') data.completedAt = new Date();
    if (input.status !== 'DONE') data.completedAt = null;
  }
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.startDate !== undefined) data.startDate = input.startDate ? new Date(input.startDate) : null;
  if (input.tags !== undefined) data.tags = input.tags;

  const before = await prisma.task.findUnique({
    where: { id },
    select: { accountId: true, opportunityId: true },
  });

  const updated = await prisma.task.update({ where: { id }, data });

  if (input.assigneeIds !== undefined) {
    await prisma.taskAssignee.deleteMany({ where: { taskId: id } });
    if (input.assigneeIds.length) {
      await prisma.taskAssignee.createMany({
        data: input.assigneeIds.map((userId) => ({ taskId: id, userId })),
        skipDuplicates: true,
      });
    }
  }

  await audit(session.user.id, 'update', id, input);
  if (before?.accountId) revalidatePath(`/accounts/${before.accountId}`);
  if (before?.opportunityId) revalidatePath(`/opportunities/${before.opportunityId}`);
  revalidateTag('tasks');
  return { ok: true, data: undefined };
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<Result> {
  const session = await requireSession();
  const before = await prisma.task.findUnique({
    where: { id },
    select: { accountId: true, status: true },
  });
  if (!before) return { ok: false, error: 'Tarea no encontrada' };

  await prisma.task.update({
    where: { id },
    data: {
      status,
      completedAt: status === 'DONE' ? new Date() : null,
    },
  });

  await audit(session.user.id, 'status_change', id, { from: before.status, to: status });
  if (before.accountId) revalidatePath(`/accounts/${before.accountId}`);
  return { ok: true, data: undefined };
}

export async function setTaskPriority(id: string, priority: TaskPriority): Promise<Result> {
  const session = await requireSession();
  const before = await prisma.task.findUnique({
    where: { id },
    select: { accountId: true, priority: true },
  });
  if (!before) return { ok: false, error: 'Tarea no encontrada' };

  await prisma.task.update({ where: { id }, data: { priority } });
  await audit(session.user.id, 'priority_change', id, { from: before.priority, to: priority });

  if (before.accountId) revalidatePath(`/accounts/${before.accountId}`);
  return { ok: true, data: undefined };
}

export async function deleteTask(id: string): Promise<Result> {
  const session = await requireSession();
  const before = await prisma.task.findUnique({
    where: { id },
    select: { accountId: true },
  });
  await prisma.task.delete({ where: { id } });
  await audit(session.user.id, 'delete', id);
  if (before?.accountId) revalidatePath(`/accounts/${before.accountId}`);
  return { ok: true, data: undefined };
}

export async function addTaskComment(input: TaskCommentInput): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  const parsed = taskCommentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const c = await prisma.taskComment.create({
    data: { taskId: parsed.data.taskId, userId: session.user.id, body: parsed.data.body },
    select: { id: true, taskId: true, task: { select: { accountId: true } } },
  });

  await audit(session.user.id, 'comment_add', parsed.data.taskId);
  if (c.task.accountId) revalidatePath(`/accounts/${c.task.accountId}`);
  return { ok: true, data: { id: c.id } };
}

export async function deleteTaskComment(id: string): Promise<Result> {
  const session = await requireSession();
  const c = await prisma.taskComment.findUnique({
    where: { id },
    select: { userId: true, task: { select: { accountId: true } } },
  });
  if (!c) return { ok: false, error: 'Comentario no encontrado' };
  if (c.userId !== session.user.id) return { ok: false, error: 'Solo el autor puede borrar' };

  await prisma.taskComment.delete({ where: { id } });
  if (c.task.accountId) revalidatePath(`/accounts/${c.task.accountId}`);
  return { ok: true, data: undefined };
}

export async function addTaskAttachment(
  taskId: string,
  fileName: string,
  fileUrl: string
): Promise<Result> {
  const session = await requireSession();
  const t = await prisma.task.findUnique({ where: { id: taskId }, select: { accountId: true } });
  if (!t) return { ok: false, error: 'Tarea no encontrada' };

  await prisma.taskAttachment.create({
    data: { taskId, fileName, fileUrl, uploadedById: session.user.id },
  });

  await audit(session.user.id, 'attachment_add', taskId, { fileName });
  if (t.accountId) revalidatePath(`/accounts/${t.accountId}`);
  return { ok: true, data: undefined };
}

export async function deleteTaskAttachment(id: string): Promise<Result> {
  const session = await requireSession();
  const a = await prisma.taskAttachment.findUnique({
    where: { id },
    select: { task: { select: { accountId: true } } },
  });
  await prisma.taskAttachment.delete({ where: { id } });
  await audit(session.user.id, 'attachment_delete', id);
  if (a?.task.accountId) revalidatePath(`/accounts/${a.task.accountId}`);
  return { ok: true, data: undefined };
}
