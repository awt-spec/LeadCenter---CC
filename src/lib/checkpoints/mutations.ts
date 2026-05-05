'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { can } from '@/lib/rbac';
import type { CheckpointType, CheckpointPriority } from '@prisma/client';

interface CreateInput {
  opportunityId: string;
  label: string;
  description?: string | null;
  type?: CheckpointType;
  priority?: CheckpointPriority;
  dueDate?: string | null; // ISO date
  assigneeId?: string | null;
}

export async function createCheckpoint(input: CreateInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Unauthorized' };
  if (!can(session, 'opportunities:update:all') && !can(session, 'opportunities:update:own')) {
    return { ok: false, error: 'Forbidden' };
  }
  const label = (input.label ?? '').trim();
  if (!label) return { ok: false, error: 'El label es obligatorio' };

  // Verify the opp exists + RBAC scope
  const opp = await prisma.opportunity.findUnique({
    where: { id: input.opportunityId },
    select: { id: true, ownerId: true, accountId: true },
  });
  if (!opp) return { ok: false, error: 'Oportunidad no encontrada' };
  if (!can(session, 'opportunities:update:all') && opp.ownerId !== session.user.id) {
    return { ok: false, error: 'Forbidden' };
  }

  const created = await prisma.opportunityCheckpoint.create({
    data: {
      opportunityId: input.opportunityId,
      label: label.slice(0, 200),
      description: input.description?.slice(0, 5000) || null,
      type: input.type ?? 'MILESTONE',
      priority: input.priority ?? 'NORMAL',
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      assigneeId: input.assigneeId || null,
      createdById: session.user.id,
    },
    select: { id: true },
  });
  revalidatePath(`/opportunities/${input.opportunityId}`);
  return { ok: true, id: created.id };
}

export async function completeCheckpoint(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Unauthorized' };
  if (!can(session, 'opportunities:update:all') && !can(session, 'opportunities:update:own')) {
    return { ok: false, error: 'Forbidden' };
  }
  const cp = await prisma.opportunityCheckpoint.findUnique({
    where: { id },
    select: { id: true, opportunityId: true, completedAt: true, opportunity: { select: { ownerId: true } } },
  });
  if (!cp) return { ok: false, error: 'Checkpoint no encontrado' };
  if (!can(session, 'opportunities:update:all') && cp.opportunity.ownerId !== session.user.id) {
    return { ok: false, error: 'Forbidden' };
  }
  if (cp.completedAt) return { ok: true }; // Idempotent
  await prisma.opportunityCheckpoint.update({
    where: { id },
    data: { completedAt: new Date(), completedById: session.user.id },
  });
  revalidatePath(`/opportunities/${cp.opportunityId}`);
  return { ok: true };
}

export async function reopenCheckpoint(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Unauthorized' };
  const cp = await prisma.opportunityCheckpoint.findUnique({
    where: { id },
    select: { id: true, opportunityId: true, opportunity: { select: { ownerId: true } } },
  });
  if (!cp) return { ok: false, error: 'Checkpoint no encontrado' };
  if (!can(session, 'opportunities:update:all') && cp.opportunity.ownerId !== session.user.id) {
    return { ok: false, error: 'Forbidden' };
  }
  await prisma.opportunityCheckpoint.update({
    where: { id },
    data: { completedAt: null, completedById: null },
  });
  revalidatePath(`/opportunities/${cp.opportunityId}`);
  return { ok: true };
}

export async function deleteCheckpoint(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Unauthorized' };
  const cp = await prisma.opportunityCheckpoint.findUnique({
    where: { id },
    select: { id: true, opportunityId: true, opportunity: { select: { ownerId: true } } },
  });
  if (!cp) return { ok: false, error: 'Checkpoint no encontrado' };
  if (!can(session, 'opportunities:update:all') && cp.opportunity.ownerId !== session.user.id) {
    return { ok: false, error: 'Forbidden' };
  }
  await prisma.opportunityCheckpoint.delete({ where: { id } });
  revalidatePath(`/opportunities/${cp.opportunityId}`);
  return { ok: true };
}
