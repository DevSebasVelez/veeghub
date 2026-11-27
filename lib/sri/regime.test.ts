import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSriRegime, rimpeLegend } from "@/lib/sri/regime";

describe("SRI regime", () => {
  it("writes each regime's contribuyenteRimpe legend as the ficha does", () => {
    assert.equal(rimpeLegend("RIMPE_NEGOCIO_POPULAR"), "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE");
    assert.equal(rimpeLegend("RIMPE_EMPRENDEDOR"), "CONTRIBUYENTE RÉGIMEN RIMPE");
    assert.equal(rimpeLegend("GENERAL"), null);
  });

  it("only accepts known regimes", () => {
    assert.ok(isSriRegime("RIMPE_EMPRENDEDOR"));
    assert.ok(!isSriRegime("RIMPE Negocio Popular"));
    assert.ok(!isSriRegime(null));
  });
});
