import {
  DetailHeaderSkeleton,
  TabsBarSkeleton,
} from "@/components/admin/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <DetailHeaderSkeleton accent="border-blue-100 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20" />
      <TabsBarSkeleton count={5} />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="rounded-lg">
            <CardContent className="space-y-4 p-5">
              <Skeleton className="h-5 w-32" />
              {Array.from({ length: 3 }).map((_, r) => (
                <Skeleton key={r} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
