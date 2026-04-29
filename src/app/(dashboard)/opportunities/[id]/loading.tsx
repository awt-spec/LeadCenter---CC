import { Skeleton } from '@/components/ui/skeleton';

export default function OpportunityDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Skeleton className="h-4 w-24" />
      <div className="rounded-xl border border-sysde-border bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
      <Skeleton className="h-12 rounded-xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
