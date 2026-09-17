import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={2} />
      <StatCardsSkeleton
        count={5}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      />
      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-56 w-full" />
      </div>
      <TableSkeleton rows={4} cols={8} />
    </div>
  );
}
