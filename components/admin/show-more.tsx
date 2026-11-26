import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Page size for «Ver más» grids; the count lives in the URL (`?mostrar=`). */
export const SHOW_MORE_STEP = 24;

/** Reads `?mostrar=` as a multiple of the step, capped so a hand-typed URL can't ask for everything. */
export function readShowCount(value: string | undefined, step = SHOW_MORE_STEP, max = 480) {
  const requested = Number(value);
  if (!Number.isFinite(requested) || requested <= step) return step;
  return Math.min(max, Math.ceil(requested / step) * step);
}

/**
 * «Ver más» as a link: the next batch renders on the server, and back,
 * refresh or a shared link land on the same amount.
 */
export function ShowMoreLink({
  basePath,
  params,
  shown,
  total,
  step = SHOW_MORE_STEP,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  shown: number;
  /** Null when the total is unknown (only «there is more»). */
  total: number | null;
  step?: number;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value && key !== "mostrar") query.set(key, value);
  query.set("mostrar", String(shown + step));
  const remaining = total == null ? null : total - shown;

  return (
    <div className="flex flex-col items-center gap-1 pt-2">
      <Button asChild variant="outline" className="h-10 rounded-full px-5">
        <Link href={`${basePath}?${query.toString()}`} scroll={false}>
          <ChevronDown className="size-4" />
          Ver más{remaining != null ? ` (${remaining})` : ""}
        </Link>
      </Button>
      <p className="text-xs text-muted-foreground tabular-nums">
        Mostrando {shown}
        {total != null ? ` de ${total}` : ""}
      </p>
    </div>
  );
}
