/**
 * Imports the five «Banco de Ideas» HTML files into ContentIdea (plan F2).
 * Idempotent by (archivo, id): re-running refreshes the scripts and keeps the
 * stage and notes set in VeegHub. Production loads them from the UI
 * («Importar» in Marketing › Ideas), because its variables are Sensitive.
 *
 *   npm run mkt:ideas
 *   npm run mkt:ideas -- --dir="/ruta/a/Banco de Ideas"
 */
import "dotenv/config";

import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import prisma from "@/lib/db/prisma";
import { parseIdeasHtml } from "@/lib/marketing/ideas-import";
import { importIdeas } from "@/lib/marketing/import";

const dir = path.resolve(
  process.argv.find((arg) => arg.startsWith("--dir="))?.slice(6) ??
    path.join(homedir(), "Documents/VEEG SOFT/MARKETING/Banco de Ideas"),
);

async function main() {
  const files = (await readdir(dir)).filter((file) => /^[1-5]-.*\.html$/.test(file)).sort();
  if (!files.length) throw new Error(`No hay archivos 1-5 *.html en ${dir}`);

  for (const file of files) {
    const ideas = parseIdeasHtml(file, await readFile(path.join(dir, file), "utf8"));
    const result = await importIdeas(ideas);
    console.log(`${file}: ${result.created} nuevas, ${result.updated} actualizadas.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
