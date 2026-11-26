import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full rounded-xl sm:h-9 sm:w-60" />
        <Skeleton className="h-3 w-64" />
      </div>
      <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
            <div className="flex gap-3">
              <Skeleton className="size-20 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-12 rounded-xl" />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
