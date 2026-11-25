import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { PostEditor } from "@/components/admin/marketing/post-editor";
import { getAssets, getCampaignOptions } from "@/lib/admin/queries/marketing";
import { isDayKey } from "@/lib/marketing/calendar";

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { fecha } = await searchParams;
  const [campaigns, library] = await Promise.all([getCampaignOptions(), getAssets()]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        href="/admin/marketing/calendario"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Calendario
      </Link>
      <h2 className="text-lg font-semibold">Nuevo post</h2>
      <div className="rounded-2xl border bg-card p-5 sm:p-6">
        <PostEditor
          campaigns={campaigns}
          library={library}
          defaultDate={isDayKey(fecha) ? fecha : undefined}
        />
      </div>
    </div>
  );
}
