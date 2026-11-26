import { StatCardsSkeleton, TableSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full max-w-xl rounded-xl" />
      <StatCardsSkeleton count={8} className="grid grid-cols-2 gap-3 lg:grid-cols-4" />
      <Skeleton className="h-72 w-full rounded-2xl" />
      <TableSkeleton rows={4} cols={8} />
    </div>
  );
}
