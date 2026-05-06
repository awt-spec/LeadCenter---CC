'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit/write';
import {
  opportunityFormSchema,
  type OpportunityFormValues,
  stageChangeSchema,
  type StageChangeInput,
  contactRoleSchema,
  type ContactRoleInput,
} from './schemas';
import { STAGE_PROBABILITY } from './stage-rules';
import { generateOpportunityCode } from './code-generator';

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Sesión requerida');
  return session;
}

async function writeAudit(params: {
  userId: string;
  action: string;
  resourceId?: string;
  changes?: unknown;
  metadata?: unknown;
}) {
  await writeAuditLog({
    userId: params.userId,
    action: params.action,
    resource: 'opportunities',
    resourceId: params.resourceId,
    changes: (params.changes ?? null) as Prisma.InputJsonValue,
    metadata: (params.metadata ?? null) as Prisma.InputJsonValue,
  });
}

function fieldErrorsFromZod(error: import('zod').ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function buildDiff<T extends Record<string, unknown>>(before: T, after: T) {
  const changes: { before: Record<string, unknown>; after: Record<string, unknown> } = {
    before: {},
    after: {},
  };
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes.before[key] = before[key] ?? null;
      changes.after[key] = after[key] ?? null;
    }
  }
  return changes;
}

export async function createOpportunity(
  input: OpportunityFormValues
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  if (!can(session, 'opportunities:create')) {
    return { ok: false, error: 'Sin permiso para crear oportunidades.' };
  }

  const parsed = opportunityFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const data = parsed.data;

  const code = data.code || (await generateOpportunityCode());
  const probability = data.probability ?? STAGE_PROBABILITY[data.stage];

  const opp = await prisma.$transaction(async (tx) => {
    const o = await tx.opportunity.create({
      data: {
        name: data.name,
        code,
        accountId: data.accountId,
        product: data.product,
        subProduct: data.subProduct ?? undefined,
        stage: data.stage,
        status: data.status,
        rating: data.rating,
        probability,
        estimatedValue: data.estimatedValue ?? undefined,
        currency: data.currency,
        commercialModel: data.commercialModel,
        portfolioAmount: data.portfolioAmount ?? undefined,
        userCount: data.userCount ?? undefined,
        annualOperations: data.annualOperations ?? undefined,
        clientCount: data.clientCount ?? undefined,
        officeCount: data.officeCount ?? undefined,
        expectedCloseDate: data.expectedCloseDate ?? undefined,
        nextActionDate: data.nextActionDate ?? undefined,
        nextActionNote: data.nextActionNote,
        source: data.source,
        sourceDetail: data.sourceDetail,
        isDirectProspecting: data.isDirectProspecting,
        referredById: data.referredById ?? undefined,
        ownerId: data.ownerId ?? session.user.id,
        description: data.description,
        internalNotes: data.internalNotes,
        createdById: session.user.id,
      },
    });

    await tx.stageHistory.create({
      data: {
        opportunityId: o.id,
        fromStage: null,
        toStage: data.stage,
        changedById: session.user.id,
        notes: 'Oportunidad creada',
      },
    });

    return o;
  });

  await writeAudit({
    userId: session.user.id,
    action: 'create',
    resourceId: opp.id,
    changes: { after: opp },
  });

  revalidatePath('/opportunities');
  return { ok: true, data: { id: opp.id } };
}

export async function updateOpportunity(
  id: string,
  input: OpportunityFormValues
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  const existing = await prisma.opportunity.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: 'No encontrada' };

  const isOwn = existing.ownerId === session.user.id;
  const hasAll = can(session, 'opportunities:update:all');
  const hasOwn = can(session, 'opportunities:update:own');
  if (!hasAll && !(hasOwn && isOwn)) {
    return { ok: false, error: 'Sin permiso para editar esta oportunidad.' };
  }

  const parsed = opportunityFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const data = parsed.data;

  // If the stage changed, block unless user has change_stage permission
  if (data.stage !== existing.stage && !can(session, 'opportunities:change_stage')) {
    return {
      ok: false,
      error: 'No tienes permiso para cambiar la fase. Usa el diálogo de cambio de fase.',
    };
  }

  const updated = await prisma.opportunity.update({
    where: { id },
    data: {
      name: data.name,
      accountId: data.accountId,
      product: data.product,
      subProduct: data.subProduct ?? null,
      rating: data.rating,
      probability: data.probability,
      estimatedValue: data.estimatedValue ?? null,
      currency: data.currency,
      commercialModel: data.commercialModel,
      portfolioAmount: data.portfolioAmount ?? null,
      userCount: data.userCount ?? null,
      annualOperations: data.annualOperations ?? null,
      clientCount: data.clientCount ?? null,
      officeCount: data.officeCount ?? null,
      expectedCloseDate: data.expectedCloseDate ?? null,
      nextActionDate: data.nextActionDate ?? null,
      nextActionNote: data.nextActionNote,
      source: data.source,
      sourceDetail: data.sourceDetail,
      isDirectProspecting: data.isDirectProspecting,
      referredById: data.referredById ?? null,
      ownerId: data.ownerId ?? null,
      description: data.description,
      internalNotes: data.internalNotes,
    },
  });

  await writeAudit({
    userId: session.user.id,
    action: 'update',
    resourceId: id,
    changes: buildDiff(existing as Record<string, unknown>, updated as Record<string, unknown>),
  });

  revalidatePath('/opportunities');
  revalidatePath(`/opportunities/${id}`);
  return { ok: true, data: { id } };
}

export async function changeStage(
  id: string,
  input: StageChangeInput
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  if (!can(session, 'opportunities:change_stage')) {
    return { ok: false, error: 'Sin permiso para cambiar la fase.' };
  }

  const parsed = stageChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const body = parsed.data;

  const existing = await prisma.opportunity.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: 'No encontrada' };

  if (body.toStage === 'LOST' && !body.lostReason) {
    return {
      ok: false,
      error: 'Debes indicar la razón de pérdida.',
      fieldErrors: { lostReason: 'Requerido' },
    };
  }

  const isOwn = existing.ownerId === session.user.id;
  const hasAll = can(session, 'opportunities:update:all');
  const hasOwn = can(session, 'opportunities:update:own');
  if (!hasAll && !(hasOwn && isOwn)) {
    return { ok: false, error: 'Sin permiso para editar esta oportunidad.' };
  }

  const daysInPreviousStage = Math.floor(
    (Date.now() - existing.stageChangedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const status =
    body.toStage === 'WON'
      ? 'WON'
      : body.toStage === 'LOST'
      ? 'LOST'
      : body.toStage === 'STAND_BY'
      ? 'STAND_BY'
      : body.toStage === 'NURTURE'
      ? 'NURTURE'
      : 'OPEN';

  await prisma.$transaction(async (tx) => {
    await tx.opportunity.update({
      where: { id },
      data: {
        previousStage: existing.stage,
        stage: body.toStage,
        stageChangedAt: new Date(),
        status,
        probability: STAGE_PROBABILITY[body.toStage],
        closedAt:
          body.toStage === 'WON' || body.toStage === 'LOST' ? new Date() : null,
        lostReason: body.toStage === 'LOST' ? body.lostReason ?? null : null,
        lostReasonDetail: body.toStage === 'LOST' ? body.lostReasonDetail : null,
        competitorWon: body.toStage === 'LOST' ? body.competitorWon : null,
        wonReason: body.toStage === 'WON' ? body.wonReason : null,
      },
    });

    await tx.stageHistory.create({
      data: {
        opportunityId: id,
        fromStage: existing.stage,
        toStage: body.toStage,
        changedById: session.user.id,
        daysInPreviousStage,
        notes: body.notes,
      },
    });
  });

  await writeAudit({
    userId: session.user.id,
    action: 'stage_change',
    resourceId: id,
    metadata: { from: existing.stage, to: body.toStage, notes: body.notes },
  });

  if (status !== 'OPEN') {
    await writeAudit({
      userId: session.user.id,
      action: 'status_change',
      resourceId: id,
      metadata: {
        to: status,
        lostReason: body.lostReason,
        wonReason: body.wonReason,
      },
    });
  }

  revalidatePath('/opportunities');
  revalidatePath(`/opportunities/${id}`);
  return { ok: true, data: { id } };
}

export async function linkContactToOpportunity(
  opportunityId: string,
  input: ContactRoleInput
): Promise<ActionResult> {
  const session = await requireSession();
  if (!can(session, 'opportunities:update:all') && !can(session, 'opportunities:update:own')) {
    return { ok: false, error: 'Sin permiso' };
  }
  const parsed = contactRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const body = parsed.data;

  await prisma.$transaction(async (tx) => {
    if (body.isPrimary) {
      await tx.opportunityContact.updateMany({
        where: { opportunityId },
        data: { isPrimary: false },
      });
    }
    await tx.opportunityContact.upsert({
      where: {
        opportunityId_contactId: { opportunityId, contactId: body.contactId },
      },
      update: { role: body.role, isPrimary: body.isPrimary, notes: body.notes },
      create: {
        opportunityId,
        contactId: body.contactId,
        role: body.role,
        isPrimary: body.isPrimary,
        notes: body.notes,
      },
    });
  });

  await writeAudit({
    userId: session.user.id,
    action: 'contact_link',
    resourceId: opportunityId,
    metadata: { contactId: body.contactId, role: body.role, isPrimary: body.isPrimary },
  });

  revalidatePath(`/opportunities/${opportunityId}`);
  return { ok: true, data: undefined };
}

export async function unlinkContactFromOpportunity(
  opportunityId: string,
  contactId: string
): Promise<ActionResult> {
  const session = await requireSession();
  if (!can(session, 'opportunities:update:all') && !can(session, 'opportunities:update:own')) {
    return { ok: false, error: 'Sin permiso' };
  }
  await prisma.opportunityContact.delete({
    where: { opportunityId_contactId: { opportunityId, contactId } },
  });
  await writeAudit({
    userId: session.user.id,
    action: 'contact_unlink',
    resourceId: opportunityId,
    metadata: { contactId },
  });
  revalidatePath(`/opportunities/${opportunityId}`);
  return { ok: true, data: undefined };
}

export async function deleteOpportunity(id: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!can(session, 'opportunities:delete')) {
    return { ok: false, error: 'Sin permiso para eliminar.' };
  }
  const existing = await prisma.opportunity.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: 'No encontrada' };

  await prisma.opportunity.delete({ where: { id } });
  await writeAudit({
    userId: session.user.id,
    action: 'delete',
    resourceId: id,
    changes: { before: existing },
  });

  revalidatePath('/opportunities');
  return { ok: true, data: undefined };
}
