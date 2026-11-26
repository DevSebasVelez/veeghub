import { Skeleton } from "@/components/ui/skeleton";

function PanelSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border bg-card ${className}`}>
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <Skeleton className="size-8 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-48 max-w-full" />
        </div>
      </div>
      <div className="space-y-3 p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between gap-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-2 rounded-full" style={{ width: `${90 - i * 18}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="ml-auto h-3 w-56" />
      </div>
      <div className="flex items-center gap-4 rounded-2xl border bg-card p-5">
        <Skeleton className="size-12 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton />
        <PanelSkeleton />
        <PanelSkeleton />
        <PanelSkeleton />
        <PanelSkeleton className="lg:col-span-2" />
      </div>
    </div>
  );
}
