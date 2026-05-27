import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function PageHeaderSkeleton({ actions = 1 }: { actions?: number }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32" />
        ))}
      </div>
    </div>
  );
}

export function StatCardsSkeleton({
  count = 4,
  className = "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-4 rounded" />
          </div>
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 8,
  cols = 6,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="p-0">
        <div className="border-b border-border px-5 py-3">
          <div className="flex gap-4">
            {Array.from({ length: cols }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex items-center gap-4 px-5 py-4">
              {Array.from({ length: cols }).map((_, c) => (
                <Skeleton key={c} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CardGridSkeleton({
  count = 6,
  className = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="rounded-xl">
          <div className="flex items-start gap-3 p-4 pb-3">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
          <CardContent className="space-y-3 pt-0">
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DetailHeaderSkeleton({
  accent = "border-border bg-card",
}: {
  accent?: string;
}) {
  return (
    <Card className={`rounded-lg ${accent}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex gap-3 sm:gap-4">
          <Skeleton className="size-12 shrink-0 rounded-lg sm:size-14" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="size-8 rounded" />
            </div>
            <Skeleton className="h-7 w-56" />
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-20 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TabsBarSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-1 border-b border-border pb-1">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-24 rounded-md" />
      ))}
    </div>
  );
}

export function ListGroupSkeleton({
  groups = 3,
  rowsPerGroup = 3,
}: {
  groups?: number;
  rowsPerGroup?: number;
}) {
  return (
    <div className="space-y-5">
      {Array.from({ length: groups }).map((_, g) => (
        <Card key={g} className="rounded-lg">
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <div className="divide-y">
              {Array.from({ length: rowsPerGroup }).map((_, r) => (
                <div key={r} className="flex items-start gap-3 px-4 py-3">
                  <Skeleton className="size-4 shrink-0 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
