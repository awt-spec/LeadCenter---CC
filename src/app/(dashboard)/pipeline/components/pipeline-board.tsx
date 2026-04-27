'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import type { OpportunityStage } from '@prisma/client';
import { PipelineColumn } from './pipeline-column';
import { OpportunityCard } from './opportunity-card';
import { QuickViewSheet } from './quick-view-sheet';
import {
  StageChangeConfirm,
  type ConfirmPayload,
} from './stage-change-confirm';
import type { PipelineOpportunityCard } from '@/lib/pipeline/stats';
import {
  changeOpportunityStage,
  type KanbanStageChangeInput,
} from '@/lib/pipeline/mutations';
import {
  getStageRequirements,
  REQUIREMENT_LABELS,
  type StageRequirementField,
} from '@/lib/opportunities/stage-rules';

const DEFAULT_STAGES: OpportunityStage[] = [
  'LEAD',
  'DISCOVERY',
  'SIZING',
  'DEMO',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSING',
  'HANDOFF',
];

const OPTIONAL_STAGES: OpportunityStage[] = ['WON', 'LOST', 'STAND_BY', 'NURTURE'];

const CRITICAL_STAGES = new Set<OpportunityStage>(['WON', 'LOST', 'STAND_BY', 'NURTURE']);

type Props = {
  initialCards: PipelineOpportunityCard[];
  visibleOptional: Record<'includeWon' | 'includeLost' | 'includeStandBy' | 'includeNurture', boolean>;
  canChangeStage: boolean;
  canCreate: boolean;
};

export function PipelineBoard({
  initialCards,
  visibleOptional,
  canChangeStage,
  canCreate,
}: Props) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);

  const [pendingConfirm, setPendingConfirm] = useState<{
    card: PipelineOpportunityCard;
    fromStage: OpportunityStage;
    toStage: OpportunityStage;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Sync cards when props change (filter updates from URL)
  useMemo(() => {
    setCards(initialCards);
  }, [initialCards]);

  const stages = useMemo(() => {
    const extras = OPTIONAL_STAGES.filter((s) => {
      if (s === 'WON') return visibleOptional.includeWon;
      if (s === 'LOST') return visibleOptional.includeLost;
      if (s === 'STAND_BY') return visibleOptional.includeStandBy;
      if (s === 'NURTURE') return visibleOptional.includeNurture;
      return false;
    });
    return [...DEFAULT_STAGES, ...extras];
  }, [visibleOptional]);

  const grouped = useMemo(() => {
    const map = new Map<OpportunityStage, PipelineOpportunityCard[]>();
    for (const s of stages) map.set(s, []);
    for (const c of cards) {
      const arr = map.get(c.stage);
      if (arr) arr.push(c);
    }
    return map;
  }, [cards, stages]);

  const activeCard = activeId ? cards.find((c) => c.id === activeId) ?? null : null;
  const quickViewCard = quickViewId ? cards.find((c) => c.id === quickViewId) ?? null : null;

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const applyOptimistic = useCallback(
    (id: string, toStage: OpportunityStage) => {
      setCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, stage: toStage } : c))
      );
    },
    []
  );

  const revertOptimistic = useCallback(
    (id: string, fromStage: OpportunityStage) => {
      setCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, stage: fromStage } : c))
      );
    },
    []
  );

  const commitChange = useCallback(
    async (
      card: PipelineOpportunityCard,
      toStage: OpportunityStage,
      extra: Partial<KanbanStageChangeInput> = {}
    ) => {
      const input: KanbanStageChangeInput = {
        opportunityId: card.id,
        toStage,
        ...extra,
      };
      const res = await changeOpportunityStage(input);
      if (!res.ok) {
        revertOptimistic(card.id, card.stage);
        toast.error(res.error);
        return false;
      }

      // Warn if stage has missing requirements (doesn't block)
      const reqs = getStageRequirements(toStage);
      const missing = reqs.filter((r) => !hasRequirement(r, card));
      if (missing.length > 0 && !CRITICAL_STAGES.has(toStage)) {
        toast.warning(
          `Movida a ${toStage}. Faltan completar: ${missing
            .map((m) => REQUIREMENT_LABELS[m])
            .join(', ')}`,
          {
            action: {
              label: 'Ir a oportunidad',
              onClick: () => router.push(`/opportunities/${card.id}`),
            },
          }
        );
      } else {
        toast.success('Fase actualizada');
      }

      router.refresh();
      return true;
    },
    [revertOptimistic, router]
  );

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const dragged = cards.find((c) => c.id === active.id);
      if (!dragged) return;

      // Determine target stage from either a droppable column or a card (when dropped on another card)
      let targetStage: OpportunityStage | null = null;
      const overData = over.data.current as { stage?: OpportunityStage; card?: PipelineOpportunityCard } | undefined;
      if (overData?.stage) targetStage = overData.stage;
      else if (overData?.card) targetStage = overData.card.stage;

      if (!targetStage || targetStage === dragged.stage) return;

      const fromStage = dragged.stage;

      // Optimistic
      applyOptimistic(dragged.id, targetStage);

      // Critical stage -> confirm
      if (CRITICAL_STAGES.has(targetStage)) {
        setPendingConfirm({ card: dragged, fromStage, toStage: targetStage });
        return;
      }

      await commitChange(dragged, targetStage);
    },
    [cards, applyOptimistic, commitChange]
  );

  const onDragCancel = useCallback(() => setActiveId(null), []);

  const handleConfirmClose = useCallback(
    async (payload: ConfirmPayload) => {
      if (!pendingConfirm) return;
      const { card, toStage } = pendingConfirm;
      setPendingConfirm(null);
      await commitChange(card, toStage, payload);
    },
    [pendingConfirm, commitChange]
  );

  const handleConfirmCancel = useCallback(() => {
    if (!pendingConfirm) return;
    revertOptimistic(pendingConfirm.card.id, pendingConfirm.fromStage);
    setPendingConfirm(null);
  }, [pendingConfirm, revertOptimistic]);

  const handleQuickView = useCallback((id: string) => setQuickViewId(id), []);
  const handleCardClick = useCallback(
    (id: string) => {
      // Single click opens quick view
      setQuickViewId(id);
    },
    []
  );
  const handleCardDoubleClick = useCallback(
    (id: string) => router.push(`/opportunities/${id}`),
    [router]
  );

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        modifiers={[restrictToWindowEdges]}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 pr-2" style={{ scrollSnapType: 'x proximity' }}>
          {stages.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              cards={grouped.get(stage) ?? []}
              draggable={canChangeStage}
              onQuickView={handleQuickView}
              onClick={handleCardClick}
              onDoubleClick={handleCardDoubleClick}
              canCreate={canCreate}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 200 }}>
          {activeCard ? (
            <div style={{ width: 304 }}>
              <OpportunityCard card={activeCard} draggable isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <QuickViewSheet
        card={quickViewCard}
        open={!!quickViewId}
        onOpenChange={(o) => !o && setQuickViewId(null)}
      />

      {pendingConfirm && (
        <StageChangeConfirm
          open
          toStage={pendingConfirm.toStage as 'WON' | 'LOST' | 'STAND_BY' | 'NURTURE'}
          opportunityName={pendingConfirm.card.name}
          currentValue={pendingConfirm.card.estimatedValue}
          currency={pendingConfirm.card.currency}
          onConfirm={handleConfirmClose}
          onCancel={handleConfirmCancel}
        />
      )}
    </>
  );
}

function hasRequirement(field: StageRequirementField, c: PipelineOpportunityCard): boolean {
  switch (field) {
    case 'portfolioAmount':
      return c.portfolioAmount !== null;
    case 'userCount':
      return c.userCount !== null;
    case 'annualOperations':
      return c.annualOperations !== null;
    case 'contactRoles':
      return !!c.primaryContact;
    case 'estimatedValue':
      return c.estimatedValue !== null;
    case 'expectedCloseDate':
      return c.expectedCloseDate !== null;
    case 'commercialModel':
      return true;
  }
}
