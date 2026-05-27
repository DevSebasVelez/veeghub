import { PageHeaderSkeleton, TableSkeleton } from "@/components/admin/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={1} />
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
