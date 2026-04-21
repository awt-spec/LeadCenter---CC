'use server';

import { revalidatePath } from 'next/cache';
import type { LostReason, OpportunityStage, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { computeStatusAndProbability } from '@/lib/opportunities/status-helpers';

export type KanbanStageChangeInput = {
  opportunityId: string;
  toStage: OpportunityStage;
  notes?: string;
  wonReason?: string;
  lostReason?: LostReason;
  lostReasonDetail?: string;
  competitorWon?: string;
  closedValue?: number;
  closedAt?: Date;
  standbyReason?: string;
  expectedRestartAt?: Date;
};

type Result = { ok: true } | { ok: false; error: string };

export async function changeOpportunityStage(
  input: KanbanStageChangeInput
): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Sesión requerida' };

  if (!can(session, 'opportunities:change_stage')) {
    return { ok: false, error: 'No tienes permiso para cambiar fases.' };
  }

  const opp = await prisma.opportunity.findUnique({
    where: { id: input.opportunityId },
  });
  if (!opp) return { ok: false, error: 'Oportunidad no encontrada' };

  if (!can(session, 'opportunities:update:all')) {
    if (opp.ownerId !== session.user.id) {
      return { ok: false, error: 'No puedes mover oportunidades de otros usuarios.' };
    }
  }

  if (opp.stage === input.toStage) return { ok: true };

  if (input.toStage === 'LOST' && !input.lostReason) {
    return { ok: false, error: 'La razón de pérdida es obligatoria.' };
  }

  const now = new Date();
  const daysInPreviousStage = Math.floor(
    (now.getTime() - opp.stageChangedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const fromStage = opp.stage;
  const { status, probability } = computeStatusAndProbability(input.toStage, opp.probability);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.opportunity.update({
        where: { id: opp.id },
        data: {
          stage: input.toStage,
          previousStage: fromStage,
          stageChangedAt: now,
          status,
          probability,
          closedAt:
            input.toStage === 'WON' || input.toStage === 'LOST'
              ? input.closedAt ?? now
              : null,
          ...(input.toStage === 'WON' && {
            wonReason: input.wonReason,
            estimatedValue: input.closedValue ?? opp.estimatedValue,
          }),
          ...(input.toStage === 'LOST' && {
            lostReason: input.lostReason,
            lostReasonDetail: input.lostReasonDetail,
            competitorWon: input.competitorWon,
          }),
        },
      });

      await tx.stageHistory.create({
        data: {
          opportunityId: opp.id,
          fromStage,
          toStage: input.toStage,
          changedById: session.user.id,
          daysInPreviousStage,
          notes: input.notes ?? input.standbyReason,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'stage_change',
          resource: 'opportunities',
          resourceId: opp.id,
          changes: { from: fromStage, to: input.toStage } as Prisma.InputJsonValue,
          metadata: {
            daysInPreviousStage,
            method: 'kanban_drag',
            notes: input.notes,
            triggered_by_drag: true,
          } as Prisma.InputJsonValue,
        },
      });

      if (status !== 'OPEN') {
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'status_change',
            resource: 'opportunities',
            resourceId: opp.id,
            metadata: {
              to: status,
              wonReason: input.wonReason,
              lostReason: input.lostReason,
            } as Prisma.InputJsonValue,
          },
        });
      }
    });
  } catch (err) {
    console.error('Stage change failed:', err);
    return { ok: false, error: 'Error al cambiar la fase. Intenta de nuevo.' };
  }

  revalidatePath('/pipeline');
  revalidatePath(`/opportunities/${opp.id}`);
  revalidatePath('/opportunities');

  return { ok: true };
}
