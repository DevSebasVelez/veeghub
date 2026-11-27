import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { isValidAccessKey, parseAccessKey } from "@/lib/sri/access-key";
import {
  type BuildInvoiceInput,
  SriBuildError,
  buildInvoiceXml,
  randomNumericCode,
  vatCodeForRate,
} from "@/lib/sri/build-invoice";
import { SRI_EMITTER } from "@/lib/sri/emitter";
import { parseSriInvoiceXml } from "@/lib/sri/invoice-xml";
import { rimpeLegend } from "@/lib/sri/regime";

// Real invoice of May 2026 from the SRI facturador (buyer anonymized,
// signature removed). Rebuilding it from its data must give the same XML.
const REAL = readFileSync(path.join(process.cwd(), "lib/sri/fixtures/factura-sri-facturador.xml"), "utf8");
const REAL_KEY = "1305202601010488569400120010010000000016329301616";

/** Same document, formatting aside: no declaration, comments or indentation. */
function canonical(xml: string) {
  return xml
    .replace(/^<\?xml[^>]*\?>/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s+<\//g, "</")
    .trim();
}

const MAY: BuildInvoiceInput = {
  environment: "PRODUCCION",
  emitter: SRI_EMITTER,
  rimpeLegend: rimpeLegend("RIMPE_NEGOCIO_POPULAR"),
  allowedVatRates: [0],
  establishment: "001",
  emissionPoint: "001",
  sequential: 1,
  issueDay: "2026-05-13",
  numericCode: "63293016",
  buyer: {
    idType: "05",
    id: "0102030405",
    name: "CLIENTE DE PRUEBA S.A.",
    address: "AV. DE PRUEBA 1-23",
  },
  items: [
    {
      code: "AV001",
      description: "PRODUCCION Y POSTPRODUCCION AUDIOVISUAL ANIMACION 3D Y EFECTOS VISUALES",
      quantity: "1",
      unitPrice: "1",
      vatCode: "0",
    },
  ],
  payments: [{ method: "01" }],
  additionalInfo: [{ name: "Email", value: "cliente@example.com" }],
};

const TEST_15: BuildInvoiceInput = {
  ...MAY,
  environment: "PRUEBAS",
  rimpeLegend: rimpeLegend("RIMPE_EMPRENDEDOR"),
  allowedVatRates: [0, 15],
  emissionPoint: "002",
  sequential: 7,
  issueDay: "2026-11-27",
  numericCode: "12345678",
  buyer: { idType: "04", id: "0102030405001", name: "CLIENTE & ASOCIADOS <PRUEBA>" },
  items: [
    { code: "DEV", description: "Desarrollo módulo A", quantity: "3", unitPrice: "0.333333", vatCode: "4" },
    { description: "Soporte mensual", quantity: "2.5", unitPrice: "40", discount: "10", vatCode: "4" },
    { description: "Dominio (exento)", quantity: "1", unitPrice: "12.99", vatCode: "0" },
  ],
  payments: [{ method: "20" }],
  additionalInfo: [],
};

describe("SRI factura builder", () => {
  it("golden: rebuilds the real May invoice exactly (signature aside)", () => {
    const built = buildInvoiceXml(MAY);
    assert.equal(built.accessKey, REAL_KEY);
    assert.equal(built.number, "001-001-000000001");
    assert.equal(canonical(built.xml), canonical(REAL));
  });

  it("round-trips through the reader with matching totals and a valid clave", () => {
    const built = buildInvoiceXml(TEST_15);
    const read = parseSriInvoiceXml(built.xml);

    assert.ok(isValidAccessKey(built.accessKey));
    assert.equal(read.accessKey, built.accessKey);
    assert.equal(read.environment, "PRUEBAS");
    assert.equal(read.number, "001-002-000000007");
    assert.equal(read.issueDay, "2026-11-27");
    assert.equal(read.emitter.rimpeLegend, "CONTRIBUYENTE RÉGIMEN RIMPE");
    assert.equal(read.buyer.name, "CLIENTE & ASOCIADOS <PRUEBA>");
    assert.equal(read.subtotalCents, built.subtotalCents);
    assert.equal(read.discountCents, built.discountCents);
    assert.equal(read.vatCents, built.vatCents);
    assert.equal(read.totalCents, built.totalCents);
    assert.equal(read.items.length, 3);
  });

  it("computes lines in cents with exact six-decimal products", () => {
    const built = buildInvoiceXml(TEST_15);
    // 3 × 0.333333 = 0.999999 → 1.00
    assert.equal(built.lines[0].baseCents, 100);
    assert.equal(built.lines[0].unitPrice, "0.333333");
    // 2.5 × 40 = 100.00 − 10 discount
    assert.equal(built.lines[1].baseCents, 9000);
    assert.equal(built.lines[1].quantity, "2.5");
    assert.equal(built.lines[2].baseCents, 1299);

    // IVA 15 % per rate on the summed base: 91.00 × 15 % = 13.65
    assert.deepEqual(
      built.taxes.map((t) => [t.vatCode, t.baseCents, t.valueCents]),
      [
        ["4", 9100, 1365],
        ["0", 1299, 0],
      ],
    );
    assert.equal(built.subtotalCents, 10399);
    assert.equal(built.discountCents, 1000);
    assert.equal(built.totalCents, 10399 + 1365);
    assert.match(built.xml, /<tarifa>15\.0<\/tarifa>/);
    assert.match(built.xml, /<descuento>10<\/descuento>/);
    assert.match(built.xml, /<totalDescuento>10\.00<\/totalDescuento>/);
  });

  it("rounds IVA half up on the summed base, not line by line", () => {
    // Two lines of 0.10 at 15 %: per line 0.015 → 0.02 each (0.04),
    // on the sum 0.20 × 15 % = 0.03. The total uses the sum.
    const built = buildInvoiceXml({
      ...TEST_15,
      items: [
        { description: "a", quantity: "1", unitPrice: "0.10", vatCode: "4" },
        { description: "b", quantity: "1", unitPrice: "0.10", vatCode: "4" },
      ],
    });
    assert.deepEqual(built.lines.map((l) => l.vatCents), [2, 2]);
    assert.equal(built.vatCents, 3);
    assert.equal(built.totalCents, 23);
  });

  it("writes the legend each regime needs and leaves it out for régimen general", () => {
    const np = buildInvoiceXml(MAY).xml;
    assert.match(np, /<contribuyenteRimpe>CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE<\/contribuyenteRimpe>/);
    const general = buildInvoiceXml({ ...MAY, rimpeLegend: rimpeLegend("GENERAL") }).xml;
    assert.doesNotMatch(general, /contribuyenteRimpe/);
  });

  it("escapes text and keeps nodes in XSD order", () => {
    const xml = buildInvoiceXml(TEST_15).xml;
    assert.match(xml, /<razonSocialComprador>CLIENTE &amp; ASOCIADOS &lt;PRUEBA&gt;<\/razonSocialComprador>/);
    assert.doesNotMatch(xml, /direccionComprador/);
    assert.doesNotMatch(xml, /infoAdicional/);
    const order = ["fechaEmision", "obligadoContabilidad", "tipoIdentificacionComprador", "razonSocialComprador",
      "identificacionComprador", "totalSinImpuestos", "totalDescuento", "totalConImpuestos", "propina",
      "importeTotal", "moneda", "pagos"].map((tag) => xml.indexOf(`<${tag}>`));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
  });

  it("pins the environment into the clave", () => {
    assert.equal(parseAccessKey(buildInvoiceXml(TEST_15).accessKey)?.environment, "PRUEBAS");
    assert.equal(parseAccessKey(buildInvoiceXml(MAY).accessKey)?.environment, "PRODUCCION");
  });

  it("refuses an IVA rate the tax profile does not allow", () => {
    assert.throws(
      () => buildInvoiceXml({ ...MAY, items: [{ ...MAY.items[0], vatCode: "4" }] }),
      (e) => e instanceof SriBuildError && /15 %/.test(e.message),
    );
  });

  it("refuses malformed amounts, ids and payments", () => {
    const bad = (patch: Partial<BuildInvoiceInput>) => () => buildInvoiceXml({ ...MAY, ...patch });
    const item = MAY.items[0];
    assert.throws(bad({ items: [{ ...item, quantity: "0" }] }), SriBuildError);
    assert.throws(bad({ items: [{ ...item, unitPrice: "1.1234567" }] }), SriBuildError);
    assert.throws(bad({ items: [{ ...item, unitPrice: "-1" }] }), SriBuildError);
    assert.throws(bad({ items: [{ ...item, discount: "2" }] }), SriBuildError);
    assert.throws(bad({ items: [{ ...item, description: "  " }] }), SriBuildError);
    assert.throws(bad({ items: [] }), SriBuildError);
    assert.throws(bad({ buyer: { ...MAY.buyer, id: "123" } }), SriBuildError);
    assert.throws(bad({ buyer: { idType: "07", id: "0102030405", name: "CONSUMIDOR FINAL" } }), SriBuildError);
    assert.throws(bad({ payments: [{ method: "01", totalCents: 50 }] }), SriBuildError);
    assert.throws(bad({ payments: [] }), SriBuildError);
    assert.throws(bad({ sequential: 0 }), SriBuildError);
    assert.throws(bad({ sequential: 1_000_000_000 }), SriBuildError);
  });

  it("caps consumidor final invoices at USD 50", () => {
    const consumer = { idType: "07" as const, id: "9999999999999", name: "CONSUMIDOR FINAL" };
    assert.doesNotThrow(() =>
      buildInvoiceXml({ ...MAY, buyer: consumer, items: [{ ...MAY.items[0], unitPrice: "50" }] }),
    );
    assert.throws(
      () => buildInvoiceXml({ ...MAY, buyer: consumer, items: [{ ...MAY.items[0], unitPrice: "50.01" }] }),
      /USD 50/,
    );
  });

  it("splits a total across several payment methods", () => {
    const built = buildInvoiceXml({
      ...MAY,
      items: [{ ...MAY.items[0], unitPrice: "100" }],
      payments: [
        { method: "20", totalCents: 6000 },
        { method: "01", totalCents: 4000 },
      ],
    });
    assert.equal((built.xml.match(/<pago>/g) ?? []).length, 2);
  });

  it("draws 8-digit numeric codes and maps rates to codes", () => {
    for (let i = 0; i < 50; i += 1) assert.match(randomNumericCode(), /^\d{8}$/);
    assert.equal(vatCodeForRate(0), "0");
    assert.equal(vatCodeForRate(15), "4");
    assert.equal(vatCodeForRate(5), "5");
    assert.equal(vatCodeForRate(8), null);
  });
});
