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
  createdAt: true,
} as const;

export async function getPipelineLeads() {
  const leads = await prisma.lead.findMany({
    where: { stage: { in: PIPELINE_STAGES } },
    select: leadListSelect,
    orderBy: [{ stage: "asc" }, { createdAt: "desc" }],
  });

  const byStage = new Map<LeadStage, typeof leads>();

  for (const stage of PIPELINE_STAGES) {
    byStage.set(stage, []);
  }

  for (const lead of leads) {
    byStage.get(lead.stage)?.push(lead);
  }

  return PIPELINE_STAGES.map((stage) => ({
    stage,
    leads: byStage.get(stage) ?? [],
  }));
}

export type LeadFilters = {
  page?: string;
  stage?: string;
  source?: string;
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
