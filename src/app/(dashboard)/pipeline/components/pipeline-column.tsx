'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { OpportunityStage } from '@prisma/client';
import { PipelineColumnHeader } from './pipeline-column-header';
import { SortableCard } from './sortable-card';
import { EmptyColumn, OverLimitNotice } from './empty-column';
import { computeColumnStats, type PipelineOpportunityCard } from '@/lib/pipeline/queries';
import { STAGE_COLORS } from '@/lib/shared/labels';
import { cn } from '@/lib/utils';

type Props = {
  stage: OpportunityStage;
  cards: PipelineOpportunityCard[];
  draggable: boolean;
  onQuickView: (id: string) => void;
  onDoubleClick: (id: string) => void;
  onClick: (id: string) => void;
  canCreate: boolean;
};

const MAX_VISIBLE = 20;

export function PipelineColumn({
  stage,
  cards,
  draggable,
  onQuickView,
  onDoubleClick,
  onClick,
  canCreate,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${stage}`, data: { stage } });

  const stats = useMemo(() => computeColumnStats(cards), [cards]);
  const visibleCards = cards.slice(0, MAX_VISIBLE);
  const overLimit = cards.length > MAX_VISIBLE;
  const colors = STAGE_COLORS[stage];

  return (
    <div className="flex w-[320px] shrink-0 snap-start flex-col">
      <PipelineColumnHeader
        stage={stage}
        count={cards.length}
        total={stats.total}
        weighted={stats.weighted}
      />

      <div
        ref={setNodeRef}
        className={cn(
          'relative flex min-h-[200px] flex-1 flex-col gap-2 rounded-b-[10px] bg-[#FAFAFA] p-2 transition-colors',
          isOver && 'bg-sysde-red-light'
        )}
        style={
          isOver
            ? {
                outline: `2px dashed ${colors.border}`,
                outlineOffset: -2,
              }
            : undefined
        }
      >
        <SortableContext
          items={visibleCards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {visibleCards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              draggable={draggable}
              onQuickView={onQuickView}
              onDoubleClick={onDoubleClick}
              onClick={onClick}
            />
          ))}
        </SortableContext>

        {cards.length === 0 && <EmptyColumn />}

        {overLimit && <OverLimitNotice stage={stage} total={cards.length} />}

        {canCreate && (
          <Link
            href={`/opportunities/new?stage=${stage}`}
            className="mt-auto inline-flex items-center justify-center rounded-lg border border-dashed border-sysde-border px-3 py-2 text-xs text-sysde-mid transition-colors hover:border-sysde-red/40 hover:text-sysde-red"
          >
            <Plus className="mr-1 h-3 w-3" />
            Añadir oportunidad
          </Link>
        )}
      </div>
    </div>
  );
}
