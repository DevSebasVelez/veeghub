/**
 * Uploads the marketing images of veegsoft-web to R2 and registers them in
 * the library (`ContentAsset`):
 *
 *   public/industrias/<slug>/*.webp            → marketing/industrias/<slug>/…
 *   docs/marketing/linkedin-lanzamiento/*.jpg  → marketing/linkedin-lanzamiento/…
 *
 * Idempotent by R2 key: a file already in the library is skipped, so it can
 * run again after new renders land. Uses DATABASE_URL and the R2 variables of
 * .env — point them at production to load production.
 *
 *   npm run mkt:assets                       # ../veegsoft-web
 *   npm run mkt:assets -- --web=/ruta/a/veegsoft-web --dry-run
 */
import "dotenv/config";

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import prisma from "@/lib/db/prisma";
import { uploadToR2 } from "@/lib/storage/r2";
import type { AssetKindValue } from "@/lib/marketing/constants";
import { classifyIndustryImage, imageDimensions } from "@/lib/marketing/assets";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const webRoot = path.resolve(
  args.find((arg) => arg.startsWith("--web="))?.slice(6) ?? "../veegsoft-web",
);

const MIME: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

type Candidate = {
  file: string;
  r2Key: string;
  name: string;
  kind: AssetKindValue;
  tags: string[];
  alt: string | null;
};

async function listImages(dir: string) {
  try {
    return (await readdir(dir)).filter((file) => MIME[path.extname(file).toLowerCase()]).sort();
  } catch {
    return [];
  }
}

async function candidates(): Promise<Candidate[]> {
  const list: Candidate[] = [];
  const industrias = path.join(webRoot, "public/industrias");

  for (const slug of (await readdir(industrias)).sort()) {
    const dir = path.join(industrias, slug);
    if (!(await stat(dir)).isDirectory()) continue;

    for (const file of await listImages(dir)) {
      const base = path.basename(file, path.extname(file));
      list.push({
        file: path.join(dir, file),
        r2Key: `marketing/industrias/${slug}/${file}`,
        name: `${slug} · ${file}`,
        ...classifyIndustryImage(slug, base),
        alt: null,
      });
    }
  }

  const launch = path.join(webRoot, "docs/marketing/linkedin-lanzamiento");
  for (const file of await listImages(launch)) {
    list.push({
      file: path.join(launch, file),
      r2Key: `marketing/linkedin-lanzamiento/${file}`,
      name: `lanzamiento · ${file}`,
      kind: "IMAGEN",
      tags: ["lanzamiento", "carrusel", "linkedin", "industrias"],
      alt: "Slide del carrusel de lanzamiento de las 9 industrias",
    });
  }

  return list;
}

async function main() {
  const all = await candidates();
  const existing = new Set(
    (
      await prisma.contentAsset.findMany({
        where: { r2Key: { in: all.map((c) => c.r2Key) } },
        select: { r2Key: true },
      })
    ).map((row) => row.r2Key),
  );
  const pending = all.filter((c) => !existing.has(c.r2Key));

  console.log(`${all.length} imágenes en ${webRoot}; ${existing.size} ya están, ${pending.length} por subir.`);
  if (dryRun) {
    pending.forEach((c) => console.log("  ·", c.r2Key, c.kind, c.tags.join(",")));
    return;
  }

  let done = 0;
  for (const candidate of pending) {
    const body = await readFile(candidate.file);
    const mime = MIME[path.extname(candidate.file).toLowerCase()];

    await uploadToR2({ key: candidate.r2Key, body, contentType: mime });
    await prisma.contentAsset.create({
      data: {
        kind: candidate.kind,
        name: candidate.name,
        r2Key: candidate.r2Key,
        mime,
        size: body.length,
        ...(await imageDimensions(body)),
        tags: candidate.tags,
        alt: candidate.alt,
      },
    });

    done += 1;
    console.log(`  ✓ ${done}/${pending.length} ${candidate.r2Key}`);
  }

  console.log(`Listo: ${done} subidas.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
