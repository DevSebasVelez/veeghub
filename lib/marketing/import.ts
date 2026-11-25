import prisma from "@/lib/db/prisma";
import { parseLocalDateTime } from "@/lib/admin/schemas";
import { GUIDELINE_SEEDS } from "@/lib/marketing/guidelines-seed";
import { parsePostsIndustrias } from "@/lib/marketing/import-industrias";

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
  /** Library images the file names that are not uploaded yet. */
  missingAssets: string[];
};

/**
 * Imports `posts-industrias.md` into the «Lanzamiento industrias» campaign.
 *
 * Idempotent by (campaign, channel, title): a post already imported is never
 * touched again, so running it twice — or after editing a post in VeegHub —
 * loses nothing. Images are linked when they are already in the library
 * (`scripts/import-assets.ts`); the missing ones are reported, not invented.
 */
export async function importPostsIndustrias(markdown: string): Promise<ImportResult> {
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
    missingAssets: [...missing],
  };
}
