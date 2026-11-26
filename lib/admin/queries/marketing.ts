import prisma from "@/lib/db/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import {
  dayKeyInAppZone,
  formatDate,
  localDateTimeInAppZone,
  timeInAppZone,
} from "@/lib/admin/format";
import { getR2DownloadUrl } from "@/lib/storage/r2";
import {
  OPEN_STATUSES,
  type AssetKindValue,
  type ContentChannelValue,
  type ContentStatusValue,
} from "@/lib/marketing/constants";
import { dayKeyStart, scheduleWindow } from "@/lib/marketing/schedule";
import { readBeats, type Beat } from "@/lib/marketing/ideas-import";

// ─── DTOs (plain, client-safe; dates already resolved in Ecuador) ───────────

export type PostCardDTO = {
  id: string;
  title: string;
  channel: ContentChannelValue;
  status: ContentStatusValue;
  campaignName: string | null;
  /** "yyyy-MM-dd" in Ecuador, null when unscheduled. */
  dayKey: string | null;
  /** "HH:mm" in Ecuador. */
  time: string | null;
  whenLabel: string;
  assetCount: number;
  /** First image, for the row thumbnail. */
  coverAssetId: string | null;
};

export type AssetDTO = {
  id: string;
  kind: AssetKindValue;
  name: string;
  r2Key: string;
  mime: string;
  size: number | null;
  width: number | null;
  height: number | null;
  tags: string[];
  alt: string | null;
  /** Signed GET, valid 5 minutes. */
  url: string | null;
  usedIn: number;
};

export type PostDetailDTO = {
  id: string;
  title: string;
  channel: ContentChannelValue;
  status: ContentStatusValue;
  body: string;
  firstComment: string | null;
  linkUrl: string | null;
  campaignId: string | null;
  campaignSlug: string | null;
  /** "yyyy-MM-ddTHH:mm" in Ecuador. */
  scheduledLocal: string | null;
  scheduledLabel: string | null;
  publishedLabel: string | null;
  approvedLabel: string | null;
  externalUrl: string | null;
  error: string | null;
  assets: AssetDTO[];
};

const CARD_SELECT = {
  id: true,
  title: true,
  channel: true,
  status: true,
  scheduledAt: true,
  campaign: { select: { name: true } },
  _count: { select: { assets: true } },
  assets: {
    where: { asset: { mime: { startsWith: "image/" } } },
    orderBy: { position: "asc" },
    take: 1,
    select: { assetId: true },
  },
} satisfies Prisma.ContentPostSelect;

type CardRow = Prisma.ContentPostGetPayload<{ select: typeof CARD_SELECT }>;

function toCard(row: CardRow): PostCardDTO {
  return {
    id: row.id,
    title: row.title,
    channel: row.channel,
    status: row.status,
    campaignName: row.campaign?.name ?? null,
    dayKey: row.scheduledAt ? dayKeyInAppZone(row.scheduledAt) : null,
    time: row.scheduledAt ? timeInAppZone(row.scheduledAt) : null,
    whenLabel: row.scheduledAt ? formatDate(row.scheduledAt) : "Sin fecha",
    assetCount: row._count.assets,
    coverAssetId: row.assets[0]?.assetId ?? null,
  };
}

async function signed(key: string) {
  try {
    return await getR2DownloadUrl(key);
  } catch (error) {
    // Missing R2 variables in a dev setup must not take the page down.
    console.error("[marketing] no se pudo firmar", key, error);
    return null;
  }
}

// ─── Calendar ───────────────────────────────────────────────────────────────

export async function getPostsInRange(start: Date, end: Date, channel?: ContentChannelValue) {
  const rows = await prisma.contentPost.findMany({
    where: { scheduledAt: { gte: start, lt: end }, ...(channel ? { channel } : {}) },
    select: CARD_SELECT,
    orderBy: [{ scheduledAt: "asc" }, { channel: "asc" }, { title: "asc" }],
  });

  return rows.map(toCard);
}

export async function getUnscheduledPosts(channel?: ContentChannelValue) {
  const rows = await prisma.contentPost.findMany({
    where: {
      scheduledAt: null,
      status: { in: OPEN_STATUSES },
      ...(channel ? { channel } : {}),
    },
    select: CARD_SELECT,
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return rows.map(toCard);
}

/** «Hoy toca publicar»: today's open posts plus any overdue one still waiting. */
export async function getTodayPosts(now = new Date()) {
  const window = scheduleWindow(now);
  const rows = await prisma.contentPost.findMany({
    where: {
      OR: [
        {
          scheduledAt: { gte: window.todayStart, lt: window.tomorrowStart },
          status: { in: OPEN_STATUSES },
        },
        // Alerted but not marked as published yet, from any earlier day.
        { status: { in: ["PROGRAMADO", "FALLIDO"] }, scheduledAt: { lt: window.todayStart } },
      ],
    },
    select: CARD_SELECT,
    orderBy: { scheduledAt: "asc" },
    take: 10,
  });

  return rows.map(toCard);
}

export async function getCampaignOptions() {
  return prisma.contentCampaign.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Post ───────────────────────────────────────────────────────────────────

export async function getPostDetail(id: string): Promise<PostDetailDTO | null> {
  const post = await prisma.contentPost.findUnique({
    where: { id },
    include: {
      campaign: { select: { slug: true } },
      assets: {
        orderBy: { position: "asc" },
        include: { asset: { include: { _count: { select: { posts: true } } } } },
      },
    },
  });

  if (!post) return null;

  const assets = await Promise.all(
    post.assets.map(async ({ asset }) => ({
      ...assetFields(asset),
      url: await signed(asset.r2Key),
    })),
  );

  return {
    id: post.id,
    title: post.title,
    channel: post.channel,
    status: post.status,
    body: post.body,
    firstComment: post.firstComment,
    linkUrl: post.linkUrl,
    campaignId: post.campaignId,
    campaignSlug: post.campaign?.slug ?? null,
    scheduledLocal: post.scheduledAt ? localDateTimeInAppZone(post.scheduledAt) : null,
    scheduledLabel: post.scheduledAt ? formatDate(post.scheduledAt) : null,
    publishedLabel: post.publishedAt ? formatDate(post.publishedAt) : null,
    approvedLabel: post.approvedAt ? formatDate(post.approvedAt) : null,
    externalUrl: post.externalUrl,
    error: post.error,
    assets,
  };
}

// ─── Library ────────────────────────────────────────────────────────────────

function assetFields(asset: {
  id: string;
  kind: AssetKindValue;
  name: string;
  r2Key: string;
  mime: string;
  size: number | null;
  width: number | null;
  height: number | null;
  tags: string[];
  alt: string | null;
  _count: { posts: number };
}) {
  return {
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    r2Key: asset.r2Key,
    mime: asset.mime,
    size: asset.size,
    width: asset.width,
    height: asset.height,
    tags: asset.tags,
    alt: asset.alt,
    usedIn: asset._count.posts,
  };
}

export type AssetFilters = {
  q?: string;
  kind?: AssetKindValue;
  tag?: string;
};

export async function getAssets(filters: AssetFilters = {}, take = 120): Promise<AssetDTO[]> {
  const q = filters.q?.trim();
  const where: Prisma.ContentAssetWhereInput = {
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.tag ? { tags: { has: filters.tag } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { alt: { contains: q, mode: "insensitive" } },
            { tags: { has: q.toLowerCase() } },
          ],
        }
      : {}),
  };

  const rows = await prisma.contentAsset.findMany({
    where,
    include: { _count: { select: { posts: true } } },
    orderBy: [{ createdAt: "desc" }, { name: "asc" }],
    take,
  });

  return Promise.all(
    rows.map(async (row) => ({
      ...assetFields(row),
      url: row.mime.startsWith("image/") ? await signed(row.r2Key) : null,
    })),
  );
}

/** Every tag in use, most frequent first, for the filter. */
export async function getAssetTags() {
  const rows = await prisma.$queryRaw<{ tag: string; count: bigint }[]>`
    SELECT tag, COUNT(*) AS count
    FROM "ContentAsset", unnest(tags) AS tag
    GROUP BY tag
    ORDER BY count DESC, tag ASC
  `;

  return rows.map((row) => ({ tag: row.tag, count: Number(row.count) }));
}

// ─── Guidelines ─────────────────────────────────────────────────────────────

export async function getGuidelines() {
  return prisma.brandGuideline.findMany({
    orderBy: [{ position: "asc" }, { key: "asc" }],
  });
}

// ─── Summary ────────────────────────────────────────────────────────────────

/** KPI strip of the calendar. Every figure is a count straight from the table. */
export async function getMarketingSummary(now = new Date()) {
  const window = scheduleWindow(now);
  const weekEnd = new Date(window.todayStart.getTime() + 7 * 24 * 3600 * 1000);
  const monthKey = window.todayKey.slice(0, 7);
  const monthStart = dayKeyStart(`${monthKey}-01`);

  const [nextWeek, toApprove, waiting, publishedThisMonth, next] = await Promise.all([
    prisma.contentPost.count({
      where: {
        scheduledAt: { gte: window.todayStart, lt: weekEnd },
        status: { notIn: ["DESCARTADO"] },
      },
    }),
    prisma.contentPost.count({
      where: {
        status: { in: ["IDEA", "BORRADOR", "EN_REVISION"] },
        scheduledAt: { gte: now, lt: new Date(now.getTime() + 14 * 24 * 3600 * 1000) },
      },
    }),
    prisma.contentPost.count({ where: { status: { in: ["PROGRAMADO", "FALLIDO"] } } }),
    prisma.contentPost.count({
      where: { status: "PUBLICADO", publishedAt: { gte: monthStart } },
    }),
    prisma.contentPost.findFirst({
      where: { scheduledAt: { gte: now }, status: { in: OPEN_STATUSES } },
      select: CARD_SELECT,
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  return {
    nextWeek,
    toApprove,
    waiting,
    publishedThisMonth,
    next: next ? toCard(next) : null,
  };
}

// ─── Banco de ideas (F2) ────────────────────────────────────────────────────

export type IdeaStageValue = "IDEA" | "GUION" | "GRABADO" | "EDITADO" | "PUBLICADO" | "ARCHIVADO";

export type IdeaFilters = {
  q?: string;
  sector?: string;
  category?: string;
  stage?: IdeaStageValue;
  priority?: number;
};

export type IdeaCardDTO = {
  id: string;
  legacyId: number | null;
  title: string;
  sector: string | null;
  category: string | null;
  format: string | null;
  stage: IdeaStageValue;
  priority: number | null;
  seconds: number | null;
  /** First beat, the hook, as the card's teaser. */
  hook: string;
  postCount: number;
};

export type IdeaDetailDTO = IdeaCardDTO & {
  source: string | null;
  audience: string | null;
  beats: Beat[];
  visualPrompt: string | null;
  notes: string | null;
  words: number | null;
  publishedUrl: string | null;
  alternativeHook: string | null;
  /** File 5: the motion-graphics sequence. */
  visual: string[];
  offer: string | null;
  benefit: string | null;
  posts: { id: string; title: string; status: ContentStatusValue }[];
};

const IDEA_ORDER = [{ source: "asc" }, { legacyId: "asc" }] satisfies Prisma.ContentIdeaOrderByWithRelationInput[];

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * The whole bank is ~200 rows: filtering in memory lets the text search look
 * inside the beats (JSON) without a full-text index.
 */
export async function getIdeas(filters: IdeaFilters = {}): Promise<IdeaCardDTO[]> {
  const rows = await prisma.contentIdea.findMany({
    where: {
      ...(filters.sector ? { sector: filters.sector } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.stage ? { stage: filters.stage } : { stage: { not: "ARCHIVADO" } }),
      ...(filters.priority ? { priority: filters.priority } : {}),
    },
    select: {
      id: true,
      legacyId: true,
      title: true,
      sector: true,
      category: true,
      format: true,
      stage: true,
      priority: true,
      seconds: true,
      audience: true,
      beats: true,
      _count: { select: { posts: true } },
    },
    orderBy: IDEA_ORDER,
  });

  const terms = filters.q ? normalize(filters.q).split(/\s+/).filter(Boolean) : [];

  return rows.flatMap((row) => {
    const beats = readBeats(row.beats);
    if (terms.length) {
      const haystack = normalize(
        [row.title, row.sector, row.category, row.audience, row.legacyId, ...beats.map((b) => `${b.voz} ${b.motion ?? ""}`)].join(" "),
      );
      if (!terms.every((term) => haystack.includes(term))) return [];
    }
    return [
      {
        id: row.id,
        legacyId: row.legacyId,
        title: row.title,
        sector: row.sector,
        category: row.category,
        format: row.format,
        stage: row.stage,
        priority: row.priority,
        seconds: row.seconds,
        hook: beats[0]?.voz ?? "",
        postCount: row._count.posts,
      },
    ];
  });
}

export async function getIdeaFacets() {
  const [sectors, categories, stages] = await Promise.all([
    prisma.contentIdea.groupBy({ by: ["sector"], _count: true, where: { sector: { not: null } }, orderBy: { sector: "asc" } }),
    prisma.contentIdea.groupBy({ by: ["category"], _count: true, where: { category: { not: null } }, orderBy: { category: "asc" } }),
    prisma.contentIdea.groupBy({ by: ["stage"], _count: true }),
  ]);

  return {
    sectors: sectors.map((row) => ({ value: row.sector!, count: row._count })),
    categories: categories.map((row) => ({ value: row.category!, count: row._count })),
    stages: Object.fromEntries(stages.map((row) => [row.stage, row._count])) as Partial<Record<IdeaStageValue, number>>,
  };
}

function metaText(meta: unknown, key: string) {
  const value = (meta as Record<string, unknown> | null)?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getIdeaDetail(id: string): Promise<IdeaDetailDTO | null> {
  const row = await prisma.contentIdea.findUnique({
    where: { id },
    include: {
      posts: { select: { id: true, title: true, status: true }, orderBy: { createdAt: "desc" } },
      _count: { select: { posts: true } },
    },
  });
  if (!row) return null;

  const beats = readBeats(row.beats);
  const visual = (row.meta as Record<string, unknown> | null)?.visual;

  return {
    id: row.id,
    legacyId: row.legacyId,
    title: row.title,
    sector: row.sector,
    category: row.category,
    format: row.format,
    stage: row.stage,
    priority: row.priority,
    seconds: row.seconds,
    hook: beats[0]?.voz ?? "",
    postCount: row._count.posts,
    source: row.source,
    audience: row.audience,
    beats,
    visualPrompt: row.visualPrompt,
    notes: row.notes,
    words: row.words,
    publishedUrl: row.publishedUrl,
    alternativeHook: metaText(row.meta, "alternative"),
    visual: Array.isArray(visual) ? visual.filter((item): item is string => typeof item === "string") : [],
    offer: metaText(row.meta, "offer"),
    benefit: metaText(row.meta, "benefit"),
    posts: row.posts,
  };
}

/** Previous and next idea in the bank's order, for the teleprompter and the ficha. */
export async function getIdeaNeighbors(id: string) {
  const ids = await prisma.contentIdea.findMany({
    where: { stage: { not: "ARCHIVADO" } },
    select: { id: true },
    orderBy: IDEA_ORDER,
  });
  const index = ids.findIndex((row) => row.id === id);
  return {
    prev: index > 0 ? ids[index - 1].id : null,
    next: index >= 0 && index < ids.length - 1 ? ids[index + 1].id : null,
    position: index + 1,
    total: ids.length,
  };
}
