/**
 * Seeds the brand guidelines and imports the industries schedule into the
 * marketing calendar. Run `npm run mkt:assets` first so the posts get their
 * images. Idempotent: existing guidelines and posts are left untouched.
 *
 *   npm run mkt:import
 *   npm run mkt:import -- --file=/ruta/a/posts-industrias.md
 */
import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import prisma from "@/lib/db/prisma";
import { importPostsIndustrias, seedBrandGuidelines } from "@/lib/marketing/import";

const file = path.resolve(
  process.argv.find((arg) => arg.startsWith("--file="))?.slice(7) ??
    "../veegsoft-web/docs/marketing/posts-industrias.md",
);

async function main() {
  const guidelines = await seedBrandGuidelines();
  console.log(`Directrices: ${guidelines.created} nuevas de ${guidelines.total}.`);

  const result = await importPostsIndustrias(await readFile(file, "utf8"));
  console.log(`Posts: ${result.created} creados, ${result.skipped} ya existían.`);

  if (result.missingAssets.length) {
    console.warn(`Faltan ${result.missingAssets.length} imágenes en la biblioteca (corre npm run mkt:assets):`);
    result.missingAssets.forEach((key) => console.warn("  ·", key));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
