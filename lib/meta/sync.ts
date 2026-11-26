import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/db/prisma";
import { dayKeyInAppZone } from "@/lib/admin/format";
import { graphUrl, systemUserToken } from "@/lib/meta/config";
import { getPageAccessToken, MetaGraphError, type GraphError } from "@/lib/meta/graph";
import { ingestLeadgen } from "@/lib/meta/ingest";
import {
  actionCounts,
  audienceSummary,
  budgetFromMeta,
  deliveryState,
  type MetaAction,
} from "@/lib/meta/campaign-kind";
import { sendPushToAdmins } from "@/lib/notifications/push";

/**
 * F8.1: the panel reads what is stored; this module is the only thing that
 * talks to the Marketing API for reporting.
 *
 * - quick (every hour, from the cron): structure, insights for yesterday and
 *   today (Meta keeps correcting yesterday), 7-day and this-month reach, and the
 *   lead backfill.
 * - full (once a day, or «Actualizar»): the same over 28 days (late
 *   attribution; 180 days the first time, as history), 12 months of monthly
 *   reach, and the breakdowns of this month and the last.
 *
 * Every call reads X-Business-Use-Case-Usage; above USAGE_CEILING the run stops
 * instead of getting the account throttled (development_access tier).
 */

const USAGE_CEILING = 80;
const QUICK_EVERY_MINUTES = 50;
const MAX_PAGES = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SyncMode = "quick" | "full";

export type MetaSyncResult = {
  status: "synced" | "skipped" | "throttled" | "failed";
  mode: SyncMode;
  reason?: string;
  counts?: Record<string, number>;
  errors?: string[];
  lastSyncedAt?: Date | null;
};

type Usage = { callCount: number | null; cpuTime: number | null; resetMinutes: number | null; tier: string | null };

class UsageCeilingError extends Error {}

function parseUsage(header: string | null): Usage {
  const empty: Usage = { callCount: null, cpuTime: null, resetMinutes: null, tier: null };
  if (!header) return empty;
  try {
    const parsed = JSON.parse(header) as Record<
      string,
      Array<{ call_count?: number; total_cputime?: number; estimated_time_to_regain_access?: number; ads_api_access_tier?: string }>
    >;
    let worst = empty;
    for (const entries of Object.values(parsed)) {
      for (const entry of entries ?? []) {
        const calls = Math.max(entry.call_count ?? 0, entry.total_cputime ?? 0);
        if (calls >= (worst.callCount ?? -1)) {
          worst = {
            callCount: calls,
            cpuTime: entry.total_cputime ?? null,
            resetMinutes: entry.estimated_time_to_regain_access ?? null,
            tier: entry.ads_api_access_tier ?? null,
          };
        }
      }
    }
    return worst;
  } catch {
    return empty;
  }
}

/** One run's Graph client: remembers the worst usage seen and stops at the ceiling. */
function createClient() {
  let usage: Usage = { callCount: null, cpuTime: null, resetMinutes: null, tier: null };
  let calls = 0;

  async function request<T>(url: URL): Promise<{ data: T[]; next: string | null }> {
    if ((usage.callCount ?? 0) >= USAGE_CEILING) {
      throw new UsageCeilingError(`Uso de la API al ${usage.callCount}%.`);
    }
    calls += 1;
    const response = await fetch(url, { cache: "no-store" });
    const reading = parseUsage(response.headers.get("x-business-use-case-usage"));
    if ((reading.callCount ?? -1) >= (usage.callCount ?? -1)) usage = reading;
    const payload = await response.json();
    if (payload?.error) throw new MetaGraphError(payload.error as GraphError);
    return { data: (payload?.data ?? []) as T[], next: payload?.paging?.next ?? null };
  }

  /** Follows paging.next (it already carries the token and the fields). */
  async function all<T>(path: string, params: Record<string, string>, token = systemUserToken()): Promise<T[]> {
    const url = new URL(graphUrl(path));
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("access_token", token);

    const rows: T[] = [];
    let next: URL | null = url;
    for (let page = 0; next && page < MAX_PAGES; page += 1) {
      const result: { data: T[]; next: string | null } = await request<T>(next);
      rows.push(...result.data);
      next = result.next ? new URL(result.next) : null;
    }
    return rows;
  }

  return { all, usage: () => usage, calls: () => calls };
}

type Client = ReturnType<typeof createClient>;

/** A calendar day (account time zone) as the @db.Date convention: UTC midnight. */
function dateOnly(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

function keyOf(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDays(key: string, days: number) {
  return keyOf(new Date(dateOnly(key).getTime() + days * DAY_MS));
}

function monthStart(key: string, monthsBack = 0) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 - monthsBack, 1));
  return keyOf(date);
}

function toDate(value: string | undefined | null) {
  if (!value) return null;
  const date = new Date(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function jsonOrNull(value: unknown) {
  return value == null ? undefined : (value as Prisma.InputJsonValue);
}

async function resolveAdAccount(client: Client) {
  const stored = await prisma.metaAdAccount.findFirst();
  if (stored) return stored;

  const [account] = await client.all<{ id: string; name?: string; currency?: string }>("me/adaccounts", {
    fields: "id,name,currency",
    limit: "5",
  });
  if (!account?.id) throw new Error("El usuario del sistema no tiene cuentas publicitarias asignadas.");

  return prisma.metaAdAccount.create({
    data: { accountId: account.id, name: account.name ?? null, currency: account.currency ?? "USD" },
  });
}

/** Runs async work over items, a few at a time, so a 300-row upsert does not take 300 round-trips in series. */
async function inChunks<T>(items: T[], size: number, run: (item: T) => Promise<unknown>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(run));
  }
}

// ---------------------------------------------------------------- structure

type CampaignRow = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective?: string;
  buying_type?: string;
  bid_strategy?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  created_time?: string;
  updated_time?: string;
  issues_info?: unknown;
};

type AdSetRow = {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  effective_status: string;
  optimization_goal?: string;
  destination_type?: string;
  billing_event?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  end_time?: string;
  learning_stage_info?: { status?: string };
  targeting?: Parameters<typeof audienceSummary>[0];
};

type AdRow = {
  id: string;
  name: string;
  adset_id: string;
  campaign_id: string;
  status: string;
  effective_status: string;
  created_time?: string;
  ad_review_feedback?: unknown;
  issues_info?: unknown;
  creative?: { thumbnail_url?: string; image_url?: string; title?: string; body?: string };
};

async function syncStructure(client: Client, accountId: string) {
  const [campaigns, adSets, ads] = await Promise.all([
    client.all<CampaignRow>(`${accountId}/campaigns`, {
      fields:
        "id,name,status,effective_status,objective,buying_type,bid_strategy,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time,issues_info",
      limit: "200",
    }),
    client.all<AdSetRow>(`${accountId}/adsets`, {
      fields:
        "id,name,campaign_id,status,effective_status,optimization_goal,destination_type,billing_event,daily_budget,lifetime_budget,start_time,end_time,learning_stage_info,targeting{age_min,age_max,genders,geo_locations}",
      limit: "200",
    }),
    client.all<AdRow>(`${accountId}/ads`, {
      fields:
        "id,name,adset_id,campaign_id,status,effective_status,created_time,ad_review_feedback,issues_info,creative.thumbnail_width(320).thumbnail_height(320){thumbnail_url,image_url,title,body}",
      limit: "200",
    }),
  ]);

  const now = new Date();

  await inChunks(campaigns, 10, (row) => {
    const data = {
      accountId,
      name: row.name,
      status: row.status,
      effectiveStatus: row.effective_status,
      objective: row.objective ?? null,
      buyingType: row.buying_type ?? null,
      bidStrategy: row.bid_strategy ?? null,
      dailyBudget: budgetFromMeta(row.daily_budget),
      lifetimeBudget: budgetFromMeta(row.lifetime_budget),
      startTime: toDate(row.start_time),
      stopTime: toDate(row.stop_time),
      createdTime: toDate(row.created_time),
      updatedTime: toDate(row.updated_time),
      issues: jsonOrNull(row.issues_info),
      syncedAt: now,
    };
    return prisma.metaCampaign.upsert({ where: { id: row.id }, create: { id: row.id, ...data }, update: data });
  });

  const knownCampaigns = new Set(campaigns.map((row) => row.id));

  const validAdSets = adSets.filter((row) => knownCampaigns.has(row.campaign_id));
  await inChunks(validAdSets, 10, (row) => {
    const data = {
      campaignId: row.campaign_id,
      name: row.name,
      status: row.status,
      effectiveStatus: row.effective_status,
      optimizationGoal: row.optimization_goal ?? null,
      destinationType: row.destination_type ?? null,
      billingEvent: row.billing_event ?? null,
      dailyBudget: budgetFromMeta(row.daily_budget),
      lifetimeBudget: budgetFromMeta(row.lifetime_budget),
      audience: audienceSummary(row.targeting),
      learningStatus: row.learning_stage_info?.status ?? null,
      startTime: toDate(row.start_time),
      endTime: toDate(row.end_time),
      syncedAt: now,
    };
    return prisma.metaAdSet.upsert({ where: { id: row.id }, create: { id: row.id, ...data }, update: data });
  });

  const knownAdSets = new Set(validAdSets.map((row) => row.id));
  const previous = new Map(
    (await prisma.metaAd.findMany({ select: { id: true, alertedStatus: true } })).map((ad) => [ad.id, ad.alertedStatus]),
  );
  const alerts: Array<{ id: string; name: string; campaignId: string; status: string }> = [];

  await inChunks(
    ads.filter((row) => knownAdSets.has(row.adset_id)),
    10,
    (row) => {
      const problem = deliveryState({ effectiveStatus: row.effective_status }) === "PROBLEMAS";
      // A brand-new ad that is already rejected also deserves the push; an ad
      // we already warned about for this same status does not.
      if (problem && previous.get(row.id) !== row.effective_status) {
        alerts.push({ id: row.id, name: row.name, campaignId: row.campaign_id, status: row.effective_status });
      }
      const data = {
        campaignId: row.campaign_id,
        adSetId: row.adset_id,
        name: row.name,
        status: row.status,
        effectiveStatus: row.effective_status,
        thumbnailUrl: row.creative?.thumbnail_url ?? row.creative?.image_url ?? null,
        title: row.creative?.title ?? null,
        body: row.creative?.body ?? null,
        reviewFeedback: jsonOrNull(row.ad_review_feedback),
        issues: jsonOrNull(row.issues_info),
        createdTime: toDate(row.created_time),
        alertedStatus: problem ? row.effective_status : null,
        syncedAt: now,
      };
      return prisma.metaAd.upsert({ where: { id: row.id }, create: { id: row.id, ...data }, update: data });
    },
  );

  if (alerts.length) {
    const [first] = alerts;
    await sendPushToAdmins({
      title: alerts.length === 1 ? "Anuncio con problemas en Meta" : `${alerts.length} anuncios con problemas en Meta`,
      body:
        alerts.length === 1
          ? `«${first.name}» está ${first.status === "DISAPPROVED" ? "rechazado" : "con problemas"} y no se muestra.`
          : alerts.map((alert) => alert.name).slice(0, 3).join(" · "),
      url: `/admin/campanas/${first.campaignId}`,
      tag: "meta-ad-alert",
    }).catch((error) => console.error("[meta] push de anuncio falló", error));
  }

  return { campaigns: campaigns.length, adSets: validAdSets.length, ads: ads.length, alerts: alerts.length };
}

// ---------------------------------------------------------------- insights

type InsightRow = {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  ad_id?: string;
  date_start?: string;
  date_stop?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  frequency?: string;
  actions?: MetaAction[];
};

function range(since: string, until: string) {
  return JSON.stringify({ since, until });
}

async function syncDailyInsights(client: Client, accountId: string, since: string, until: string) {
  const [campaignRows, adRows] = await Promise.all([
    client.all<InsightRow>(`${accountId}/insights`, {
      level: "campaign",
      time_increment: "1",
      time_range: range(since, until),
      fields: "campaign_id,campaign_name,spend,impressions,clicks,reach,actions",
      limit: "500",
    }),
    client.all<InsightRow>(`${accountId}/insights`, {
      level: "ad",
      time_increment: "1",
      time_range: range(since, until),
      fields: "ad_id,adset_id,campaign_id,spend,impressions,clicks,actions",
      limit: "500",
    }),
  ]);

  await inChunks(campaignRows, 20, (row) => {
    if (!row.campaign_id || !row.date_start) return Promise.resolve();
    const data = {
      accountId,
      campaignId: row.campaign_id,
      campaignName: row.campaign_name ?? row.campaign_id,
      date: dateOnly(row.date_start),
      spend: row.spend ?? "0",
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      reach: Number(row.reach ?? 0),
      ...actionCounts(row.actions),
    };
    return prisma.metaCampaignInsight.upsert({
      where: { campaignId_date: { campaignId: data.campaignId, date: data.date } },
      create: data,
      update: data,
    });
  });

  await inChunks(adRows, 20, (row) => {
    if (!row.ad_id || !row.date_start || !row.campaign_id) return Promise.resolve();
    const data = {
      adId: row.ad_id,
      adSetId: row.adset_id ?? "",
      campaignId: row.campaign_id,
      date: dateOnly(row.date_start),
      spend: row.spend ?? "0",
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      ...actionCounts(row.actions),
    };
    return prisma.metaAdInsight.upsert({
      where: { adId_date: { adId: data.adId, date: data.date } },
      create: data,
      update: data,
    });
  });

  return { campaignDays: campaignRows.length, adDays: adRows.length };
}

/** Reach and frequency for whole periods: never summed from days. */
async function syncPeriodStats(client: Client, accountId: string, today: string, monthsBack: number) {
  const writes: Array<{ kind: string; campaignId: string; row: InsightRow }> = [];
  const monthly = { time_increment: "monthly", time_range: range(monthStart(today, monthsBack), today) };
  const rolling = { time_range: range(shiftDays(today, -6), today) };
  const fields = "campaign_id,spend,impressions,reach,frequency";

  const [accountMonths, campaignMonths, accountWeek, campaignWeek] = await Promise.all([
    client.all<InsightRow>(`${accountId}/insights`, { ...monthly, fields, limit: "100" }),
    client.all<InsightRow>(`${accountId}/insights`, { ...monthly, level: "campaign", fields, limit: "500" }),
    client.all<InsightRow>(`${accountId}/insights`, { ...rolling, fields }),
    client.all<InsightRow>(`${accountId}/insights`, { ...rolling, level: "campaign", fields, limit: "200" }),
  ]);

  for (const row of accountMonths) writes.push({ kind: "month", campaignId: "", row });
  for (const row of campaignMonths) writes.push({ kind: "month", campaignId: row.campaign_id ?? "", row });
  for (const row of accountWeek) writes.push({ kind: "rolling7", campaignId: "", row });
  for (const row of campaignWeek) writes.push({ kind: "rolling7", campaignId: row.campaign_id ?? "", row });

  // The rolling window moves: keep only today's.
  await prisma.metaPeriodStat.deleteMany({ where: { kind: "rolling7" } });

  await inChunks(writes, 20, ({ kind, campaignId, row }) => {
    if (!row.date_start || !row.date_stop) return Promise.resolve();
    const since = dateOnly(kind === "rolling7" ? shiftDays(today, -6) : row.date_start);
    const data = {
      kind,
      campaignId,
      since,
      until: dateOnly(row.date_stop),
      spend: row.spend ?? "0",
      impressions: Number(row.impressions ?? 0),
      reach: Number(row.reach ?? 0),
      frequency: Number(row.frequency ?? 0),
    };
    return prisma.metaPeriodStat.upsert({
      where: { kind_campaignId_since: { kind, campaignId, since } },
      create: data,
      update: data,
    });
  });

  return { periods: writes.length };
}

const BREAKDOWNS: Array<{ dimension: string; breakdowns: string; key: (row: Record<string, string>) => string }> = [
  {
    dimension: "plataforma",
    breakdowns: "publisher_platform,platform_position",
    key: (row) => `${row.publisher_platform ?? "?"}:${row.platform_position ?? "?"}`,
  },
  { dimension: "edad", breakdowns: "age,gender", key: (row) => `${row.age ?? "?"}:${row.gender ?? "?"}` },
  { dimension: "region", breakdowns: "region", key: (row) => row.region ?? "?" },
];

async function syncBreakdowns(client: Client, accountId: string, today: string, months: number) {
  let rows = 0;
  for (let back = 0; back < months; back += 1) {
    const since = monthStart(today, back);
    const until = back === 0 ? today : shiftDays(monthStart(today, back - 1), -1);
    for (const spec of BREAKDOWNS) {
      const data = await client.all<InsightRow & Record<string, string>>(`${accountId}/insights`, {
        breakdowns: spec.breakdowns,
        time_range: range(since, until),
        fields: "spend,impressions,clicks,actions",
        limit: "500",
      });
      const month = dateOnly(since);
      await prisma.metaBreakdown.deleteMany({ where: { month, dimension: spec.dimension } });
      if (data.length) {
        await prisma.metaBreakdown.createMany({
          data: data.map((row) => ({
            month,
            dimension: spec.dimension,
            key: spec.key(row as Record<string, string>),
            spend: row.spend ?? "0",
            impressions: Number(row.impressions ?? 0),
            clicks: Number(row.clicks ?? 0),
            metaLeads: actionCounts(row.actions).metaLeads,
          })),
          skipDuplicates: true,
        });
      }
      rows += data.length;
    }
  }
  return { breakdownRows: rows };
}

// ---------------------------------------------------------------- leads

/**
 * Pending since CRM F6: if the webhook misses a lead (deploy, Meta outage),
 * pull the last 48 h from every active form. ingestLeadgen dedupes by
 * metaLeadId and respects leads deleted on purpose.
 */
async function backfillLeads(client: Client, now: Date) {
  const pageId = process.env.META_PAGE_ID;
  if (!pageId) return { recovered: 0 };

  const pageToken = await getPageAccessToken(pageId);
  const forms = await client.all<{ id: string; status?: string }>(
    `${pageId}/leadgen_forms`,
    { fields: "id,status", limit: "100" },
    pageToken,
  );
  const since = Math.floor((now.getTime() - 2 * DAY_MS) / 1000);
  let recovered = 0;

  for (const form of forms.filter((item) => item.status !== "ARCHIVED")) {
    const leads = await client.all<{ id: string; created_time?: string; ad_id?: string; form_id?: string }>(
      `${form.id}/leads`,
      {
        fields: "id,created_time,ad_id,form_id",
        filtering: JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }]),
        limit: "100",
      },
      pageToken,
    );
    if (!leads.length) continue;

    const known = new Set(
      (
        await prisma.lead.findMany({
          where: { metaLeadId: { in: leads.map((lead) => lead.id) } },
          select: { metaLeadId: true },
        })
      ).map((lead) => lead.metaLeadId),
    );

    for (const lead of leads.filter((item) => !known.has(item.id))) {
      const result = await ingestLeadgen({
        leadgenId: lead.id,
        pageId,
        formId: lead.form_id ?? form.id,
        adId: lead.ad_id ?? null,
        createdTime: lead.created_time ? Math.floor(new Date(lead.created_time).getTime() / 1000) : null,
      });
      if (result.status === "created") recovered += 1;
    }
  }

  return { recovered };
}

// ---------------------------------------------------------------- alerts

/** Once a day: an active campaign with budget that spent nothing yesterday. */
async function alertSilentCampaigns(today: string) {
  const yesterday = dateOnly(shiftDays(today, -1));
  const active = await prisma.metaCampaign.findMany({
    where: { effectiveStatus: "ACTIVE", startTime: { lt: yesterday } },
    select: {
      id: true,
      name: true,
      dailyBudget: true,
      lifetimeBudget: true,
      adSets: { where: { effectiveStatus: "ACTIVE" }, select: { dailyBudget: true, lifetimeBudget: true } },
    },
  });
  const funded = active.filter(
    (campaign) =>
      campaign.dailyBudget || campaign.lifetimeBudget || campaign.adSets.some((set) => set.dailyBudget || set.lifetimeBudget),
  );
  if (!funded.length) return 0;

  const spent = await prisma.metaCampaignInsight.findMany({
    where: { date: yesterday, campaignId: { in: funded.map((campaign) => campaign.id) }, spend: { gt: 0 } },
    select: { campaignId: true },
  });
  const spentIds = new Set(spent.map((row) => row.campaignId));
  const silent = funded.filter((campaign) => !spentIds.has(campaign.id));
  if (!silent.length) return 0;

  await sendPushToAdmins({
    title: silent.length === 1 ? "Campaña activa sin gastar" : `${silent.length} campañas activas sin gastar`,
    body: `${silent.map((campaign) => campaign.name).slice(0, 2).join(" · ")}: $0 ayer con presupuesto activo.`,
    url: silent.length === 1 ? `/admin/campanas/${silent[0].id}` : "/admin/campanas",
    tag: "meta-silent-campaign",
  }).catch((error) => console.error("[meta] push de campaña sin gasto falló", error));

  return silent.length;
}

// ---------------------------------------------------------------- entry

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Decides what to run. Without force: quick at most every 50 min, full once
 * per business day (from 05:00, so yesterday is already closed in Meta).
 */
export async function runMetaSync({
  mode: requested,
  force = false,
  now = new Date(),
}: {
  mode?: SyncMode;
  force?: boolean;
  now?: Date;
} = {}): Promise<MetaSyncResult> {
  const client = createClient();
  const account = await resolveAdAccount(client);
  const today = dayKeyInAppZone(now);

  const fullDue = !account.lastFullSyncAt || dayKeyInAppZone(account.lastFullSyncAt) !== today;
  const mode: SyncMode = requested ?? (fullDue ? "full" : "quick");

  if (!force) {
    const minutes = account.lastQuickSyncAt ? (now.getTime() - account.lastQuickSyncAt.getTime()) / 60000 : Infinity;
    if (mode === "quick" && minutes < QUICK_EVERY_MINUTES) {
      return { status: "skipped", mode, reason: `Sincronizado hace ${Math.round(minutes)} min.`, lastSyncedAt: account.lastSyncedAt };
    }
    if (mode === "full" && !fullDue) {
      return { status: "skipped", mode, reason: "La completa ya corrió hoy.", lastSyncedAt: account.lastSyncedAt };
    }
  }

  if ((account.usageCallCount ?? 0) >= USAGE_CEILING && account.lastQuickSyncAt && now.getTime() - account.lastQuickSyncAt.getTime() < 60 * 60000) {
    return {
      status: "throttled",
      mode,
      reason: `Uso de la API al ${account.usageCallCount}%. Se libera en ~${account.usageResetMin ?? "?"} min.`,
      lastSyncedAt: account.lastSyncedAt,
    };
  }

  const counts: Record<string, number> = {};
  const errors: string[] = [];
  let throttled = false;

  const steps: Array<[string, () => Promise<Record<string, number>>]> = [
    ["estructura", () => syncStructure(client, account.accountId)],
    [
      "insights",
      () => syncDailyInsights(client, account.accountId, shiftDays(today, mode === "quick" ? -1 : account.lastFullSyncAt ? -27 : -179), today),
    ],
    ["alcance", () => syncPeriodStats(client, account.accountId, today, mode === "full" ? 11 : 0)],
  ];
  if (mode === "full") {
    steps.push(["desgloses", () => syncBreakdowns(client, account.accountId, today, 2)]);
    steps.push(["sin gasto", async () => ({ silent: await alertSilentCampaigns(today) })]);
  }
  steps.push(["leads", () => backfillLeads(client, now)]);

  for (const [name, step] of steps) {
    try {
      Object.assign(counts, await step());
    } catch (error) {
      if (error instanceof UsageCeilingError) {
        throttled = true;
        errors.push(`${name}: ${error.message}`);
        break;
      }
      console.error(`[meta] paso ${name} falló`, error);
      errors.push(`${name}: ${errorText(error)}`);
    }
  }

  const usage = client.usage();
  const ok = errors.length === 0;
  const anyData = counts.campaigns != null || counts.campaignDays != null;

  const updated = await prisma.metaAdAccount.update({
    where: { id: account.id },
    data: {
      usageCallCount: usage.callCount ?? account.usageCallCount,
      usageCpuTime: usage.cpuTime ?? account.usageCpuTime,
      usageResetMin: usage.resetMinutes ?? account.usageResetMin,
      accessTier: usage.tier ?? account.accessTier,
      lastSyncError: ok ? null : errors.join(" · ").slice(0, 1000),
      ...(anyData ? { lastSyncedAt: now, lastQuickSyncAt: now } : {}),
      ...(anyData && mode === "full" && !throttled ? { lastFullSyncAt: now } : {}),
      ...(counts.recovered != null ? { lastBackfillAt: now } : {}),
    },
  });

  counts.calls = client.calls();

  return {
    status: throttled ? "throttled" : anyData ? "synced" : "failed",
    mode,
    counts,
    errors: errors.length ? errors : undefined,
    reason: errors[0],
    lastSyncedAt: updated.lastSyncedAt,
  };
}
