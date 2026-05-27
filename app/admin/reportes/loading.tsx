import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/admin/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={1} />
      <Skeleton className="h-16 w-full rounded-xl" />
      <StatCardsSkeleton count={4} />
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 space-y-4"
          >
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}
