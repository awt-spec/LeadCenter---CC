import type { OpportunityStage } from '@prisma/client';
import { STAGE_LABELS, STAGE_COLORS } from '@/lib/shared/labels';
import { cn } from '@/lib/utils';

type StageBadgeProps = {
  stage: OpportunityStage;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
};

export function StageBadge({ stage, size = 'md', onClick, className }: StageBadgeProps) {
  const colors = STAGE_COLORS[stage];
  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-md border font-medium transition-colors',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-2.5 py-1 text-sm',
        size === 'lg' && 'px-3 py-1.5 text-base',
        onClick && 'cursor-pointer hover:opacity-80',
        className
      )}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        borderColor: colors.border,
      }}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}
