// Pure helpers that turn Meta's enums into what Sebastián reads on screen.
// No Prisma, no fetch: they run in tests and in client components alike.

export const CAMPAIGN_KINDS = [
  "FORMULARIO",
  "WHATSAPP",
  "MESSENGER",
  "INSTAGRAM",
  "MENSAJES",
  "TRAFICO",
  "INTERACCION",
  "RECONOCIMIENTO",
  "VENTAS",
  "OTRO",
] as const;

export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];

export const CAMPAIGN_KIND_LABELS: Record<CampaignKind, string> = {
  FORMULARIO: "Formulario instantáneo",
  WHATSAPP: "Mensajes de WhatsApp",
  MESSENGER: "Mensajes de Messenger",
  INSTAGRAM: "Mensajes de Instagram",
  MENSAJES: "Mensajes (varias apps)",
  TRAFICO: "Tráfico al sitio",
  INTERACCION: "Interacción",
  RECONOCIMIENTO: "Reconocimiento",
  VENTAS: "Ventas",
  OTRO: "Otro",
};

export const CAMPAIGN_KIND_SHORT: Record<CampaignKind, string> = {
  FORMULARIO: "Formulario",
  WHATSAPP: "WhatsApp",
  MESSENGER: "Messenger",
  INSTAGRAM: "Instagram DM",
  MENSAJES: "Mensajes",
  TRAFICO: "Tráfico",
  INTERACCION: "Interacción",
  RECONOCIMIENTO: "Reconocimiento",
  VENTAS: "Ventas",
  OTRO: "Otro",
};

export function isCampaignKind(value: unknown): value is CampaignKind {
  return typeof value === "string" && (CAMPAIGN_KINDS as readonly string[]).includes(value);
}

type AdSetShape = { optimizationGoal?: string | null; destinationType?: string | null };

function kindFromAdSet({ optimizationGoal, destinationType }: AdSetShape): CampaignKind | null {
  const destination = destinationType ?? "";
  const goal = optimizationGoal ?? "";

  if (destination === "ON_AD" || goal === "LEAD_GENERATION" || goal === "QUALITY_LEAD") return "FORMULARIO";

  const messaging = destination.includes("MESSENGER") || destination.includes("WHATSAPP") || destination.includes("INSTAGRAM_DIRECT");
  if (messaging || goal === "CONVERSATIONS") {
    const apps = [
      destination.includes("WHATSAPP"),
      destination.includes("MESSENGER"),
      destination.includes("INSTAGRAM_DIRECT"),
    ].filter(Boolean).length;
    if (apps > 1) return "MENSAJES";
    if (destination.includes("WHATSAPP")) return "WHATSAPP";
    if (destination.includes("INSTAGRAM_DIRECT")) return "INSTAGRAM";
    if (destination.includes("MESSENGER")) return "MESSENGER";
    return "MENSAJES";
  }

  if (destination === "WEBSITE" || goal === "LINK_CLICKS" || goal === "LANDING_PAGE_VIEWS") return "TRAFICO";
  if (goal === "OFFSITE_CONVERSIONS" || goal === "VALUE") return "VENTAS";
  if (goal === "REACH" || goal === "IMPRESSIONS" || goal === "AD_RECALL_LIFT" || goal === "THRUPLAY") return "RECONOCIMIENTO";
  if (goal === "POST_ENGAGEMENT" || goal === "PAGE_LIKES" || destination.startsWith("ON_")) return "INTERACCION";
  return null;
}

function kindFromObjective(objective: string | null | undefined): CampaignKind {
  switch (objective) {
    case "OUTCOME_LEADS":
    case "LEAD_GENERATION":
      return "FORMULARIO";
    case "OUTCOME_TRAFFIC":
    case "LINK_CLICKS":
      return "TRAFICO";
    case "OUTCOME_ENGAGEMENT":
    case "POST_ENGAGEMENT":
      return "INTERACCION";
    case "MESSAGES":
      return "MENSAJES";
    case "OUTCOME_AWARENESS":
    case "REACH":
    case "BRAND_AWARENESS":
      return "RECONOCIMIENTO";
    case "OUTCOME_SALES":
    case "CONVERSIONS":
      return "VENTAS";
    default:
      return "OTRO";
  }
}

/**
 * The readable type. The objective alone is not enough: a WhatsApp campaign is
 * OUTCOME_ENGAGEMENT, same as a «boost this post» one. The ad sets' destination
 * decides; when they disagree, the one shared by most ad sets wins.
 */
export function campaignKind(objective: string | null | undefined, adSets: AdSetShape[] = []): CampaignKind {
  const votes = new Map<CampaignKind, number>();
  for (const adSet of adSets) {
    const kind = kindFromAdSet(adSet);
    if (kind) votes.set(kind, (votes.get(kind) ?? 0) + 1);
  }
  const winner = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return winner ?? kindFromObjective(objective);
}

export const DELIVERY_STATES = ["ACTIVA", "APRENDIZAJE", "PROGRAMADA", "PROBLEMAS", "PAUSADA", "TERMINADA"] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

export const DELIVERY_LABELS: Record<DeliveryState, string> = {
  ACTIVA: "Activa",
  APRENDIZAJE: "En aprendizaje",
  PROGRAMADA: "Programada",
  PROBLEMAS: "Con problemas",
  PAUSADA: "Pausada",
  TERMINADA: "Terminada",
};

export function isDeliveryState(value: unknown): value is DeliveryState {
  return typeof value === "string" && (DELIVERY_STATES as readonly string[]).includes(value);
}

const PROBLEM_STATES = new Set(["DISAPPROVED", "WITH_ISSUES", "PENDING_BILLING_INFO", "ADSET_DISAPPROVED"]);
const PAUSED_STATES = new Set(["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"]);
const ENDED_STATES = new Set(["ARCHIVED", "DELETED", "COMPLETED"]);

/** Collapses effective_status (+ learning and dates) into six states with fixed colors. */
export function deliveryState({
  effectiveStatus,
  learningStatus,
  startTime,
  stopTime,
  now = new Date(),
}: {
  effectiveStatus: string;
  learningStatus?: string | null;
  startTime?: Date | string | null;
  stopTime?: Date | string | null;
  now?: Date;
}): DeliveryState {
  if (PROBLEM_STATES.has(effectiveStatus)) return "PROBLEMAS";
  if (ENDED_STATES.has(effectiveStatus)) return "TERMINADA";
  if (PAUSED_STATES.has(effectiveStatus)) return "PAUSADA";
  if (stopTime && new Date(stopTime) < now) return "TERMINADA";
  if (startTime && new Date(startTime) > now) return "PROGRAMADA";
  if (effectiveStatus === "IN_PROCESS" || effectiveStatus === "PENDING_REVIEW") return "APRENDIZAJE";
  if (learningStatus === "LEARNING" || learningStatus === "FAIL") return "APRENDIZAJE";
  return effectiveStatus === "ACTIVE" ? "ACTIVA" : "PAUSADA";
}

export type MetaAction = { action_type?: string; value?: string };

/** Sums the given action types (Meta repeats the same lead under several aliases, so pass one). */
export function actionValue(actions: MetaAction[] | undefined, type: string) {
  const match = actions?.find((action) => action.action_type === type);
  return match ? Math.round(Number(match.value ?? 0)) || 0 : 0;
}

/** The three counts we keep from `actions`. */
export function actionCounts(actions: MetaAction[] | undefined) {
  return {
    linkClicks: actionValue(actions, "link_click"),
    metaLeads: actionValue(actions, "lead"),
    conversations: actionValue(actions, "onsite_conversion.messaging_conversation_started_7d"),
  };
}

/** Meta sends budgets in the account's minor unit ("500" = USD 5.00). "0" means none. */
export function budgetFromMeta(value: string | undefined | null) {
  const minor = Number(value ?? 0);
  return Number.isFinite(minor) && minor > 0 ? minor / 100 : null;
}

const COUNTRY_NAMES: Record<string, string> = { EC: "Ecuador", CO: "Colombia", PE: "Perú", US: "EE. UU." };

type Targeting = {
  age_min?: number;
  age_max?: number;
  genders?: number[];
  geo_locations?: {
    countries?: string[];
    regions?: Array<{ name?: string }>;
    cities?: Array<{ name?: string }>;
  };
};

/** «18–65 · Ecuador» or «25–55 · Mujeres · Cuenca, Quito». */
export function audienceSummary(targeting: Targeting | undefined | null) {
  if (!targeting) return null;
  const parts: string[] = [];
  if (targeting.age_min || targeting.age_max) {
    parts.push(`${targeting.age_min ?? 18}–${targeting.age_max ?? 65}${targeting.age_max === 65 ? "+" : ""}`);
  }
  if (targeting.genders?.length === 1) parts.push(targeting.genders[0] === 1 ? "Hombres" : "Mujeres");
  const geo = targeting.geo_locations;
  const places = [
    ...(geo?.cities ?? []).map((city) => city.name),
    ...(geo?.regions ?? []).map((region) => region.name),
    ...(geo?.countries ?? []).map((code) => COUNTRY_NAMES[code] ?? code),
  ].filter(Boolean) as string[];
  if (places.length) parts.push(places.slice(0, 3).join(", ") + (places.length > 3 ? ` +${places.length - 3}` : ""));
  return parts.join(" · ") || null;
}

/** Link to the campaign in Ads Manager, for anything the panel cannot change. */
export function adsManagerUrl(accountId: string | null | undefined, campaignId?: string | null) {
  const act = (accountId ?? "").replace(/^act_/, "");
  const url = new URL("https://adsmanager.facebook.com/adsmanager/manage/campaigns");
  if (act) url.searchParams.set("act", act);
  if (campaignId) url.searchParams.set("selected_campaign_ids", campaignId);
  return url.toString();
}
