import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { renderRide, rideTotals } from "@/lib/pdf/ride";
import { buildInvoiceXml } from "@/lib/sri/build-invoice";
import { SRI_EMITTER } from "@/lib/sri/emitter";
import { parseSriInvoiceXml } from "@/lib/sri/invoice-xml";
import { rimpeLegend } from "@/lib/sri/regime";

const MIXED = buildInvoiceXml({
  environment: "PRUEBAS",
  emitter: SRI_EMITTER,
  rimpeLegend: rimpeLegend("RIMPE_EMPRENDEDOR"),
  allowedVatRates: [0, 15],
  establishment: "001",
  emissionPoint: "002",
  sequential: 77,
  issueDay: "2026-11-27",
  buyer: { idType: "04", id: "0102030405001", name: "EMPRESA DE EJEMPLO" },
  items: [
    { description: "Desarrollo", quantity: "1", unitPrice: "1200", vatCode: "4" },
    { description: "Soporte", quantity: "2.5", unitPrice: "40", discount: "10", vatCode: "4" },
    { description: "Dominio", quantity: "1", unitPrice: "35", vatCode: "0" },
    { description: "Reembolso", quantity: "1", unitPrice: "5", vatCode: "6" },
  ],
  payments: [{ method: "20" }],
}).xml;

describe("RIDE", () => {
  it("breaks the totals down by IVA rate like Anexo 2", () => {
    const lines = Object.fromEntries(rideTotals(parseSriInvoiceXml(MIXED)).map((l) => [l.label, l.cents]));
    assert.deepEqual(lines, {
      "Subtotal 15 %": 129000,
      "Subtotal 0 %": 3500,
      "Subtotal no objeto de IVA": 500,
      "Subtotal exento de IVA": 0,
      "Subtotal sin impuestos": 133000,
      "Total descuento": 1000,
      "IVA 15 %": 19350,
      Propina: 0,
      "Valor total": 152350,
    });
  });

  it("prints only the 0 % lines for a Negocio Popular invoice", () => {
    const real = readFileSync(path.join(process.cwd(), "lib/sri/fixtures/factura-sri-facturador.xml"), "utf8");
    const labels = rideTotals(parseSriInvoiceXml(real)).map((l) => l.label);
    assert.ok(!labels.some((l) => /15/.test(l)));
    assert.equal(labels.at(-1), "Valor total");
  });

  it("renders a PDF, authorized or as a preview", async () => {
    const authorized = await renderRide(MIXED, { kind: "authorized", authorizedAt: new Date("2026-11-27T21:40:00Z") });
    const preview = await renderRide(MIXED, { kind: "preview" });
    for (const pdf of [authorized, preview]) {
      assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
      assert.ok(pdf.length > 10_000);
    }
  });
});
