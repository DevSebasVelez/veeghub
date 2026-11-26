import { KpiTilesSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <KpiTilesSkeleton />
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Skeleton className="h-10 w-full rounded-md sm:h-9 sm:w-64" />
          <div className="grid grid-cols-2 gap-2 sm:contents">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-md sm:h-9 sm:w-40" />
            ))}
          </div>
          <Skeleton className="h-10 rounded-md sm:h-8 sm:w-16" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="relative flex flex-col overflow-hidden rounded-2xl border bg-card p-5 pt-6">
              <Skeleton className="absolute inset-x-0 top-0 h-1 rounded-none" />
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
              <Skeleton className="mt-3 h-5 w-4/5" />
              <div className="mt-2 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="size-10 rounded-full" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
