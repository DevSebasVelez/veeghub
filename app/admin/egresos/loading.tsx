import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
  TabsBarSkeleton,
} from "@/components/admin/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={2} />
      <TabsBarSkeleton count={3} />
      <StatCardsSkeleton count={3} className="grid gap-4 sm:grid-cols-3" />
      <TableSkeleton rows={8} cols={8} />
    </div>
  );
}
