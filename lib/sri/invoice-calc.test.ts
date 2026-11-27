import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SriBuildError, computeInvoiceTotals, vatOptions } from "@/lib/sri/invoice-calc";

describe("invoice arithmetic shared by the screen and the XML", () => {
  it("rounds each line once and IVA per rate on the summed base", () => {
    const totals = computeInvoiceTotals(
      [
        { description: "Desarrollo", quantity: "3", unitPrice: "33.333333", vatCode: "4" },
        { description: "Hosting", quantity: "1", unitPrice: "10", discount: "1.5", vatCode: "4" },
        { description: "Dominio", quantity: "1", unitPrice: "12", vatCode: "0" },
      ],
      [0, 15],
    );
    assert.deepEqual(
      totals.lines.map((l) => [l.baseCents, l.vatCents]),
      [
        [10000, 1500],
        [850, 128],
        [1200, 0],
      ],
    );
    assert.deepEqual(
      totals.taxes.map((t) => [t.vatCode, t.baseCents, t.valueCents]),
      [
        ["4", 10850, 1628],
        ["0", 1200, 0],
      ],
    );
    assert.equal(totals.subtotalCents, 12050);
    assert.equal(totals.discountCents, 150);
    assert.equal(totals.totalCents, 13678);
  });

  it("names the item that fails", () => {
    assert.throws(
      () => computeInvoiceTotals([{ description: "X", quantity: "1", unitPrice: "1", vatCode: "4" }], [0]),
      (error: unknown) => error instanceof SriBuildError && error.message.startsWith("Ítem 1"),
    );
    assert.throws(() => computeInvoiceTotals([], [0]), SriBuildError);
  });

  it("offers the profile's rates plus no objeto and exento under 0 %", () => {
    assert.deepEqual(
      vatOptions([0]).map((o) => o.code),
      ["0", "6", "7"],
    );
    assert.deepEqual(
      vatOptions([0, 15]).map((o) => o.code),
      ["4", "0", "6", "7"],
    );
  });
});
