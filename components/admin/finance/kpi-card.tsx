import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { InfoTip } from "@/components/admin/finance/info-tip";
import { cn } from "@/lib/utils";

export type Tone = "blue" | "orange" | "emerald" | "amber" | "rose" | "violet" | "slate";

// Soft tinted circle behind the icon, as in the reference dashboards. The
// tint only decorates; the label always says what the number is.
export const TONE_STYLES: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300",
  orange: "bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export function IconBadge({
  icon: Icon,
  tone,
  size = "md",
}: {
  icon: LucideIcon;
  tone: Tone;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        size === "md" ? "size-11" : "size-8",
        TONE_STYLES[tone],
      )}
    >
      <Icon className={size === "md" ? "size-5" : "size-4"} />
    </span>
  );
}

export type Delta = {
  /** This period and the previous one, in cents. */
  current: number;
  previous: number;
  /** Whether a rise is good news (cash in) or bad news (cash out). */
  upIsGood: boolean;
};

/**
 * Change vs the previous month as a pill: arrow + signed percentage, colored
 * by whether the direction is good. The arrow and sign carry the meaning, so
 * it never relies on color alone.
 */
export function DeltaPill({ delta, label }: { delta: Delta; label: string }) {
  const { current, previous, upIsGood } = delta;

  // No base to compare against: say so instead of an infinite percentage.
  if (previous === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {current === 0 ? "Sin movimientos" : `Sin movimientos el mes anterior`}
      </span>
    );
  }

  const change = (current - previous) / Math.abs(previous);
  const percent = Math.round(change * 100);
  const flat = percent === 0;
  const good = flat ? null : percent > 0 === upIsGood;
  const Icon = flat ? Minus : percent > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums",
          good === null && "bg-muted text-muted-foreground",
          good === true &&
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
          good === false &&
            "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
        )}
      >
        <Icon className="size-3" />
        {percent > 0 ? "+" : ""}
        {percent}%
      </span>
      {label}
    </span>
  );
}

export function KpiCard({
  icon,
  tone,
  label,
  value,
  info,
  footer,
  href,
  emphasis = false,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  value: string;
  info?: string;
  footer?: React.ReactNode;
  href?: string;
  emphasis?: boolean;
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-colors sm:p-5",
        href && "hover:bg-accent/40",
        emphasis && "ring-1 ring-primary/10",
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <IconBadge icon={icon} tone={tone} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span className="truncate">{label}</span>
            {info ? <InfoTip text={info} /> : null}
          </div>
          <p
            className={cn(
              "mt-0.5 truncate font-semibold tracking-tight",
              emphasis ? "text-xl sm:text-3xl" : "text-xl sm:text-2xl",
              value.startsWith("-") && "text-rose-600 dark:text-rose-400",
            )}
          >
            {value}
          </p>
        </div>
      </div>
      {footer ? <div className="mt-auto">{footer}</div> : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
