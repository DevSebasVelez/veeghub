import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { afterAuthorization, afterReception, retryDelayMs } from "@/lib/sri/state";

const msg = (id: string, text = "x") => ({ id, text, detail: null, type: "ERROR" });

describe("SRI state machine rules", () => {
  it("moves to RECEIVED when the SRI takes the document", () => {
    assert.deepEqual(afterReception({ state: "RECIBIDA", messages: [] }), {
      status: "RECEIVED",
      retry: true,
      problem: null,
    });
  });

  it("treats 43 (clave registrada) and 70 (en procesamiento) as already received", () => {
    for (const id of ["43", "70"]) {
      assert.equal(afterReception({ state: "DEVUELTA", messages: [msg(id)] }).status, "RECEIVED");
    }
  });

  it("stops at RETURNED with the SRI's reasons for anything else", () => {
    const d = afterReception({
      state: "DEVUELTA",
      messages: [{ id: "35", text: "ARCHIVO NO CUMPLE ESTRUCTURA XML", detail: "moneda", type: "ERROR" }],
    });
    assert.equal(d.status, "RETURNED");
    assert.equal(d.retry, false);
    assert.match(d.problem!, /\[35\] ARCHIVO NO CUMPLE ESTRUCTURA XML — moneda/);
    // 43 together with another error is not "already there".
    assert.equal(afterReception({ state: "DEVUELTA", messages: [msg("43"), msg("35")] }).status, "RETURNED");
  });

  it("keeps a document SIGNED when reception did not answer", () => {
    const d = afterReception(null, "El SRI no respondió a tiempo.");
    assert.equal(d.status, "SIGNED");
    assert.equal(d.retry, true);
    assert.match(d.problem!, /antes de reenviar/);
  });

  it("finishes on AUTORIZADO and NO AUTORIZADO", () => {
    const ok = afterAuthorization({ state: "AUTORIZADO", authorizedAt: "x", messages: [], xml: "<a/>" }, "RECEIVED");
    assert.deepEqual([ok.status, ok.retry], ["AUTHORIZED", false]);
    const no = afterAuthorization(
      { state: "NO AUTORIZADO", authorizedAt: null, messages: [msg("52", "ERROR EN DIFERENCIAS")], xml: "<a/>" },
      "RECEIVED",
    );
    assert.deepEqual([no.status, no.retry], ["NOT_AUTHORIZED", false]);
    assert.match(no.problem!, /\[52\] ERROR EN DIFERENCIAS/);
  });

  it("after an uncertain send, sends again only if the SRI has no record", () => {
    const none = { state: null, authorizedAt: null, messages: [], xml: null };
    assert.equal(afterAuthorization(none, "SIGNED").send, true);
    assert.equal(afterAuthorization(none, "RECEIVED").send, undefined);
    assert.equal(afterAuthorization(none, "RECEIVED").status, "RECEIVED");
  });

  it("waits while the SRI is processing or silent", () => {
    const busy = afterAuthorization({ state: "EN PROCESO", authorizedAt: null, messages: [], xml: "<a/>" }, "RECEIVED");
    assert.deepEqual([busy.status, busy.retry], ["RECEIVED", true]);
    const silent = afterAuthorization(null, "RECEIVED", "timeout");
    assert.deepEqual([silent.status, silent.retry], ["RECEIVED", true]);
  });

  it("backs off between retries", () => {
    assert.deepEqual([1, 2, 3, 6, 7, 20].map(retryDelayMs), [30e3, 60e3, 120e3, 1800e3, 3600e3, 3600e3]);
  });
});
