'use client';

import type { OpportunityStage } from '@prisma/client';
import { Check } from 'lucide-react';
import { PIPELINE_STAGES } from '@/lib/opportunities/stage-rules';
import { STAGE_LABELS, STAGE_COLORS } from '@/lib/shared/labels';
import { cn } from '@/lib/utils';

type Props = {
  currentStage: OpportunityStage;
  onStageClick?: (s: OpportunityStage) => void;
};

export function StageProgress({ currentStage, onStageClick }: Props) {
  const currentIdx = PIPELINE_STAGES.indexOf(currentStage);
  const isClosedLost = currentStage === 'LOST';

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {PIPELINE_STAGES.map((stage, i) => {
        const isPast = !isClosedLost && i < currentIdx;
        const isCurrent = stage === currentStage;
        const colors = STAGE_COLORS[stage];

        return (
          <div key={stage} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onStageClick?.(stage)}
              className={cn(
                'flex min-w-fit items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all',
                onStageClick && 'cursor-pointer hover:opacity-90',
                isCurrent && 'ring-2 ring-sysde-red ring-offset-1'
              )}
              style={{
                backgroundColor: isPast ? '#D1FAE5' : isCurrent ? colors.bg : '#F8FAFC',
                color: isPast ? '#065F46' : isCurrent ? colors.text : '#94A3B8',
                borderColor: isPast ? '#6EE7B7' : isCurrent ? colors.border : '#E2E8F0',
              }}
              aria-label={STAGE_LABELS[stage]}
            >
              {isPast && <Check className="h-3 w-3" strokeWidth={3} />}
              <span>{STAGE_LABELS[stage]}</span>
            </button>
            {i < PIPELINE_STAGES.length - 1 && (
              <div className="h-px w-4 shrink-0 bg-sysde-border" />
            )}
          </div>
        );
      })}
      {(currentStage === 'LOST' || currentStage === 'STAND_BY' || currentStage === 'NURTURE') && (
        <>
          <div className="mx-2 h-6 w-px bg-sysde-border" />
          <span
            className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium ring-2 ring-sysde-red ring-offset-1"
            style={{
              backgroundColor: STAGE_COLORS[currentStage].bg,
              color: STAGE_COLORS[currentStage].text,
              borderColor: STAGE_COLORS[currentStage].border,
            }}
          >
            {STAGE_LABELS[currentStage]}
          </span>
        </>
      )}
    </div>
  );
}
