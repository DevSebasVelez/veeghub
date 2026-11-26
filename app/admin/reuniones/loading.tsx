import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-36 rounded-lg" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="flex items-center justify-between gap-2 lg:justify-end">
            <Skeleton className="h-9 w-52 rounded-md" />
            <Skeleton className="h-9 w-36 rounded-md" />
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border bg-border">
          <div className="grid grid-cols-7 gap-px">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex justify-center bg-card px-2 py-2">
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="flex min-h-20 flex-col gap-1 bg-card p-1.5 sm:min-h-28">
                <Skeleton className="mx-auto size-6 rounded-full sm:mx-0" />
                {i % 4 === 1 ? <Skeleton className="hidden h-5 w-full rounded sm:block" /> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
