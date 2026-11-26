import { BellRing, CalendarClock, CheckCircle2, FileClock } from "lucide-react";

import { KpiCard } from "@/components/admin/tone";
import { getMarketingSummary } from "@/lib/admin/queries/marketing";
import { CHANNELS } from "@/lib/marketing/constants";

export async function MarketingSummary() {
  const summary = await getMarketingSummary();
  const list = "/admin/marketing/calendario?vista=lista";

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiCard
        href={list}
        icon={CalendarClock}
        tone="blue"
        label="Próximos 7 días"
        value={String(summary.nextWeek)}
        helper={
          summary.next
            ? `Sigue: ${CHANNELS[summary.next.channel].short} · ${summary.next.whenLabel}`
            : "Nada programado"
        }
      />
      <KpiCard
        href={list}
        icon={FileClock}
        tone="amber"
        label="Por aprobar (14 días)"
        value={String(summary.toApprove)}
        helper={summary.toApprove ? "Sin aprobar no llega el aviso a la hora" : "Todo aprobado"}
        active={summary.toApprove > 0}
      />
      <KpiCard
        href={list}
        icon={BellRing}
        tone="orange"
        label="Esperando publicación"
        value={String(summary.waiting)}
        helper={summary.waiting ? "Ya avisó: márcalo publicado con su URL" : "Nada pendiente"}
        active={summary.waiting > 0}
      />
      <KpiCard
        href="/admin/marketing/calendario"
        icon={CheckCircle2}
        tone="emerald"
        label="Publicados este mes"
        value={String(summary.publishedThisMonth)}
        helper="Con su URL guardada"
      />
    </div>
  );
}
