import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeDollarSign,
  ChevronLeft,
  ExternalLink,
  Inbox,
  Layers,
  MessagesSquare,
  Radar,
  Target,
  Trophy,
} from "lucide-react";

import { AdCard } from "@/components/admin/campaigns/ad-card";
import { DeliveryBadge, KIND_STYLE, KindTag } from "@/components/admin/campaigns/badges";
import { budgetLabel, compact, money, percent } from "@/components/admin/campaigns/format";
import { chartLabel, readPeriod } from "@/components/admin/campaigns/page-helpers";
import { RecommendationsCard } from "@/components/admin/campaigns/recommendations";
import { SpendVsLeadsChart } from "@/components/admin/campaigns/spend-vs-leads-chart";
import { CampaignsToolbar } from "@/components/admin/campaigns/toolbar";
import { STAGE_LABELS, STAGE_TEXT_COLOR } from "@/components/admin/leads/constants";
import { IconTile, KpiCard } from "@/components/admin/tone";
import { Button } from "@/components/ui/button";
import { formatDate, shortAge } from "@/lib/admin/format";
import { getCampaignDetail, getRecommendations, isMessagingKind } from "@/lib/admin/queries/campaigns";
import { adsManagerUrl, CAMPAIGN_KIND_LABELS } from "@/lib/meta/campaign-kind";
import type { PeriodParams } from "@/lib/meta/period";
import { cn } from "@/lib/utils";

const OBJECTIVES: Record<string, string> = {
  OUTCOME_LEADS: "Clientes potenciales",
  OUTCOME_ENGAGEMENT: "Interacción",
  OUTCOME_TRAFFIC: "Tráfico",
  OUTCOME_AWARENESS: "Reconocimiento",
  OUTCOME_SALES: "Ventas",
  OUTCOME_APP_PROMOTION: "Promoción de app",
};

const GOALS: Record<string, string> = {
  LEAD_GENERATION: "Leads (formulario)",
  QUALITY_LEAD: "Leads de calidad",
  CONVERSATIONS: "Conversaciones",
  LINK_CLICKS: "Clics al enlace",
  LANDING_PAGE_VIEWS: "Visitas a la página",
  POST_ENGAGEMENT: "Interacción",
  REACH: "Alcance",
  IMPRESSIONS: "Impresiones",
  THRUPLAY: "Reproducciones",
  OFFSITE_CONVERSIONS: "Conversiones",
};

const LEARNING: Record<string, string> = { LEARNING: "En aprendizaje", FAIL: "Aprendizaje limitado", SUCCESS: "Aprendizaje completado" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{children}</span>
    </div>
  );
}

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<PeriodParams>;
}) {
  const { id } = await params;
  const { today, period, months, query } = readPeriod(await searchParams);
  const [campaign, allRecs] = await Promise.all([getCampaignDetail(id, period), getRecommendations(today)]);
  if (!campaign) notFound();

  const recs = allRecs.filter((rec) => rec.campaignId === id);
  const metrics = campaign.metrics;
  const messaging = isMessagingKind(campaign.kind);
  const kindStyle = KIND_STYLE[campaign.kind];

  return (
    <div className="space-y-4">
      <Link
        href={`/admin/campanas?${query}`}
        className="-ml-1 inline-flex min-h-10 items-center gap-1 px-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Campañas
      </Link>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile icon={kindStyle.icon} tone={kindStyle.tone} size="lg" />
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight [overflow-wrap:anywhere]">{campaign.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <DeliveryBadge state={campaign.state} />
              <KindTag kind={campaign.kind} />
              <span className="text-xs text-muted-foreground">{budgetLabel(campaign.dailyBudget, campaign.lifetimeBudget)}</span>
            </div>
          </div>
        </div>
        <CampaignsToolbar period={period.value} months={months} since={period.since} until={period.until} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside className="max-lg:contents lg:sticky lg:top-20 lg:order-2 lg:space-y-4">
          <section className="rounded-2xl border bg-card px-5 py-3 max-lg:order-1">
            <div className="divide-y">
              <Row label="Tipo">{CAMPAIGN_KIND_LABELS[campaign.kind]}</Row>
              {campaign.objective ? <Row label="Objetivo">{OBJECTIVES[campaign.objective] ?? campaign.objective}</Row> : null}
              <Row label="Presupuesto">{budgetLabel(campaign.dailyBudget, campaign.lifetimeBudget)}</Row>
              {campaign.startTime ? <Row label="Inicio">{formatDate(campaign.startTime)}</Row> : null}
              {campaign.stopTime ? <Row label="Fin">{formatDate(campaign.stopTime)}</Row> : null}
              <Row label="Frecuencia 7 días">
                <span className={cn("tabular-nums", (campaign.frequency7 ?? 0) > 3 && "text-amber-600 dark:text-amber-300")}>
                  {campaign.frequency7 != null ? `${campaign.frequency7.toFixed(1)}×` : "—"}
                </span>
              </Row>
              <Row label="Datos de Meta">{shortAge(campaign.syncedAt)}</Row>
            </div>
            <Button asChild variant="outline" className="my-2 h-10 w-full rounded-full">
              <a href={adsManagerUrl(campaign.accountId, campaign.id)} target="_blank" rel="noopener noreferrer">
                Editar en Meta <ExternalLink className="size-3.5" />
              </a>
            </Button>
            <p className="pb-2 text-center text-[11px] text-muted-foreground">Pausar o cambiar presupuesto se hace en Meta.</p>
          </section>

          <section className="overflow-hidden rounded-2xl border bg-card max-lg:order-4">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="text-sm font-semibold">Últimos leads</h3>
              <Link href="/admin/leads" className="text-xs text-muted-foreground hover:text-foreground">
                Ver todos
              </Link>
            </div>
            {campaign.recentLeads.length ? (
              <ul className="divide-y">
                {campaign.recentLeads.map((lead) => (
                  <li key={lead.id}>
                    <Link href={`/admin/leads/${lead.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-accent/40">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{lead.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{lead.metaAdName ?? "—"}</span>
                      </span>
                      <span className={cn("shrink-0 text-xs font-medium", STAGE_TEXT_COLOR[lead.stage])}>{STAGE_LABELS[lead.stage] ?? lead.stage}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">{messaging ? "Las conversaciones llegan a WhatsApp/Messenger, no al CRM." : "Aún no llegan leads de esta campaña."}</p>
            )}
          </section>
        </aside>

        <div className="min-w-0 space-y-4 max-lg:order-2 lg:order-1">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiCard icon={BadgeDollarSign} tone="blue" label="Gasto" value={money(metrics.spend)} helper={`CPM ${money(metrics.cpm)}`} />
            {messaging ? (
              <KpiCard icon={MessagesSquare} tone="teal" label="Conversaciones" value={String(metrics.conversations)} helper={`${money(metrics.costPerConversation)} c/u`} />
            ) : (
              <KpiCard icon={Inbox} tone="violet" label="Leads en el CRM" value={String(metrics.leads)} helper={`${money(metrics.cpl)} c/u · Meta: ${metrics.metaLeads}`} />
            )}
            <KpiCard icon={Target} tone="amber" label="Calificados" value={String(metrics.qualified)} helper={`${money(metrics.costPerQualified)} c/u`} />
            <KpiCard icon={Trophy} tone="emerald" label="Clientes" value={String(metrics.won)} helper={metrics.won ? `${money(metrics.costPerWon)} c/u` : `CTR ${percent(metrics.ctr, 2)}`} />
          </div>

          {recs.length ? <RecommendationsCard items={recs} limit={2} /> : null}

          <section className="rounded-2xl border bg-card p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Por día</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{period.label}</p>
              </div>
              {campaign.reach ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                  <Radar className="size-3.5" /> {compact(campaign.reach.reach)} personas · {campaign.reach.frequency.toFixed(1)}×
                </span>
              ) : null}
            </div>
            <SpendVsLeadsChart data={campaign.series.map((point) => ({ ...point, label: chartLabel(point.day) }))} className="aspect-auto h-52 w-full md:h-64" />
          </section>

          <section className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex items-center gap-3 border-b px-5 py-4">
              <IconTile icon={Layers} tone="indigo" size="sm" />
              <div>
                <h3 className="text-sm font-semibold">Conjuntos de anuncios</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">A quién se muestra, con qué meta y cuánto rinde cada uno.</p>
              </div>
            </div>
            <ul className="divide-y">
              {campaign.adSets.map((set) => (
                <li key={set.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium [overflow-wrap:anywhere]">{set.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[GOALS[set.optimizationGoal ?? ""] ?? set.optimizationGoal, set.audience, budgetLabel(set.dailyBudget, set.lifetimeBudget)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {set.learningStatus && set.learningStatus !== "SUCCESS" ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          {LEARNING[set.learningStatus] ?? set.learningStatus}
                        </span>
                      ) : null}
                      <DeliveryBadge state={set.state} />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <Mini label="Gasto" value={money(set.metrics.spend)} />
                    <Mini label={messaging ? "Conversaciones" : "Leads"} value={String(messaging ? set.metrics.conversations : set.metrics.leads)} />
                    <Mini label="Calificados" value={String(set.metrics.qualified)} />
                    <Mini label="Costo/calificado" value={money(set.metrics.costPerQualified)} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="px-1 text-sm font-semibold">Anuncios</h3>
            {campaign.ads.length ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {campaign.ads.map((ad, index) => (
                  <AdCard key={ad.id} ad={ad} rank={index + 1} showCampaign={false} />
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">Ningún anuncio gastó en este período.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
