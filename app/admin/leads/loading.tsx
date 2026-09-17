import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
} from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, column) => (
          <div key={column} className="space-y-2 rounded-lg bg-muted/40 p-2">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 2 }).map((_, card) => (
              <Skeleton key={card} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
