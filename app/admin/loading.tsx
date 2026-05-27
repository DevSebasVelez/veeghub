import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
} from "@/components/admin/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={2} />
      <StatCardsSkeleton
        count={6}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      />
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, r) => (
                <div
                  key={r}
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
