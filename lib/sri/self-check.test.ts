import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildInvoiceXml } from "@/lib/sri/build-invoice";
import { SRI_EMITTER } from "@/lib/sri/emitter";
import { rimpeLegend } from "@/lib/sri/regime";
import { selfCheckInvoiceXml } from "@/lib/sri/self-check";

const built = buildInvoiceXml({
  environment: "PRUEBAS",
  emitter: SRI_EMITTER,
  rimpeLegend: rimpeLegend("RIMPE_EMPRENDEDOR"),
  allowedVatRates: [0, 15],
  establishment: "001",
  emissionPoint: "002",
  sequential: 9,
  issueDay: "2026-11-27",
  buyer: { idType: "04", id: "0102030405001", name: "CLIENTE" },
  items: [
    { description: "A", quantity: "3", unitPrice: "0.333333", vatCode: "4" },
    { description: "B", quantity: "2.5", unitPrice: "40", discount: "10", vatCode: "4" },
  ],
  payments: [{ method: "20" }],
});
const expected = { accessKey: built.accessKey, environment: "PRUEBAS" as const };

describe("self-check before sending", () => {
  it("passes what the builder made", () => {
    assert.deepEqual(selfCheckInvoiceXml(built.xml, expected), []);
  });

  it("catches a total that does not add up (celcer would authorize it)", () => {
    const xml = built.xml.replace(/<importeTotal>[^<]+</, "<importeTotal>999.00<");
    assert.match(selfCheckInvoiceXml(xml, expected).join(" "), /total no cuadra/);
  });

  it("catches a line whose arithmetic is wrong", () => {
    const xml = built.xml.replace("<precioUnitario>40</precioUnitario>", "<precioUnitario>41</precioUnitario>");
    assert.match(selfCheckInvoiceXml(xml, expected).join(" "), /Ítem 2: cantidad × precio/);
  });

  it("catches another clave or environment", () => {
    assert.match(
      selfCheckInvoiceXml(built.xml, { ...expected, accessKey: "1".repeat(49) }).join(" "),
      /clave del XML/,
    );
    assert.match(
      selfCheckInvoiceXml(built.xml, { ...expected, environment: "PRODUCCION" }).join(" "),
      /ambiente del XML/,
    );
  });

  it("reports unreadable XML instead of throwing", () => {
    assert.equal(selfCheckInvoiceXml("<nada/>", expected).length, 1);
  });
});
