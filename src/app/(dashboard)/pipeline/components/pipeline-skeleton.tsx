import { Skeleton } from '@/components/ui/skeleton';

export function PipelineSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="w-[320px] shrink-0 space-y-2">
          <Skeleton className="h-14 w-full rounded-[10px]" />
          {Array.from({ length: 3 }).map((_, j) => (
            <Skeleton key={j} className="h-32 w-full rounded-[10px]" />
          ))}
        </div>
      ))}
    </div>
  );
}
