import Link from "next/link";

import { cn } from "@/lib/utils";

/** Pill-style segmented control whose options are links (state in the URL). */
export function SegmentedLinks({
  items,
  label,
}: {
  items: Array<{ key: string; label: string; href: string; active: boolean; count?: number }>;
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-full border bg-card p-1 shadow-xs"
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          scroll={false}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
            item.active
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
          {item.count ? (
            <span
              className={cn(
                "rounded-full px-1.5 text-[10px] leading-4 tabular-nums",
                item.active ? "bg-primary-foreground/20" : "bg-muted",
              )}
            >
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
