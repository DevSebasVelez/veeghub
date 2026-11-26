import { KpiTilesSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <KpiTilesSkeleton className="grid grid-cols-2 gap-3 lg:grid-cols-4" />
      <div className="rounded-2xl border bg-card p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <Skeleton className="size-9 rounded-full" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl md:h-80" />
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="space-y-1.5 border-b px-5 py-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-4 py-3.5 md:px-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24 md:w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
