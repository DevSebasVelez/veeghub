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

/** Thumbnail of the first image, or a channel-colored tile when there is none. */
function PostThumb({ post }: { post: PostCardDTO }) {
  const channel = CHANNELS[post.channel];

  if (post.coverAssetId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- redirects to a signed R2 URL
      <img
        src={`/api/admin/marketing/assets/${post.coverAssetId}`}
        alt=""
        loading="lazy"
        className="size-12 shrink-0 rounded-xl border bg-muted object-cover"
      />
    );
  }

  return (
    <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", channel.chip)}>
      <ImageIcon className="size-4 opacity-60" />
    </span>
  );
}

/** Full row for lists: «Próximos 14 días», borradores sin fecha, dashboard. */
/** `timeOnly` when the list already groups by day. */
export function PostRow({ post, timeOnly = false }: { post: PostCardDTO; timeOnly?: boolean }) {
  const channel = CHANNELS[post.channel];

  return (
    <Link
      href={postHref(post.id)}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40 sm:px-5 sm:py-3.5"
    >
      <PostThumb post={post} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", channel.dot)} />
          <span className="truncate text-sm font-medium">{post.title}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span>{channel.short}</span>
          <span aria-hidden>·</span>
          <span>{timeOnly && post.time ? post.time : post.whenLabel}</span>
          {post.campaignName ? (
            <>
              <span aria-hidden className="max-sm:hidden">·</span>
              <span className="truncate max-sm:hidden">{post.campaignName}</span>
            </>
          ) : null}
          {post.assetCount ? (
            <span className="inline-flex items-center gap-0.5" aria-label={`${post.assetCount} imágenes`}>
              <span aria-hidden>·</span> <ImageIcon className="size-3" aria-hidden /> {post.assetCount}
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 sm:hidden">
          <StatusBadge status={post.status} />
        </div>
      </div>
      <span className="max-sm:hidden">
        <StatusBadge status={post.status} />
      </span>
    </Link>
  );
}
