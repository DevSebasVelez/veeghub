import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { parseRideText } from "@/lib/sri/ride";

// Text of the real RIDE (buyer anonymized) as two extractors return it:
// unpdf (values before labels) and pdftotext -layout (labels before values).
const fixture = (name: string) => readFileSync(path.join(process.cwd(), "lib/sri/fixtures", name), "utf8");
const KEY = "1305202601010488569400120010010000000016329301616";

describe("parseRideText", () => {
  for (const name of ["ride-unpdf.txt", "ride-layout.txt"]) {
    it(`reads the SRI facturador RIDE (${name})`, () => {
      const ride = parseRideText(fixture(name));
      assert.ok(ride);
      assert.equal(ride.accessKey, KEY);
      assert.equal(ride.number, "001-001-000000001");
      assert.equal(ride.key.issueDay, "2026-05-13");
      assert.equal(ride.key.environment, "PRODUCCION");
      assert.equal(ride.authorizedAt, "13/05/2026 11:05:04");
      assert.equal(ride.buyer.id, "0102030405");
      assert.equal(ride.buyer.name, "CLIENTE DE PRUEBA S.A.");
      assert.equal(ride.subtotalCents, 100);
      assert.equal(ride.totalCents, 100);
      assert.equal(ride.vatRate, 0);
      assert.equal(ride.vatCents, 0);
      assert.deepEqual(ride.warnings, []);
    });
  }

  it("reads a 15% IVA invoice with thousands separators", () => {
    const text = fixture("ride-unpdf.txt")
      .replace("1.00SUBTOTAL 0%", "0.00SUBTOTAL 0%\n1,250.00SUBTOTAL 15%")
      .replace("1.00SUBTOTAL SIN IMPUESTOS", "1,250.00SUBTOTAL SIN IMPUESTOS\n187.50IVA 15%")
      .replace("1.00VALOR TOTAL", "1,437.50VALOR TOTAL");
    const ride = parseRideText(text);
    assert.equal(ride?.subtotalCents, 125000);
    assert.equal(ride?.vatCents, 18750);
    assert.equal(ride?.vatRate, 15);
    assert.equal(ride?.totalCents, 143750);
    assert.deepEqual(ride?.warnings, []);
  });

  it("returns null without a valid clave", () => {
    assert.equal(parseRideText("Un PDF cualquiera\nVALOR TOTAL 10.00"), null);
    assert.equal(parseRideText(fixture("ride-unpdf.txt").replaceAll(KEY, KEY.slice(0, 48) + "0")), null);
  });

  it("warns when the total is missing", () => {
    const ride = parseRideText(fixture("ride-unpdf.txt").replace("1.00VALOR TOTAL", ""));
    assert.equal(ride?.totalCents, null);
    assert.match(ride!.warnings.join(" "), /valor total/);
  });
});
