import type { AssetKindValue } from "@/lib/marketing/constants";

/** Public site the industry images are served from. */
export const WEBSITE_URL = "https://veegsoft.com";

const INDUSTRIAS = /^marketing\/industrias\/([a-z0-9-]+)\/([a-z0-9-]+)\.(webp|jpe?g|png)$/;

export const IMAGE_MIME: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

/** Kind and tags of an industry image, from its file name. */
export function classifyIndustryImage(slug: string, base: string): {
  kind: AssetKindValue;
  tags: string[];
} {
  const tags = [`industria:${slug}`];
  if (/escena-3d|-3d-recorrido/.test(base)) return { kind: "RENDER_3D", tags: [...tags, "render"] };
  if (base.startsWith("visor")) return { kind: "CAPTURA", tags: [...tags, "visor"] };
  if (base === "movil") return { kind: "CAPTURA", tags: [...tags, "app"] };
  return { kind: "CAPTURA", tags: [...tags, "pantalla"] };
}

/**
 * Where an industry image of the library lives on the public site, or null
 * for keys that are not industry images (the launch carousel is not public).
 * veegsoft-web serves `public/industrias/<slug>/<file>` at `/industrias/…`,
 * the same layout the library keys mirror.
 */
export function websiteSourceFor(r2Key: string) {
  const match = r2Key.match(INDUSTRIAS);
  if (!match) return null;

  const [, slug, base, ext] = match;
  return {
    url: `${WEBSITE_URL}/industrias/${slug}/${base}.${ext}`,
    mime: IMAGE_MIME[ext],
    name: `${slug} · ${base}.${ext}`,
    ...classifyIndustryImage(slug, base),
  };
}

/** Width and height when sharp is available; never fails the import. */
export async function imageDimensions(buffer: Buffer) {
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buffer).metadata();
    return { width: meta.width ?? null, height: meta.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}
