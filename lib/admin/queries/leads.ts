import prisma from "@/lib/db/prisma";
import type { LeadStage } from "@/app/generated/prisma/client";

// Stages shown as pipeline columns. WON and LOST are terminal and live outside
// the board so it stays readable once volume grows.
export const PIPELINE_STAGES: LeadStage[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
];

const PAGE_SIZE = 25;

export const leadListSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  company: true,
  stage: true,
  source: true,
  serviceTag: true,
  estimatedValue: true,
  currency: true,
  metaCampaignName: true,
  metaFormName: true,
  firstContactedAt: true,
  nextFollowUpAt: true,
  convertedClientId: true,
  temperature: true,
  aiSummary: true,
  createdAt: true,
} as const;

/** Cards per column on first paint; «Cargar más» brings the next batch. */
export const PIPELINE_COLUMN_SIZE = 20;

const PIPELINE_ORDER = [{ createdAt: "desc" }, { id: "desc" }] as const;

/**
 * The first batch of every column plus each column's real count and value,
 * so the header stays right however many cards are loaded. Before this the
 * board fetched every open lead at once, which grows with every campaign.
 */
export async function getPipelineLeads() {
  const [batches, totals] = await Promise.all([
    Promise.all(
      PIPELINE_STAGES.map((stage) =>
        prisma.lead.findMany({
          where: { stage },
          select: leadListSelect,
          orderBy: [...PIPELINE_ORDER],
          take: PIPELINE_COLUMN_SIZE,
        }),
      ),
    ),
    prisma.lead.groupBy({
      by: ["stage"],
      where: { stage: { in: PIPELINE_STAGES } },
      _count: { _all: true },
      _sum: { estimatedValue: true },
    }),
  ]);

  const byStage = new Map(totals.map((row) => [row.stage, row]));

  return PIPELINE_STAGES.map((stage, index) => ({
    stage,
    leads: batches[index],
    total: byStage.get(stage)?._count._all ?? 0,
    value: Number(byStage.get(stage)?._sum.estimatedValue ?? 0),
  }));
}

/** The next batch of one column, for «Cargar más». */
export async function getPipelineColumnPage(stage: LeadStage, skip: number) {
  return prisma.lead.findMany({
    where: { stage },
    select: leadListSelect,
    orderBy: [...PIPELINE_ORDER],
    skip: Math.max(0, Math.floor(skip)),
    take: PIPELINE_COLUMN_SIZE,
  });
}

export type LeadFilters = {
  page?: string;
  stage?: string;
  source?: string;
  /** Temperatura del asistente IA: HOT, WARM o COLD. */
  temp?: string;
  q?: string;
};

export async function getLeadsPageData(filters: LeadFilters) {
  const page = Math.max(1, Number(filters.page ?? "1") || 1);
  const query = filters.q?.trim();

  const where = {
    ...(filters.stage && filters.stage !== "all"
      ? { stage: filters.stage as LeadStage }
      : {}),
    ...(filters.source && filters.source !== "all"
      ? { source: filters.source as never }
      : {}),
    ...(filters.temp && filters.temp !== "all"
      ? { temperature: filters.temp as never }
      : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
            { phone: { contains: query } },
            { company: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      select: leadListSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.lead.count({ where }),
  ]);

  return { page, pageSize: PAGE_SIZE, leads, total };
}

export async function getLeadDetail(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      activities: { orderBy: { occurredAt: "desc" } },
      convertedClient: { select: { id: true, name: true } },
      convertedProject: { select: { id: true, name: true, slug: true } },
    },
  });
}

/** Counters for the board header and the dashboard card. */
export async function getLeadStats() {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const [newCount, staleCount, openCount, wonCount, followUpsDue] =
    await Promise.all([
      prisma.lead.count({ where: { stage: "NEW" } }),
      prisma.lead.count({
        where: { stage: "NEW", createdAt: { lt: twoHoursAgo } },
      }),
      prisma.lead.count({ where: { stage: { in: PIPELINE_STAGES } } }),
      prisma.lead.count({ where: { stage: "WON" } }),
      prisma.lead.count({
        where: {
          stage: { in: PIPELINE_STAGES },
          nextFollowUpAt: { lte: now },
        },
      }),
    ]);

  return { newCount, staleCount, openCount, wonCount, followUpsDue };
}

/** Oldest uncontacted leads, for the dashboard card. */
export async function getUncontactedLeads(limit = 5) {
  return prisma.lead.findMany({
    where: { stage: "NEW" },
    select: leadListSelect,
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}
