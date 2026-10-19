import {
  CardGridSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/admin/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={0} />
      <CardGridSkeleton />
      <TableSkeleton rows={6} cols={9} />
    </div>
  );
}
