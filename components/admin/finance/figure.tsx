import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/admin/format";
import { cn } from "@/lib/utils";

// What kind of number a figure is, shown next to it so a pending or estimated
// amount is never read as money already in hand.
export type FigureKind = "real" | "pending" | "estimate" | "reference";

const KIND: Record<FigureKind, { label: string; className: string }> = {
  real: {
    label: "Real",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  pending: {
    label: "Pendiente",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  estimate: {
    label: "Estimación",
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  },
  reference: {
    label: "Referencia",
    className:
      "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
  },
};

export function FigureKindBadge({ kind }: { kind: FigureKind }) {
  return (
    <Badge variant="outline" className={cn("border text-[10px]", KIND[kind].className)}>
      {KIND[kind].label}
    </Badge>
  );
}

export function Figure({
  label,
  value,
  kind,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string;
  kind: FigureKind;
  hint?: string;
  emphasis?: boolean;
}) {
  const negative = value.startsWith("-");

  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("text-sm", emphasis && "font-semibold")}>{label}</span>
          <FigureKindBadge kind={kind} />
        </div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          emphasis ? "text-lg font-bold" : "font-medium",
          negative && "text-destructive",
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}
