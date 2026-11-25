import Link from "next/link";
import { ImageIcon } from "lucide-react";

import type { PostCardDTO } from "@/lib/admin/queries/marketing";
import {
  CHANNELS,
  STATUS_BADGES,
  STATUS_LABELS,
  type ContentStatusValue,
} from "@/lib/marketing/constants";
import { cn } from "@/lib/utils";

/** Status dot: the same colors as the badges (conventions §5). */
export const STATUS_DOTS: Record<ContentStatusValue, string> = {
  IDEA: "bg-zinc-400",
  BORRADOR: "bg-zinc-400",
  EN_REVISION: "bg-amber-500",
  APROBADO: "bg-blue-500",
  PROGRAMADO: "bg-orange-500",
  PUBLICADO: "bg-emerald-500",
  FALLIDO: "bg-red-500",
  DESCARTADO: "bg-zinc-300",
};

export function postHref(id: string) {
  return `/admin/marketing/calendario/${id}`;
}

/** Compact chip for the month and week grids, colored by channel. */
export function PostChip({ post, showChannel = true }: { post: PostCardDTO; showChannel?: boolean }) {
  const channel = CHANNELS[post.channel];
  const muted = post.status === "DESCARTADO";
  const done = post.status === "PUBLICADO";

  return (
    <Link
      href={postHref(post.id)}
      title={`${post.title} · ${channel.label} · ${STATUS_LABELS[post.status]}`}
      className={cn(
        "flex min-w-0 items-center gap-1.5 overflow-hidden rounded-lg px-1.5 py-1 text-xs transition-colors",
        channel.chip,
        muted && "line-through opacity-60",
        done && "opacity-75",
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOTS[post.status])} />
      {post.time ? <span className="hidden shrink-0 tabular-nums opacity-80 sm:inline">{post.time}</span> : null}
      {showChannel ? <span className="min-w-0 truncate font-medium sm:shrink-0">{channel.short}</span> : null}
      <span className="hidden truncate sm:inline">{post.title.replace(/ · (LinkedIn|GBP)$/, "")}</span>
    </Link>
  );
}

export function StatusBadge({ status }: { status: PostCardDTO["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        STATUS_BADGES[status],
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_DOTS[status])} />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Full row for lists: «Próximos 14 días», borradores sin fecha, dashboard. */
export function PostRow({ post }: { post: PostCardDTO }) {
  const channel = CHANNELS[post.channel];

  return (
    <Link
      href={postHref(post.id)}
      className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-accent/40"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", channel.dot)} />
          <span className="truncate text-sm font-medium">{post.title}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span>{channel.label}</span>
          <span>·</span>
          <span>{post.whenLabel}</span>
          {post.campaignName ? (
            <>
              <span>·</span>
              <span className="truncate">{post.campaignName}</span>
            </>
          ) : null}
          {post.assetCount ? (
            <span className="inline-flex items-center gap-0.5">
              · <ImageIcon className="size-3" /> {post.assetCount}
            </span>
          ) : null}
        </div>
      </div>
      <StatusBadge status={post.status} />
    </Link>
  );
}
