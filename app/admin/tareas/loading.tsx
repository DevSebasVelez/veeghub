import {
  PageHeaderSkeleton,
  ListGroupSkeleton,
} from "@/components/admin/skeletons";

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton actions={2} />
      <ListGroupSkeleton groups={3} rowsPerGroup={3} />
    </div>
  );
}
