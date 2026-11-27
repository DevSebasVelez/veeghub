// Smoke test against the SRI TEST environment (celcer) only.
//
// Builds a USD 1.00 factura to consumidor final from emission point 001-002
// (PRUEBAS), signs it, sends it to reception and asks for its authorization.
// Run by hand, never in CI:
//
//   npx tsx scripts/sri-smoke.ts     # signs with the .p12 uploaded in VeegHub
//
// or, to try a file before uploading it, SRI_P12_PATH and SRI_P12_PASSWORD in
// .env (never on the command line, where the shell history keeps it).
//
// It prints the SRI's answer and where the signed XML was saved; it never
// prints the password or the file.

import "dotenv/config";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

import prisma from "@/lib/db/prisma";
import { dayKeyInAppZone } from "@/lib/admin/format";
import { buildInvoiceXml } from "@/lib/sri/build-invoice";
import { getSriTaxContext, takeSequential } from "@/lib/sri/emission";
import { SRI_EMITTER } from "@/lib/sri/emitter";
import { signInvoiceWith, signStoredInvoice } from "@/lib/sri/signing";
import { fetchAuthorization, sendToReception } from "@/lib/sri/ws";

// Fixed on purpose. This script must never be able to reach production.
const ENVIRONMENT = "PRUEBAS" as const;
const POINT_ID = "ep_001_002_pruebas";

function filePassword() {
  const password = process.env.SRI_P12_PASSWORD;
  if (!password) throw new Error("Con SRI_P12_PATH hace falta SRI_P12_PASSWORD en .env.");
  return password;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const today = dayKeyInAppZone(new Date());
  const tax = await getSriTaxContext(new Date(`${today}T00:00:00.000Z`));

  const point = await prisma.$transaction((tx) => takeSequential(tx, POINT_ID, ENVIRONMENT));
  const vatCode = tax.vatRates.includes(0) ? "0" : "4";
  const built = buildInvoiceXml({
    environment: ENVIRONMENT,
    emitter: SRI_EMITTER,
    rimpeLegend: tax.legend,
    allowedVatRates: tax.vatRates,
    establishment: point.establishment,
    emissionPoint: point.emissionPoint,
    sequential: point.sequential,
    issueDay: today,
    buyer: { idType: "07", id: "9999999999999", name: "CONSUMIDOR FINAL" },
    items: [{ code: "PRUEBA", description: "Prueba de integración VeegHub", quantity: "1", unitPrice: "1", vatCode }],
    payments: [{ method: "20" }],
    additionalInfo: [{ name: "Nota", value: "Documento de prueba sin validez tributaria" }],
  });
  console.log(`Factura ${built.number} · clave ${built.accessKey} · total ${built.totalCents / 100}`);
  console.log(`Régimen: ${tax.regime} · leyenda: ${tax.legend ?? "(ninguna)"}`);

  const p12Path = process.env.SRI_P12_PATH?.replace(/^~(?=\/)/, homedir());
  const signed = p12Path
    ? signInvoiceWith(built.xml, readFileSync(p12Path), filePassword())
    : await signStoredInvoice(built.xml, {
        accessKey: built.accessKey,
        environment: ENVIRONMENT,
        purpose: "smoke-test",
      });
  console.log(`Firmada con ${p12Path ? "el archivo indicado" : "la firma guardada en VeegHub"}.`);

  const out = path.join(tmpdir(), `veeghub-sri-smoke-${built.accessKey}.xml`);
  writeFileSync(out, signed);
  console.log(`XML firmado: ${out}`);

  if (spawnSync("xmllint", ["--version"]).status === 0) {
    const xsd = path.join(process.cwd(), "lib/sri/xsd/factura_V1.1.0.xsd");
    execFileSync("xmllint", ["--noout", "--schema", xsd, out], { stdio: "inherit" });
  }

  const reception = await sendToReception(signed, ENVIRONMENT);
  console.log(`Recepción: ${reception.state}`);
  for (const m of reception.messages) console.log(`  [${m.id}] ${m.text}${m.detail ? ` — ${m.detail}` : ""}`);
  if (reception.state !== "RECIBIDA") return;

  for (const wait of [3000, 5000, 10000]) {
    await sleep(wait);
    const auth = await fetchAuthorization(built.accessKey, ENVIRONMENT);
    if (!auth.found) {
      console.log("Autorización: aún sin respuesta, reintentando…");
      continue;
    }
    console.log(`Autorización: ${auth.status}`);
    const details = [...auth.xml.matchAll(/<identificador>(.*?)<\/identificador>\s*<mensaje>(.*?)<\/mensaje>(?:\s*<informacionAdicional>(.*?)<\/informacionAdicional>)?/g)];
    for (const [, id, text, extra] of details) console.log(`  [${id}] ${text}${extra ? ` — ${extra}` : ""}`);
    if (auth.status !== "EN PROCESO") return;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
