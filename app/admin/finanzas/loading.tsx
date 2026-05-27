import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/admin/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={2} />
      <StatCardsSkeleton count={3} className="grid gap-4 sm:grid-cols-3" />
      <Skeleton className="h-10 w-40 rounded-lg" />
      <TableSkeleton rows={8} cols={7} />
    </div>
  );
}
