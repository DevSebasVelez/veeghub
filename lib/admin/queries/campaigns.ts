import prisma from "@/lib/db/prisma";
import {
  dayKeyInAppZone,
  dayStartInstant,
  dayStartUtc,
} from "@/lib/admin/format";

export type CampaignRow = {
  campaignId: string | null;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  won: number;
  ctr: number | null;
  cpc: number | null;
  costPerLead: number | null;
  costPerWon: number | null;
};

/** Leads that arrived without campaign attribution still have to be visible. */
const UNATTRIBUTED = "Sin campaña";

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

/**
 * Snaps a range to whole business-timezone days.
 *
 * MetaCampaignInsight.date holds the ad account's calendar day at UTC midnight.
 * Bounding by UTC days instead would drop today's spend for the five hours
 * after 19:00 local, and a `since` still carrying a clock time would cut the
 * first day off every range.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

function dayBounds(since: Date, until: Date) {
  // For the @db.Date column, which holds the calendar day at UTC midnight.
  const from = dayStartUtc(since);
  const to = new Date(dayStartUtc(until).getTime() + DAY_MS - 1);

  // For timestamp columns, which need the real instants that day spans.
  const instantFrom = dayStartInstant(since);
  const instantTo = new Date(dayStartInstant(until).getTime() + DAY_MS - 1);

  return { from, to, instantFrom, instantTo };
}

/**
 * Spend comes from Meta, lead counts come from our own records.
 *
 * Meta reports leads through action types whose names vary with how the
 * campaign was built (`offsite_complete_registration_add_meta_leads` on this
 * account), so counting our own Lead rows is both stabler and truer to what we
 * actually received.
 */
export async function getCampaignPerformance({
  since,
  until,
}: {
  since: Date;
  until: Date;
}) {
  const { from, to, instantFrom, instantTo } = dayBounds(since, until);

  const [insights, leadTotals, leadsWon, accounts] = await Promise.all([
    prisma.metaCampaignInsight.groupBy({
      by: ["campaignId", "campaignName"],
      where: { date: { gte: from, lte: to } },
      _sum: { spend: true, impressions: true, clicks: true },
    }),
    prisma.lead.groupBy({
      by: ["metaCampaignId"],
      where: { createdAt: { gte: instantFrom, lte: instantTo } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["metaCampaignId"],
      where: { createdAt: { gte: instantFrom, lte: instantTo }, stage: "WON" },
      _count: { _all: true },
    }),
    prisma.metaAdAccount.findFirst(),
  ]);

  const leadsByCampaign = new Map(
    leadTotals.map((row) => [row.metaCampaignId, row._count._all]),
  );
  const wonByCampaign = new Map(
    leadsWon.map((row) => [row.metaCampaignId, row._count._all]),
  );

  const rows = new Map<string, CampaignRow>();

  for (const insight of insights) {
    const spend = Number(insight._sum.spend ?? 0);
    const impressions = insight._sum.impressions ?? 0;
    const clicks = insight._sum.clicks ?? 0;
    const leads = leadsByCampaign.get(insight.campaignId) ?? 0;
    const won = wonByCampaign.get(insight.campaignId) ?? 0;

    rows.set(insight.campaignId, {
      campaignId: insight.campaignId,
      campaignName: insight.campaignName,
      spend,
      impressions,
      clicks,
      leads,
      won,
      ctr: ratio(clicks * 100, impressions),
      cpc: ratio(spend, clicks),
      costPerLead: ratio(spend, leads),
      costPerWon: ratio(spend, won),
    });
  }

  // Leads whose campaign never spent in this window, plus manual ones.
  for (const [campaignId, leads] of leadsByCampaign) {
    if (campaignId && rows.has(campaignId)) continue;

    const key = campaignId ?? UNATTRIBUTED;
    const won = wonByCampaign.get(campaignId) ?? 0;

    rows.set(key, {
      campaignId,
      campaignName: campaignId ? `Campaña ${campaignId}` : UNATTRIBUTED,
      spend: 0,
      impressions: 0,
      clicks: 0,
      leads,
      won,
      ctr: null,
      cpc: null,
      costPerLead: null,
      costPerWon: null,
    });
  }

  const campaigns = [...rows.values()].sort((a, b) => b.spend - a.spend);

  const totals = campaigns.reduce(
    (acc, row) => ({
      spend: acc.spend + row.spend,
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      leads: acc.leads + row.leads,
      won: acc.won + row.won,
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0, won: 0 },
  );

  return {
    campaigns,
    totals: {
      ...totals,
      costPerLead: ratio(totals.spend, totals.leads),
      costPerWon: ratio(totals.spend, totals.won),
      ctr: ratio(totals.clicks * 100, totals.impressions),
    },
    account: accounts
      ? {
          name: accounts.name,
          lastSyncedAt: accounts.lastSyncedAt?.toISOString() ?? null,
          usageCallCount: accounts.usageCallCount,
          usageResetMin: accounts.usageResetMin,
          accessTier: accounts.accessTier,
        }
      : null,
  };
}

/** Daily spend against daily leads, for the chart. */
export async function getCampaignDailySeries({
  since,
  until,
}: {
  since: Date;
  until: Date;
}) {
  const { from, to, instantFrom, instantTo } = dayBounds(since, until);

  const [spendByDay, leads] = await Promise.all([
    prisma.metaCampaignInsight.groupBy({
      by: ["date"],
      where: { date: { gte: from, lte: to } },
      _sum: { spend: true },
      orderBy: { date: "asc" },
    }),
    prisma.lead.findMany({
      where: { createdAt: { gte: instantFrom, lte: instantTo } },
      select: { createdAt: true },
    }),
  ]);

  const leadsByDay = new Map<string, number>();

  for (const lead of leads) {
    // Bucket by the business calendar day, the same one Meta reports spend in.
    const key = dayKeyInAppZone(lead.createdAt);
    leadsByDay.set(key, (leadsByDay.get(key) ?? 0) + 1);
  }

  const days = new Set<string>([
    ...spendByDay.map((row) => row.date.toISOString().slice(0, 10)),
    ...leadsByDay.keys(),
  ]);

  return [...days]
    .sort()
    .map((day) => ({
      day,
      spend: Number(
        spendByDay.find((row) => row.date.toISOString().slice(0, 10) === day)
          ?._sum.spend ?? 0,
      ),
      leads: leadsByDay.get(day) ?? 0,
    }));
}
