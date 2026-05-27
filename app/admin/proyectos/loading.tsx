import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  CardGridSkeleton,
} from "@/components/admin/skeletons";

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton actions={2} />
      <Skeleton className="h-12 w-full rounded-lg" />
      <CardGridSkeleton count={6} />
    </div>
  );
}
