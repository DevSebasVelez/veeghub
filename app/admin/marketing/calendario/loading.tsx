import { KpiTilesSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <KpiTilesSkeleton />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-36 rounded-lg sm:h-8" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-48 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md sm:h-9" />
          <Skeleton className="h-10 w-24 rounded-md sm:h-9" />
          <Skeleton className="h-10 w-28 rounded-md sm:h-9" />
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex justify-center py-2">
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="min-h-14 space-y-1 border-b border-r p-1.5 [&:nth-child(7n)]:border-r-0 sm:min-h-28 sm:p-1">
              <Skeleton className="mx-auto size-6 rounded-full sm:mx-0" />
              {i % 3 === 0 ? <Skeleton className="hidden h-5 w-full rounded sm:block" /> : null}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
    </div>
  );
}
