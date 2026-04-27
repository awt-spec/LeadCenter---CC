'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { OpportunityCard } from './opportunity-card';
import type { PipelineOpportunityCard } from '@/lib/pipeline/stats';

type Props = {
  card: PipelineOpportunityCard;
  draggable: boolean;
  onQuickView: (id: string) => void;
  onDoubleClick: (id: string) => void;
  onClick: (id: string) => void;
};

export function SortableCard({ card, draggable, onQuickView, onDoubleClick, onClick }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { card },
    disabled: !draggable,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(draggable ? listeners : {})}
      onClick={() => onClick(card.id)}
      onDoubleClick={() => onDoubleClick(card.id)}
    >
      <OpportunityCard
        card={card}
        draggable={draggable}
        isDragging={isDragging}
        onQuickView={onQuickView}
      />
    </div>
  );
}
