import { FactsCardSkeleton, SectionCardSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside className="max-lg:contents lg:order-2 lg:space-y-4">
          <SectionCardSkeleton lines={2} className="max-lg:order-1" />
          <FactsCardSkeleton rows={4} className="max-lg:order-3" />
        </aside>
        <div className="min-w-0 rounded-2xl border bg-card max-lg:order-2 lg:order-1">
          <div className="flex gap-4 border-b px-5 pb-2 pt-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="space-y-3 p-5 sm:p-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 aspect-[4/3] w-full max-w-md rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
