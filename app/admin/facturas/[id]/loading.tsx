import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-8 w-56 max-w-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Skeleton className="h-9 w-full sm:w-28" />
          <Skeleton className="h-9 w-full sm:w-28" />
        </div>
      </div>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="rounded-lg">
            <CardContent className="space-y-4 p-5">
              <Skeleton className="h-5 w-40" />
              {Array.from({ length: 4 }).map((_, r) => (
                <Skeleton key={r} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
