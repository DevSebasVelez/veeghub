import { Skeleton } from "@/components/ui/skeleton";

/** Teleprompter: full-screen black overlay, not the admin shell. */
export default function Loading() {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black" aria-busy="true">
      <div className="flex items-center justify-between gap-3 p-4">
        <Skeleton className="size-10 rounded-full bg-white/10" />
        <Skeleton className="h-4 w-40 bg-white/10" />
        <Skeleton className="size-10 rounded-full bg-white/10" />
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-5 px-6">
        <Skeleton className="h-8 w-full bg-white/10" />
        <Skeleton className="h-8 w-11/12 bg-white/10" />
        <Skeleton className="h-8 w-4/5 bg-white/10" />
        <Skeleton className="h-8 w-2/3 bg-white/10" />
      </div>
      <div className="flex justify-center gap-3 p-6">
        <Skeleton className="h-10 w-24 rounded-full bg-white/10" />
        <Skeleton className="size-14 rounded-full bg-white/15" />
        <Skeleton className="h-10 w-24 rounded-full bg-white/10" />
      </div>
    </div>
  );
}
