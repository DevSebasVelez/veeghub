import prisma from "@/lib/db/prisma";
import { graphUrl, systemUserToken } from "@/lib/meta/config";
import { MetaGraphError } from "@/lib/meta/graph";

/** Do not re-hit Meta if we synced this recently, unless explicitly forced. */
const TTL_MINUTES = 15;

/**
 * Refuse to call when the rolling-hour quota is nearly spent. The app is on the
 * development_access tier, where the allowance is small and getting throttled
 * locks out every ads call for as long as estimated_time_to_regain_access says.
 */
const USAGE_CEILING = 80;

export type UsageSnapshot = {
  callCount: number | null;
  cpuTime: number | null;
  resetMinutes: number | null;
  tier: string | null;
};

/** Parses X-Business-Use-Case-Usage, keeping the worst reading across objects. */
function parseUsage(header: string | null): UsageSnapshot {
  const empty: UsageSnapshot = {
    callCount: null,
    cpuTime: null,
    resetMinutes: null,
    tier: null,
  };

  if (!header) return empty;

  try {
    const parsed = JSON.parse(header) as Record<
      string,
      Array<{
        type?: string;
        call_count?: number;
        total_cputime?: number;
        estimated_time_to_regain_access?: number;
        ads_api_access_tier?: string;
      }>
    >;

    let worst = empty;

    for (const entries of Object.values(parsed)) {
      for (const entry of entries ?? []) {
        const callCount = entry.call_count ?? 0;

        if (callCount >= (worst.callCount ?? -1)) {
          worst = {
            callCount,
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

function toDateOnly(value: string) {
  // Meta returns "2026-09-16"; Date.parse reads a bare date as UTC midnight,
  // which is exactly the convention @db.Date columns use here.
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatRange(date: Date) {
  return date.toISOString().slice(0, 10);
}

type InsightRow = {
  campaign_id?: string;
  campaign_name?: string;
  date_start?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
};

/** Resolves the ad account once and remembers it, so no new env var is needed. */
async function resolveAdAccount() {
  const stored = await prisma.metaAdAccount.findFirst();
  if (stored) return stored;

  const url = new URL(graphUrl("me/adaccounts"));
  url.searchParams.set("fields", "id,name,currency");
  url.searchParams.set("access_token", systemUserToken());

  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json();

  if (payload?.error) throw new MetaGraphError(payload.error);

  const account = payload?.data?.[0];

  if (!account?.id) {
    throw new Error("El usuario del sistema no tiene cuentas publicitarias asignadas.");
  }

  return prisma.metaAdAccount.create({
    data: {
      accountId: account.id,
      name: account.name ?? null,
      currency: account.currency ?? "USD",
    },
  });
}

export type SyncResult = {
  status: "synced" | "skipped" | "throttled";
  rows?: number;
  reason?: string;
  usage?: UsageSnapshot;
  lastSyncedAt?: Date | null;
};

/**
 * Pulls one row per campaign per day for the range and upserts it.
 *
 * time_increment=1 means a single request covers any range at daily grain, so
 * the UI can aggregate whatever window it wants without going back to Meta.
 */
export async function syncCampaignInsights({
  since,
  until,
  force = false,
}: {
  since: Date;
  until: Date;
  force?: boolean;
}): Promise<SyncResult> {
  const account = await resolveAdAccount();

  if (!force && account.lastSyncedAt) {
    const minutes = (Date.now() - account.lastSyncedAt.getTime()) / 60000;

    if (minutes < TTL_MINUTES) {
      return {
        status: "skipped",
        reason: `Sincronizado hace ${Math.round(minutes)} min.`,
        lastSyncedAt: account.lastSyncedAt,
      };
    }
  }

  if ((account.usageCallCount ?? 0) >= USAGE_CEILING) {
    return {
      status: "throttled",
      reason: `Uso de la API al ${account.usageCallCount}%. Se libera en ~${account.usageResetMin ?? "?"} min.`,
      lastSyncedAt: account.lastSyncedAt,
    };
  }

  const url = new URL(graphUrl(`${account.accountId}/insights`));
  url.searchParams.set("level", "campaign");
  url.searchParams.set("time_increment", "1");
  // An explicit time_range rather than date_preset: last_30d and friends
  // EXCLUDE today, which silently hides the spend you most want to see.
  url.searchParams.set(
    "time_range",
    JSON.stringify({ since: formatRange(since), until: formatRange(until) }),
  );
  url.searchParams.set(
    "fields",
    "campaign_id,campaign_name,spend,impressions,clicks,reach",
  );
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", systemUserToken());

  const response = await fetch(url, { cache: "no-store" });
  const usage = parseUsage(response.headers.get("x-business-use-case-usage"));
  const payload = await response.json();

  if (payload?.error) {
    await prisma.metaAdAccount.update({
      where: { id: account.id },
      data: {
        usageCallCount: usage.callCount,
        usageCpuTime: usage.cpuTime,
        usageResetMin: usage.resetMinutes,
        accessTier: usage.tier,
      },
    });

    throw new MetaGraphError(payload.error);
  }

  const rows: InsightRow[] = payload?.data ?? [];

  for (const row of rows) {
    if (!row.campaign_id || !row.date_start) continue;

    const data = {
      accountId: account.accountId,
      campaignId: row.campaign_id,
      campaignName: row.campaign_name ?? row.campaign_id,
      date: toDateOnly(row.date_start),
      spend: row.spend ?? "0",
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      reach: Number(row.reach ?? 0),
    };

    await prisma.metaCampaignInsight.upsert({
      where: {
        campaignId_date: { campaignId: data.campaignId, date: data.date },
      },
      create: data,
      update: data,
    });
  }

  const updated = await prisma.metaAdAccount.update({
    where: { id: account.id },
    data: {
      lastSyncedAt: new Date(),
      usageCallCount: usage.callCount,
      usageCpuTime: usage.cpuTime,
      usageResetMin: usage.resetMinutes,
      accessTier: usage.tier,
    },
  });

  return {
    status: "synced",
    rows: rows.length,
    usage,
    lastSyncedAt: updated.lastSyncedAt,
  };
}
