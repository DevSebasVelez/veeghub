import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkBuyerId, checkCedula, checkRuc, guessBuyerIdType } from "@/lib/sri/identification";

describe("Ecuadorian identification", () => {
  it("accepts a valid cédula and rejects a wrong check digit", () => {
    assert.deepEqual(checkCedula("0104885694"), { ok: true, warning: null });
    assert.equal(checkCedula("0104885695").ok, false);
    assert.equal(checkCedula("0102030405").ok, false);
  });

  it("rejects cédulas with a bad shape, province or third digit", () => {
    assert.equal(checkCedula("010488569").ok, false);
    assert.equal(checkCedula("2504885694").ok, false);
    assert.equal(checkCedula("0164885694").ok, false);
  });

  it("checks a persona natural RUC as cédula + establishment", () => {
    assert.deepEqual(checkRuc("0104885694001"), { ok: true, warning: null });
    assert.equal(checkRuc("0104885695001").ok, false);
    assert.equal(checkRuc("0104885694000").ok, false);
  });

  it("checks sociedad RUCs with módulo 11, warning instead of failing", () => {
    assert.deepEqual(checkRuc("1790016919001"), { ok: true, warning: null });
    assert.deepEqual(checkRuc("1760001550001"), { ok: true, warning: null });
    const odd = checkRuc("1790016918001");
    assert.equal(odd.ok, true);
    assert.ok(odd.ok && odd.warning);
    assert.equal(checkRuc("1770016919001").ok, false);
  });

  it("checks by buyer type", () => {
    assert.equal(checkBuyerId("07", "9999999999999").ok, true);
    assert.equal(checkBuyerId("07", "0104885694").ok, false);
    assert.equal(checkBuyerId("06", "AB123456").ok, true);
    assert.equal(checkBuyerId("05", "0104885694001").ok, false);
  });

  it("guesses the type from a stored taxId", () => {
    assert.equal(guessBuyerIdType("0104885694001"), "04");
    assert.equal(guessBuyerIdType("0104885694"), "05");
    assert.equal(guessBuyerIdType(null), "07");
    assert.equal(guessBuyerIdType("AB123"), "06");
  });
});
