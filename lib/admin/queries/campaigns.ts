import { cache } from "react";

import prisma from "@/lib/db/prisma";
import { dayKeyInAppZone, dayStartInstant } from "@/lib/admin/format";
import {
  campaignKind,
  deliveryState,
  type CampaignKind,
  type DeliveryState,
} from "@/lib/meta/campaign-kind";
import { daysBetween, monthBounds, monthLabel, recentMonths, shiftKey, type Period } from "@/lib/meta/period";
import { buildRecommendations, type Recommendation } from "@/lib/meta/recommendations";

/**
 * F8 — Centro de Meta Ads. Everything here reads what lib/meta/sync.ts stored;
 * nothing calls Meta. Spend and Meta's own counts come from the insights
 * tables; leads, qualified and won come from the CRM (Lead.meta*Id), which is
 * what really reached us.
 */

const DAY_MS = 86_400_000;
const QUALIFIED = new Set(["QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON"]);
const MESSAGING: ReadonlySet<CampaignKind> = new Set(["WHATSAPP", "MESSENGER", "INSTAGRAM", "MENSAJES"]);

export function isMessagingKind(kind: CampaignKind) {
  return MESSAGING.has(kind);
}

// ---------------------------------------------------------------- math

export type Totals = {
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  metaLeads: number;
  conversations: number;
  leads: number;
  contacted: number;
  qualified: number;
  won: number;
};

export type Metrics = Totals & {
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpl: number | null;
  costPerConversation: number | null;
  costPerQualified: number | null;
  costPerWon: number | null;
  contactedRate: number | null;
  qualifiedRate: number | null;
  wonRate: number | null;
};

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

function emptyTotals(): Totals {
  return { spend: 0, impressions: 0, clicks: 0, linkClicks: 0, metaLeads: 0, conversations: 0, leads: 0, contacted: 0, qualified: 0, won: 0 };
}

function add(target: Totals, source: Partial<Totals>) {
  for (const key of Object.keys(source) as Array<keyof Totals>) target[key] += source[key] ?? 0;
  return target;
}

export function derive(totals: Totals): Metrics {
  return {
    ...totals,
    ctr: ratio(totals.clicks * 100, totals.impressions),
    cpc: ratio(totals.spend, totals.clicks),
    cpm: ratio(totals.spend * 1000, totals.impressions),
    cpl: ratio(totals.spend, totals.leads),
    costPerConversation: ratio(totals.spend, totals.conversations),
    costPerQualified: ratio(totals.spend, totals.qualified),
    costPerWon: ratio(totals.spend, totals.won),
    contactedRate: ratio(totals.contacted * 100, totals.leads),
    qualifiedRate: ratio(totals.qualified * 100, totals.leads),
    wonRate: ratio(totals.won * 100, totals.leads),
  };
}

/** Percent change, or null when there is nothing to compare against. */
export function change(current: number | null, previous: number | null) {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// ---------------------------------------------------------------- loaders

function dateOnly(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Real instants for timestamp columns, from calendar-day keys. */
function instantRange(since: string, until: string) {
  const from = dayStartInstant(new Date(`${since}T12:00:00.000Z`));
  const to = new Date(dayStartInstant(new Date(`${until}T12:00:00.000Z`)).getTime() + DAY_MS - 1);
  return { gte: from, lte: to };
}

type LeadFact = { campaignId: string | null; adSetId: string | null; adId: string | null; stage: string; day: string };

async function loadLeads(since: string, until: string): Promise<LeadFact[]> {
  const rows = await prisma.lead.findMany({
    where: { createdAt: instantRange(since, until), metaCampaignId: { not: null } },
    select: { metaCampaignId: true, metaAdsetId: true, metaAdId: true, stage: true, createdAt: true },
  });
  return rows.map((row) => ({
    campaignId: row.metaCampaignId,
    adSetId: row.metaAdsetId,
    adId: row.metaAdId,
    stage: row.stage,
    day: dayKeyInAppZone(row.createdAt),
  }));
}

function leadTotals(lead: LeadFact): Partial<Totals> {
  return {
    leads: 1,
    contacted: lead.stage === "NEW" ? 0 : 1,
    qualified: QUALIFIED.has(lead.stage) ? 1 : 0,
    won: lead.stage === "WON" ? 1 : 0,
  };
}

async function loadCampaignDays(since: string, until: string) {
  return prisma.metaCampaignInsight.findMany({
    where: { date: { gte: dateOnly(since), lte: dateOnly(until) } },
    select: {
      campaignId: true,
      campaignName: true,
      date: true,
      spend: true,
      impressions: true,
      clicks: true,
      linkClicks: true,
      metaLeads: true,
      conversations: true,
    },
  });
}

async function loadAdDays(since: string, until: string, campaignId?: string) {
  return prisma.metaAdInsight.findMany({
    where: { date: { gte: dateOnly(since), lte: dateOnly(until) }, ...(campaignId ? { campaignId } : {}) },
  });
}

function insightTotals(row: {
  spend: unknown;
  impressions: number;
  clicks: number;
  linkClicks: number;
  metaLeads: number;
  conversations: number;
}): Partial<Totals> {
  return {
    spend: Number(row.spend),
    impressions: row.impressions,
    clicks: row.clicks,
    linkClicks: row.linkClicks,
    metaLeads: row.metaLeads,
    conversations: row.conversations,
  };
}

// Layout, page and recommendations all need it: one query per request.
const loadStructure = cache(async () => {
  return prisma.metaCampaign.findMany({
    include: {
      adSets: { select: { id: true, name: true, effectiveStatus: true, optimizationGoal: true, destinationType: true, learningStatus: true, dailyBudget: true, lifetimeBudget: true, startTime: true, endTime: true, campaignId: true, audience: true, billingEvent: true } },
      ads: { select: { id: true, name: true, effectiveStatus: true, thumbnailUrl: true, adSetId: true, title: true, body: true, reviewFeedback: true, createdTime: true } },
    },
  });
});

type Structure = Awaited<ReturnType<typeof loadStructure>>[number];

function campaignState(campaign: Structure, now = new Date()): DeliveryState {
  const state = deliveryState({
    effectiveStatus: campaign.effectiveStatus,
    startTime: campaign.startTime,
    stopTime: campaign.stopTime,
    now,
  });
  if (state !== "ACTIVA") return state;
  // Active, but an active ad set still learning (or a rejected ad) says more.
  const activeSets = campaign.adSets.filter((set) => set.effectiveStatus === "ACTIVE");
  if (campaign.ads.some((ad) => ad.effectiveStatus === "DISAPPROVED" || ad.effectiveStatus === "WITH_ISSUES")) return "PROBLEMAS";
  if (activeSets.length && activeSets.every((set) => set.learningStatus === "LEARNING" || set.learningStatus === "FAIL")) return "APRENDIZAJE";
  return "ACTIVA";
}

function budgetOf(campaign: Structure) {
  const daily = campaign.dailyBudget
    ? Number(campaign.dailyBudget)
    : campaign.adSets
        .filter((set) => set.effectiveStatus === "ACTIVE")
        .reduce((sum, set) => sum + Number(set.dailyBudget ?? 0), 0);
  const lifetime = campaign.lifetimeBudget
    ? Number(campaign.lifetimeBudget)
    : campaign.adSets.reduce((sum, set) => sum + Number(set.lifetimeBudget ?? 0), 0);
  return { daily: daily || null, lifetime: lifetime || null };
}

// ---------------------------------------------------------------- sync info

export type SyncInfo = {
  name: string | null;
  accountId: string;
  lastSyncedAt: string | null;
  lastFullSyncAt: string | null;
  lastBackfillAt: string | null;
  lastSyncError: string | null;
  usage: number | null;
  tier: string | null;
};

export const getSyncInfo = cache(async (): Promise<SyncInfo | null> => {
  const account = await prisma.metaAdAccount.findFirst();
  if (!account) return null;
  return {
    name: account.name,
    accountId: account.accountId,
    lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
    lastFullSyncAt: account.lastFullSyncAt?.toISOString() ?? null,
    lastBackfillAt: account.lastBackfillAt?.toISOString() ?? null,
    lastSyncError: account.lastSyncError,
    usage: account.usageCallCount,
    tier: account.accessTier,
  };
});

// ---------------------------------------------------------------- overview

export type CampaignListRow = Metrics & {
  id: string;
  name: string;
  state: DeliveryState;
  kind: CampaignKind;
  objective: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  adsActive: number;
  adsTotal: number;
  thumbnail: string | null;
  startTime: string | null;
};

export type CampaignFilters = { state?: DeliveryState; kind?: CampaignKind };

export type SeriesPoint = { day: string; spend: number; leads: number; conversations: number };

function seriesOf(since: string, until: string, days: Array<{ date: Date; spend: unknown; conversations: number }>, leads: LeadFact[]): SeriesPoint[] {
  const spend = new Map<string, number>();
  const conversations = new Map<string, number>();
  for (const row of days) {
    const key = row.date.toISOString().slice(0, 10);
    spend.set(key, (spend.get(key) ?? 0) + Number(row.spend));
    conversations.set(key, (conversations.get(key) ?? 0) + row.conversations);
  }
  const leadsByDay = new Map<string, number>();
  for (const lead of leads) leadsByDay.set(lead.day, (leadsByDay.get(lead.day) ?? 0) + 1);

  const count = daysBetween(since, until);
  return Array.from({ length: count }, (_, index) => {
    const day = shiftKey(since, index);
    return { day, spend: spend.get(day) ?? 0, leads: leadsByDay.get(day) ?? 0, conversations: conversations.get(day) ?? 0 };
  });
}

/** Reach can only be read whole: a calendar month or the rolling 7 days. */
async function periodReach(period: Period, campaignId = "") {
  if (period.month) {
    const stat = await prisma.metaPeriodStat.findUnique({
      where: { kind_campaignId_since: { kind: "month", campaignId, since: dateOnly(monthBounds(period.month).since) } },
    });
    return stat ? { reach: stat.reach, frequency: stat.frequency, source: "mes" as const } : null;
  }
  if (period.kind === "dias" && period.days === 7) {
    const stat = await prisma.metaPeriodStat.findFirst({ where: { kind: "rolling7", campaignId } });
    return stat ? { reach: stat.reach, frequency: stat.frequency, source: "7d" as const } : null;
  }
  return null;
}

export async function getAdsOverview(period: Period, filters: CampaignFilters = {}) {
  const now = new Date();
  const [structure, days, prevDays, leads, prevLeads, sync] = await Promise.all([
    loadStructure(),
    loadCampaignDays(period.since, period.until),
    loadCampaignDays(period.previous.since, period.previous.until),
    loadLeads(period.since, period.until),
    loadLeads(period.previous.since, period.previous.until),
    getSyncInfo(),
  ]);

  const byId = new Map(structure.map((campaign) => [campaign.id, campaign]));
  const totals = new Map<string, Totals>();
  const names = new Map<string, string>();
  const ensure = (id: string) => totals.get(id) ?? totals.set(id, emptyTotals()).get(id)!;

  for (const row of days) {
    add(ensure(row.campaignId), insightTotals(row));
    names.set(row.campaignId, row.campaignName);
  }
  for (const lead of leads) if (lead.campaignId) add(ensure(lead.campaignId), leadTotals(lead));

  // Campaigns in the period plus every campaign running right now, even at $0.
  const ids = new Set([...totals.keys(), ...structure.filter((c) => c.effectiveStatus === "ACTIVE").map((c) => c.id)]);

  const rows: CampaignListRow[] = [...ids].map((id) => {
    const campaign = byId.get(id);
    const metrics = derive(totals.get(id) ?? emptyTotals());
    if (!campaign) {
      return {
        ...metrics,
        id,
        name: names.get(id) ?? `Campaña ${id}`,
        state: "TERMINADA" as const,
        kind: "OTRO" as const,
        objective: null,
        dailyBudget: null,
        lifetimeBudget: null,
        adsActive: 0,
        adsTotal: 0,
        thumbnail: null,
        startTime: null,
      };
    }
    const budget = budgetOf(campaign);
    const activeAds = campaign.ads.filter((ad) => ad.effectiveStatus === "ACTIVE");
    return {
      ...metrics,
      id,
      name: campaign.name,
      state: campaignState(campaign, now),
      kind: campaignKind(campaign.objective, campaign.adSets),
      objective: campaign.objective,
      dailyBudget: budget.daily,
      lifetimeBudget: budget.lifetime,
      adsActive: activeAds.length,
      adsTotal: campaign.ads.length,
      thumbnail: (activeAds[0] ?? campaign.ads[0])?.thumbnailUrl ?? null,
      startTime: campaign.startTime?.toISOString() ?? null,
    };
  });

  const facets = {
    states: countBy(rows.map((row) => row.state)),
    kinds: countBy(rows.map((row) => row.kind)),
  };

  const visible = rows
    .filter((row) => (!filters.state || row.state === filters.state) && (!filters.kind || row.kind === filters.kind))
    .sort((a, b) => stateRank(a.state) - stateRank(b.state) || b.spend - a.spend);

  const visibleIds = new Set(visible.map((row) => row.id));
  const filtered = Boolean(filters.state || filters.kind);
  const keep = (id: string | null) => !filtered || (id != null && visibleIds.has(id));

  const current = emptyTotals();
  for (const row of days) if (keep(row.campaignId)) add(current, insightTotals(row));
  for (const lead of leads) if (keep(lead.campaignId)) add(current, leadTotals(lead));
  const previous = emptyTotals();
  for (const row of prevDays) if (keep(row.campaignId)) add(previous, insightTotals(row));
  for (const lead of prevLeads) if (keep(lead.campaignId)) add(previous, leadTotals(lead));

  return {
    sync,
    totals: derive(current),
    previous: derive(previous),
    reach: filtered ? null : await periodReach(period),
    series: seriesOf(
      period.since,
      period.until,
      days.filter((row) => keep(row.campaignId)),
      leads.filter((lead) => keep(lead.campaignId)),
    ),
    campaigns: visible,
    facets,
    hasStructure: structure.length > 0,
  };
}

function countBy<T extends string>(values: T[]) {
  const out: Partial<Record<T, number>> = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
}

const STATE_ORDER: DeliveryState[] = ["PROBLEMAS", "ACTIVA", "APRENDIZAJE", "PROGRAMADA", "PAUSADA", "TERMINADA"];
function stateRank(state: DeliveryState) {
  return STATE_ORDER.indexOf(state);
}

// ---------------------------------------------------------------- month by month

export type MonthRow = Metrics & {
  month: string;
  label: string;
  shortLabel: string;
  reach: number | null;
  frequency: number | null;
  spendChange: number | null;
  cplChange: number | null;
};

export async function getMonthlyReport(today: string, count = 12): Promise<MonthRow[]> {
  const months = recentMonths(today, count).reverse();
  const first = monthBounds(months[0]).since;

  const [stats, days, leads] = await Promise.all([
    prisma.metaPeriodStat.findMany({ where: { kind: "month", campaignId: "", since: { gte: dateOnly(first) } } }),
    loadCampaignDays(first, today),
    loadLeads(first, today),
  ]);

  const statByMonth = new Map(stats.map((stat) => [stat.since.toISOString().slice(0, 7), stat]));
  const byMonth = new Map(months.map((month) => [month, emptyTotals()]));
  for (const row of days) {
    const bucket = byMonth.get(row.date.toISOString().slice(0, 7));
    if (bucket) add(bucket, insightTotals(row));
  }
  for (const lead of leads) {
    const bucket = byMonth.get(lead.day.slice(0, 7));
    if (bucket) add(bucket, leadTotals(lead));
  }

  let prev: MonthRow | null = null;
  const rows: MonthRow[] = [];
  for (const month of months) {
    const totals = byMonth.get(month)!;
    const stat = statByMonth.get(month);
    // Meta's monthly figure wins: daily rows older than the sync window may be missing.
    if (stat && Number(stat.spend) > totals.spend) {
      totals.spend = Number(stat.spend);
      totals.impressions = stat.impressions;
    }
    const metrics = derive(totals);
    const row: MonthRow = {
      ...metrics,
      month,
      label: monthLabel(month),
      shortLabel: monthLabel(month, true),
      reach: stat?.reach ?? null,
      frequency: stat?.frequency ?? null,
      spendChange: prev ? change(metrics.spend, prev.spend) : null,
      cplChange: prev ? change(metrics.cpl, prev.cpl) : null,
    };
    rows.push(row);
    prev = row;
  }

  // Drop the empty months before the account's first spend.
  const firstActive = rows.findIndex((row) => row.spend > 0 || row.leads > 0);
  return firstActive === -1 ? [] : rows.slice(firstActive);
}

// ---------------------------------------------------------------- ads

export type AdRow = Metrics & {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  adSetId: string;
  adSetName: string;
  state: DeliveryState;
  thumbnail: string | null;
  title: string | null;
  body: string | null;
  kind: CampaignKind;
};

export async function getAdsReport(period: Period, campaignId?: string): Promise<AdRow[]> {
  const [structure, days, leads] = await Promise.all([
    loadStructure(),
    loadAdDays(period.since, period.until, campaignId),
    loadLeads(period.since, period.until),
  ]);

  const totals = new Map<string, Totals>();
  const ensure = (id: string) => totals.get(id) ?? totals.set(id, emptyTotals()).get(id)!;
  for (const row of days) add(ensure(row.adId), insightTotals(row));
  for (const lead of leads) {
    if (!lead.adId || (campaignId && lead.campaignId !== campaignId)) continue;
    add(ensure(lead.adId), leadTotals(lead));
  }

  const rows: AdRow[] = [];
  for (const campaign of structure) {
    if (campaignId && campaign.id !== campaignId) continue;
    const kind = campaignKind(campaign.objective, campaign.adSets);
    const sets = new Map(campaign.adSets.map((set) => [set.id, set]));
    for (const ad of campaign.ads) {
      const metrics = derive(totals.get(ad.id) ?? emptyTotals());
      const running = ad.effectiveStatus === "ACTIVE";
      if (!running && metrics.spend === 0 && metrics.leads === 0) continue;
      rows.push({
        ...metrics,
        id: ad.id,
        name: ad.name,
        campaignId: campaign.id,
        campaignName: campaign.name,
        adSetId: ad.adSetId,
        adSetName: sets.get(ad.adSetId)?.name ?? "",
        state: deliveryState({ effectiveStatus: ad.effectiveStatus }),
        thumbnail: ad.thumbnailUrl,
        title: ad.title,
        body: ad.body,
        kind,
      });
    }
  }

  // «Qué anuncio trae clientes, no sólo leads»: won, then qualified, then cheapest lead.
  return rows.sort(
    (a, b) =>
      b.won - a.won ||
      b.qualified - a.qualified ||
      (a.costPerQualified ?? Infinity) - (b.costPerQualified ?? Infinity) ||
      b.leads - a.leads ||
      b.spend - a.spend,
  );
}

// ---------------------------------------------------------------- audience

export type BreakdownRow = {
  key: string;
  label: string;
  group?: string;
  spend: number;
  impressions: number;
  clicks: number;
  metaLeads: number;
  share: number;
  cpl: number | null;
  ctr: number | null;
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  messenger: "Messenger",
  audience_network: "Audience Network",
  threads: "Threads",
  whatsapp: "WhatsApp",
  unknown: "Sin dato",
};

const POSITION_LABELS: Record<string, string> = {
  feed: "Feed",
  facebook_reels: "Reels",
  instagram_reels: "Reels",
  facebook_reels_overlay: "Reels (overlay)",
  story: "Historias",
  facebook_stories: "Historias",
  instagram_stories: "Historias",
  instagram_explore: "Explorar",
  instagram_explore_grid_home: "Explorar",
  marketplace: "Marketplace",
  video_feeds: "Videos",
  instream_video: "Video in-stream",
  search: "Búsqueda",
  right_hand_column: "Columna derecha",
  an_classic: "Apps",
  rewarded_video: "Video recompensado",
  messenger_inbox: "Bandeja",
  profile_feed: "Perfil",
  instagram_profile_feed: "Perfil",
};

const GENDER_LABELS: Record<string, string> = { male: "Hombres", female: "Mujeres", unknown: "Sin dato" };

function finish(rows: Omit<BreakdownRow, "share" | "cpl" | "ctr">[]): BreakdownRow[] {
  const total = rows.reduce((sum, row) => sum + row.spend, 0);
  return rows
    .map((row) => ({
      ...row,
      share: total ? (row.spend / total) * 100 : 0,
      cpl: ratio(row.spend, row.metaLeads),
      ctr: ratio(row.clicks * 100, row.impressions),
    }))
    .sort((a, b) => b.spend - a.spend);
}

function group(rows: Array<{ key: string; spend: unknown; impressions: number; clicks: number; metaLeads: number }>, keyOf: (key: string) => string, labelOf: (key: string) => string) {
  const map = new Map<string, Omit<BreakdownRow, "share" | "cpl" | "ctr">>();
  for (const row of rows) {
    const key = keyOf(row.key);
    const entry = map.get(key) ?? { key, label: labelOf(key), spend: 0, impressions: 0, clicks: 0, metaLeads: 0 };
    entry.spend += Number(row.spend);
    entry.impressions += row.impressions;
    entry.clicks += row.clicks;
    entry.metaLeads += row.metaLeads;
    map.set(key, entry);
  }
  return finish([...map.values()]);
}

export async function getAudienceReport(month: string) {
  const rows = await prisma.metaBreakdown.findMany({ where: { month: dateOnly(`${month}-01`) } });
  const by = (dimension: string) => rows.filter((row) => row.dimension === dimension);
  const months = await prisma.metaBreakdown.findMany({ distinct: ["month"], select: { month: true }, orderBy: { month: "desc" } });

  return {
    available: months.map((row) => row.month.toISOString().slice(0, 7)),
    platforms: group(by("plataforma"), (key) => key.split(":")[0], (key) => PLATFORM_LABELS[key] ?? key),
    placements: group(
      by("plataforma"),
      (key) => key,
      (key) => {
        const [platform, position] = key.split(":");
        return `${PLATFORM_LABELS[platform] ?? platform} · ${POSITION_LABELS[position] ?? position.replace(/_/g, " ")}`;
      },
    ).slice(0, 8),
    ages: group(by("edad"), (key) => key.split(":")[0], (key) => (key === "Unknown" ? "Sin dato" : key)).sort((a, b) => a.key.localeCompare(b.key)),
    genders: group(by("edad"), (key) => key.split(":")[1] ?? "unknown", (key) => GENDER_LABELS[key] ?? key),
    regions: group(by("region"), (key) => key, (key) => key.replace(/ Province$/, "")).slice(0, 10),
  };
}

// ---------------------------------------------------------------- detail

export async function getCampaignDetail(id: string, period: Period) {
  const campaign = await prisma.metaCampaign.findUnique({
    where: { id },
    include: {
      adSets: { orderBy: { name: "asc" } },
      ads: { select: { id: true, name: true, effectiveStatus: true, thumbnailUrl: true, adSetId: true, title: true, body: true, reviewFeedback: true, createdTime: true } },
    },
  });
  if (!campaign) return null;

  const [days, adDays, leads, ads, reach, reach7, recentLeads, account] = await Promise.all([
    prisma.metaCampaignInsight.findMany({ where: { campaignId: id, date: { gte: dateOnly(period.since), lte: dateOnly(period.until) } } }),
    loadAdDays(period.since, period.until, id),
    loadLeads(period.since, period.until),
    getAdsReport(period, id),
    periodReach(period, id),
    prisma.metaPeriodStat.findFirst({ where: { kind: "rolling7", campaignId: id } }),
    prisma.lead.findMany({
      where: { metaCampaignId: id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, stage: true, createdAt: true, metaAdName: true },
    }),
    prisma.metaAdAccount.findFirst({ select: { accountId: true } }),
  ]);

  const own = leads.filter((lead) => lead.campaignId === id);
  const totals = emptyTotals();
  for (const row of days) add(totals, insightTotals(row));
  for (const lead of own) add(totals, leadTotals(lead));

  const setTotals = new Map<string, Totals>();
  const ensure = (key: string) => setTotals.get(key) ?? setTotals.set(key, emptyTotals()).get(key)!;
  for (const row of adDays) add(ensure(row.adSetId), insightTotals(row));
  for (const lead of own) if (lead.adSetId) add(ensure(lead.adSetId), leadTotals(lead));

  const structure = { ...campaign, ads: campaign.ads } as unknown as Structure;
  const kind = campaignKind(campaign.objective, campaign.adSets);
  const budget = budgetOf(structure);

  return {
    id: campaign.id,
    name: campaign.name,
    accountId: account?.accountId ?? null,
    objective: campaign.objective,
    bidStrategy: campaign.bidStrategy,
    kind,
    state: campaignState(structure),
    effectiveStatus: campaign.effectiveStatus,
    dailyBudget: budget.daily,
    lifetimeBudget: budget.lifetime,
    startTime: campaign.startTime?.toISOString() ?? null,
    stopTime: campaign.stopTime?.toISOString() ?? null,
    syncedAt: campaign.syncedAt.toISOString(),
    metrics: derive(totals),
    reach: reach ?? null,
    frequency7: reach7?.frequency ?? null,
    series: seriesOf(period.since, period.until, days, own),
    adSets: campaign.adSets.map((set) => ({
      id: set.id,
      name: set.name,
      state: deliveryState({ effectiveStatus: set.effectiveStatus, learningStatus: set.learningStatus, startTime: set.startTime, stopTime: set.endTime }),
      learningStatus: set.learningStatus,
      optimizationGoal: set.optimizationGoal,
      destinationType: set.destinationType,
      kind: campaignKind(null, [set]),
      dailyBudget: set.dailyBudget ? Number(set.dailyBudget) : null,
      lifetimeBudget: set.lifetimeBudget ? Number(set.lifetimeBudget) : null,
      audience: set.audience,
      metrics: derive(setTotals.get(set.id) ?? emptyTotals()),
    })),
    ads,
    recentLeads: recentLeads.map((lead) => ({ ...lead, createdAt: lead.createdAt.toISOString() })),
  };
}

// ---------------------------------------------------------------- recommendations

/** Cached per request: the layout (nav badge) and the page both ask. */
export const getRecommendations = cache(async (today: string): Promise<Recommendation[]> => {
  const since30 = shiftKey(today, -29);
  const since7 = shiftKey(today, -6);
  const since2 = shiftKey(today, -1);

  const [structure, days, adDays, leads, rolling] = await Promise.all([
    loadStructure(),
    loadCampaignDays(since30, today),
    loadAdDays(since30, today),
    loadLeads(since30, today),
    prisma.metaPeriodStat.findMany({ where: { kind: "rolling7" } }),
  ]);
  if (!structure.length) return [];

  const freq = new Map(rolling.map((stat) => [stat.campaignId, stat.frequency]));
  const campaignStats = new Map<string, { spend2: number; spend7: number; spend30: number; leads7: number; leads30: number }>();
  const stat = (id: string) =>
    campaignStats.get(id) ?? campaignStats.set(id, { spend2: 0, spend7: 0, spend30: 0, leads7: 0, leads30: 0 }).get(id)!;

  let metaLeads30 = 0;
  for (const row of days) {
    const key = row.date.toISOString().slice(0, 10);
    const entry = stat(row.campaignId);
    const spend = Number(row.spend);
    entry.spend30 += spend;
    if (key >= since7) entry.spend7 += spend;
    if (key >= since2) entry.spend2 += spend;
    metaLeads30 += row.metaLeads;
  }
  for (const lead of leads) {
    if (!lead.campaignId) continue;
    const entry = stat(lead.campaignId);
    entry.leads30 += 1;
    if (lead.day >= since7) entry.leads7 += 1;
  }

  const adTotals = new Map<string, Totals>();
  const ensure = (key: string) => adTotals.get(key) ?? adTotals.set(key, emptyTotals()).get(key)!;
  for (const row of adDays) add(ensure(row.adId), insightTotals(row));
  for (const lead of leads) if (lead.adId) add(ensure(lead.adId), leadTotals(lead));

  return buildRecommendations({
    campaigns: structure.map((campaign) => {
      const entry = stat(campaign.id);
      const budget = budgetOf(campaign);
      return {
        id: campaign.id,
        name: campaign.name,
        state: campaignState(campaign),
        kind: campaignKind(campaign.objective, campaign.adSets),
        hasBudget: Boolean(budget.daily || budget.lifetime),
        spendLast2Days: entry.spend2,
        spend7: entry.spend7,
        leads7: entry.leads7,
        spend30: entry.spend30,
        leads30: entry.leads30,
        frequency7: freq.get(campaign.id) ?? null,
      };
    }),
    adSets: structure.flatMap((campaign) =>
      campaign.adSets.map((set) => ({
        id: set.id,
        name: set.name,
        campaignId: campaign.id,
        learningStatus: set.learningStatus,
        active: set.effectiveStatus === "ACTIVE",
      })),
    ),
    ads: structure.flatMap((campaign) =>
      campaign.ads.map((ad) => {
        const totals = adTotals.get(ad.id) ?? emptyTotals();
        return {
          id: ad.id,
          name: ad.name,
          campaignId: campaign.id,
          adSetId: ad.adSetId,
          state: deliveryState({ effectiveStatus: ad.effectiveStatus }),
          impressions: totals.impressions,
          clicks: totals.clicks,
          spend: totals.spend,
          leads: totals.leads,
          qualified: totals.qualified,
        };
      }),
    ),
    metaLeads30,
    crmLeads30: leads.filter((lead) => {
      const campaign = structure.find((item) => item.id === lead.campaignId);
      return campaign ? campaignKind(campaign.objective, campaign.adSets) === "FORMULARIO" : true;
    }).length,
  });
});

// ---------------------------------------------------------------- reportes card

/** «Marketing del mes» on /admin/reportes. */
export async function getMarketingMonth(month: string, today: string) {
  const { since, until: end } = monthBounds(month);
  const until = end > today ? today : end;
  if (since > today) return null;

  const [days, leads, stat] = await Promise.all([
    loadCampaignDays(since, until),
    loadLeads(since, until),
    prisma.metaPeriodStat.findUnique({ where: { kind_campaignId_since: { kind: "month", campaignId: "", since: dateOnly(since) } } }),
  ]);
  const totals = emptyTotals();
  for (const row of days) add(totals, insightTotals(row));
  for (const lead of leads) add(totals, leadTotals(lead));
  if (stat && Number(stat.spend) > totals.spend) totals.spend = Number(stat.spend);
  return { ...derive(totals), reach: stat?.reach ?? null };
}

/** For the CSV export: one row per campaign and day. */
export async function getExportRows(period: Period) {
  const [days, leads, structure] = await Promise.all([
    loadCampaignDays(period.since, period.until),
    loadLeads(period.since, period.until),
    prisma.metaCampaign.findMany({ include: { adSets: { select: { optimizationGoal: true, destinationType: true } } } }),
  ]);
  const kinds = new Map(structure.map((campaign) => [campaign.id, campaignKind(campaign.objective, campaign.adSets)]));
  const leadKey = (campaignId: string, day: string) => `${campaignId}|${day}`;
  const leadTotalsByKey = new Map<string, Totals>();
  for (const lead of leads) {
    if (!lead.campaignId) continue;
    const key = leadKey(lead.campaignId, lead.day);
    add(leadTotalsByKey.get(key) ?? leadTotalsByKey.set(key, emptyTotals()).get(key)!, leadTotals(lead));
  }
  return days
    .map((row) => {
      const day = row.date.toISOString().slice(0, 10);
      const crm = leadTotalsByKey.get(leadKey(row.campaignId, day)) ?? emptyTotals();
      return {
        day,
        campaignId: row.campaignId,
        campaign: row.campaignName,
        kind: kinds.get(row.campaignId) ?? "OTRO",
        spend: Number(row.spend),
        impressions: row.impressions,
        clicks: row.clicks,
        linkClicks: row.linkClicks,
        metaLeads: row.metaLeads,
        conversations: row.conversations,
        leads: crm.leads,
        qualified: crm.qualified,
        won: crm.won,
      };
    })
    .sort((a, b) => a.day.localeCompare(b.day) || a.campaign.localeCompare(b.campaign));
}
