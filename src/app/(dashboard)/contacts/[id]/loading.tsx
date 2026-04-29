import { Skeleton } from '@/components/ui/skeleton';

export default function ContactDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Skeleton className="h-4 w-24" />

      <div className="rounded-xl border border-sysde-border bg-white p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="rounded-xl border border-sysde-border bg-white p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
