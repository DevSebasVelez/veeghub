// B4 campaign against the SRI TEST environment (celcer). Run by hand:
//
//   npx tsx scripts/sri-campaign.ts
//   SRI_CAMPAIGN_ONLY=3,4 npx tsx scripts/sri-campaign.ts   # some cases
//
// Each case creates a real issued invoice (PRUEBAS, point 001-002, USD 1.00 to
// consumidor final) for the client «Cliente de pruebas SRI» and runs the
// state machine. Needs the .p12 uploaded in VeegHub. The production guard is
// checked with fake services that fail if anything tries to send.

import "dotenv/config";
import assert from "node:assert/strict";

import prisma from "@/lib/db/prisma";
import { dayKeyInAppZone } from "@/lib/admin/format";
import { type IssueDeps, advanceInvoice, createIssuedInvoice } from "@/lib/sri/issue";
import { signStoredInvoice } from "@/lib/sri/signing";
import { queryAuthorization, sendToReception } from "@/lib/sri/ws";

const POINT = "ep_001_002_pruebas";
const today = dayKeyInAppZone(new Date());

const realDeps: IssueDeps = {
  sign: (xml, inv) =>
    signStoredInvoice(xml, { accessKey: inv.accessKey, environment: inv.environment, invoiceId: inv.id, purpose: "campaign" }),
  send: sendToReception,
  query: queryAuthorization,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

async function testClient() {
  const existing = await prisma.client.findFirst({ where: { name: "Cliente de pruebas SRI" } });
  return existing ?? prisma.client.create({ data: { name: "Cliente de pruebas SRI", notes: "Facturas de pruebas (celcer). Sin validez tributaria." } });
}

async function draft(
  clientId: string,
  emissionPointId = POINT,
  environment: "PRUEBAS" | "PRODUCCION" = "PRUEBAS",
  issueDay = today,
) {
  return createIssuedInvoice({
    clientId,
    emissionPointId,
    environment,
    issueDay,
    buyer: { idType: "07", id: "9999999999999", name: "CONSUMIDOR FINAL" },
    items: [{ code: "PRUEBA", description: "Prueba de emisión VeegHub", quantity: "1", unitPrice: "1", vatCode: "0" }],
    payments: [{ method: "20" }],
    additionalInfo: [{ name: "Nota", value: "Documento de prueba sin validez tributaria" }],
  });
}

async function tamper(id: string, from: string, to: string) {
  const row = await prisma.invoice.findUniqueOrThrow({ where: { id } });
  assert.ok(row.sriXml?.includes(from), `no encuentro ${from}`);
  await prisma.invoice.update({ where: { id }, data: { sriXml: row.sriXml!.replace(from, to) } });
}

async function state(id: string) {
  const row = await prisma.invoice.findUniqueOrThrow({
    where: { id },
    include: { sriSubmissions: { orderBy: { createdAt: "asc" } } },
  });
  return row;
}

const results: Array<[string, string, string]> = [];
async function run(name: string, fn: () => Promise<string>) {
  const only = process.env.SRI_CAMPAIGN_ONLY;
  if (only && !only.split(",").some((n) => name.startsWith(`${n}.`))) return;
  process.stdout.write(`▶ ${name}… `);
  try {
    const detail = await fn();
    results.push([name, "OK", detail]);
    console.log(`OK — ${detail}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push([name, "FALLÓ", message]);
    console.log(`FALLÓ — ${message}`);
  }
}

async function main() {
  const client = await testClient();
  let authorizedId = "";

  await run("1. Autorizada", async () => {
    const inv = await draft(client.id);
    const r = await advanceInvoice(inv.id, realDeps);
    assert.ok(!r.busy);
    assert.equal(r.status, "AUTHORIZED", r.problem ?? "");
    const row = await state(inv.id);
    assert.ok(row.authorizedAt && row.sriAuthorizedXml?.includes("AUTORIZADO"));
    authorizedId = inv.id;
    return `${inv.invoiceNumber} autorizada ${row.authorizedAt.toISOString()}`;
  });

  await run("2. Clave repetida (43) se trata como recibida", async () => {
    assert.ok(authorizedId, "depende del caso 1");
    // Pretend the first send was lost: back to SIGNED with no attempts, so the
    // machine sends the same bytes again.
    await prisma.invoice.update({
      where: { id: authorizedId },
      data: { sriStatus: "SIGNED", sriAttempts: 0, authorizedAt: null, sriAuthorizedXml: null },
    });
    const r = await advanceInvoice(authorizedId, realDeps);
    assert.ok(!r.busy);
    assert.equal(r.status, "AUTHORIZED", r.problem ?? "");
    const row = await state(authorizedId);
    const reception = row.sriSubmissions.filter((s) => s.operation === "RECEPTION").at(-1)!;
    assert.equal(reception.status, "DEVUELTA");
    assert.match(JSON.stringify(reception.messages), /"43"/);
    return "recepción DEVUELTA [43] → autorización → AUTHORIZED, sin documento nuevo";
  });

  await run("3. Devuelta por estructura (XSD)", async () => {
    const inv = await draft(client.id);
    await tamper(inv.id, "<moneda>DOLAR</moneda>", "<moneda>DOLAR</moneda><campoInventado>x</campoInventado>");
    const r = await advanceInvoice(inv.id, realDeps);
    assert.ok(!r.busy);
    assert.equal(r.status, "RETURNED", r.problem ?? "");
    return r.problem ?? "";
  });

  await run("4. Cálculos que no cuadran: VeegHub los frena antes de firmar", async () => {
    // celcer does not check arithmetic (2026-11-27 it authorized a USD 2.00
    // total over a USD 1.00 base, a 1 × 5.00 line declared as 1.00, a 40-day
    // old date and an invalid cédula), so error 52 cannot be produced there.
    // VeegHub's self-check is what stops it; nothing reaches the SRI.
    const inv = await draft(client.id);
    await tamper(inv.id, "<importeTotal>1.00</importeTotal>", "<importeTotal>2.00</importeTotal>");
    const r = await advanceInvoice(inv.id, realDeps);
    assert.ok(!r.busy);
    assert.equal(r.status, "DRAFT");
    assert.match(r.problem ?? "", /Revisión interna/);
    assert.equal((await state(inv.id)).sriSubmissions.length, 0);
    return r.problem ?? "";
  });

  await run("5. SRI sin respuesta al enviar, luego se recupera", async () => {
    const inv = await draft(client.id);
    const timeout: IssueDeps = {
      ...realDeps,
      send: async () => {
        throw Object.assign(new Error("El SRI no respondió a tiempo."), { name: "TimeoutError" });
      },
    };
    const first = await advanceInvoice(inv.id, timeout);
    assert.ok(!first.busy);
    assert.equal(first.status, "SIGNED");
    assert.ok(first.pending);
    const second = await advanceInvoice(inv.id, realDeps);
    assert.ok(!second.busy);
    assert.equal(second.status, "AUTHORIZED", second.problem ?? "");
    const ops = (await state(inv.id)).sriSubmissions.map((s) => `${s.operation}:${s.status}`);
    // After the lost send it asked first, found nothing, then sent.
    assert.deepEqual(ops.slice(0, 3), ["RECEPTION:ERROR", "AUTHORIZATION:SIN REGISTRO", "RECEPTION:RECIBIDA"]);
    return ops.join(" → ");
  });

  await run("6. Dos procesos a la vez: uno espera", async () => {
    const inv = await draft(client.id);
    const [a, b] = await Promise.all([advanceInvoice(inv.id, realDeps), advanceInvoice(inv.id, realDeps)]);
    assert.ok(a.busy !== b.busy, "exactamente uno debía quedar ocupado");
    const done = (a.busy ? b : a) as Exclude<typeof a, { busy: true }>;
    assert.equal(done.status, "AUTHORIZED", done.problem ?? "");
    return "uno avanzó hasta AUTHORIZED, el otro devolvió busy";
  });

  await run("7. Producción bloqueada sin SRI_ALLOW_PRODUCTION", async () => {
    assert.notEqual(process.env.SRI_ALLOW_PRODUCTION, "true");
    const point = await prisma.emissionPoint.create({
      data: { establishment: "999", emissionPoint: "999", environment: "PRODUCCION", label: "temporal campaña" },
    });
    try {
      const inv = await draft(client.id, point.id, "PRODUCCION");
      const never: IssueDeps = {
        sign: async (xml) => xml,
        send: async () => assert.fail("intentó enviar a producción"),
        query: async () => assert.fail("intentó consultar producción"),
        sleep: async () => {},
      };
      const r = await advanceInvoice(inv.id, never);
      assert.ok(!r.busy);
      assert.equal(r.status, "SIGNED");
      assert.match(r.problem ?? "", /producción está deshabilitado/);
      await prisma.invoice.delete({ where: { id: inv.id } });
      return "se quedó en SIGNED sin tocar el SRI";
    } finally {
      await prisma.invoice.deleteMany({ where: { emissionPointId: point.id } });
      await prisma.emissionPoint.delete({ where: { id: point.id } });
    }
  });

  console.log("\nResumen");
  for (const [name, verdict, detail] of results) console.log(`${verdict.padEnd(6)} ${name} — ${detail}`);
  if (results.some(([, verdict]) => verdict !== "OK")) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
