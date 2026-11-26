import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The panel's accent palette (convenciones §2.1). Each tone is a pair that
 * reads in light and dark: a soft tinted surface with a saturated icon.
 * Classes are written out in full so Tailwind can see them.
 */
export const TONES = ["blue", "violet", "emerald", "amber", "rose", "sky", "orange", "teal", "indigo", "pink", "red", "zinc"] as const;
export type Tone = (typeof TONES)[number];

export const TONE_TILE: Record<Tone, string> = {
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  orange: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
  teal: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300",
  indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  pink: "bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300",
  red: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300",
  zinc: "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300",
};

/** A faint wash of the tone, for hero cards and selected KPI tiles. */
export const TONE_WASH: Record<Tone, string> = {
  blue: "bg-linear-to-br from-blue-50 to-card dark:from-blue-500/10",
  violet: "bg-linear-to-br from-violet-50 to-card dark:from-violet-500/10",
  emerald: "bg-linear-to-br from-emerald-50 to-card dark:from-emerald-500/10",
  amber: "bg-linear-to-br from-amber-50 to-card dark:from-amber-500/10",
  rose: "bg-linear-to-br from-rose-50 to-card dark:from-rose-500/10",
  sky: "bg-linear-to-br from-sky-50 to-card dark:from-sky-500/10",
  orange: "bg-linear-to-br from-orange-50 to-card dark:from-orange-500/10",
  teal: "bg-linear-to-br from-teal-50 to-card dark:from-teal-500/10",
  indigo: "bg-linear-to-br from-indigo-50 to-card dark:from-indigo-500/10",
  pink: "bg-linear-to-br from-pink-50 to-card dark:from-pink-500/10",
  red: "bg-linear-to-br from-red-50 to-card dark:from-red-500/10",
  zinc: "bg-linear-to-br from-zinc-50 to-card dark:from-zinc-500/10",
};

export const TONE_RING: Record<Tone, string> = {
  blue: "ring-blue-500/30",
  violet: "ring-violet-500/30",
  emerald: "ring-emerald-500/30",
  amber: "ring-amber-500/30",
  rose: "ring-rose-500/30",
  sky: "ring-sky-500/30",
  orange: "ring-orange-500/30",
  teal: "ring-teal-500/30",
  indigo: "ring-indigo-500/30",
  pink: "ring-pink-500/30",
  red: "ring-red-500/30",
  zinc: "ring-zinc-500/30",
};

/** Solid accent, for a progress bar or a beat stripe. */
export const TONE_SOLID: Record<Tone, string> = {
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  indigo: "bg-indigo-500",
  pink: "bg-pink-500",
  red: "bg-red-500",
  zinc: "bg-zinc-400",
};

/** Text-only accent for small labels. */
export const TONE_TEXT: Record<Tone, string> = {
  blue: "text-blue-700 dark:text-blue-300",
  violet: "text-violet-700 dark:text-violet-300",
  emerald: "text-emerald-700 dark:text-emerald-300",
  amber: "text-amber-700 dark:text-amber-300",
  rose: "text-rose-700 dark:text-rose-300",
  sky: "text-sky-700 dark:text-sky-300",
  orange: "text-orange-700 dark:text-orange-300",
  teal: "text-teal-700 dark:text-teal-300",
  indigo: "text-indigo-700 dark:text-indigo-300",
  pink: "text-pink-700 dark:text-pink-300",
  red: "text-red-700 dark:text-red-300",
  zinc: "text-zinc-700 dark:text-zinc-300",
};

export function IconTile({
  icon: Icon,
  tone = "zinc",
  size = "md",
  className,
}: {
  icon: React.ElementType;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        size === "sm" && "size-8 [&_svg]:size-4",
        size === "md" && "size-10 [&_svg]:size-[18px]",
        size === "lg" && "size-12 [&_svg]:size-5",
        TONE_TILE[tone],
        className,
      )}
    >
      <Icon />
    </span>
  );
}

/** Tag with a tone: categories, types. Neutral tags stay `bg-muted`. */
export function ToneTag({ tone, icon: Icon, children, className }: { tone: Tone; icon?: React.ElementType; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", TONE_TILE[tone], className)}>
      {Icon ? <Icon className="size-3" aria-hidden /> : null}
      {children}
    </span>
  );
}

/**
 * Variation chip. `goodWhen` decides the color: a cheaper lead is good (green),
 * more spend is neither (`neutral`, blue).
 */
export function Delta({ value, goodWhen = "up", className }: { value: number | null; goodWhen?: "up" | "down" | "neutral"; className?: string }) {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded === 0) {
    return <span className={cn("rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground", className)}>0%</span>;
  }
  const up = rounded > 0;
  const good = goodWhen === "up" ? up : !up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const tone =
    goodWhen === "neutral"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
      : good
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
        : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
        tone,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {up ? "+" : ""}
      {rounded}%
    </span>
  );
}

/** KPI card (convenciones §4) with a tone. A link when it explains a list. */
export function KpiCard({
  icon,
  tone,
  label,
  value,
  helper,
  delta,
  href,
  active,
  className,
}: {
  icon: React.ElementType;
  tone: Tone;
  label: string;
  value: string;
  helper?: React.ReactNode;
  delta?: { value: number | null; goodWhen?: "up" | "down" | "neutral" };
  href?: string;
  active?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <IconTile icon={icon} tone={tone} className="max-sm:size-8 max-sm:[&_svg]:size-4" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground sm:truncate">{label}</p>
        <div className="flex flex-wrap items-center gap-x-1.5">
          <p className="text-xl font-semibold leading-tight tabular-nums sm:text-2xl">{value}</p>
          {delta ? <Delta value={delta.value} goodWhen={delta.goodWhen} /> : null}
        </div>
        {helper ? <p className="line-clamp-2 text-xs text-muted-foreground sm:truncate">{helper}</p> : null}
      </div>
    </>
  );
  const classes = cn(
    // Phone: icon above the figure, so a two-column grid keeps whole labels.
    "flex min-w-0 flex-col items-start gap-2 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4",
    active && cn("ring-2", TONE_RING[tone], TONE_WASH[tone]),
    className,
  );

  if (!href) return <div className={classes}>{body}</div>;
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn(classes, "transition-colors hover:bg-accent/40")}>
      {body}
    </Link>
  );
}
