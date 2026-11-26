import prisma from "@/lib/db/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { parseLocalDateTime } from "@/lib/admin/schemas";
import { GUIDELINE_SEEDS } from "@/lib/marketing/guidelines-seed";
import { parsePostsIndustrias } from "@/lib/marketing/import-industrias";
import { imageDimensions, websiteSourceFor } from "@/lib/marketing/assets";
import { uploadToR2 } from "@/lib/storage/r2";
import type { ImportedIdea } from "@/lib/marketing/ideas-import";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Brings a library image the schedule needs from veegsoft.com into this
 * deployment's R2, under the same key `scripts/import-assets.ts` uses — so
 * production can be loaded from the UI without its secrets on a laptop.
 * Returns the new asset id, or null when the image is not public or fails.
 */
async function fetchWebsiteAsset(r2Key: string) {
  const source = websiteSourceFor(r2Key);
  if (!source) return null;

  try {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(15000) });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) return null;

    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > MAX_IMAGE_BYTES) return null;

    await uploadToR2({ key: r2Key, body, contentType: source.mime });
    const asset = await prisma.contentAsset.upsert({
      where: { r2Key },
      create: {
        kind: source.kind,
        name: source.name,
        r2Key,
        mime: source.mime,
        size: body.length,
        ...(await imageDimensions(body)),
        tags: source.tags,
      },
      update: {},
      select: { id: true },
    });

    return asset.id;
  } catch (error) {
    console.error("[marketing] no se pudo traer", source.url, error);
    return null;
  }
}

/** Runs `task` over `items` with at most `limit` at a time. */
async function inBatches<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    results.push(...(await Promise.all(items.slice(i, i + limit).map(task))));
  }
  return results;
}

/**
 * Creates the guideline keys that are missing. Existing rows are left alone —
 * once seeded, the database is the source and edits made in the UI win.
 */
export async function seedBrandGuidelines() {
  const result = await prisma.brandGuideline.createMany({
    data: GUIDELINE_SEEDS.map((seed) => ({
      key: seed.key,
      title: seed.title,
      content: seed.content,
      position: seed.position,
    })),
    skipDuplicates: true,
  });

  return { created: result.count, total: GUIDELINE_SEEDS.length };
}

export type ImportResult = {
  campaignId: string;
  created: number;
  skipped: number;
  /** Images brought from veegsoft.com during this import. */
  fetchedAssets: number;
  /** Library images the file names that are not uploaded yet. */
  missingAssets: string[];
};

/**
 * Imports `posts-industrias.md` into the «Lanzamiento industrias» campaign.
 *
 * Idempotent by (campaign, channel, title): a post already imported is never
 * touched again, so running it twice — or after editing a post in VeegHub —
 * loses nothing. Images are linked when they are already in the library
 * (`scripts/import-assets.ts`) or, with `fetchMissingAssets`, brought from
 * veegsoft.com; whatever still misses is reported, not invented.
 */
export async function importPostsIndustrias(
  markdown: string,
  { fetchMissingAssets = false }: { fetchMissingAssets?: boolean } = {},
): Promise<ImportResult> {
  const parsed = parsePostsIndustrias(markdown);

  const campaign = await prisma.contentCampaign.upsert({
    where: { slug: parsed.slug },
    create: {
      name: parsed.name,
      slug: parsed.slug,
      objective:
        "Dar a conocer las 9 páginas de industria con un post semanal en LinkedIn y GBP.",
      startsOn: parsed.startsOn ? new Date(`${parsed.startsOn}T00:00:00.000Z`) : null,
      endsOn: parsed.endsOn ? new Date(`${parsed.endsOn}T00:00:00.000Z`) : null,
    },
    update: {},
  });

  const [existing, assets] = await Promise.all([
    prisma.contentPost.findMany({
      where: { campaignId: campaign.id },
      select: { channel: true, title: true },
    }),
    prisma.contentAsset.findMany({
      where: { r2Key: { in: parsed.posts.flatMap((post) => post.assetKeys) } },
      select: { id: true, r2Key: true },
    }),
  ]);

  const seen = new Set(existing.map((post) => `${post.channel}|${post.title}`));
  const assetIds = new Map(assets.map((asset) => [asset.r2Key, asset.id]));

  let fetchedAssets = 0;
  if (fetchMissingAssets) {
    const wanted = [
      ...new Set(
        parsed.posts
          .filter((post) => !seen.has(`${post.channel}|${post.title}`))
          .flatMap((post) => post.assetKeys)
          .filter((key) => !assetIds.has(key)),
      ),
    ];
    const ids = await inBatches(wanted, 6, fetchWebsiteAsset);
    wanted.forEach((key, index) => {
      const id = ids[index];
      if (id) {
        assetIds.set(key, id);
        fetchedAssets += 1;
      }
    });
  }
  const missing = new Set<string>();

  let created = 0;
  let skipped = 0;

  for (const post of parsed.posts) {
    if (seen.has(`${post.channel}|${post.title}`)) {
      skipped += 1;
      continue;
    }

    const scheduledAt = post.scheduledLocal
      ? parseLocalDateTime(post.scheduledLocal)
      : null;
    const linked = post.assetKeys.flatMap((key) => {
      const id = assetIds.get(key);
      if (!id) missing.add(key);
      return id ? [id] : [];
    });

    await prisma.contentPost.create({
      data: {
        campaignId: campaign.id,
        channel: post.channel,
        status: post.status,
        title: post.title,
        body: post.body,
        firstComment: post.firstComment,
        linkUrl: post.linkUrl,
        scheduledAt,
        publishedAt: post.status === "PUBLICADO" ? scheduledAt : null,
        externalUrl: post.externalUrl,
        // Already out: no reminder should ever fire for it.
        reminderSentAt: post.status === "PUBLICADO" ? scheduledAt : null,
        dueNotifiedAt: post.status === "PUBLICADO" ? scheduledAt : null,
        assets: {
          create: linked.map((assetId, position) => ({ assetId, position })),
        },
      },
    });

    created += 1;
  }

  return {
    campaignId: campaign.id,
    created,
    skipped,
    fetchedAssets,
    missingAssets: [...missing],
  };
}

// ─── Banco de ideas (F2) ────────────────────────────────────────────────────

export type IdeasImportResult = { created: number; updated: number; total: number };

/**
 * Upserts parsed ideas by (source, legacyId). Re-importing refreshes the
 * script (beats, prompt, stats) but never the progress made in VeegHub:
 * stage, notes, tags and published URL stay as they are, and a script
 * edited in VeegHub (editedAt) keeps its text.
 */
export async function importIdeas(ideas: ImportedIdea[]): Promise<IdeasImportResult> {
  const known = (
    await prisma.contentIdea.findMany({
      where: { source: { in: [...new Set(ideas.map((idea) => idea.source))] } },
      select: { source: true, legacyId: true, editedAt: true },
    })
  ).map((row) => [`${row.source}#${row.legacyId}`, row.editedAt] as const);
  const existing = new Set(known.map(([key]) => key));
  // A script edited in VeegHub wins over the HTML: only the labels refresh.
  const edited = new Set(known.filter(([, editedAt]) => editedAt).map(([key]) => key));

  let created = 0;
  for (const idea of ideas) {
    const content = {
      title: idea.title,
      sector: idea.sector,
      category: idea.category,
      format: idea.format,
      priority: idea.priority,
      audience: idea.audience,
      beats: idea.beats,
      visualPrompt: idea.visualPrompt,
      meta: (idea.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      words: idea.words,
      seconds: idea.seconds,
    };

    await prisma.contentIdea.upsert({
      where: { source_legacyId: { source: idea.source, legacyId: idea.legacyId } },
      create: { ...content, source: idea.source, legacyId: idea.legacyId, notes: idea.notes },
      update: edited.has(`${idea.source}#${idea.legacyId}`)
        ? { sector: content.sector, category: content.category, format: content.format, priority: content.priority, audience: content.audience }
        : content,
    });
    if (!existing.has(`${idea.source}#${idea.legacyId}`)) created += 1;
  }

  return { created, updated: ideas.length - created, total: ideas.length };
}
