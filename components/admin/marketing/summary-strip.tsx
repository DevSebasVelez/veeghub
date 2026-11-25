import Link from "next/link";
import { BellRing, CalendarClock, CheckCircle2, FileClock } from "lucide-react";

import { getMarketingSummary } from "@/lib/admin/queries/marketing";
import { CHANNELS } from "@/lib/marketing/constants";
import { cn } from "@/lib/utils";

function Tile({
  href,
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  value: string;
  helper: string;
  tone?: "alert";
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border bg-card p-3 transition-colors hover:bg-accent/40 sm:p-4"
    >
      <span
        className={cn(
          "hidden size-10 shrink-0 items-center justify-center rounded-full bg-muted sm:flex",
          tone === "alert" && "bg-orange-500/15 text-orange-600 dark:text-orange-300",
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums leading-tight">{value}</p>
        <p
          className={cn(
            "hidden truncate text-xs text-muted-foreground sm:block",
            tone === "alert" && "font-medium text-orange-700 dark:text-orange-300",
          )}
        >
          {helper}
        </p>
      </div>
    </Link>
  );
}

export async function MarketingSummary() {
  const summary = await getMarketingSummary();
  const list = "/admin/marketing/calendario?vista=lista";

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Tile
        href={list}
        icon={CalendarClock}
        label="Próximos 7 días"
        value={String(summary.nextWeek)}
        helper={
          summary.next
            ? `Sigue: ${CHANNELS[summary.next.channel].short} · ${summary.next.whenLabel}`
            : "Nada programado"
        }
      />
      <Tile
        href={list}
        icon={FileClock}
        label="Por aprobar (14 días)"
        value={String(summary.toApprove)}
        helper={summary.toApprove ? "Sin aprobar no llega el aviso a la hora" : "Todo aprobado"}
        tone={summary.toApprove ? "alert" : undefined}
      />
      <Tile
        href={list}
        icon={BellRing}
        label="Esperando publicación"
        value={String(summary.waiting)}
        helper={summary.waiting ? "Ya avisó: márcalo publicado con su URL" : "Nada pendiente"}
        tone={summary.waiting ? "alert" : undefined}
      />
      <Tile
        href="/admin/marketing/calendario"
        icon={CheckCircle2}
        label="Publicados este mes"
        value={String(summary.publishedThisMonth)}
        helper="Con su URL guardada"
      />
    </div>
  );
}
