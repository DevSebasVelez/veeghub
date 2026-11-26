// F8.5: simple, visible rules. Each one names the number that fired it, so the
// advice can be checked in Ads Manager. Nothing here writes to Meta.

import type { CampaignKind, DeliveryState } from "./campaign-kind";

export type RecommendationLevel = "alta" | "media" | "oportunidad";

export type Recommendation = {
  id: string;
  level: RecommendationLevel;
  title: string;
  detail: string;
  /** The figure that fired the rule, shown big on the card. */
  metric: string;
  campaignId?: string;
  adId?: string;
};

export type RecCampaign = {
  id: string;
  name: string;
  state: DeliveryState;
  kind: CampaignKind;
  hasBudget: boolean;
  spendLast2Days: number;
  spend7: number;
  leads7: number;
  spend30: number;
  leads30: number;
  frequency7: number | null;
};

export type RecAdSet = { id: string; name: string; campaignId: string; learningStatus: string | null; active: boolean };

export type RecAd = {
  id: string;
  name: string;
  campaignId: string;
  adSetId: string;
  state: DeliveryState;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  qualified: number;
};

export const THRESHOLDS = {
  frequency: 3,
  cplJump: 1.4,
  lowCtrRatio: 0.5,
  minImpressions: 1000,
  minLeadsForQuality: 5,
  lostLeads: 2,
} as const;

const money = (value: number) => `$${value.toFixed(2)}`;

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function buildRecommendations({
  campaigns,
  adSets,
  ads,
  metaLeads30,
  crmLeads30,
}: {
  campaigns: RecCampaign[];
  adSets: RecAdSet[];
  ads: RecAd[];
  /** Leads Meta counted in the last 30 days (form campaigns). */
  metaLeads30: number;
  /** Meta-sourced leads that reached the CRM in the same window. */
  crmLeads30: number;
}): Recommendation[] {
  const out: Recommendation[] = [];

  for (const ad of ads) {
    if (ad.state === "PROBLEMAS") {
      out.push({
        id: `ad-problem-${ad.id}`,
        level: "alta",
        title: "Anuncio rechazado o con problemas",
        detail: `«${ad.name}» no se está mostrando. Revisa el motivo en el Administrador de anuncios y corrígelo o duplícalo.`,
        metric: "Rechazado",
        campaignId: ad.campaignId,
        adId: ad.id,
      });
    }
  }

  for (const campaign of campaigns) {
    if (campaign.state === "ACTIVA" && campaign.hasBudget && campaign.spendLast2Days === 0) {
      out.push({
        id: `no-spend-${campaign.id}`,
        level: "alta",
        title: "Activa pero sin gastar",
        detail: `«${campaign.name}» está activa con presupuesto y no gastó nada en 2 días. Suele ser un anuncio rechazado, un pago pendiente o un público demasiado chico.`,
        metric: "$0 en 48 h",
        campaignId: campaign.id,
      });
    }

    if (campaign.frequency7 != null && campaign.frequency7 > THRESHOLDS.frequency && campaign.state !== "PAUSADA") {
      out.push({
        id: `frequency-${campaign.id}`,
        level: "media",
        title: "El público ya se cansó",
        detail: `En 7 días cada persona vio los anuncios de «${campaign.name}» ${campaign.frequency7.toFixed(1)} veces. Rota el creativo o amplía el público.`,
        metric: `${campaign.frequency7.toFixed(1)}× frecuencia`,
        campaignId: campaign.id,
      });
    }

    const cpl7 = campaign.leads7 ? campaign.spend7 / campaign.leads7 : null;
    const cpl30 = campaign.leads30 >= 3 ? campaign.spend30 / campaign.leads30 : null;
    if (cpl7 != null && cpl30 != null && campaign.spend7 >= 5 && cpl7 > cpl30 * THRESHOLDS.cplJump) {
      const jump = Math.round((cpl7 / cpl30 - 1) * 100);
      out.push({
        id: `cpl-${campaign.id}`,
        level: "alta",
        title: "El costo por lead se disparó",
        detail: `«${campaign.name}»: ${money(cpl7)} por lead esta semana contra ${money(cpl30)} de media en 30 días. Mira qué anuncio subió y pausa el más caro.`,
        metric: `+${jump}% CPL`,
        campaignId: campaign.id,
      });
    } else if (campaign.state === "ACTIVA" && campaign.spend7 >= 5 && campaign.leads7 === 0 && campaign.kind === "FORMULARIO") {
      out.push({
        id: `no-leads-${campaign.id}`,
        level: "alta",
        title: "Gasta pero no trae leads",
        detail: `«${campaign.name}» gastó ${money(campaign.spend7)} en 7 días sin un solo lead en el CRM. Revisa el formulario y la integración.`,
        metric: `${money(campaign.spend7)} · 0 leads`,
        campaignId: campaign.id,
      });
    }
  }

  for (const adSet of adSets) {
    if (adSet.active && adSet.learningStatus === "FAIL") {
      out.push({
        id: `learning-${adSet.id}`,
        level: "media",
        title: "Aprendizaje limitado",
        detail: `El conjunto «${adSet.name}» no junta suficientes resultados para salir de aprendizaje. Junta conjuntos o sube el presupuesto.`,
        metric: "Aprendizaje limitado",
        campaignId: adSet.campaignId,
      });
    }
  }

  const byAdSet = new Map<string, RecAd[]>();
  for (const ad of ads) byAdSet.set(ad.adSetId, [...(byAdSet.get(ad.adSetId) ?? []), ad]);
  for (const siblings of byAdSet.values()) {
    const measured = siblings.filter((ad) => ad.impressions >= THRESHOLDS.minImpressions);
    if (measured.length < 2) continue;
    const ctrs = measured.map((ad) => ad.clicks / ad.impressions);
    const reference = median(ctrs);
    for (const ad of measured) {
      const ctr = ad.clicks / ad.impressions;
      if (ad.state !== "PAUSADA" && reference > 0 && ctr < reference * THRESHOLDS.lowCtrRatio) {
        out.push({
          id: `ctr-${ad.id}`,
          level: "media",
          title: "Anuncio con CTR bajo",
          detail: `«${ad.name}» tiene ${(ctr * 100).toFixed(2)}% de CTR; sus hermanos, ${(reference * 100).toFixed(2)}%. Prueba otro gancho o pausa este.`,
          metric: `${(ctr * 100).toFixed(2)}% CTR`,
          campaignId: ad.campaignId,
          adId: ad.id,
        });
      }
    }
  }

  for (const ad of ads) {
    if (ad.leads >= THRESHOLDS.minLeadsForQuality && ad.qualified === 0) {
      out.push({
        id: `quality-${ad.id}`,
        level: "media",
        title: "Leads baratos que no califican",
        detail: `«${ad.name}» trajo ${ad.leads} leads y ninguno pasó a calificado. Ajusta las preguntas del formulario o el público.`,
        metric: `${ad.leads} leads · 0 calificados`,
        campaignId: ad.campaignId,
        adId: ad.id,
      });
    }
  }

  if (metaLeads30 - crmLeads30 >= THRESHOLDS.lostLeads) {
    out.push({
      id: "lost-leads",
      level: "alta",
      title: "Leads que no llegaron al CRM",
      detail: `Meta contó ${metaLeads30} leads en 30 días y al CRM llegaron ${crmLeads30}. El cron recupera los de los últimos 2 días; si la diferencia sigue (y no los borraste a mano), revisa Leads › Configuración.`,
      metric: `${metaLeads30 - crmLeads30} perdidos`,
    });
  }

  // The opportunity: put more money where clients (not only leads) come from.
  const winners = ads
    .filter((ad) => ad.qualified >= 2 && ad.spend > 0 && ad.state !== "PROBLEMAS")
    .map((ad) => ({ ad, cost: ad.spend / ad.qualified }))
    .sort((a, b) => a.cost - b.cost);
  if (winners.length) {
    const { ad, cost } = winners[0];
    out.push({
      id: `winner-${ad.id}`,
      level: "oportunidad",
      title: ad.state === "PAUSADA" ? "Tu mejor anuncio está pausado" : "Dale más presupuesto a tu mejor anuncio",
      detail: `«${ad.name}» consigue leads calificados a ${money(cost)} c/u, el más barato de la cuenta.${ad.state === "PAUSADA" ? " Reactívalo." : " Súbele el presupuesto a su conjunto de a poco (20 % cada 3 días)."}`,
      metric: `${money(cost)} / calificado`,
      campaignId: ad.campaignId,
      adId: ad.id,
    });
  }

  const order: Record<RecommendationLevel, number> = { alta: 0, media: 1, oportunidad: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
