import { TableSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
        <Skeleton className="size-5 shrink-0 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
      </div>
      <div className="rounded-lg border bg-card">
        <div className="px-5 pb-2 pt-5">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 px-5 py-3">
              <Skeleton className="mt-0.5 size-5 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
}
