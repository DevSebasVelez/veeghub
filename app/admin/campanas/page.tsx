import {
  BadgeDollarSign,
  Download,
  Inbox,
  MessagesSquare,
  MousePointerClick,
  Radar,
  Target,
  Trophy,
} from "lucide-react";

import { CampaignList } from "@/components/admin/campaigns/campaign-list";
import { compact, money, percent } from "@/components/admin/campaigns/format";
import { FunnelCard } from "@/components/admin/campaigns/funnel";
import { chartLabel, kindOptions, readPeriod, stateOptions } from "@/components/admin/campaigns/page-helpers";
import { RecommendationsCard } from "@/components/admin/campaigns/recommendations";
import { SpendVsLeadsChart } from "@/components/admin/campaigns/spend-vs-leads-chart";
import { CampaignsToolbar } from "@/components/admin/campaigns/toolbar";
import { KpiCard } from "@/components/admin/tone";
import { Button } from "@/components/ui/button";
import { change, getAdsOverview, getRecommendations } from "@/lib/admin/queries/campaigns";
import { isCampaignKind, isDeliveryState } from "@/lib/meta/campaign-kind";
import type { PeriodParams } from "@/lib/meta/period";

type Params = PeriodParams & { estado?: string; tipo?: string };

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { today, period, query, months } = readPeriod(params);
  const filters = {
    state: isDeliveryState(params.estado) ? params.estado : undefined,
    kind: isCampaignKind(params.tipo) ? params.tipo : undefined,
  };

  const [overview, recommendations] = await Promise.all([getAdsOverview(period, filters), getRecommendations(today)]);
  const { totals, previous, reach } = overview;
  const vs = period.kind === "mes" ? "vs. mes anterior" : "vs. período anterior";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <CampaignsToolbar
          period={period.value}
          months={months}
          since={period.since}
          until={period.until}
          facets={[
            { param: "estado", label: "Estado", value: filters.state ?? "", options: stateOptions(overview.facets.states) },
            { param: "tipo", label: "Tipo", value: filters.kind ?? "", options: kindOptions(overview.facets.kinds) },
          ]}
        />
        <Button asChild variant="outline" className="h-10 rounded-full sm:h-9 lg:self-auto">
          <a href={`/api/admin/campanas/exportar?${query}`} download>
            <Download className="size-4" />
            Exportar CSV
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={BadgeDollarSign} tone="blue" label="Gasto" value={money(totals.spend)} helper={vs} delta={{ value: change(totals.spend, previous.spend), goodWhen: "neutral" }} />
        <KpiCard icon={Inbox} tone="violet" label="Leads en el CRM" value={String(totals.leads)} helper={`Meta contó ${totals.metaLeads}`} delta={{ value: change(totals.leads, previous.leads) }} href="/admin/leads" />
        <KpiCard icon={Target} tone="amber" label="Costo por lead" value={money(totals.cpl)} helper={vs} delta={{ value: change(totals.cpl, previous.cpl), goodWhen: "down" }} />
        <KpiCard icon={Trophy} tone="emerald" label="Clientes ganados" value={String(totals.won)} helper={totals.costPerWon != null ? `${money(totals.costPerWon)} c/u` : "Lo que realmente importa"} delta={{ value: change(totals.won, previous.won) }} />
        <KpiCard
          icon={Radar}
          tone="sky"
          label="Alcance"
          value={reach ? compact(reach.reach) : "—"}
          helper={reach ? `Frecuencia ${reach.frequency.toFixed(1)}×` : "Elige un mes o 7 días"}
        />
        <KpiCard icon={MessagesSquare} tone="teal" label="Conversaciones" value={String(totals.conversations)} helper={totals.costPerConversation != null ? `${money(totals.costPerConversation)} c/u` : "WhatsApp y Messenger"} />
        <KpiCard icon={MousePointerClick} tone="indigo" label="CTR" value={percent(totals.ctr, 2)} helper={`${compact(totals.clicks)} clics · CPM ${money(totals.cpm)}`} />
        <KpiCard icon={Trophy} tone="rose" label="Costo por calificado" value={money(totals.costPerQualified)} helper={`${totals.qualified} calificados · ${percent(totals.qualifiedRate, 0)}`} />
      </div>

      <RecommendationsCard items={recommendations} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">Gasto y resultados por día</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{period.label}. Barras: gasto. Líneas: leads y conversaciones.</p>
          </div>
          <SpendVsLeadsChart data={overview.series.map((point) => ({ ...point, label: chartLabel(point.day) }))} />
        </section>
        <FunnelCard metrics={totals} />
      </div>

      <CampaignList rows={overview.campaigns} query={query} />

      <p className="text-xs text-muted-foreground">
        Gasto, clics y alcance vienen de Meta; leads, calificados y clientes, de tu CRM (por la campaña de cada lead). El alcance no se
        suma entre días: se lee completo por mes o por 7 días.
      </p>
    </div>
  );
}
