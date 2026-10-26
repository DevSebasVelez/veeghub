import assert from "node:assert/strict";
import { test } from "node:test";

import { readConversation, readInsights, readWebOrigin } from "./ficha";

test("readInsights descarta formas inválidas y vacíos", () => {
  assert.equal(readInsights(null), null);
  assert.equal(readInsights(["x"]), null);

  const insights = readInsights({ necesidad: " ERP ", plazo: "", urgencia: 3 });
  assert.equal(insights?.necesidad, "ERP");
  assert.equal(insights?.plazo, null);
  assert.equal(insights?.urgencia, null);
});

test("readConversation conserva sólo turnos válidos", () => {
  const turns = readConversation([
    { role: "user", text: "Hola" },
    { role: "system", text: "x" },
    { role: "assistant", text: "  " },
    "basura",
    { role: "assistant", text: "¿En qué te ayudo?" },
  ]);
  assert.deepEqual(turns, [
    { role: "user", text: "Hola" },
    { role: "assistant", text: "¿En qué te ayudo?" },
  ]);
});

test("readWebOrigin devuelve null sin datos de origen", () => {
  assert.equal(readWebOrigin({ name: "Ana" }), null);

  const origin = readWebOrigin({
    sourcePath: "/servicios/ecommerce",
    attribution: { utm_source: "google", gclid: "abc" },
  });
  assert.equal(origin?.sourcePath, "/servicios/ecommerce");
  assert.equal(origin?.utmSource, "google");
  assert.equal(origin?.googleAdsClick, true);
});
