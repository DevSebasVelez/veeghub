import assert from "node:assert/strict";
import { test } from "node:test";

import { websiteSourceFor } from "./assets";

test("websiteSourceFor mapea las imágenes de industria al sitio", () => {
  const source = websiteSourceFor("marketing/industrias/manufactura/planta-3d-recorrido.webp");
  assert.equal(source?.url, "https://veegsoft.com/industrias/manufactura/planta-3d-recorrido.webp");
  assert.equal(source?.mime, "image/webp");
  assert.equal(source?.kind, "RENDER_3D");
  assert.deepEqual(source?.tags, ["industria:manufactura", "render"]);
  assert.equal(websiteSourceFor("marketing/industrias/seguros/visor-3d.webp")?.kind, "CAPTURA");
});

test("websiteSourceFor ignora lo que no es público ni seguro", () => {
  assert.equal(websiteSourceFor("marketing/linkedin-lanzamiento/veegsoft-industrias-1.jpg"), null);
  assert.equal(websiteSourceFor("marketing/industrias/../secret.webp"), null);
  assert.equal(websiteSourceFor("marketing/industrias/a/b.svg"), null);
});
