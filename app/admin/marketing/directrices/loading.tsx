import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="w-full max-w-2xl space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-9 w-36 shrink-0 rounded-md" />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Skeleton className="h-9 w-full max-w-sm rounded-md" />
                <Skeleton className="h-5 w-20 rounded" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-40 w-full rounded-md" />
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
