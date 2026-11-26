import { TONE_SOLID, type Tone } from "@/components/admin/tone";
import { cn } from "@/lib/utils";

/** Horizontal bars for breakdowns: label, bar by share, value on the right. */
export function BarList({
  rows,
  tone = "indigo",
  empty = "Sin datos este mes.",
}: {
  rows: Array<{ key: string; label: string; share: number; value: string; helper?: string; tone?: Tone }>;
  tone?: Tone;
  empty?: string;
}) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.share), 1);

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {row.value}
              {row.helper ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{row.helper}</span> : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", TONE_SOLID[row.tone ?? tone])}
              style={{ width: `${Math.max(2, (row.share / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
