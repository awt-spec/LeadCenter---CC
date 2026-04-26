import type { ActivityTag } from '@prisma/client';
import { ACTIVITY_TAG_COLORS, ACTIVITY_TAG_LABELS } from '@/lib/activities/labels';
import { cn } from '@/lib/utils';

export function ActivityTagBadge({
  tag,
  className,
  onRemove,
}: {
  tag: ActivityTag;
  className?: string;
  onRemove?: () => void;
}) {
  const colors = ACTIVITY_TAG_COLORS[tag];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        className
      )}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {ACTIVITY_TAG_LABELS[tag]}
      {onRemove && (
        <button type="button" onClick={onRemove} className="opacity-70 hover:opacity-100">
          ×
        </button>
      )}
    </span>
  );
}
